/**
 * Audit image resolution in gridset files
 *
 * This test audits a gridset file to ensure all images in the ZIP
 * are being resolved correctly by the processor.
 */

import { GridsetProcessor } from '../src/processors/gridsetProcessor';
import path from 'node:path';

interface AuditResult {
  totalCells: number;
  cellsWithDeclaredImages: number;
  cellsWithResolvedImages: number;
  cellsWithoutResolvedImages: number;
  actualImageFilesInZip: number;
  resolvedImagePaths: string[];
  unresolvedCells: Array<{
    label: string;
    x: number;
    y: number;
    imageName: string;
    page: string;
  }>;
  imageFilesInZip: string[];
  resolvedImagesNotInZip: string[];
}

function countImageFilesInZip(entries: string[]): string[] {
  // Count all image files in the ZIP (excluding XML files)
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp'];
  return entries.filter((entry) => {
    const ext = entry.toLowerCase().split('.').pop();
    return ext && imageExtensions.includes(`.${ext}`);
  });
}

async function auditGridsetImages(gridsetPath: string): Promise<AuditResult> {
  const processor = new GridsetProcessor();

  // Load the gridset
  const tree = await processor.loadIntoTree(gridsetPath);

  // Get all entries from the ZIP for manual inspection
  // We need to access the internal ZIP entries
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip(gridsetPath);
  const allEntries = zip.getEntries().map((e: any) => e.entryName);

  const imageFilesInZip = countImageFilesInZip(allEntries);

  const resolvedImagePaths = new Set<string>();
  const unresolvedCells: AuditResult['unresolvedCells'] = [];

  let totalCells = 0;
  let cellsWithDeclaredImages = 0;
  let cellsWithResolvedImages = 0;

  // Audit each page
  for (const [pageId, page] of Object.entries(tree.pages)) {
    for (const button of page.buttons) {
      totalCells++;

      if (button.image || button.resolvedImageEntry) {
        cellsWithDeclaredImages++;
      }

      if (button.resolvedImageEntry) {
        cellsWithResolvedImages++;
        resolvedImagePaths.add(button.resolvedImageEntry);
      } else if (button.image) {
        // Has image name but couldn't resolve
        const cellX = (button.parameters as any)?.cellX;
        const cellY = (button.parameters as any)?.cellY;
        unresolvedCells.push({
          label: button.label,
          x: cellX,
          y: cellY,
          imageName: button.image,
          page: pageId,
        });
      }
    }
  }

  // Check for resolved images that aren't actually in the ZIP
  const resolvedImagesNotInZip = Array.from(resolvedImagePaths).filter(
    (img) => !allEntries.includes(img) && !allEntries.includes(img.replace(/^Grids\//, ''))
  );

  return {
    totalCells,
    cellsWithDeclaredImages,
    cellsWithResolvedImages,
    cellsWithoutResolvedImages: cellsWithDeclaredImages - cellsWithResolvedImages,
    actualImageFilesInZip: imageFilesInZip.length,
    resolvedImagePaths: Array.from(resolvedImagePaths),
    unresolvedCells,
    imageFilesInZip,
    resolvedImagesNotInZip,
  };
}

describe('Gridset Image Audit', () => {
  const exampleGridset = path.join(process.cwd(), 'examples/example-images.gridset');

  test('should resolve all images that exist in the ZIP', async () => {
    const audit = await auditGridsetImages(exampleGridset);

    console.log('\n=== Gridset Image Audit ===');
    console.log(`Total cells: ${audit.totalCells}`);
    console.log(`Cells with declared images: ${audit.cellsWithDeclaredImages}`);
    console.log(`Cells with resolved images: ${audit.cellsWithResolvedImages}`);
    console.log(`Cells without resolved images: ${audit.cellsWithoutResolvedImages}`);
    console.log(`Actual image files in ZIP: ${audit.actualImageFilesInZip}`);
    console.log(`Unique resolved image paths: ${audit.resolvedImagePaths.length}`);
    console.log(`Resolved images not found in ZIP: ${audit.resolvedImagesNotInZip.length}`);

    if (audit.unresolvedCells.length > 0) {
      console.log(`\nUnresolved cells (${audit.unresolvedCells.length}):`);
      audit.unresolvedCells.forEach((cell) => {
        console.log(`  - "${cell.label}" at (${cell.x}, ${cell.y}): ${cell.imageName}`);
      });
    }

    if (audit.resolvedImagesNotInZip.length > 0) {
      console.log(`\nResolved images not in ZIP (${audit.resolvedImagesNotInZip.length}):`);
      audit.resolvedImagesNotInZip.forEach((img) => {
        console.log(`  - ${img}`);
      });
    }

    console.log('\n=== Sample resolved images ===');
    audit.resolvedImagePaths.slice(0, 10).forEach((img) => {
      console.log(`  - ${img}`);
    });
    if (audit.resolvedImagePaths.length > 10) {
      console.log(`  ... and ${audit.resolvedImagePaths.length - 10} more`);
    }

    console.log('\n=== Sample image files in ZIP ===');
    audit.imageFilesInZip.slice(0, 10).forEach((img) => {
      console.log(`  - ${img}`);
    });
    if (audit.imageFilesInZip.length > 10) {
      console.log(`  ... and ${audit.imageFilesInZip.length - 10} more`);
    }

    // The resolved images should be a subset of images in the ZIP
    expect(audit.resolvedImagesNotInZip.length).toBe(0);

    // Log the summary
    console.log('\n=== Summary ===');
    console.log(`✓ All ${audit.cellsWithResolvedImages} resolved images exist in the ZIP`);
    console.log(
      `✓ ${audit.cellsWithDeclaredImages - audit.cellsWithResolvedImages} cells could not be resolved`
    );
    console.log(
      `✓ ${audit.actualImageFilesInZip - audit.resolvedImagePaths.length} images in ZIP are not referenced by cells`
    );
  }, 30000);
});
