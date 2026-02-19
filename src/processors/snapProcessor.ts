import {
  BaseProcessor,
  ProcessorOptions,
  ExtractStringsResult,
  TranslatedString,
  SourceString,
} from '../core/baseProcessor';
import {
  AACTree,
  AACPage,
  AACButton,
  AACSemanticAction,
  AACSemanticCategory,
  AACSemanticIntent,
  SnapMetadata,
} from '../core/treeStructure';
import { generateCloneId } from '../utilities/analytics/utils/idGenerator';
import { SnapValidator } from '../validation/snapValidator';
import { ValidationResult } from '../validation/validationTypes';
import { ProcessorInput, getNodeRequire, isNodeRuntime } from '../utils/io';
import { openSqliteDatabase, requireBetterSqlite3 } from '../utils/sqlite';

/**
 * Convert a Buffer or Uint8Array to base64 string (browser and Node compatible)
 * Node.js Buffers support toString('base64'), but Uint8Arrays in browser do not.
 * This function works in both environments.
 */
function arrayBufferToBase64(data: Buffer | Uint8Array): string {
  // Node.js environment - Buffer has built-in base64 encoding
  if (typeof Buffer !== 'undefined' && data instanceof Buffer) {
    return data.toString('base64');
  }

  // Browser environment - use btoa with binary string conversion
  const bytes = new Uint8Array(data);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface SnapButton {
  Id: number;
  Label: string;
  Message: string | null;
  LibrarySymbolId?: number | null;
  PageSetImageId?: number | null;
  NavigatePageId: number | null;
  MessageRecordingId?: number | null;
  UseMessageRecording?: number | null;
  SerializedMessageSoundMetadata?: string | null;
  LabelColor?: number;
  BackgroundColor?: number;
  BorderColor?: number;
  BorderThickness?: number;
  FontSize?: number;
  FontFamily?: string;
  FontStyle?: number;
  Visible?: number; // 0 = hidden, 1 (or non-zero) = visible
}

/**
 * Map Snap Visible value to AAC standard visibility
 * Snap: 0 = hidden, 1 (or non-zero) = visible
 * Maps to: 'Hidden' | 'Visible' | undefined
 */
function mapSnapVisibility(visible: number | null | undefined): 'Hidden' | 'Visible' | undefined {
  if (visible === null || visible === undefined) {
    return undefined; // Default to visible
  }
  return visible === 0 ? 'Hidden' : 'Visible';
}

interface SnapPage {
  Id: number;
  Name: string;
  Buttons: SnapButton[];
  ParentId: number | null;
  BackgroundColor?: number;
}

class SnapProcessor extends BaseProcessor {
  private symbolResolver: unknown | null = null;
  private loadAudio: boolean = false;
  private pageLayoutPreference: 'largest' | 'smallest' | 'scanning' | number = 'scanning'; // Default to scanning for metrics

  constructor(
    symbolResolver: unknown | null = null,
    options?: ProcessorOptions & {
      loadAudio?: boolean;
      pageLayoutPreference?: 'largest' | 'smallest' | 'scanning' | number;
    }
  ) {
    super(options);
    this.symbolResolver = symbolResolver;
    this.loadAudio = options?.loadAudio !== undefined ? options.loadAudio : true;
    this.pageLayoutPreference =
      options?.pageLayoutPreference !== undefined ? options.pageLayoutPreference : 'scanning'; // Default to scanning
  }

  async extractTexts(filePathOrBuffer: ProcessorInput): Promise<string[]> {
    const tree = await this.loadIntoTree(filePathOrBuffer);
    const texts: string[] = [];

    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      // Include page names
      if (page.name) texts.push(page.name);

      // Include button texts
      page.buttons.forEach((btn) => {
        if (btn.label) texts.push(btn.label);
        if (btn.message && btn.message !== btn.label) texts.push(btn.message);
      });
    }

    return texts;
  }

  async loadIntoTree(filePathOrBuffer: ProcessorInput): Promise<AACTree> {
    const { writeBinaryToPath, removePath, mkTempDir, basename, join } = this.options.fileAdapter;
    await Promise.resolve();
    const tree = new AACTree();
    let dbResult: Awaited<ReturnType<typeof openSqliteDatabase>> | null = null;
    let cleanupTempZip: (() => Promise<void>) | null = null;

    try {
      // Handle .sub.zip files (Snap pageset backups containing .sps files)
      let inputFile = filePathOrBuffer;

      if (typeof filePathOrBuffer === 'string') {
        const fileName = basename(filePathOrBuffer).toLowerCase();
        if (fileName.endsWith('.sub.zip') || filePathOrBuffer.endsWith('.sub')) {
          // Extract .sub.zip to find the embedded .sps file
          const tempDir = await mkTempDir('snap-sub-');
          const zip = await this.options.zipAdapter(filePathOrBuffer);

          // Find the .sps file in the archive
          const files = zip.listFiles();
          const spsFile = files.find((f) => f.endsWith('.sps'));

          if (!spsFile) {
            await removePath(tempDir, { recursive: true, force: true });
            throw new Error('No .sps file found in .sub.zip archive');
          }

          // Extract the .sps file
          const spsData = await zip.readFile(spsFile);
          const extractedSpsPath = join(tempDir, basename(spsFile));
          await writeBinaryToPath(extractedSpsPath, Buffer.from(spsData));

          inputFile = extractedSpsPath;
          cleanupTempZip = async () => {
            await removePath(tempDir, { recursive: true, force: true });
          };
        }
      }

      dbResult = await openSqliteDatabase(inputFile, {
        readonly: true,
        fileAdapter: this.options.fileAdapter,
      });
      const db = dbResult.db;

      const getTableColumns = (tableName: string): Set<string> => {
        try {
          const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
            name: string;
          }>;
          return new Set(rows.map((row) => row.name));
        } catch {
          return new Set();
        }
      };

      // Load pages first, using UniqueId as canonical id
      const pages = db.prepare('SELECT * FROM Page').all();

      // Load PageSetProperties to find default Keyboard and Home pages
      let defaultKeyboardPageId: string | undefined;
      let defaultHomePageId: string | undefined;
      let dashboardPageId: string | undefined;
      let toolbarId: string | undefined;
      try {
        const properties = db.prepare('SELECT * FROM PageSetProperties').get();
        if (properties) {
          defaultKeyboardPageId = properties.DefaultKeyboardPageUniqueId;
          defaultHomePageId = properties.DefaultHomePageUniqueId;
          dashboardPageId = properties.DashboardUniqueId;
          toolbarId = properties.ToolBarUniqueId;

          const hasGlobalToolbar =
            toolbarId && toolbarId !== '00000000-0000-0000-0000-000000000000';

          // Store metadata in tree
          const metadata: SnapMetadata = {
            format: 'snap',
            name: properties.Name || properties.PageSetName || undefined,
            description: properties.Description || undefined,
            author: properties.Author || undefined,
            locale: properties.Locale || undefined,
            languages: properties.Locale ? [properties.Locale] : undefined,
            defaultKeyboardPageId: defaultKeyboardPageId || undefined,
            defaultHomePageId: defaultHomePageId || undefined,
            dashboardId: dashboardPageId || undefined,
            hasGlobalToolbar: !!hasGlobalToolbar,
          };
          tree.metadata = metadata;

          // Set toolbarId if there's a global toolbar
          if (hasGlobalToolbar) {
            tree.toolbarId = toolbarId || null;
            // Use defaultHomePageId as root (the content pageset), not the toolbar
            tree.rootId = defaultHomePageId || null;
          } else if (defaultHomePageId) {
            tree.rootId = defaultHomePageId;
          }
        }
      } catch (e) {
        console.warn('[SnapProcessor] Failed to load PageSetProperties:', e);
      }

      // If still no root, fallback to first page (but don't override a valid defaultHomePageId)
      if (!tree.rootId && pages.length > 0) {
        tree.rootId = String(pages[0].UniqueId || pages[0].Id);
      }

      // Map from numeric Id -> UniqueId for later lookup
      const idToUniqueId: Record<string, string> = {};
      pages.forEach((pageRow: SnapPage) => {
        const uniqueId = String((pageRow as any).UniqueId || pageRow.Id);
        idToUniqueId[String(pageRow.Id)] = uniqueId;

        const page = new AACPage({
          id: uniqueId,
          name: (pageRow as any).Title || pageRow.Name,
          grid: [],
          buttons: [],
          parentId: null, // ParentId will be set via navigation buttons below
          style: {
            backgroundColor: pageRow.BackgroundColor
              ? `#${pageRow.BackgroundColor.toString(16)}`
              : undefined,
          },
        });
        tree.addPage(page);
      });

      // Try to find toolbar page even if not set in PageSetProperties
      // Some SNAP files have a toolbar page but don't set ToolBarUniqueId
      // This must be done AFTER pages are added to the tree
      if (!tree.toolbarId || tree.toolbarId === '00000000-0000-0000-0000-000000000000') {
        const toolbarPage = Object.values(tree.pages).find((p) => {
          const name = (p.name || '').toLowerCase();
          return name === 'tool bar' || name === 'toolbar';
        });
        if (toolbarPage) {
          tree.toolbarId = toolbarPage.id;
          // Update metadata to reflect toolbar detection
          if (tree.metadata) {
            (tree.metadata as any).hasGlobalToolbar = true;
          }
        }
      }

      // Load ScanGroups for TD Snap "Group Scan" feature
      // Maps PageLayoutId -> Array of ScanGroups with their scan block numbers
      interface SnapScanGroup {
        id: number;
        scanBlock: number; // 1-based, determined by ScanGroup index within PageLayout
        positions: Array<{ Column: number; Row: number }>;
      }

      const scanGroupsByPageLayout = new Map<number, SnapScanGroup[]>();
      try {
        const scanGroupRows = db
          .prepare('SELECT Id, SerializedGridPositions, PageLayoutId FROM ScanGroup ORDER BY Id')
          .all() as {
          Id: number;
          SerializedGridPositions: string;
          PageLayoutId: number;
        }[];

        if (scanGroupRows && scanGroupRows.length > 0) {
          // Group by PageLayoutId first
          const groupsByLayout = new Map<number, any[]>();
          scanGroupRows.forEach((sg) => {
            if (!groupsByLayout.has(sg.PageLayoutId)) {
              groupsByLayout.set(sg.PageLayoutId, []);
            }
            const layoutGroups = groupsByLayout.get(sg.PageLayoutId);
            if (layoutGroups) {
              layoutGroups.push(sg);
            }
          });

          // For each PageLayout, assign scan block numbers based on order (1-based index)
          groupsByLayout.forEach((groups, layoutId) => {
            groups.forEach((sg, index) => {
              // Parse SerializedGridPositions JSON
              let positions: Array<{ Column: number; Row: number }> = [];
              try {
                positions = JSON.parse(sg.SerializedGridPositions as string);
              } catch (e) {
                // Invalid JSON, skip this group
                return;
              }

              const scanGroup: SnapScanGroup = {
                id: sg.Id,
                scanBlock: index + 1, // Scan block is 1-based index
                positions: positions,
              };

              if (!scanGroupsByPageLayout.has(layoutId)) {
                scanGroupsByPageLayout.set(layoutId, []);
              }
              const layoutGroups = scanGroupsByPageLayout.get(layoutId);
              if (layoutGroups) {
                layoutGroups.push(scanGroup);
              }
            });
          });
        }
      } catch (e) {
        // No ScanGroups table or error loading, continue without scan blocks
        console.warn('[SnapProcessor] Failed to load ScanGroups:', e);
      }

      // Load buttons per page, using UniqueId for page id
      for (const pageRow of pages) {
        // Create a map to track page grid layouts
        const pageGrids = new Map<string, Array<Array<AACButton | null>>>();

        // Select PageLayout for this page based on preference
        let selectedPageLayoutId: number | null = null;
        try {
          const pageLayouts = db
            .prepare('SELECT Id, PageLayoutSetting FROM PageLayout WHERE PageId = ?')
            .all(pageRow.Id) as { Id: number; PageLayoutSetting: string }[];

          if (pageLayouts && pageLayouts.length > 0) {
            // Parse PageLayoutSetting: "columns,rows,hasScanGroups,?"
            const layoutsWithInfo = pageLayouts.map((pl) => {
              const parts = pl.PageLayoutSetting.split(',');
              const cols = parseInt(parts[0], 10) || 0;
              const rows = parseInt(parts[1], 10) || 0;
              const hasScanning = parts[2] === 'True';
              const size = cols * rows;
              return { id: pl.Id, cols, rows, size, hasScanning };
            });

            // Select based on preference
            if (typeof this.pageLayoutPreference === 'number') {
              // Specific PageLayoutId
              selectedPageLayoutId = this.pageLayoutPreference;
            } else if (this.pageLayoutPreference === 'largest') {
              // Select layout with largest grid size, prefer layouts with ScanGroups
              layoutsWithInfo.sort((a, b) => {
                const sizeDiff = b.size - a.size;
                if (sizeDiff !== 0) return sizeDiff;
                // Same size, prefer one with ScanGroups
                const aHasScanning = scanGroupsByPageLayout.has(a.id);
                const bHasScanning = scanGroupsByPageLayout.has(b.id);
                return (bHasScanning ? 1 : 0) - (aHasScanning ? 1 : 0);
              });
              selectedPageLayoutId = layoutsWithInfo[0].id;
            } else if (this.pageLayoutPreference === 'smallest') {
              // Select layout with smallest grid size, prefer layouts with ScanGroups
              layoutsWithInfo.sort((a, b) => {
                const sizeDiff = a.size - b.size;
                if (sizeDiff !== 0) return sizeDiff;
                // Same size, prefer one with ScanGroups
                const aHasScanning = scanGroupsByPageLayout.has(a.id);
                const bHasScanning = scanGroupsByPageLayout.has(b.id);
                return (bHasScanning ? 1 : 0) - (aHasScanning ? 1 : 0);
              });
              selectedPageLayoutId = layoutsWithInfo[0].id;
            } else if (this.pageLayoutPreference === 'scanning') {
              // Select layout with scanning enabled (check against actual ScanGroups)
              const scanningLayouts = layoutsWithInfo.filter((l) =>
                scanGroupsByPageLayout.has(l.id)
              );
              if (scanningLayouts.length > 0) {
                scanningLayouts.sort((a, b) => b.size - a.size);
                selectedPageLayoutId = scanningLayouts[0].id;
              } else {
                // Fallback to largest
                layoutsWithInfo.sort((a, b) => b.size - a.size);
                selectedPageLayoutId = layoutsWithInfo[0].id;
              }
            }
          }
        } catch (e) {
          // Error selecting PageLayout, will load all buttons
          console.warn(`[SnapProcessor] Failed to select PageLayout for page ${pageRow.Id}:`, e);
        }

        // Load buttons
        let buttons: any[] = [];
        try {
          const buttonColumns = getTableColumns('Button');
          const selectFields = [
            'b.Id',
            'b.Label',
            'b.Message',
            buttonColumns.has('LibrarySymbolId') ? 'b.LibrarySymbolId' : 'NULL AS LibrarySymbolId',
            buttonColumns.has('PageSetImageId') ? 'b.PageSetImageId' : 'NULL AS PageSetImageId',
            buttonColumns.has('BorderColor') ? 'b.BorderColor' : 'NULL AS BorderColor',
            buttonColumns.has('BorderThickness') ? 'b.BorderThickness' : 'NULL AS BorderThickness',
            buttonColumns.has('FontSize') ? 'b.FontSize' : 'NULL AS FontSize',
            buttonColumns.has('FontFamily') ? 'b.FontFamily' : 'NULL AS FontFamily',
            buttonColumns.has('FontStyle') ? 'b.FontStyle' : 'NULL AS FontStyle',
            buttonColumns.has('LabelColor') ? 'b.LabelColor' : 'NULL AS LabelColor',
            buttonColumns.has('BackgroundColor') ? 'b.BackgroundColor' : 'NULL AS BackgroundColor',
            buttonColumns.has('NavigatePageId') ? 'b.NavigatePageId' : 'NULL AS NavigatePageId',
            buttonColumns.has('ContentType') ? 'b.ContentType' : 'NULL AS ContentType',
          ];

          if (this.loadAudio) {
            selectFields.push(
              buttonColumns.has('MessageRecordingId')
                ? 'b.MessageRecordingId'
                : 'NULL AS MessageRecordingId'
            );
            selectFields.push(
              buttonColumns.has('UseMessageRecording')
                ? 'b.UseMessageRecording'
                : 'NULL AS UseMessageRecording'
            );
            selectFields.push(
              buttonColumns.has('SerializedMessageSoundMetadata')
                ? 'b.SerializedMessageSoundMetadata'
                : 'NULL AS SerializedMessageSoundMetadata'
            );
          }

          const placementColumns = getTableColumns('ElementPlacement');
          const hasButtonPageLink = getTableColumns('ButtonPageLink').size > 0;

          selectFields.push(
            placementColumns.has('GridPosition') ? 'ep.GridPosition' : 'NULL AS GridPosition',
            placementColumns.has('PageLayoutId') ? 'ep.PageLayoutId' : 'NULL AS PageLayoutId',
            placementColumns.has('Visible') ? 'ep.Visible' : 'NULL AS Visible',
            'er.PageId as ButtonPageId'
          );

          if (hasButtonPageLink) {
            selectFields.push('bpl.PageUniqueId AS LinkedPageUniqueId');
          } else {
            selectFields.push('NULL AS LinkedPageUniqueId');
          }

          const hasCommandSequence = getTableColumns('CommandSequence').size > 0;
          if (hasCommandSequence) {
            selectFields.push('cs.SerializedCommands');
          } else {
            selectFields.push('NULL AS SerializedCommands');
          }

          const buttonQuery = `
             SELECT ${selectFields.join(', ')}
             FROM Button b
             INNER JOIN ElementReference er ON b.ElementReferenceId = er.Id
             LEFT JOIN ElementPlacement ep ON ep.ElementReferenceId = er.Id
             ${hasButtonPageLink ? 'LEFT JOIN ButtonPageLink bpl ON b.Id = bpl.ButtonId' : ''}
             ${hasCommandSequence ? 'LEFT JOIN CommandSequence cs ON b.Id = cs.ButtonId' : ''}
             WHERE er.PageId = ? ${selectedPageLayoutId ? 'AND ep.PageLayoutId = ?' : ''}
           `;
          if (selectedPageLayoutId) {
            buttons = db.prepare(buttonQuery).all(pageRow.Id, selectedPageLayoutId);
          } else {
            buttons = db.prepare(buttonQuery).all(pageRow.Id);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          const errorCode =
            err && typeof err === 'object' && 'code' in err ? (err as any).code : undefined;
          if (
            errorCode === 'SQLITE_CORRUPT' ||
            errorCode === 'SQLITE_NOTADB' ||
            /malformed/i.test(errorMessage)
          ) {
            throw new Error(`Snap database is corrupted or incomplete: ${errorMessage}`);
          }

          console.warn(`Failed to load buttons for page ${pageRow.Id}: ${errorMessage}`);
          // Skip this page instead of loading all buttons
          buttons = [];
        }

        const uniqueId = String(pageRow.UniqueId || pageRow.Id);
        const page = tree.getPage(uniqueId);
        if (!page) {
          continue;
        }

        // Initialize page grid if not exists (assume max 10x10 grid)
        if (!pageGrids.has(uniqueId)) {
          const grid: Array<Array<AACButton | null>> = [];
          for (let r = 0; r < 10; r++) {
            grid[r] = new Array(10).fill(null);
          }
          pageGrids.set(uniqueId, grid);
        }

        const pageGrid = pageGrids.get(uniqueId);
        if (!pageGrid) continue;

        buttons.forEach((btnRow) => {
          // Determine navigation target UniqueId, if possible
          let targetPageUniqueId: string | undefined = undefined;
          if (btnRow.NavigatePageId && idToUniqueId[String(btnRow.NavigatePageId)]) {
            targetPageUniqueId = idToUniqueId[String(btnRow.NavigatePageId)];
          } else if (btnRow.LinkedPageUniqueId) {
            targetPageUniqueId = String(btnRow.LinkedPageUniqueId);
          } else if (btnRow.PageUniqueId) {
            targetPageUniqueId = String(btnRow.PageUniqueId);
          }

          // Parse CommandSequence for navigation targets if not found yet
          if (btnRow.SerializedCommands) {
            try {
              const commands = JSON.parse(btnRow.SerializedCommands as string);
              const values = commands.$values || [];
              for (const cmd of values) {
                if (cmd.$type === '2' && cmd.LinkedPageId) {
                  // Normal Navigation
                  targetPageUniqueId = String(cmd.LinkedPageId);
                } else if (cmd.$type === '16') {
                  // Go to Home
                  targetPageUniqueId = defaultHomePageId;
                } else if (cmd.$type === '17') {
                  // Go to Keyboard
                  targetPageUniqueId = defaultKeyboardPageId;
                } else if (cmd.$type === '18') {
                  // Go to Dashboard
                  targetPageUniqueId = dashboardPageId;
                }
              }
            } catch (e) {
              // Ignore JSON parse errors in commands
            }
          }

          // Determine parent page association for this button
          const parentPageId = btnRow.ButtonPageId ? String(btnRow.ButtonPageId) : undefined;
          const parentUniqueId =
            parentPageId && idToUniqueId[parentPageId] ? idToUniqueId[parentPageId] : uniqueId;

          // Load audio recording if requested and available
          let audioRecording;
          if (this.loadAudio && btnRow.MessageRecordingId && btnRow.MessageRecordingId > 0) {
            try {
              const recordingData = db
                .prepare(
                  `
                SELECT Id, Identifier, Data FROM PageSetData WHERE Id = ?
              `
                )
                .get(btnRow.MessageRecordingId) as
                | { Id: number; Identifier: string; Data: Buffer }
                | undefined;

              if (recordingData) {
                audioRecording = {
                  id: recordingData.Id,
                  data: recordingData.Data,
                  identifier: recordingData.Identifier,
                  metadata: btnRow.SerializedMessageSoundMetadata || undefined,
                };
              }
            } catch (e) {
              console.warn(`[SnapProcessor] Failed to load audio for button ${btnRow.Id}:`, e);
            }
          }

          // Load symbol image if available
          // Note: PageSetImageId references embedded images in PageSetData table
          // LibrarySymbolId references external symbol libraries (SymbolStix, etc.)
          let buttonImage: string | undefined;
          const buttonParameters: { image_id?: string } = {};
          if (btnRow.PageSetImageId && btnRow.PageSetImageId > 0) {
            try {
              const imageData = db
                .prepare(
                  `
                  SELECT Id, Identifier, Data FROM PageSetData WHERE Id = ?
                `
                )
                .get(btnRow.PageSetImageId) as
                | { Id: number; Identifier: string; Data: Buffer }
                | undefined;

              if (imageData && imageData.Data && imageData.Data.length > 0) {
                // Snap files can store different types of image data:
                // 1. PNG/JPEG binaries (actual images) - extract and display
                // 2. Vector graphics (custom format d7 cd c6 9a) - skip (requires renderer)
                const data = imageData.Data;

                // Check for PNG: 89 50 4E 47
                const isPng =
                  data.length > 4 &&
                  data[0] === 0x89 &&
                  data[1] === 0x50 &&
                  data[2] === 0x4e &&
                  data[3] === 0x47;
                // Check for JPEG: FF D8 FF
                const isJpeg =
                  data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;

                if (isPng || isJpeg) {
                  // Actual PNG/JPEG image - can be displayed
                  const mimeType = isPng ? 'image/png' : 'image/jpeg';
                  const base64 = arrayBufferToBase64(data);
                  buttonImage = `data:${mimeType};base64,${base64}`;
                  buttonParameters.image_id = imageData.Identifier;
                } else {
                  // Vector graphics or other format - skip rendering
                  // Store identifier but don't create image URL
                  buttonParameters.image_id = imageData.Identifier;
                }
              }
            } catch (e) {
              console.warn(
                `[SnapProcessor] Failed to load image for button ${btnRow.Id} (PageSetImageId: ${btnRow.PageSetImageId}):`,
                e
              );
            }
          }

          // Create semantic action for Snap button
          let semanticAction: AACSemanticAction | undefined;

          if (targetPageUniqueId) {
            semanticAction = {
              category: AACSemanticCategory.NAVIGATION,
              intent: AACSemanticIntent.NAVIGATE_TO,
              targetId: targetPageUniqueId,
              platformData: {
                snap: {
                  navigatePageId: btnRow.NavigatePageId,
                  elementReferenceId: btnRow.Id,
                },
              },
              fallback: {
                type: 'NAVIGATE',
                targetPageId: targetPageUniqueId,
              },
            };
          } else {
            semanticAction = {
              category: AACSemanticCategory.COMMUNICATION,
              intent: AACSemanticIntent.SPEAK_TEXT,
              text: btnRow.Message || btnRow.Label || '',
              platformData: {
                snap: {
                  elementReferenceId: btnRow.Id,
                },
              },
              fallback: {
                type: 'SPEAK',
                message: btnRow.Message || btnRow.Label || '',
              },
            };
          }

          const button = new AACButton({
            id: String(btnRow.Id),
            label: btnRow.Label || (btnRow.ContentType === 1 ? '[Prediction]' : ''),
            message:
              btnRow.Message || (btnRow.ContentType === 1 ? '[Prediction]' : btnRow.Label || ''),
            targetPageId: targetPageUniqueId,
            semanticAction: semanticAction,
            contentType: btnRow.ContentType === 1 ? 'AutoContent' : undefined,
            contentSubType: btnRow.ContentType === 1 ? 'Prediction' : undefined,
            audioRecording: audioRecording,
            visibility: mapSnapVisibility(btnRow.Visible as number),
            semantic_id: btnRow.LibrarySymbolId
              ? `snap_symbol_${btnRow.LibrarySymbolId}`
              : undefined, // Extract semantic_id from LibrarySymbolId
            image: buttonImage,
            resolvedImageEntry: buttonImage,
            parameters: Object.keys(buttonParameters).length > 0 ? buttonParameters : undefined,
            style: {
              backgroundColor: btnRow.BackgroundColor
                ? `#${btnRow.BackgroundColor.toString(16)}`
                : undefined,
              borderColor: btnRow.BorderColor ? `#${btnRow.BorderColor.toString(16)}` : undefined,
              borderWidth: btnRow.BorderThickness,
              fontColor: btnRow.LabelColor ? `#${btnRow.LabelColor.toString(16)}` : undefined,
              fontSize: btnRow.FontSize,
              fontFamily: btnRow.FontFamily,
              fontStyle: btnRow.FontStyle?.toString(),
            },
          });

          // Add to the intended parent page
          const parentPage = tree.getPage(parentUniqueId);
          if (parentPage) {
            parentPage.addButton(button);

            // Add button to grid layout if position data is available
            const gridPositionStr = String(btnRow.GridPosition || '');
            if (gridPositionStr && gridPositionStr.includes(',')) {
              // Parse comma-separated coordinates "x,y"
              const [xStr, yStr] = gridPositionStr.split(',');
              const gridX = parseInt(xStr, 10);
              const gridY = parseInt(yStr, 10);

              // Set button x,y properties (critical for metrics!)
              if (!isNaN(gridX) && !isNaN(gridY)) {
                button.x = gridX;
                button.y = gridY;

                // Determine scan block from ScanGroups (TD Snap "Group Scan")
                // IMPORTANT: Only match against ScanGroups from the SAME PageLayout
                // A button can exist in multiple layouts with different positions
                const buttonPageLayoutId = btnRow.PageLayoutId as number;
                if (buttonPageLayoutId && scanGroupsByPageLayout.has(buttonPageLayoutId)) {
                  const scanGroups = scanGroupsByPageLayout.get(buttonPageLayoutId);
                  if (scanGroups && scanGroups.length > 0) {
                    // Find which ScanGroup contains this button's position
                    for (const scanGroup of scanGroups) {
                      // Skip if positions array is null or undefined
                      if (!scanGroup.positions || !Array.isArray(scanGroup.positions)) {
                        continue;
                      }

                      const foundInGroup = scanGroup.positions.some(
                        (pos) => pos.Column === gridX && pos.Row === gridY
                      );

                      if (foundInGroup) {
                        // Use the scan block number from the ScanGroup
                        // ScanGroup scanBlock is already 1-based (index + 1)
                        button.scanBlock = scanGroup.scanBlock;
                        break; // Found the scan block, stop looking
                      }
                    }
                  }
                }
              }

              // Place button in grid if within bounds and coordinates are valid
              if (
                !isNaN(gridX) &&
                !isNaN(gridY) &&
                gridX >= 0 &&
                gridY >= 0 &&
                gridY < 10 &&
                gridX < 10 &&
                pageGrid[gridY] &&
                pageGrid[gridY][gridX] === null
              ) {
                // Generate clone_id for button at this position
                const rows = pageGrid.length;
                const cols = pageGrid[0] ? pageGrid[0].length : 10;
                button.clone_id = generateCloneId(rows, cols, gridY, gridX, button.label);
                pageGrid[gridY][gridX] = button;
              }
            }
          }

          // If this is a navigation button, update the target page's parentId
          if (targetPageUniqueId) {
            const targetPage = tree.getPage(targetPageUniqueId);
            if (targetPage) {
              targetPage.parentId = parentUniqueId;
            }
          }
        });

        // Set grid layout for the current page
        const currentPage = tree.getPage(uniqueId);
        if (currentPage && pageGrid) {
          currentPage.grid = pageGrid;

          // Track semantic_ids and clone_ids on the page
          const semanticIds: string[] = [];
          const cloneIds: string[] = [];

          pageGrid.forEach((row) => {
            row.forEach((btn) => {
              if (btn) {
                if (btn.semantic_id) {
                  semanticIds.push(btn.semantic_id);
                }
                if (btn.clone_id) {
                  cloneIds.push(btn.clone_id);
                }
              }
            });
          });

          if (semanticIds.length > 0) {
            currentPage.semantic_ids = semanticIds;
          }
          if (cloneIds.length > 0) {
            currentPage.clone_ids = cloneIds;
          }
        }
      }

      return tree;
    } catch (error: any) {
      const fileIdentifier =
        typeof filePathOrBuffer === 'string' ? filePathOrBuffer : '[buffer input]';
      // Provide more specific error messages
      if (error.code === 'SQLITE_NOTADB') {
        throw new Error(
          `Invalid SQLite database file: ${typeof filePathOrBuffer === 'string' ? filePathOrBuffer : 'buffer'}`
        );
      } else if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${fileIdentifier}`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Permission denied accessing file: ${fileIdentifier}`);
      } else {
        throw new Error(`Failed to load Snap file: ${error.message}`);
      }
    } finally {
      if (dbResult?.cleanup) {
        await dbResult.cleanup();
      } else if (dbResult?.db) {
        dbResult.db.close();
      }
      // Clean up temporary extracted .sps file from .sub.zip
      if (cleanupTempZip) {
        try {
          await cleanupTempZip();
        } catch (e) {
          console.warn('[SnapProcessor] Failed to clean up temporary .sps file:', e);
        }
      }
    }
  }

  async processTexts(
    filePathOrBuffer: ProcessorInput,
    translations: Map<string, string>,
    outputPath: string
  ): Promise<Uint8Array> {
    const { pathExists, mkDir, writeBinaryToPath, readBinaryFromInput, removePath, dirname } =
      this.options.fileAdapter;
    if (!isNodeRuntime()) {
      throw new Error('processTexts is only supported in Node.js environments for Snap files.');
    }

    if (typeof filePathOrBuffer === 'string') {
      const inputPath = filePathOrBuffer;
      const outputDir = dirname(outputPath);
      const dirExists = await pathExists(outputDir);
      if (!dirExists) {
        await mkDir(outputDir, { recursive: true });
      }
      if (await pathExists(outputPath)) {
        await removePath(outputPath);
      }
      await writeBinaryToPath(outputPath, await readBinaryFromInput(inputPath));

      const Database = requireBetterSqlite3();
      const db = new Database(outputPath, { readonly: false });
      try {
        const getColumns = (tableName: string): Set<string> => {
          try {
            const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
              name: string;
            }>;
            return new Set(rows.map((row) => row.name));
          } catch {
            return new Set();
          }
        };

        const pageColumns = getColumns('Page');
        const buttonColumns = getColumns('Button');

        const pageUpdates: string[] = [];
        const pageWhere: string[] = [];
        const pageColumnsToUse: Array<'Name' | 'Title'> = [];

        if (pageColumns.has('Name')) {
          pageUpdates.push('Name = ?');
          pageWhere.push('Name = ?');
          pageColumnsToUse.push('Name');
        }
        if (pageColumns.has('Title')) {
          pageUpdates.push('Title = ?');
          pageWhere.push('Title = ?');
          pageColumnsToUse.push('Title');
        }

        const updatePage =
          pageUpdates.length > 0
            ? db.prepare(
                `UPDATE Page SET ${pageUpdates.join(', ')} WHERE ${pageWhere.join(' OR ')}`
              )
            : null;

        const updateLabel = buttonColumns.has('Label')
          ? db.prepare('UPDATE Button SET Label = ? WHERE Label = ?')
          : null;
        const updateMessage = buttonColumns.has('Message')
          ? db.prepare('UPDATE Button SET Message = ? WHERE Message = ?')
          : null;

        const entries = Array.from(translations.entries());
        const applyUpdates = db.transaction(() => {
          entries.forEach(([original, translated]) => {
            if (!translated || translated === original) {
              return;
            }
            if (updatePage) {
              const updateValues: string[] = [];
              pageColumnsToUse.forEach(() => updateValues.push(translated));
              pageColumnsToUse.forEach(() => updateValues.push(original));
              updatePage.run(...updateValues);
            }
            if (updateLabel) {
              updateLabel.run(translated, original);
            }
            if (updateMessage) {
              updateMessage.run(translated, original);
            }
          });
        });
        applyUpdates();
      } finally {
        db.close();
      }

      return await readBinaryFromInput(outputPath);
    }

    // Fallback for buffer inputs: rebuild from tree (may drop Snap assets)
    const tree = await this.loadIntoTree(filePathOrBuffer);

    Object.values(tree.pages).forEach((page) => {
      if (page.name && translations.has(page.name)) {
        const translatedName = translations.get(page.name);
        if (translatedName !== undefined) {
          page.name = translatedName;
        }
      }

      page.buttons.forEach((button) => {
        if (button.label && translations.has(button.label)) {
          const translatedLabel = translations.get(button.label);
          if (translatedLabel !== undefined) {
            button.label = translatedLabel;
          }
        }
        if (button.message && translations.has(button.message)) {
          const translatedMessage = translations.get(button.message);
          if (translatedMessage !== undefined) {
            button.message = translatedMessage;
          }
        }
      });
    });

    await this.saveFromTree(tree, outputPath);
    return await readBinaryFromInput(outputPath);
  }

  async saveFromTree(tree: AACTree, outputPath: string): Promise<void> {
    const { pathExists, mkDir, removePath, dirname } = this.options.fileAdapter;
    if (!isNodeRuntime()) {
      throw new Error('saveFromTree is only supported in Node.js environments for Snap files.');
    }
    await Promise.resolve();
    const outputDir = dirname(outputPath);
    const dirExists = await pathExists(outputDir);
    if (!dirExists) {
      await mkDir(outputDir, { recursive: true });
    }
    if (await pathExists(outputPath)) {
      await removePath(outputPath);
    }
    // Create a new SQLite database for Snap format
    const Database = requireBetterSqlite3();
    const db = new Database(outputPath, { readonly: false });

    try {
      // Create basic Snap database schema (simplified)
      db.exec(`
        CREATE TABLE IF NOT EXISTS Page (
          Id INTEGER PRIMARY KEY,
          UniqueId TEXT UNIQUE,
          Title TEXT,
          Name TEXT,
          BackgroundColor INTEGER
        );

        CREATE TABLE IF NOT EXISTS Button (
          Id INTEGER PRIMARY KEY,
          Label TEXT,
          Message TEXT,
          NavigatePageId INTEGER,
          ElementReferenceId INTEGER,
          LibrarySymbolId INTEGER,
          PageSetImageId INTEGER,
          MessageRecordingId INTEGER,
          SerializedMessageSoundMetadata TEXT,
          UseMessageRecording INTEGER,
          LabelColor INTEGER,
          BackgroundColor INTEGER,
          BorderColor INTEGER,
          BorderThickness REAL,
          FontSize REAL,
          FontFamily TEXT,
          FontStyle INTEGER
        );

        CREATE TABLE IF NOT EXISTS ElementReference (
          Id INTEGER PRIMARY KEY,
          PageId INTEGER,
          FOREIGN KEY (PageId) REFERENCES Page (Id)
        );

        CREATE TABLE IF NOT EXISTS ElementPlacement (
          Id INTEGER PRIMARY KEY,
          ElementReferenceId INTEGER,
          GridPosition TEXT,
          FOREIGN KEY (ElementReferenceId) REFERENCES ElementReference (Id)
        );

        CREATE TABLE IF NOT EXISTS PageSetData (
          Id INTEGER PRIMARY KEY,
          Identifier TEXT UNIQUE,
          Data BLOB,
          RefCount INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS PageSetProperties (
          Id INTEGER PRIMARY KEY,
          Name TEXT,
          Description TEXT,
          Author TEXT,
          Locale TEXT,
          DefaultHomePageUniqueId TEXT,
          DefaultKeyboardPageUniqueId TEXT,
          DashboardUniqueId TEXT,
          ToolBarUniqueId TEXT
        );
      `);

      // Insert pages
      let pageIdCounter = 1;
      let buttonIdCounter = 1;
      let elementRefIdCounter = 1;
      let placementIdCounter = 1;
      let pageSetDataIdCounter = 1;

      const pageIdMap = new Map<string, number>();
      const pageSetDataIdentifierMap = new Map<string, number>();
      const insertPageSetData = db.prepare(
        'INSERT INTO PageSetData (Id, Identifier, Data, RefCount) VALUES (?, ?, ?, ?)'
      );
      const incrementRefCount = db.prepare(
        'UPDATE PageSetData SET RefCount = RefCount + 1 WHERE Id = ?'
      );

      // First pass: create all pages
      Object.values(tree.pages).forEach((page) => {
        const numericPageId = pageIdCounter++;
        pageIdMap.set(page.id, numericPageId);

        const insertPage = db.prepare(
          'INSERT INTO Page (Id, UniqueId, Title, Name, BackgroundColor) VALUES (?, ?, ?, ?, ?)'
        );
        insertPage.run(
          numericPageId,
          page.id,
          page.name || '',
          page.name || '',
          page.style?.backgroundColor
            ? parseInt(page.style.backgroundColor.replace('#', ''), 16)
            : null
        );
      });

      // Second pass: create buttons with proper page references
      Object.values(tree.pages).forEach((page) => {
        const numericPageId = pageIdMap.get(page.id);
        if (numericPageId === undefined) {
          return;
        }

        page.buttons.forEach((button, index) => {
          // Find button position in grid layout
          let gridPosition = `${index % 4},${Math.floor(index / 4)}`; // Default fallback

          if (page.grid && page.grid.length > 0) {
            // Search for button in grid layout
            for (let y = 0; y < page.grid.length; y++) {
              for (let x = 0; x < page.grid[y].length; x++) {
                const gridButton = page.grid[y][x];
                if (gridButton && gridButton.id === button.id) {
                  // Convert grid coordinates to comma-separated format
                  gridPosition = `${x},${y}`;
                  break;
                }
              }
            }
          }
          const elementRefId = elementRefIdCounter++;

          // Insert ElementReference
          const insertElementRef = db.prepare(
            'INSERT INTO ElementReference (Id, PageId) VALUES (?, ?)'
          );
          insertElementRef.run(elementRefId, numericPageId);

          // Insert Button - handle semantic actions
          let navigatePageId = null;

          // Use semantic action if available
          if (button.semanticAction?.intent === AACSemanticIntent.NAVIGATE_TO) {
            const targetId = button.semanticAction.targetId || button.targetPageId;
            navigatePageId = targetId ? pageIdMap.get(targetId) || null : null;
          }

          const insertButton = db.prepare(
            'INSERT INTO Button (Id, Label, Message, NavigatePageId, ElementReferenceId, LibrarySymbolId, PageSetImageId, MessageRecordingId, SerializedMessageSoundMetadata, UseMessageRecording, LabelColor, BackgroundColor, BorderColor, BorderThickness, FontSize, FontFamily, FontStyle) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          );

          const audio = button.audioRecording;
          let messageRecordingId: number | null = null;
          let serializedMetadata: string | null = null;
          let useMessageRecording = 0;

          if (audio && Buffer.isBuffer(audio.data) && audio.data.length > 0) {
            const identifier =
              audio.identifier && audio.identifier.trim().length > 0
                ? audio.identifier.trim()
                : `audio_${buttonIdCounter}`;

            let audioId = pageSetDataIdentifierMap.get(identifier);
            if (!audioId) {
              audioId = pageSetDataIdCounter++;
              insertPageSetData.run(audioId, identifier, audio.data, 1);
              pageSetDataIdentifierMap.set(identifier, audioId);
            } else {
              incrementRefCount.run(audioId);
            }

            messageRecordingId = audioId;
            serializedMetadata = audio.metadata || null;
            useMessageRecording = 1;
          }

          // Handle image data from button.parameters.imageData or button.image (data URL)
          let pageSetImageId: number | null = null;
          if (button.parameters?.imageData && Buffer.isBuffer(button.parameters.imageData)) {
            // Use existing image data buffer
            const imageIdentifier: string =
              (button.parameters.image_id as string) || `IMG_${buttonIdCounter}`;
            let imageId = pageSetDataIdentifierMap.get(imageIdentifier);
            if (!imageId) {
              imageId = pageSetDataIdCounter++;
              insertPageSetData.run(imageId, imageIdentifier, button.parameters.imageData, 1);
              pageSetDataIdentifierMap.set(imageIdentifier, imageId);
            } else {
              incrementRefCount.run(imageId);
            }
            pageSetImageId = imageId;
          } else if (
            button.image &&
            typeof button.image === 'string' &&
            button.image.startsWith('data:image')
          ) {
            // Convert data URL to buffer
            try {
              const matches = button.image.match(/^data:image\/(\w+);base64,(.+)$/);
              if (matches && matches[2]) {
                const imageData = Buffer.from(matches[2], 'base64');
                const imageIdentifier: string =
                  (button.parameters?.image_id as string) || `IMG_${buttonIdCounter}`;
                let imageId = pageSetDataIdentifierMap.get(imageIdentifier);
                if (!imageId) {
                  imageId = pageSetDataIdCounter++;
                  insertPageSetData.run(imageId, imageIdentifier, imageData, 1);
                  pageSetDataIdentifierMap.set(imageIdentifier, imageId);
                } else {
                  incrementRefCount.run(imageId);
                }
                pageSetImageId = imageId;
              }
            } catch (err) {
              console.warn(
                `[SnapProcessor] Failed to convert data URL to Buffer for button ${button.id}:`,
                err
              );
            }
          }

          // Retry logic for SQLite operations
          let retries = 3;
          while (retries > 0) {
            try {
              insertButton.run(
                buttonIdCounter++,
                button.label || '',
                button.message || button.label || '',
                navigatePageId,
                elementRefId,
                null, // LibrarySymbolId - not used for embedded images
                pageSetImageId, // PageSetImageId - references embedded image in PageSetData
                messageRecordingId,
                serializedMetadata,
                useMessageRecording,
                button.style?.fontColor
                  ? parseInt(button.style.fontColor.replace('#', ''), 16)
                  : null,
                button.style?.backgroundColor
                  ? parseInt(button.style.backgroundColor.replace('#', ''), 16)
                  : null,
                button.style?.borderColor
                  ? parseInt(button.style.borderColor.replace('#', ''), 16)
                  : null,
                button.style?.borderWidth,
                button.style?.fontSize,
                button.style?.fontFamily,
                button.style?.fontStyle ? parseInt(button.style.fontStyle) : null
              );
              break; // Success
            } catch (err: any) {
              if (err.code === 'SQLITE_IOERR' && retries > 1) {
                retries--;
                // Wait a bit before retrying
                const now = Date.now();
                while (Date.now() - now < 100) {
                  /* busy wait */
                }
              } else {
                throw err;
              }
            }
          }

          // Insert ElementPlacement
          const insertPlacement = db.prepare(
            'INSERT INTO ElementPlacement (Id, ElementReferenceId, GridPosition) VALUES (?, ?, ?)'
          );
          insertPlacement.run(placementIdCounter++, elementRefId, gridPosition);
        });
      });

      // Insert PageSetProperties metadata
      const insertProps = db.prepare(`
        INSERT INTO PageSetProperties (
          Id, Name, Description, Author, Locale, 
          DefaultHomePageUniqueId, DefaultKeyboardPageUniqueId, 
          DashboardUniqueId, ToolBarUniqueId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertProps.run(
        1,
        tree.metadata?.name || null,
        tree.metadata?.description || null,
        tree.metadata?.author || null,
        tree.metadata?.locale || null,
        tree.metadata?.defaultHomePageId || tree.rootId || null,
        tree.metadata?.defaultKeyboardPageId || null,
        tree.metadata?.dashboardId || null,
        tree.metadata?.hasGlobalToolbar ? tree.metadata.toolbarId || null : null
      );
    } finally {
      db.close();
    }
  }

  /**
   * Add audio recording to a button in the database
   */
  async addAudioToButton(
    dbPath: string,
    buttonId: number,
    audioData: Uint8Array,
    metadata?: string
  ): Promise<number> {
    await Promise.resolve();
    if (!isNodeRuntime()) {
      throw new Error('addAudioToButton is only supported in Node.js environments.');
    }
    const Database = requireBetterSqlite3();
    const crypto = getNodeRequire()('crypto') as typeof import('crypto');
    const db = new Database(dbPath, { fileMustExist: true });

    try {
      // Ensure PageSetData table exists
      db.exec(`
            CREATE TABLE IF NOT EXISTS PageSetData (
                Id INTEGER PRIMARY KEY,
                Identifier TEXT UNIQUE,
                Data BLOB
            );
        `);

      // Generate SHA1 hash for the identifier
      const sha1Hash = crypto.createHash('sha1').update(audioData).digest('hex');
      const identifier = `SND:${sha1Hash}`;

      // Check if audio with this identifier already exists
      let audioId;
      const existingAudio = db
        .prepare('SELECT Id FROM PageSetData WHERE Identifier = ?')
        .get(identifier) as { Id: number } | undefined;

      if (existingAudio) {
        audioId = existingAudio.Id;
      } else {
        // Insert new audio data
        const result = db
          .prepare('INSERT INTO PageSetData (Identifier, Data) VALUES (?, ?)')
          .run(identifier, audioData);
        audioId = Number(result.lastInsertRowid);
      }

      // Update button to reference the audio
      const updateButton = db.prepare(
        'UPDATE Button SET MessageRecordingId = ?, UseMessageRecording = 1, SerializedMessageSoundMetadata = ? WHERE Id = ?'
      );
      const metadataJson = metadata ? JSON.stringify({ FileName: metadata }) : null;
      updateButton.run(audioId, metadataJson, buttonId);

      return audioId;
    } finally {
      db.close();
    }
  }

  /**
   * Create a copy of the pageset with audio recordings added
   */
  async createAudioEnhancedPageset(
    sourceDbPath: string,
    targetDbPath: string,
    audioMappings: Map<number, { audioData: Uint8Array; metadata?: string }>
  ): Promise<void> {
    const { writeBinaryToPath, readBinaryFromInput } = this.options.fileAdapter;
    if (!isNodeRuntime()) {
      throw new Error('createAudioEnhancedPageset is only supported in Node.js environments.');
    }
    // Copy the source database to target
    await writeBinaryToPath(targetDbPath, await readBinaryFromInput(sourceDbPath));

    // Add audio recordings to the copy
    for (const [buttonId, audioInfo] of audioMappings.entries()) {
      await this.addAudioToButton(targetDbPath, buttonId, audioInfo.audioData, audioInfo.metadata);
    }
  }

  /**
   * Extract buttons from a specific page that need audio recordings
   */
  extractButtonsForAudio(
    dbPath: string,
    pageUniqueId: string
  ): Array<{
    id: number;
    label: string;
    message: string;
    hasAudio: boolean;
  }> {
    if (!isNodeRuntime()) {
      throw new Error('extractButtonsForAudio is only supported in Node.js environments.');
    }
    const Database = requireBetterSqlite3();
    const db = new Database(dbPath, { readonly: true });

    try {
      // Find the page by UniqueId
      const page = db.prepare('SELECT * FROM Page WHERE UniqueId = ?').get(pageUniqueId) as
        | { Id: number }
        | undefined;
      if (!page) {
        throw new Error(`Page with UniqueId ${pageUniqueId} not found`);
      }

      // Get buttons for this page
      const buttons = db
        .prepare(
          `
        SELECT
          b.Id, b.Label, b.Message, b.MessageRecordingId, b.UseMessageRecording
        FROM Button b
        JOIN ElementReference er ON b.ElementReferenceId = er.Id
        WHERE er.PageId = ?
      `
        )
        .all(page.Id) as Array<{
        Id: number;
        Label: string;
        Message: string | null;
        MessageRecordingId: number | null;
        UseMessageRecording: number | null;
      }>;

      return buttons.map((btn) => ({
        id: btn.Id,
        label: btn.Label || '',
        message: btn.Message || btn.Label || '',
        hasAudio: !!(btn.MessageRecordingId && btn.MessageRecordingId > 0),
      }));
    } finally {
      db.close();
    }
  }

  /**
   * Extract strings with metadata for aac-tools-platform compatibility
   * Uses the generic implementation from BaseProcessor
   */
  async extractStringsWithMetadata(filePath: string): Promise<ExtractStringsResult> {
    return this.extractStringsWithMetadataGeneric(filePath);
  }

  /**
   * Generate translated download for aac-tools-platform compatibility
   * Uses the generic implementation from BaseProcessor
   */
  async generateTranslatedDownload(
    filePath: string,
    translatedStrings: TranslatedString[],
    sourceStrings: SourceString[]
  ): Promise<string> {
    return this.generateTranslatedDownloadGeneric(filePath, translatedStrings, sourceStrings);
  }

  /**
   * Validate Snap file format
   * @param filePath - Path to the file to validate
   * @returns Promise with validation result
   */
  async validate(filePath: string): Promise<ValidationResult> {
    return SnapValidator.validateFile(filePath, this.options.fileAdapter);
  }

  /**
   * Get available PageLayouts for a Snap file
   * Useful for UI components that want to let users select layout size
   * @param filePath - Path to the Snap file
   * @returns Array of available PageLayouts with their dimensions
   */
  async getAvailablePageLayouts(filePath: string): Promise<PageLayoutInfo[]> {
    const { writeBinaryToPath, removePath, pathExists, join } = this.options.fileAdapter;
    if (!isNodeRuntime()) {
      throw new Error('getAvailablePageLayouts is only supported in Node.js environments.');
    }
    const dbPath = typeof filePath === 'string' ? filePath : join(process.cwd(), 'temp.spb');

    if (Buffer.isBuffer(filePath)) {
      await writeBinaryToPath(dbPath, filePath);
    }

    let db: any = null;
    try {
      const Database = requireBetterSqlite3();
      db = new Database(dbPath, { readonly: true });

      // Get unique PageLayouts based on PageLayoutSetting (dimensions)
      const pageLayouts = db
        .prepare(
          `
          SELECT
            MIN(pl.Id) as Id,
            pl.PageLayoutSetting
          FROM PageLayout pl
          GROUP BY pl.PageLayoutSetting
          ORDER BY pl.PageLayoutSetting
        `
        )
        .all() as Array<{ Id: number; PageLayoutSetting: string }>;

      // Parse the PageLayoutSetting format: "columns,rows,hasScanGroups,?"
      const layouts: PageLayoutInfo[] = pageLayouts.map((pl) => {
        const parts = pl.PageLayoutSetting.split(',');
        const cols = parseInt(parts[0], 10) || 0;
        const rows = parseInt(parts[1], 10) || 0;
        const hasScanning = parts[2] === 'True';

        return {
          id: pl.Id,
          cols,
          rows,
          size: cols * rows,
          hasScanning,
          label: `${cols}×${rows}${hasScanning ? ' (with scanning)' : ''}`,
        };
      });

      // Sort by size (total buttons), with scanning layouts first
      layouts.sort((a, b) => {
        if (a.hasScanning && !b.hasScanning) return -1;
        if (!a.hasScanning && b.hasScanning) return 1;
        return b.size - a.size; // Larger sizes first
      });

      return layouts;
    } catch (error) {
      console.error('[SnapProcessor] Failed to get available page layouts:', error);
      return [];
    } finally {
      if (db) {
        db.close();
      }

      // Clean up temporary file if created from buffer
      const exists = await pathExists(dbPath);
      if (Buffer.isBuffer(filePath) && exists) {
        try {
          await removePath(dbPath);
        } catch (e) {
          console.warn('Failed to clean up temporary file:', e);
        }
      }
    }
  }
}

/**
 * Interface for PageLayout information returned by getAvailablePageLayouts
 */
export interface PageLayoutInfo {
  id: number;
  cols: number;
  rows: number;
  size: number;
  hasScanning: boolean;
  label: string;
}

export { SnapProcessor };
