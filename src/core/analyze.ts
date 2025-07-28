import { OpmlProcessor } from "../processors/opmlProcessor";
import { ObfProcessor } from "../processors/obfProcessor";
import { TouchChatProcessor } from "../processors/touchchatProcessor";
import { GridsetProcessor } from "../processors/gridsetProcessor";
import { AstericsGridProcessor } from "../processors/astericsGridProcessor";
import { SnapProcessor } from "../processors/snapProcessor";
import { DotProcessor } from "../processors/dotProcessor";
import { ApplePanelsProcessor } from "../processors/applePanelsProcessor";
import { AACTree } from "./treeStructure";
import { BaseProcessor, ProcessorOptions } from "./baseProcessor";
import fs from "fs";

export function getProcessor(
  format: string,
  options?: ProcessorOptions,
): BaseProcessor {
  const normalizedFormat = (format || "").toLowerCase();

  switch (normalizedFormat) {
    case "opml":
      return new OpmlProcessor(options);
    case "obf":
      return new ObfProcessor(options);
    case "touchchat":
    case "ce": // TouchChat file extension
      return new TouchChatProcessor(options);
    case "gridset":
      return new GridsetProcessor(options); // Grid3 format
    case "grd": // Asterics Grid file extension
      return new AstericsGridProcessor(options);
    case "snap":
    case "sps": // Snap file extension
    case "spb": // Snap backup file extension
      return new SnapProcessor(options);
    case "dot":
      return new DotProcessor(options);
    case "applepanels":
    case "panels": // Apple Panels file extension
    case "ascconfig": // Apple Panels folder format
      return new ApplePanelsProcessor(options);
    default:
      throw new Error("Unknown format: " + format);
  }
}

export function analyze(file: string, format: string) {
  const processor = getProcessor(format);
  const tree = processor.loadIntoTree(file);
  return { tree };
}
