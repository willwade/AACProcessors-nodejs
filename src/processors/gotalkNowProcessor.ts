/**
 * GoTalk NOW Processor
 *
 * Reads, translates, and converts Attainment Company's GoTalk NOW
 * communication-board files (`.gtbz`).
 *
 * A `.gtbz` file is a ZIP archive containing Apple property lists:
 *   - BookInfo.plist        – format version (GoTalkBookFormatVersion)
 *   - PageData.plist        – pages dict keyed by page id (positive = content,
 *                             negative = system/express-bar pages)
 *   - PageOrder.plist       – ordered array of page ids
 *   - PageHistory.plist     – navigation history (usually empty)
 *   - SettingsWriteOut.plist– app-level settings (TTS, scanning, …)
 *   - IconSource-<id>.png   – page icons
 *   - Source-<page>-<btn>-<guid>-…png – button images
 *   - <page>-<btn>.caf      – audio recordings (Core Audio Format)
 *   - Backup-<n>.zip        – rolling backups
 *   - REQUIRESREGEN         – marker file
 *
 * Colours and fonts in PageData are NSKeyedArchiver-encoded binary plists
 * carried inside `<data>` tags. They are treated as opaque blobs and preserved
 * verbatim so that only text fields are touched during translation.
 */

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
} from '../core/treeStructure';
import plist, { PlistValue } from 'plist';
import {
  ValidationFailureError,
  buildValidationResultFromMessage,
} from '../validation/validationTypes';
import { ProcessorInput, getBasename } from '../utils/io';
import { decodeNsColor, decodeNsFont } from './gotalkNow/nsKeyed';

// ---------------------------------------------------------------------------
// Raw plist type aliases
// ---------------------------------------------------------------------------

/** A value stored inside a `<data>` tag (base64-encoded binary). */
type PlistData = string | Uint8Array | Buffer;

interface GoTalkButtonImage {
  Location?: string;
  Center?: string;
  Type?: string;
  SourceLibrary?: string;
  SourceImageName?: string;
  QuickRecoveryPath?: string;
  Hash?: string;
  Transform?: PlistData;
  AlreadyHasTransparentBorder?: boolean;
  [key: string]: unknown;
}

interface GoTalkActionData {
  TTSText?: string;
  JumpTo?: number;
  [key: string]: unknown;
}

interface GoTalkRawButton {
  ActionData?: GoTalkActionData;
  ButtonType?: string;
  ButtonText?: string;
  ButtonImages?: GoTalkButtonImage[];
  BackgroundColor?: PlistData;
  BorderColor?: PlistData;
  TextColor?: PlistData;
  TextFont?: PlistData;
  TextCenter?: string;
  TextShadow?: boolean;
  Enabled?: boolean;
  [key: string]: unknown;
}

interface GoTalkRawPage {
  ButtonCount?: number;
  Buttons?: Record<string, GoTalkRawButton>;
  BackgroundColor?: PlistData;
  TitleFont?: PlistData;
  PageTitle?: string;
  Enabled?: boolean;
  ExpressPage?: boolean;
  PageIcon?: unknown;
  RandomizePage?: boolean;
  AutoActivateOneButton?: boolean;
  [key: string]: unknown;
}

/** PageData.plist: dict keyed by page-id string. */
type GoTalkPageData = Record<string, GoTalkRawPage>;

// ---------------------------------------------------------------------------
// GoTalk NOW button type → semantic-action mapping
// ---------------------------------------------------------------------------

