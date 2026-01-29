/**
 * Image Debugging Utilities for Grid3 Files
 *
 * These utilities help developers understand why images might not be resolving
 * correctly in Grid3 gridsets.
 */

import type { ZipEntry } from './password';
import { openZipFromInput } from '../../utils/zip';
import { getZipEntriesFromAdapter } from './password';
import { resolveGridsetPasswordFromEnv } from './password';
import { XMLParser } from 'fast-xml-parser';
import { decodeText } from '../../utils/io';

export interface ImageIssue {
  gridName: string;
  cellX: number;
  cellY: number;
  declaredImage: string | undefined;
  expectedPaths: string[];
  issue: 'not_found' | 'symbol_library' | 'external_reference';
  suggestion: string;
}

export interface ImageAuditResult {
  totalCells: number;
  cellsWithImages: number;
  resolvedImages: number;
  unresolvedImages: number;
  issues: ImageIssue[];
  availableImages: string[];
}

/**
 * Audit a gridset file to find image resolution issues
 *
 * @param gridsetBuffer - The gridset file as a Buffer
 * @returns Detailed audit report of image issues
 *
 * @example
 * const audit = await auditGridsetImages(gridsetBuffer);
 * console.log(`Found ${audit.unresolvedImages} unresolved images`);
 * audit.issues.forEach(issue => {
 *   console.log(`Cell (${issue.cellX}, ${issue.cellY}): ${issue.suggestion}`);
 * });
 */
