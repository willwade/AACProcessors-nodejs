#!/usr/bin/env node
import { program } from "commander";
import { prettyPrintTree } from "./prettyPrint";
import { analyze, getProcessor } from "../core/analyze";
import path from "path";
import fs from "fs";

// Set version from package.json
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../package.json"), "utf8"),
);
program.version(packageJson.version);

program
  .command("analyze <file>")
  .option("--format <format>", "Format type")
  .option("--pretty", "Pretty print output")
  .action(async (file, options) => {
    const result = await analyze(file, options.format);
    if (options.pretty) {
      console.log(prettyPrintTree(result.tree));
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  });

program
  .command("extract <file>")
  .option("--format <format>", "Format type (auto-detected if not specified)")
  .option("--verbose", "Verbose output")
  .option("--quiet", "Quiet output")
  .action(async (file, options) => {
    try {
      // Auto-detect format if not specified
      const format = options.format || path.extname(file).slice(1);
      const processor = getProcessor(format);
      const texts = processor.extractTexts(file);

      if (!options.quiet) {
        if (options.verbose) {
          console.log(`Extracting texts from ${file} (format: ${format})`);
          console.log(`Found ${texts.length} text entries:`);
        }
      }

      // Output the texts (one per line for easier processing)
      texts.forEach((text) => console.log(text));
    } catch (error) {
      console.error(
        "Error extracting texts:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

program
  .command("convert <input> <output>")
  .option("--format <format>", "Output format (required)")
  .action(async (input, output, options) => {
    try {
      if (!options.format) {
        console.error("Error: --format option is required for convert command");
        process.exit(1);
      }

      // Auto-detect input format
      const inputFormat = path.extname(input).slice(1);
      const inputProcessor = getProcessor(inputFormat);

      // Load the tree from input
      const tree = inputProcessor.loadIntoTree(input);

      // Save using output format
      const outputProcessor = getProcessor(options.format);
      outputProcessor.saveFromTree(tree, output);

      console.log(
        `Successfully converted ${input} to ${output} (${options.format} format)`,
      );
    } catch (error) {
      console.error(
        "Error converting file:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

// Show help if no command provided
if (process.argv.length <= 2) {
  program.help();
}

program.parse(process.argv);
