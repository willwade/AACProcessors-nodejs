#!/usr/bin/env node
import { program } from "commander";
import { prettyPrintTree } from "./prettyPrint";
import { getProcessor } from "../core/analyze";
import { ProcessorOptions } from "../core/baseProcessor";
import path from "path";
import fs from "fs";

// Helper function to detect format from file/folder path
function detectFormat(filePath: string): string {
  // Check if it's a folder ending with .ascconfig
  if (
    fs.existsSync(filePath) &&
    fs.statSync(filePath).isDirectory() &&
    filePath.endsWith(".ascconfig")
  ) {
    return "ascconfig";
  }

  // Map multi-file formats to their base processor
  if (filePath.endsWith(".obfset")) {
    return "obf"; // Use ObfProcessor for .obfset files
  }
  if (filePath.endsWith(".gridset")) {
    return "gridset";
  }

  // Otherwise use file extension
  return path.extname(filePath).slice(1);
}

// Helper function to parse filtering options from CLI arguments
function parseFilteringOptions(options: {
  preserveAllButtons?: boolean;
  excludeNavigation?: boolean;
  excludeSystem?: boolean;
  excludeButtons?: string;
  gridsetPassword?: string;
}): ProcessorOptions {
  const processorOptions: ProcessorOptions = {};

  if (options.gridsetPassword) {
    processorOptions.gridsetPassword = options.gridsetPassword;
  }

  // Handle preserve all buttons flag
  if (options.preserveAllButtons) {
    processorOptions.preserveAllButtons = true;
    return processorOptions; // If preserving all, ignore other options
  }

  // Handle specific exclusion flags
  if (options.excludeNavigation !== undefined) {
    processorOptions.excludeNavigationButtons = options.excludeNavigation;
  }
  if (options.excludeSystem !== undefined) {
    processorOptions.excludeSystemButtons = options.excludeSystem;
  }

  // Handle custom button exclusion list
  if (options.excludeButtons) {
    const excludeList = options.excludeButtons
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);

    if (excludeList.length > 0) {
      processorOptions.customButtonFilter = (button) => {
        const label = button.label?.toLowerCase() || "";
        const message = button.message?.toLowerCase() || "";

        // Exclude if button label or message contains any of the excluded terms
        return !excludeList.some(
          (term) => label.includes(term) || message.includes(term),
        );
      };
    }
  }

  return processorOptions;
}

// Set version from package.json
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../package.json"), "utf8"),
) as { version: string };
program.version(packageJson.version);