export async function auditGridsetImages(
  gridsetBuffer: Uint8Array,
  password = resolveGridsetPasswordFromEnv()
): Promise<ImageAuditResult> {
  const issues: ImageIssue[] = [];
  const availableImages = new Set<string>();
  let totalCells = 0;
  let cellsWithImages = 0;
  let resolvedImages = 0;
  let unresolvedImages = 0;

  try {
    const { zip } = await openZipFromInput(gridsetBuffer);
    const entries = getZipEntriesFromAdapter(zip, password);
    const parser = new XMLParser();

    // Collect all image files in the gridset
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.emf', '.wmf'];
    for (const entry of entries) {
      const name = entry.entryName.toLowerCase();
      if (imageExtensions.some(ext => name.endsWith(ext))) {
        availableImages.add(entry.entryName);
      }
    }

    // Process each grid file
    for (const entry of entries) {
      if (!entry.entryName.startsWith('Grids/') || !entry.entryName.endsWith('grid.xml')) {
        continue;
      }

      try {
        const xmlContent = decodeText(await entry.getData());
        const data = parser.parse(xmlContent);
        const grid = data.Grid || data.grid;
        if (!grid) continue;

        const gridNameMatch = entry.entryName.match(/^Grids\/([^/]+)\//);
        const gridName = gridNameMatch ? gridNameMatch[1] : entry.entryName;

        const gridEntryPath = entry.entryName.replace(/\\/g, '/');
        const baseDir = gridEntryPath.replace(/\/grid\.xml$/, '/');

        // Check for FileMap.xml
        const fileMapEntry = entries.find((e) =>
          e.entryName === baseDir + 'FileMap.xml'
        );

        const dynamicFilesMap = new Map<string, string[]>();
        if (fileMapEntry) {
          try {
            const fmXml = decodeText(await fileMapEntry.getData());
            const fmData = parser.parse(fmXml);
            const fileEntries = fmData?.FileMap?.Entries?.Entry || fmData?.fileMap?.entries?.entry;
            if (fileEntries) {
              const arr = Array.isArray(fileEntries) ? fileEntries : [fileEntries];
              for (const ent of arr) {
                const rawStaticFile = ent['@_StaticFile'] || ent.StaticFile || ent.staticFile;
                const staticFile = typeof rawStaticFile === 'string' ? rawStaticFile.replace(/\\/g, '/') : '';
                if (!staticFile) continue;
                const df = ent.DynamicFiles || ent.dynamicFiles;
                const candidates = df?.File || df?.file || df?.Files || df?.files;
                const list = Array.isArray(candidates) ? candidates : candidates ? [candidates] : [];
                dynamicFilesMap.set(staticFile, list);
              }
            }
          } catch (e) {
            // FileMap parsing failed, continue without it
          }
        }

        // Process cells
        const cells = grid.Cells?.Cell || grid.cells?.cell;
        if (!cells) continue;

        const cellArr = Array.isArray(cells) ? cells : [cells];

        for (const cell of cellArr) {
          totalCells++;
          const content = cell.Content;
          if (!content) continue;

          const captionAndImage = content.CaptionAndImage || content.captionAndImage;
          const imageCandidate =
            captionAndImage?.Image ||
            captionAndImage?.image ||
            captionAndImage?.ImageName ||
            captionAndImage?.imageName;

          if (!imageCandidate) continue;

          cellsWithImages++;

          const cellX = Math.max(0, parseInt(String(cell['@_X'] || '1'), 10) - 1);
          const cellY = Math.max(0, parseInt(String(cell['@_Y'] || '1'), 10) - 1);

          // Try to resolve the image
          const imageName = String(imageCandidate).trim();
          const imageFound = availableImages.has(`${baseDir}${imageName}`) ||
                           availableImages.has(`${baseDir}Images/${imageName}`);

          if (imageFound) {
            resolvedImages++;
          } else {
            unresolvedImages++;

            // Determine the issue
            const expectedPaths = [
              `${baseDir}${imageName}`,
              `${baseDir}Images/${imageName}`,
              `${baseDir}${cellX + 1}-${cellY + 1}-0-text-0.png`,
              `${baseDir}${cellX + 1}-${cellY + 1}.png`,
            ];

            let issue: ImageIssue['issue'];
            let suggestion: string;

            if (imageName.startsWith('[')) {
              // Check if it's a symbol library reference
              if (imageName.includes('widgit') || imageName.includes('Widgit')) {
                issue = 'symbol_library';
                suggestion = 'This is a Widgit symbol library reference. These symbols are not stored in the gridset - they require the Widgit Symbols to be installed on the system.';
              } else if (imageName.includes('grid3x') || imageName.includes('Grid3')) {
                issue = 'external_reference';
                suggestion = 'This is a built-in Grid3 resource reference. These images are not included in the gridset file.';
              } else {
                issue = 'symbol_library';
                suggestion = `External symbol library reference: ${imageName}. Symbol libraries are not embedded in gridset files.`;
              }
            } else {
              issue = 'not_found';
              const similarImages = Array.from(availableImages).filter(img =>
                img.toLowerCase().includes(imageName.toLowerCase().substring(0, 10))
              );
              if (similarImages.length > 0) {
                suggestion = `Image not found. Did you mean one of these?\n  ${similarImages.slice(0, 3).join('\n  ')}`;
              } else {
                suggestion = `Image file not found in gridset. The file may have been excluded or the path is incorrect.`;
              }
            }

            issues.push({
              gridName,
              cellX: cellX + 1,
              cellY: cellY + 1,
              declaredImage: imageName,
              expectedPaths,
              issue,
              suggestion,
            });
          }
        }
      } catch (e) {
        // Skip grids that can't be processed
        continue;
      }
    }

    return {
      totalCells,
      cellsWithImages,
      resolvedImages,
      unresolvedImages,
      issues,
      availableImages: Array.from(availableImages).sort(),
    };
  } catch (error: any) {
    throw new Error(`Failed to audit gridset images: ${error.message}`);
  }
}

/**
 * Get a human-readable summary of image audit results
 */
export function formatImageAuditSummary(audit: ImageAuditResult): string {
  const lines: string[] = [];

  lines.push('=== Grid3 Image Audit Summary ===');
  lines.push(`Total cells: ${audit.totalCells}`);
  lines.push(`Cells with images: ${audit.cellsWithImages}`);
  lines.push(`Resolved images: ${audit.resolvedImages}`);
  lines.push(`Unresolved images: ${audit.unresolvedImages}`);
  lines.push(`Available image files: ${audit.availableImages.length}`);
  lines.push('');

  if (audit.issues.length > 0) {
    lines.push('=== Image Issues ===');

    // Group by issue type
    const byType = new Map<ImageIssue['issue'], ImageIssue[]>();
    for (const issue of audit.issues) {
      const list = byType.get(issue.issue) || [];
      list.push(issue);
      byType.set(issue.issue, list);
    }

    for (const [type, issues] of byType) {
      lines.push(`\n${type.toUpperCase()} (${issues.length} occurrences):`);
      for (const issue of issues.slice(0, 5)) { // Show first 5 of each type
        lines.push(`  [${issue.gridName}] Cell (${issue.cellX}, ${issue.cellY}): ${issue.declaredImage}`);
        lines.push(`    → ${issue.suggestion}`);
      }
      if (issues.length > 5) {
        lines.push(`  ... and ${issues.length - 5} more`);
      }
    }
  }

  return lines.join('\n');
}
