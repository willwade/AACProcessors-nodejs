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
 * Two on-disk variants exist and both are accepted:
 *   - `.gtbz` app backups: plists at the ZIP root.
 *   - `.gotalk-book` share exports (often `.zip`-suffixed): everything nested
 *     under a `<BookName>.gotalk-book/` folder, possibly alongside `__MACOSX/`
 *     resource-fork entries (ignored). Button images are pre-rendered
 *     snapshots named `<page>-<button>-<buttonCount>.png`.
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
  JumpBook?: string;
  URL?: string;
  OpenInternally?: boolean;
  TrimStart?: number;
  TrimEnd?: number;
  GoVisual?: string;
  GoVisualLink?: unknown;
  MediaPlayerCommandIndex?: number;
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
  Disabled?: boolean;
  CueType?: string;
  CueData?: GoTalkActionData;
  AfterAction?: number;
  AfterActionData?: GoTalkActionData;
  SceneRect?: PlistData;
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
  const spoken = ttsText && ttsText.length > 0 ? ttsText : label;

  switch (buttonType) {
    case 'Jump': {
      const jumpTo = actionData.JumpTo;
      // GoTalk treats 0 / -1 / "" as "no jump configured".
      const target = !isNoJumpTarget(jumpTo) ? String(jumpTo) : undefined;
      return {
        semanticAction: {
          category: AACSemanticCategory.NAVIGATION,
          intent: AACSemanticIntent.NAVIGATE_TO,
          targetId: target,
          platformData: {
            gotalkNow: { buttonType: 'Jump', jumpTo, jumpBook: actionData.JumpBook },
          },
          fallback: target ? { type: 'NAVIGATE', targetPageId: target } : { type: 'ACTION' },
        },
        message: '',
        targetPageId: target,
      };
    }
    case 'Audio':
    case 'Recorded': {
      // Recorded audio: plays a .caf file named <pageId>-<buttonIndex>.caf.
      // Recorded buttons may also have TrimStart/TrimEnd for audio trimming.
      const audioLocation = `${pageId}-${buttonIndex}.caf`;
      return {
        semanticAction: {
          category: AACSemanticCategory.MEDIA,
          intent: AACSemanticIntent.PLAY_SOUND,
          platformData: {
            gotalkNow: {
              buttonType,
              audioLocation,
              trimStart: actionData.TrimStart,
              trimEnd: actionData.TrimEnd,
            },
          },
          fallback: { type: 'ACTION' },
        },
        message: spoken,
      };
    }
    case 'URL': {
      return {
        semanticAction: {
          category: AACSemanticCategory.SYSTEM_CONTROL,
          intent: AACSemanticIntent.WEB_NAVIGATE,
          text: actionData.URL,
          platformData: {
            gotalkNow: {
              buttonType: 'URL',
              url: actionData.URL,
              openInternally: actionData.OpenInternally,
            },
          },
          fallback: { type: 'ACTION' },
        },
        message: spoken,
      };
    }
    case 'GoVisual': {
      return {
        semanticAction: {
          category: AACSemanticCategory.SYSTEM_CONTROL,
          intent: AACSemanticIntent.PLATFORM_SPECIFIC,
          platformData: {
            gotalkNow: {
              buttonType: 'GoVisual',
              goVisual: actionData.GoVisual,
              goVisualLink: actionData.GoVisualLink,
            },
          },
          fallback: { type: 'ACTION' },
        },
        message: spoken,
      };
    }
    case 'Video': {
      return {
        semanticAction: {
          category: AACSemanticCategory.MEDIA,
          intent: AACSemanticIntent.PLAY_VIDEO,
          platformData: {
            gotalkNow: { buttonType: 'Video' },
          },
          fallback: { type: 'ACTION' },
        },
        message: spoken,
      };
    }
    case 'Express':
    case 'Bookmark': {
      return {
        semanticAction: {
          category: AACSemanticCategory.SYSTEM_CONTROL,
          intent: AACSemanticIntent.PLATFORM_SPECIFIC,
          platformData: {
            gotalkNow: { buttonType },
          },
          fallback: { type: 'ACTION' },
        },
        message: spoken,
      };
    }
    case 'TTS':
    default: {
      // Empty/placeholder cells (no ButtonType or no label) get a SPEAK with empty text.
      return {
        semanticAction: {
          category: AACSemanticCategory.COMMUNICATION,
          intent: AACSemanticIntent.SPEAK_TEXT,
          text: spoken,
          platformData: {
            gotalkNow: { buttonType: buttonType === 'TTS' ? 'TTS' : 'Empty' },
          },
          fallback: { type: 'SPEAK', message: spoken },
        },
        message: spoken,
      };
    }
  }
}

