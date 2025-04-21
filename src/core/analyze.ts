import { OpmlProcessor } from '../processors/opmlProcessor';
import { ObfProcessor } from '../processors/obfProcessor';
import { TouchChatProcessor } from '../processors/touchchatProcessor';
import { GridsetProcessor } from '../processors/gridsetProcessor';
import { SnapProcessor } from '../processors/snapProcessor';
import { DotProcessor } from '../processors/dotProcessor';
import { ApplePanelsProcessor } from '../processors/applePanelsProcessor';
import { AACTree } from './treeStructure';
import fs from 'fs';

export function getProcessor(format: string) {
  switch ((format || '').toLowerCase()) {
    case 'opml':
      return new OpmlProcessor();
    case 'obf':
      return new ObfProcessor();
    case 'touchchat':
      return new TouchChatProcessor();
    case 'gridset':
      return new GridsetProcessor();
    case 'snap':
      return new SnapProcessor();
    case 'dot':
      return new DotProcessor();
    case 'applepanels':
      return new ApplePanelsProcessor();
    default:
      throw new Error('Unknown format: ' + format);
  }
}

export async function analyze(file: string, format: string) {
  let processor;
  switch ((format || '').toLowerCase()) {
    case 'opml':
      processor = new OpmlProcessor(); break;
    case 'obf':
      processor = new ObfProcessor(); break;
    case 'touchchat':
      processor = new TouchChatProcessor(); break;
    case 'gridset':
      processor = new GridsetProcessor(); break;
    case 'snap':
      processor = new SnapProcessor(); break;
    case 'dot':
      processor = new DotProcessor(); break;
    case 'applepanels':
      processor = new ApplePanelsProcessor(); break;
    default:
      throw new Error('Unknown format: ' + format);
  }
  const fileBuffer = fs.readFileSync(file);
  const tree: AACTree = processor.loadIntoTree(fileBuffer);
  return { tree };
}