function buildSemanticAction(
  rawButton: GoTalkRawButton,
  pageId: string,
  buttonIndex: string
): { semanticAction: AACSemanticAction; message: string; targetPageId?: string } {
  const buttonType = rawButton.ButtonType || 'TTS';
  const actionData = rawButton.ActionData || {};
  const label = rawButton.ButtonText ?? '';
  const ttsText = actionData.TTSText;

  switch (buttonType) {
    case 'Jump': {
      const jumpTo = actionData.JumpTo;
      const target = jumpTo !== undefined ? String(jumpTo) : undefined;
      return {
        semanticAction: {
          category: AACSemanticCategory.NAVIGATION,
          intent: AACSemanticIntent.NAVIGATE_TO,
          targetId: target,
          platformData: {
            gotalkNow: { buttonType: 'Jump', jumpTo },
          },
          fallback: { type: 'NAVIGATE', targetPageId: target },
        },
        message: '',
        targetPageId: target,
      };
    }
    case 'Audio': {
      // Audio buttons play a recorded .caf file named <pageId>-<buttonIndex>.caf
      const audioLocation = `${pageId}-${buttonIndex}.caf`;
      return {
        semanticAction: {
          category: AACSemanticCategory.MEDIA,
          intent: AACSemanticIntent.PLAY_SOUND,
          platformData: {
            gotalkNow: { buttonType: 'Audio', audioLocation },
          },
          fallback: { type: 'ACTION' },
        },
        message: label,
      };
    }
    case 'Express':
    case 'Bookmark':
    case 'URL':
    case 'Video': {
      return {
        semanticAction: {
          category: AACSemanticCategory.SYSTEM_CONTROL,
          intent: AACSemanticIntent.PLATFORM_SPECIFIC,
          platformData: {
            gotalkNow: { buttonType },
          },
          fallback: { type: 'ACTION' },
        },
        message: ttsText && ttsText.length > 0 ? ttsText : label,
      };
    }
    case 'TTS':
    default: {
      // When TTSText is empty the visible ButtonText is spoken.
      const spoken = ttsText && ttsText.length > 0 ? ttsText : label;
      return {
        semanticAction: {
          category: AACSemanticCategory.COMMUNICATION,
          intent: AACSemanticIntent.SPEAK_TEXT,
          text: spoken,
          platformData: {
            gotalkNow: { buttonType: 'TTS' },
          },
          fallback: { type: 'SPEAK', message: spoken },
        },
        message: spoken,
      };
    }
  }
}

/**
 * Derive a square-ish grid layout from the declared button count.
 * GoTalk NOW uses fixed layouts (1, 4, 9, 16, 25, 36 …).
 */