program
  .command("analyze <file>")
  .option("--format <format>", "Format type (auto-detected if not specified)")
  .option("--pretty", "Pretty print output")
  .option(
    "--preserve-all-buttons",
    "Preserve all buttons including navigation/system buttons",
  )
  .option(
    "--no-exclude-navigation",
    "Don't exclude navigation buttons (Home, Back)",
  )
  .option(
    "--no-exclude-system",
    "Don't exclude system buttons (Delete, Clear, etc.)",
  )
  .option(
    "--exclude-buttons <list>",
    "Comma-separated list of button labels/terms to exclude",
  )
  .option(
    "--gridset-password <password>",
    "Password for encrypted Grid3 archives (.gridsetx)",
  )
  .action(
    (
      file: string,
      options: {
        format?: string;
        pretty?: boolean;
        preserveAllButtons?: boolean;
        excludeNavigation?: boolean;
        excludeSystem?: boolean;
        excludeButtons?: string;
        gridsetPassword?: string;
      },
    ) => {
      try {
        // Parse filtering options
        const filteringOptions = parseFilteringOptions(options);

        // Auto-detect format if not specified
        const format = options.format || detectFormat(file);
        const processor = getProcessor(format, filteringOptions);
        const tree = processor.loadIntoTree(file);

        const result = {
          format,
          tree,
          filtering: filteringOptions,
        };

        if (options.pretty) {
          console.log(prettyPrintTree(result.tree));
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
      } catch (error) {
        console.error(
          "Error analyzing file:",
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    },
  );

program
  .command("extract <file>")
  .option("--format <format>", "Format type (auto-detected if not specified)")
  .option("--verbose", "Verbose output")
  .option("--quiet", "Quiet output")
  .option(
    "--preserve-all-buttons",
    "Preserve all buttons including navigation/system buttons",
  )
  .option(
    "--no-exclude-navigation",
    "Don't exclude navigation buttons (Home, Back)",
  )
  .option(
    "--no-exclude-system",
    "Don't exclude system buttons (Delete, Clear, etc.)",
  )
  .option(
    "--exclude-buttons <list>",
    "Comma-separated list of button labels/terms to exclude",
  )
  .option(
    "--gridset-password <password>",
    "Password for encrypted Grid3 archives (.gridsetx)",
  )
  .action(
    (
      file: string,
      options: {
        format?: string;
        verbose?: boolean;
        quiet?: boolean;
        preserveAllButtons?: boolean;
        excludeNavigation?: boolean;
        excludeSystem?: boolean;
        excludeButtons?: string;
        gridsetPassword?: string;
      },
    ) => {
      try {
        // Parse filtering options
        const filteringOptions = parseFilteringOptions(options);

        // Auto-detect format if not specified
        const format = options.format || detectFormat(file);
        const processor = getProcessor(format, filteringOptions);
        const texts = processor.extractTexts(file);

        if (!options.quiet) {
          if (options.verbose) {
            console.log(`Extracting texts from ${file} (format: ${format})`);
            console.log(`Found ${texts.length} text entries:`);

            // Show filtering info in verbose mode
            if (filteringOptions.preserveAllButtons) {
              console.log("Filtering: All buttons preserved");
            } else {
              const filters = [];
              if (filteringOptions.excludeNavigationButtons !== false)
                filters.push("navigation");
              if (filteringOptions.excludeSystemButtons !== false)
                filters.push("system");
              if (filteringOptions.customButtonFilter) filters.push("custom");
              if (filters.length > 0) {
                console.log(
                  `Filtering: Excluding ${filters.join(", ")} buttons`,
                );
              }
            }
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
    },
  );

program
  .command("convert <input> <output>")
  .option("--format <format>", "Output format (required)")
  .option(
    "--preserve-all-buttons",
    "Preserve all buttons including navigation/system buttons",
  )
  .option(
    "--no-exclude-navigation",
    "Don't exclude navigation buttons (Home, Back)",
  )
  .option(
    "--no-exclude-system",
    "Don't exclude system buttons (Delete, Clear, etc.)",
  )
  .option(
    "--exclude-buttons <list>",
    "Comma-separated list of button labels/terms to exclude",
  )
  .option(
    "--gridset-password <password>",
    "Password for encrypted Grid3 archives (.gridsetx)",
  )
  .action(
    async (
      input: string,
      output: string,
      options: {
        format?: string;
        preserveAllButtons?: boolean;
        excludeNavigation?: boolean;
        excludeSystem?: boolean;
        excludeButtons?: string;
        gridsetPassword?: string;
      },
    ) => {
      try {
        if (!options.format) {
          console.error(
            "Error: --format option is required for convert command",
          );
          process.exit(1);
        }

        // Parse filtering options
        const filteringOptions = parseFilteringOptions(options);

        // Auto-detect input format
        const inputFormat = detectFormat(input);
        const inputProcessor = getProcessor(inputFormat, filteringOptions);

        // Load the tree (handle both files and folders)
        const tree = inputProcessor.loadIntoTree(input);

        // Save using output format with same filtering options
        const outputProcessor = getProcessor(options.format, filteringOptions);
        await outputProcessor.saveFromTree(tree, output);

        // Show filtering summary
        let filteringSummary = "";
        if (filteringOptions.preserveAllButtons) {
          filteringSummary = " (all buttons preserved)";
        } else {
          const filters = [];
          if (filteringOptions.excludeNavigationButtons !== false)
            filters.push("navigation");
          if (filteringOptions.excludeSystemButtons !== false)
            filters.push("system");
          if (filteringOptions.customButtonFilter) filters.push("custom");
          if (filters.length > 0) {
            filteringSummary = ` (filtered: ${filters.join(", ")} buttons)`;
          }
        }

        console.log(
          `Successfully converted ${input} to ${output} (${options.format} format)${filteringSummary}`,
        );
      } catch (error) {
        console.error(
          "Error converting file:",
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    },
  );

program
  .command("validate <file>")
  .description("Validate an AAC file format")
  .option("--format <format>", "Format type (auto-detected if not specified)")
  .option("--json", "Output results as JSON")
  .option("--quiet", "Only output validation result (valid/invalid)")
  .option(
    "--gridset-password <password>",
    "Password for encrypted Grid3 archives (.gridsetx)",
  )
  .action(
    async (
      file: string,
      options: {
        format?: string;
        json?: boolean;
        quiet?: boolean;
        gridsetPassword?: string;
      },
    ) => {
      try {
        // Auto-detect format if not specified
        const format = options.format || detectFormat(file);

        // Get processor with gridset password if provided
        const processorOptions: ProcessorOptions = {};
        if (options.gridsetPassword) {
          processorOptions.gridsetPassword = options.gridsetPassword;
        }

        const processor = getProcessor(format, processorOptions);

        // Check if processor supports validation
        if (!processor.validate) {
          console.error(
            `Error: Validation not supported for format '${format}'`,
          );
          process.exit(1);
        }

        // Run validation
        const result = await processor.validate(file);

        // Output results
        if (options.quiet) {
          console.log(result.valid ? "valid" : "invalid");
        } else if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          // Pretty print validation results
          console.log(`\nValidation Results for: ${result.filename}`);
          console.log(`Format: ${result.format}`);
          console.log(`File size: ${result.filesize} bytes`);
          console.log(`Status: ${result.valid ? "✓ VALID" : "✗ INVALID"}`);
          console.log(`Errors: ${result.errors}`);
          console.log(`Warnings: ${result.warnings}\n`);

          if (result.errors > 0 || result.warnings > 0) {
            if (result.errors > 0) {
              console.log("Errors:");
              result.results
                .filter((r) => !r.valid)
                .forEach((check) => {
                  console.log(`  ✗ ${check.description}`);
                  if (check.error) {
                    console.log(`    ${check.error}`);
                  }
                });
            }

            if (result.warnings > 0) {
              console.log("\nWarnings:");
              result.results.forEach((check) => {
                if (check.warnings && check.warnings.length > 0) {
                  console.log(`  ⚠ ${check.description}`);
                  check.warnings.forEach((warning) => {
                    console.log(`    ${warning}`);
                  });
                }
              });
            }
          }

          // Show sub-results if available
          if (result.sub_results && result.sub_results.length > 0) {
            console.log("\nSub-results:");
            result.sub_results.forEach((sub, idx) => {
              console.log(`  [${idx + 1}] ${sub.filename}`);
              console.log(
                `      Status: ${sub.valid ? "✓" : "✗"} (${sub.errors} errors, ${sub.warnings} warnings)`,
              );
            });
          }

          console.log("");
        }

        // Exit with appropriate code
        process.exit(result.valid ? 0 : 1);
      } catch (error) {
        console.error(
          "Error validating file:",
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    },
  );

// Show help if no command provided
if (process.argv.length <= 2) {
  program.help();
}

program.parse(process.argv);
