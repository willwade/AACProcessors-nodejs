import { OpmlProcessor } from "../processors/opmlProcessor";
import { ObfProcessor } from "../processors/obfProcessor";
import { TouchChatProcessor } from "../processors/touchchatProcessor";
import { GridsetProcessor } from "../processors/gridsetProcessor";
import { SnapProcessor } from "../processors/snapProcessor";
import { DotProcessor } from "../processors/dotProcessor";
import { ApplePanelsProcessor } from "../processors/applePanelsProcessor";
import { AACTree } from "./treeStructure";
import fs from "fs";

export function getProcessor(format: string) {
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
    case "grd": // Gridset file extension
      return new GridsetProcessor();
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

export async function analyze(file: string, format: string) {
  const processor = getProcessor(format);
  const fileBuffer = fs.readFileSync(file);
  const tree: AACTree = processor.loadIntoTree(fileBuffer);
  return { tree };
}