/**
 * Derive a GoTalk NOW layout from the declared button count.
 * GoTalk NOW uses fixed square layouts (1, 4, 9, 16, 25, 36 …); when the
 * count is not a perfect square (alternate/custom layouts), fall back to a
 * near-square rectangle: cols = ceil(sqrt(n)), rows = ceil(n / cols).
 */
function gridDimensionsFromButtonCount(count: number): { rows: number; cols: number } {
  const n = Math.max(count, 1);
  const side = Math.ceil(Math.sqrt(n));
  return { rows: Math.ceil(n / side), cols: side };
}

/** GoTalk treats JumpTo 0 / -1 / "" as "no jump". */
function isNoJumpTarget(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === 0 ||
    value === -1 ||
    value === '' ||
    value === '0' ||
    value === '-1'
  );
}

/** Normalise a zip or iOS-container path to a lowercase basename. */
function basenameLower(p: string | undefined): string | null {
  if (!p) return null;
  const base = p.replace(/\\/g, '/').split('/').pop() || '';
  const trimmed = base.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve a bundled image for a button against the archive's file list.
 *
 * `Location`/`QuickRecoveryPath` values are iOS app-container paths that never
 * match archive entry names verbatim, so candidates are matched by basename
 * (case-insensitive), with extension guessing when the name has none.
 */
function findZipImageEntry(
  zipBasenames: Map<string, string>,
  candidates: Array<string | undefined>
): { entry: string; ext: string } | null {
  const tried = new Set<string>();
  for (const candidate of candidates) {
    const base = basenameLower(candidate);
    if (!base || tried.has(base)) continue;
    tried.add(base);
    // 1. Exact basename match.
    const direct = zipBasenames.get(base);
    if (direct) {
      const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '.png';
      return { entry: direct, ext };
    }
    // 2. Try common image extensions.
    for (const ext of ['.png', '.jpg', '.jpeg', '.bmp']) {
      const hit = zipBasenames.get(base + ext);
      if (hit) return { entry: hit, ext };
    }
  }
  return null;
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

  /**
   * Resolve a plist entry name inside the archive, tolerating both layout
   * variants: `.gtbz` (plists at ZIP root) and `.gotalk-book` share exports
   * (plists nested under a `<BookName>.gotalk-book/` folder). `__MACOSX`
   * resource-fork entries are ignored. Returns the full entry name, or null.
   */
  private resolveEntryName(files: string[], basename: string, prefix: string): string | null {
    const rooted = `${prefix}${basename}`;
    if (files.includes(rooted)) return rooted;
    // Nested variant: find the (non-__MACOSX) entry ending in /<basename>.
    const matches = files.filter(
      (f) => f !== `__MACOSX` && !f.startsWith('__MACOSX/') && f.endsWith(`/${basename}`)
    );
    return matches.length > 0 ? matches[0] : null;
  }

  private async readPlistFromZip(
    zip: Awaited<ReturnType<typeof this.options.zipAdapter>>,
    name: string,
    resolvedName: string | null,
    fallback?: () => PlistValue
  ): Promise<PlistValue> {
    if (!resolvedName) {
      if (fallback) return fallback();
      throw new Error(`GoTalk NOW archive is missing ${name}`);
    }
    const bytes = await zip.readFile(resolvedName);
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
      // Resolve plist locations once; shared by load/processTexts round-trip.
      const files = zip.listFiles();
      const pdEntry = this.resolveEntryName(files, 'PageData.plist', '');
      const prefix = pdEntry ? pdEntry.slice(0, -'PageData.plist'.length) : '';
      pageDataValue = await this.readPlistFromZip(zip, 'PageData.plist', pdEntry);
      pageOrderValue = await this.readPlistFromZip(
        zip,
        'PageOrder.plist',
        this.resolveEntryName(files, 'PageOrder.plist', prefix),
        () => [] as unknown as PlistValue
      );
      bookInfoValue = await this.readPlistFromZip(
        zip,
        'BookInfo.plist',
        this.resolveEntryName(files, 'BookInfo.plist', prefix),
        () => ({}) as PlistValue
      );
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
    // Basename (lowercase, non-__MACOSX) -> full entry name, for tolerant
    // matching of bundled images in .gotalk-book share exports.
    const zipBasenames = new Map<string, string>();
    for (const f of zipFiles) {
      if (f.startsWith('__MACOSX/') || f.endsWith('/')) continue;
      const base = basenameLower(f);
      if (base && !zipBasenames.has(base)) zipBasenames.set(base, f);
    }

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
      // Sparse button maps: the grid size is max(index)+1, not the number of
      // keys (GoTalk snapshots and layouts are sized by the highest slot).
      const buttonCount =
        rawPage.ButtonCount ??
        (buttonIndices.length > 0 ? Math.max(...buttonIndices.map(Number)) + 1 : 0);

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
        // Heuristics (from real .gotalk-book share exports):
        //   - entries sourced from the app's bundled "GoTalk Image Library"
        //     are clip-art, not user content — skip them;
        //   - prefer the entry carrying QuickRecoveryPath; with multiple
        //     entries the second one is the user's image;
        //   - bundled files are matched by basename (Location/QRP are iOS
        //     container paths, never archive entry names);
        //   - last resort: the pre-rendered snapshot <page>-<btn>-<count>.png.
        const imagesAll = rawButton.ButtonImages;
        const images = Array.isArray(imagesAll)
          ? imagesAll.filter((im) => (im?.SourceLibrary || '') !== 'GoTalk Image Library')
          : [];
        if (images.length > 0) {
          const selected =
            images.find((im) => im.QuickRecoveryPath !== undefined) ??
            (images.length >= 2 ? images[1] : images[0]);
          if (selected) {
            const sourceLibrary = (selected.SourceLibrary || '').toLowerCase();
            const sourceImageName = selected.SourceImageName || '';
            const isLibrarySymbol =
              /metacom|pcs|symbolstix|widgit/.test(sourceLibrary) && sourceImageName.length > 0;

            if (selected.Location) button.image = selected.Location;
            if (selected.SourceLibrary) button.symbolLibrary = selected.SourceLibrary;
            if (sourceImageName) button.symbolPath = sourceImageName;

            if (!isLibrarySymbol) {
              const bundled = findZipImageEntry(zipBasenames, [
                selected.QuickRecoveryPath,
                selected.Location,
                selected.SourceImageName,
                `${pageId}-${btnIndex}-${buttonCount}.png`,
              ]);
              if (bundled) {
                button.image = bundled.entry;
                button.resolvedImageEntry = bundled.entry;
              }
            } else if (zipFiles.has(selected.Location || '')) {
              button.resolvedImageEntry = selected.Location;
            }
          }
        }

        // Visibility: GoTalk buttons can be disabled via either field.
        if (rawButton.Enabled === false || rawButton.Disabled === true) {
          button.visibility = 'Disabled';
        }

        // Auditory cue (played when scanning/highlighting).
        if (rawButton.CueType && rawButton.CueType !== 'None') {
          const cueText = rawButton.CueData?.TTSText;
          if (cueText && cueText.length > 0) {
            button.audioDescription = cueText;
          }
        }

        // Recorded audio reference.
        const btnType = rawButton.ButtonType;
        if (btnType === 'Audio' || btnType === 'Recorded') {
          button.audioRecording = {
            identifier: `${pageId}-${btnIndex}.caf`,
          };
        }

        // AfterAction: motor-planning "speak and return" behaviour.
        // AfterAction is an enum (0=stay, 2=..., 50=jump-back) and
        // AfterActionData has the same shape as ActionData (e.g. {JumpTo: 0}).
        const afterActionJumpTo = rawButton.AfterActionData?.JumpTo;

        // Preserve raw style + extended data opaquely for round-trip styling.
        button.parameters = {
          ...(button.parameters || {}),
          __gotalkNow: {
            buttonType: rawButton.ButtonType,
            textShadow: rawButton.TextShadow,
            textCenter: rawButton.TextCenter,
            cueType: rawButton.CueType,
            afterAction: rawButton.AfterAction,
            afterActionJumpTo:
              afterActionJumpTo !== undefined ? String(afterActionJumpTo) : undefined,
            jumpBook: rawButton.ActionData?.JumpBook,
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

    // Parse PageData and apply translations in place. Locate the plist the
    // same tolerant way loadIntoTree does (root or nested .gotalk-book folder)
    // and write it back under its original entry name so the layout survives.
    const files = originalZip.listFiles();
    const pdEntry = this.resolveEntryName(files, 'PageData.plist', '') ?? 'PageData.plist';
    const pageDataBytes = await originalZip.readFile(pdEntry);
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
    const filesOut: { name: string; data: string | Uint8Array }[] = [];
    for (const name of originalZip.listFiles()) {
      if (name === pdEntry) continue;
      filesOut.push({ name, data: await originalZip.readFile(name) });
    }
    filesOut.push({ name: pdEntry, data: rebuiltPageData });

    const outputBuffer = await outputZip.writeFiles(filesOut);
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
