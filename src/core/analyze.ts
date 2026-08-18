import { OpmlProcessor } from '../processors/opmlProcessor';
import { ObfProcessor } from '../processors/obfProcessor';
import { TouchChatProcessor } from '../processors/touchchatProcessor';
import { GridsetProcessor } from '../processors/gridsetProcessor';
import { AstericsGridProcessor } from '../processors/astericsGridProcessor';
import { SnapProcessor } from '../processors/snapProcessor';
import { DotProcessor } from '../processors/dotProcessor';
import { ExcelProcessor } from '../processors/excelProcessor';
import { ApplePanelsProcessor } from '../processors/applePanelsProcessor';
import { GotalkNowProcessor } from '../processors/gotalkNowProcessor';
import { AACTree } from './treeStructure';
import { BaseProcessor, ProcessorOptions } from './baseProcessor';

/**
 * Resolve a processor instance by friendly format name or common extension.
 * @param format Format key or extension (e.g., 'snap', 'obf', 'xlsx')
 * @param options Optional processor configuration
 */
export function getProcessor(format: string, options?: ProcessorOptions): BaseProcessor {
  const normalizedFormat = (format || '').toLowerCase();

  switch (normalizedFormat) {
    case 'opml':
      return new OpmlProcessor(options);
    case 'obf':
    case 'obfset': // Obfset files use ObfProcessor
      return new ObfProcessor(options);
    case 'touchchat':
    case 'ce': // TouchChat file extension
      return new TouchChatProcessor(options);
    case 'gridset':
    case 'gridsetx':
      return new GridsetProcessor(options); // Grid3 format
    case 'grd': // Asterics Grid file extension
      return new AstericsGridProcessor(options);
    case 'snap':
    case 'sps': // Snap file extension
    case 'spb': // Snap backup file extension
      return new SnapProcessor(options);
    case 'dot':
      return new DotProcessor(options);
    case 'excel':
    case 'xlsx': // Excel file extension
      return new ExcelProcessor(options);
    case 'applepanels':
    case 'panels': // Apple Panels file extension
    case 'ascconfig': // Apple Panels folder format
      return new ApplePanelsProcessor(options);
    case 'gotalknow':
    case 'gotalk':
    case 'gtbz': // GoTalk NOW file extension
      return new GotalkNowProcessor(options);
    default:
      throw new Error('Unknown format: ' + format);
  }
}

/**
 * Convenience helper to load a file into an AACTree using the inferred processor.
 * @param file Path to the source file
 * @param format Format key or extension (passed to getProcessor)
 */
export async function analyze(file: string, format: string): Promise<{ tree: AACTree }> {
  const processor = getProcessor(format);
  const tree = await processor.loadIntoTree(file);
  return { tree };
}