function gridDimensionsFromButtonCount(count: number): { rows: number; cols: number } {
  const side = Math.max(1, Math.ceil(Math.sqrt(Math.max(count, 1))));
  return { rows: side, cols: side };
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

class GotalkNowProcessor extends BaseProcessor {
  readonly capabilities = {
    wordList: 'none' as const,
    preservesAssetsOnSave: true,
    newCellCreation: 'allowed' as const,
  };

  constructor(options?: ProcessorOptions) {
    super(options);
  }

  // ---- Zip access ---------------------------------------------------------

  private async openZip(
    filePathOrBuffer: ProcessorInput
  ): Promise<Awaited<ReturnType<typeof this.options.zipAdapter>>> {
    const zip = await this.options.zipAdapter(filePathOrBuffer, this.options.fileAdapter);
    return zip;
  }

  private async readPlistFromZip(
    zip: Awaited<ReturnType<typeof this.options.zipAdapter>>,
    name: string,
    fallback?: () => PlistValue
  ): Promise<PlistValue> {
    const files = zip.listFiles();
    if (!files.includes(name)) {
      if (fallback) return fallback();
      throw new Error(`GoTalk NOW archive is missing ${name}`);
    }
    const bytes = await zip.readFile(name);
    const text =
      typeof Buffer !== 'undefined' && Buffer.isBuffer(bytes)
        ? bytes.toString('utf8')
        : new TextDecoder().decode(bytes);
    return plist.parse(text);
  }

  // ---- extractTexts -------------------------------------------------------

  async extractTexts(filePathOrBuffer: ProcessorInput): Promise<string[]> {
    const tree = await this.loadIntoTree(filePathOrBuffer);
    const texts: string[] = [];

    for (const pageId in tree.pages) {
      const page = tree.pages[pageId];
      if (page.name) texts.push(page.name);
      page.buttons.forEach((btn) => {
        if (btn.label) texts.push(btn.label);
        if (btn.message && btn.message !== btn.label) texts.push(btn.message);
      });
    }

    return texts;
  }

  // ---- loadIntoTree -------------------------------------------------------

  async loadIntoTree(filePathOrBuffer: ProcessorInput): Promise<AACTree> {
    const { getFileSize, pathExists } = this.options.fileAdapter;
    const filename =
      typeof filePathOrBuffer === 'string' ? getBasename(filePathOrBuffer) : 'upload.gtbz';

    let zip: Awaited<ReturnType<typeof this.options.zipAdapter>>;
    let pageDataValue: PlistValue;
    let pageOrderValue: PlistValue;
    let bookInfoValue: PlistValue;

    try {
      zip = await this.openZip(filePathOrBuffer);
      pageDataValue = await this.readPlistFromZip(zip, 'PageData.plist');
      pageOrderValue = await this.readPlistFromZip(
        zip,
        'PageOrder.plist',
        () => [] as unknown as PlistValue
      );
      bookInfoValue = await this.readPlistFromZip(zip, 'BookInfo.plist', () => ({}) as PlistValue);
    } catch (err: any) {
      if (err instanceof ValidationFailureError) throw err;
      const validation = buildValidationResultFromMessage({
        filename,
        filesize:
          typeof filePathOrBuffer === 'string'
            ? (await pathExists(filePathOrBuffer))
              ? await getFileSize(filePathOrBuffer)
              : 0
            : 0,
        format: 'gotalknow',
        message: err?.message || 'Failed to open GoTalk NOW archive',
        type: 'structure',
        description: 'gtbz archive',
      });
      throw new ValidationFailureError('Failed to load GoTalk NOW file', validation, err);
    }

    const pageData = (pageDataValue as GoTalkPageData) || {};
    const pageOrderRaw = Array.isArray(pageOrderValue) ? (pageOrderValue as unknown[]) : [];

    const tree = new AACTree();
    tree.metadata.format = 'gotalknow';

    // Format version
    const bookInfo = (bookInfoValue as Record<string, unknown>) || {};
    if (bookInfo.GoTalkBookFormatVersion !== undefined) {
      const version = bookInfo.GoTalkBookFormatVersion;
      tree.metadata.version =
        typeof version === 'number' || typeof version === 'string' ? String(version) : '1';
    }

    // Preserve the ordered list of page ids for round-trip fidelity.
    const orderedPageIds = pageOrderRaw.map((id) => String(id));
    (tree.metadata as Record<string, unknown>).pageOrder = orderedPageIds;

    // The first page in PageOrder (if any) is treated as the home page.
    if (orderedPageIds.length > 0) {
      tree.metadata.defaultHomePageId = orderedPageIds[0];
    }

    // Track available image files so we can resolve ButtonImages locations.
    const zipFiles = new Set(zip.listFiles());

    // Build pages. Use the union of PageData keys and PageOrder ids.
    const allPageIds = new Set<string>([...Object.keys(pageData), ...orderedPageIds]);

    // Deterministic ordering: ordered pages first (in order), then any extras sorted numerically.
    const sortedPageIds = [
      ...orderedPageIds.filter((id) => allPageIds.has(id)),
      ...[...allPageIds]
        .filter((id) => !orderedPageIds.includes(id))
        .sort((a, b) => Number(a) - Number(b)),
    ];

    if (sortedPageIds.length === 0) {
      const validation = buildValidationResultFromMessage({
        filename,
        filesize: 0,
        format: 'gotalknow',
        message: 'No pages found in GoTalk NOW PageData.plist',
        type: 'structure',
        description: 'PageData.plist',
      });
      throw new ValidationFailureError('GoTalk NOW file has no pages', validation);
    }

    for (const pageId of sortedPageIds) {
      const rawPage: GoTalkRawPage = pageData[pageId] || { Buttons: {} };
      const pageTitle =
        typeof rawPage.PageTitle === 'string' && rawPage.PageTitle.trim().length > 0
          ? rawPage.PageTitle
          : `Page ${pageId}`;
      const page = new AACPage({
        id: pageId,
        name: pageTitle,
        grid: [],
        buttons: [],
        parentId: null,
      });

      // Page-level style: background colour and title font.
      const pageBg = decodeNsColor(rawPage.BackgroundColor as Uint8Array | Buffer | undefined);
      const pageFont = decodeNsFont(rawPage.TitleFont as Uint8Array | Buffer | undefined);
      if (pageBg || pageFont.fontFamily) {
        page.style = {
          ...(page.style || {}),
          ...(pageBg ? { backgroundColor: pageBg } : {}),
          ...(pageFont.fontFamily ? { fontFamily: pageFont.fontFamily } : {}),
        };
      }
      if (rawPage.Enabled === false) {
        // Disabled pages are retained but flagged for fidelity.
        (page as AACPage & { enabled?: boolean }).enabled = false;
      }

      const buttonsById = rawPage.Buttons || {};
      // Numeric sort of button indices ("0","1",…,"10",…)
      const buttonIndices = Object.keys(buttonsById).sort((a, b) => Number(a) - Number(b));
      const buttonCount = rawPage.ButtonCount ?? buttonIndices.length;

      const { rows, cols } = gridDimensionsFromButtonCount(buttonCount);
      const gridLayout: (AACButton | null)[][] = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => null)
      );

      buttonIndices.forEach((btnIndex, i) => {
        const rawButton = buttonsById[btnIndex];
        if (!rawButton) return;

        const { semanticAction, message, targetPageId } = buildSemanticAction(
          rawButton,
          pageId,
          btnIndex
        );

        const button = new AACButton({
          id: `${pageId}_btn_${btnIndex}`,
          label: rawButton.ButtonText ?? '',
          message,
          targetPageId,
          semanticAction,
        });

        // Decode style from NSKeyedArchiver blobs.
        const backgroundColor = decodeNsColor(
          rawButton.BackgroundColor as Uint8Array | Buffer | undefined
        );
        const borderColor = decodeNsColor(rawButton.BorderColor as Uint8Array | Buffer | undefined);
        const fontColor = decodeNsColor(rawButton.TextColor as Uint8Array | Buffer | undefined);
        const font = decodeNsFont(rawButton.TextFont as Uint8Array | Buffer | undefined);
        if (backgroundColor || borderColor || fontColor || font.fontFamily) {
          button.style = {
            ...(button.style || {}),
            ...(backgroundColor ? { backgroundColor } : {}),
            ...(borderColor ? { borderColor } : {}),
            ...(fontColor ? { fontColor } : {}),
            ...(font.fontFamily ? { fontFamily: font.fontFamily } : {}),
          };
        }

        // Resolve image metadata.
        const images = rawButton.ButtonImages;
        if (Array.isArray(images) && images.length > 0) {
          const first = images[0];
          if (first?.Location) {
            button.image = first.Location;
            if (zipFiles.has(first.Location)) {
              button.resolvedImageEntry = first.Location;
            }
          }
          if (first?.SourceLibrary) button.symbolLibrary = first.SourceLibrary;
          if (first?.SourceImageName) button.symbolPath = first.SourceImageName;
        }

        // Visibility: GoTalk buttons can be disabled.
        if (rawButton.Enabled === false) {
          button.visibility = 'Disabled';
        }

        // Preserve raw style data opaquely for round-trip styling.
        button.parameters = {
          ...(button.parameters || {}),
          __gotalkNow: {
            buttonType: rawButton.ButtonType,
            textShadow: rawButton.TextShadow,
            textCenter: rawButton.TextCenter,
          },
        };

        page._loadButton(button);

        // Place into grid by index (row-major).
        const row = Math.floor(i / cols);
        const col = i % cols;
        if (row < rows && col < cols) {
          gridLayout[row][col] = button;
        }
      });

      page.grid = gridLayout;
      tree.addPage(page);
    }

    return tree;
  }

  // ---- processTexts (asset-preserving round-trip) -------------------------

  async processTexts(
    filePathOrBuffer: ProcessorInput,
    translations: Map<string, string>,
    outputPath: string
  ): Promise<Uint8Array> {
    const { writeBinaryToPath } = this.options.fileAdapter;

    const originalZip = await this.openZip(filePathOrBuffer);

    // Parse PageData and apply translations in place.
    const pageDataBytes = await originalZip.readFile('PageData.plist');
    const pageDataText =
      typeof Buffer !== 'undefined' && Buffer.isBuffer(pageDataBytes)
        ? pageDataBytes.toString('utf8')
        : new TextDecoder().decode(pageDataBytes);
    const pageData = plist.parse(pageDataText) as GoTalkPageData;

    for (const pageId of Object.keys(pageData)) {
      const rawPage = pageData[pageId];
      if (!rawPage || !rawPage.Buttons) continue;

      for (const btnIndex of Object.keys(rawPage.Buttons)) {
        const rawButton = rawPage.Buttons[btnIndex];
        if (!rawButton) continue;

        // Translate the visible label.
        if (rawButton.ButtonText && translations.has(rawButton.ButtonText)) {
          rawButton.ButtonText = translations.get(rawButton.ButtonText);
        }

        // Translate the spoken text (only when explicitly set).
        const actionData = rawButton.ActionData;
        if (actionData && actionData.TTSText && translations.has(actionData.TTSText)) {
          actionData.TTSText = translations.get(actionData.TTSText);
        }
      }
    }

    const rebuiltPageData = plist.build(pageData as unknown as PlistValue);

    // Repack: copy every original entry verbatim, replacing only PageData.plist.
    const outputZip = await this.options.zipAdapter(undefined, this.options.fileAdapter);
    const files: { name: string; data: string | Uint8Array }[] = [];
    for (const name of originalZip.listFiles()) {
      if (name === 'PageData.plist') continue;
      files.push({ name, data: await originalZip.readFile(name) });
    }
    files.push({ name: 'PageData.plist', data: rebuiltPageData });

    const outputBuffer = await outputZip.writeFiles(files);
    await writeBinaryToPath(outputPath, outputBuffer);

    return outputBuffer;
  }

  // ---- saveFromTree (build from tree) -------------------------------------

  async saveFromTree(tree: AACTree, outputPath: string): Promise<void> {
    const { writeBinaryToPath } = this.options.fileAdapter;

    const pageData: GoTalkPageData = {};
    const pageOrder: number[] = [];
    const imageFiles: { name: string; data: Uint8Array }[] = [];

    const pageIds = Object.keys(tree.pages);

    pageIds.forEach((pageId, pageIdx) => {
      const page = tree.pages[pageId];
      const numericId = Number(pageId);
      if (!Number.isNaN(numericId)) pageOrder.push(numericId);

      const buttons: Record<string, GoTalkRawButton> = {};
      const buttonList = page.buttons;
      buttonList.forEach((btn, i) => {
        const btnIndex = String(i);
        const buttonType =
          (btn.parameters?.__gotalkNow?.buttonType as string | undefined) ||
          (btn.targetPageId ? 'Jump' : 'TTS');

        const actionData: GoTalkActionData = {};
        if (buttonType === 'Jump' && btn.targetPageId) {
          actionData.JumpTo = Number(btn.targetPageId);
          actionData.TTSText = '';
        } else if (buttonType === 'TTS') {
          // Only store TTSText when it differs from the label (matches GoTalk's convention).
          actionData.TTSText = btn.message && btn.message !== btn.label ? btn.message : '';
        } else {
          actionData.TTSText = btn.message || '';
        }

        const rawButton: GoTalkRawButton = {
          ActionData: actionData,
          ButtonType: buttonType,
          ButtonText: btn.label || '',
        };

        if (btn.resolvedImageEntry || btn.image) {
          rawButton.ButtonImages = [
            {
              Location: btn.resolvedImageEntry || btn.image,
              Type: 'Saved',
            },
          ];
        }

        buttons[btnIndex] = rawButton;
      });

      pageData[pageId] = {
        ButtonCount: buttonList.length,
        Buttons: buttons,
      };

      // Collect referenced images so we can include them in the archive.
      buttonList.forEach((btn) => {
        if (btn.resolvedImageEntry) {
          // Image bytes are not available from the tree alone; skip if absent.
        }
      });
      void pageIdx;
    });

    const bookInfo = {
      GoTalkBookFormatVersion: Number(tree.metadata.version) || 1,
    };

    const zip = await this.options.zipAdapter(undefined, this.options.fileAdapter);
    const files: { name: string; data: string | Uint8Array }[] = [
      { name: 'BookInfo.plist', data: plist.build(bookInfo as unknown as PlistValue) },
      { name: 'PageData.plist', data: plist.build(pageData as unknown as PlistValue) },
      {
        name: 'PageOrder.plist',
        data: plist.build(pageOrder as unknown as PlistValue),
      },
      { name: 'PageHistory.plist', data: plist.build([] as unknown as PlistValue) },
      ...imageFiles,
    ];

    const outputBuffer = await zip.writeFiles(files);
    await writeBinaryToPath(outputPath, outputBuffer);
  }

  /**
   * Extract strings with metadata for aac-tools-platform compatibility.
   * Uses the generic implementation from BaseProcessor.
   */
  extractStringsWithMetadata(filePath: string): Promise<ExtractStringsResult> {
    return this.extractStringsWithMetadataGeneric(filePath);
  }

  /**
   * Generate translated download for aac-tools-platform compatibility.
   * Uses the generic implementation from BaseProcessor.
   */
  generateTranslatedDownload(
    filePath: string,
    translatedStrings: TranslatedString[],
    sourceStrings: SourceString[]
  ): Promise<string> {
    return this.generateTranslatedDownloadGeneric(filePath, translatedStrings, sourceStrings);
  }
}

export { GotalkNowProcessor };
