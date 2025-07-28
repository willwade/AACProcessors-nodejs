import { OpmlProcessor } from "../processors/opmlProcessor";
import { ObfProcessor } from "../processors/obfProcessor";
import { TouchChatProcessor } from "../processors/touchchatProcessor";
import { GridsetProcessor } from "../processors/gridsetProcessor";
import { AstericsGridProcessor } from "../processors/astericsGridProcessor";
import { SnapProcessor } from "../processors/snapProcessor";
import { DotProcessor } from "../processors/dotProcessor";
import { ApplePanelsProcessor } from "../processors/applePanelsProcessor";
import { AACTree } from "./treeStructure";
import { BaseProcessor } from "./baseProcessor";
import fs from "fs";

export function getProcessor(format: string): BaseProcessor {
  const normalizedFormat = (format || "").toLowerCase();

  switch (normalizedFormat) {
    case "opml":
      return new OpmlProcessor();
    case "obf":
      return new ObfProcessor();
    case "touchchat":
    case "ce": // TouchChat file extension
      return new TouchChatProcessor();
    case "gridset":
      return new GridsetProcessor(); // Grid3 format
    case "grd": // Asterics Grid file extension
      return new AstericsGridProcessor();
    case "snap":
    case "sps": // Snap file extension
    case "spb": // Snap backup file extension
      return new SnapProcessor();
    case "dot":
      return new DotProcessor();
    case "applepanels":
    case "panels": // Apple Panels file extension
      return new ApplePanelsProcessor();
    default:
      throw new Error("Unknown format: " + format);
  }
}

export function analyze(file: string, format: string) {
  const processor = getProcessor(format);
  const fileBuffer = fs.readFileSync(file);
  const tree = processor.loadIntoTree(fileBuffer);
  return { tree };
}
