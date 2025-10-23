#!/usr/bin/env ts-node

/**
 * Demonstration of the unified alias interface for aac-tools-platform integration
 * Shows how all processors now support consistent method signatures
 */

import {
  TouchChatProcessor,
  ObfProcessor,
  SnapProcessor,
  DotProcessor,
  GridsetProcessor,
  ApplePanelsProcessor,
  AstericsGridProcessor,
  ExcelProcessor,
  OpmlProcessor,
  StringCasing,
  detectCasing,
  ExtractStringsResult,
  TranslatedString,
  SourceString
} from "../dist/index";

async function demonstrateUnifiedInterface() {
  console.log("🚀 AAC Processors - Unified Interface Demo");
  console.log("==========================================\n");

  // Create instances of different processors
  const processors = [
    { name: "TouchChat", processor: new TouchChatProcessor(), extension: ".ce" },
    { name: "OBF", processor: new ObfProcessor(), extension: ".obf" },
    { name: "Snap", processor: new SnapProcessor(), extension: ".spb" },
    { name: "Grid3", processor: new GridsetProcessor(), extension: ".gridset" },
    { name: "Apple Panels", processor: new ApplePanelsProcessor(), extension: ".ascconfig" },
    { name: "Asterics Grid", processor: new AstericsGridProcessor(), extension: ".grd" },
    { name: "Excel", processor: new ExcelProcessor(), extension: ".xlsx" },
    { name: "OPML", processor: new OpmlProcessor(), extension: ".opml" },
    { name: "DOT", processor: new DotProcessor(), extension: ".dot" }
  ];

  console.log("1. 📋 Checking Unified Interface Availability");
  console.log("----------------------------------------------");
  
  processors.forEach(({ name, processor }) => {
    const hasExtractMethod = typeof processor.extractStringsWithMetadata === 'function';
    const hasGenerateMethod = typeof processor.generateTranslatedDownload === 'function';
    
    console.log(`${name} Processor:`);
    console.log(`  ✅ extractStringsWithMetadata: ${hasExtractMethod ? 'Available' : 'Not Available'}`);
    console.log(`  ✅ generateTranslatedDownload: ${hasGenerateMethod ? 'Available' : 'Not Available'}`);
    console.log(`  ✅ Backward compatibility: ${typeof processor.extractTexts === 'function' ? 'Maintained' : 'Broken'}`);
    console.log();
  });

  console.log("2. 🔤 String Casing Detection Demo");
  console.log("----------------------------------");
  
  const testStrings = [
    "Hello World",
    "hello world", 
    "HELLO WORLD",
    "helloWorld",
    "HelloWorld",
    "hello_world",
    "HELLO_WORLD",
    "hello-world",
    "Hello-World"
  ];

  testStrings.forEach(str => {
    const casing = detectCasing(str);
    console.log(`"${str}" → ${casing}`);
  });
  console.log();

  console.log("3. 🔄 Mock Translation Workflow");
  console.log("-------------------------------");
  
  // Mock data for demonstration
  const mockExtractedResult: ExtractStringsResult = {
    errors: [],
    extractedStrings: [
      {
        string: "Hello",
        vocabPlacementMeta: {
          vocabLocations: [{
            table: "buttons",
            id: 1,
            column: "LABEL",
            casing: StringCasing.CAPITAL
          }]
        }
      },
      {
        string: "goodbye",
        vocabPlacementMeta: {
          vocabLocations: [{
            table: "buttons", 
            id: 2,
            column: "MESSAGE",
            casing: StringCasing.LOWER
          }]
        }
      }
    ]
  };

  const mockTranslatedStrings: TranslatedString[] = [
    {
      sourcestringid: 1,
      overridestring: "",
      translatedstring: "Hola"
    },
    {
      sourcestringid: 2,
      overridestring: "Adiós",
      translatedstring: "goodbye_translated"
    }
  ];

  const mockSourceStrings: SourceString[] = [
    {
      id: 1,
      sourcestring: "Hello",
      vocabplacementmetadata: mockExtractedResult.extractedStrings[0].vocabPlacementMeta
    },
    {
      id: 2,
      sourcestring: "goodbye", 
      vocabplacementmetadata: mockExtractedResult.extractedStrings[1].vocabPlacementMeta
    }
  ];

  console.log("📤 Mock Extracted Strings:");
  mockExtractedResult.extractedStrings.forEach((extracted, index) => {
    console.log(`  ${index + 1}. "${extracted.string}" (${extracted.vocabPlacementMeta.vocabLocations[0].casing})`);
    console.log(`     Location: ${extracted.vocabPlacementMeta.vocabLocations[0].table}.${extracted.vocabPlacementMeta.vocabLocations[0].column}[${extracted.vocabPlacementMeta.vocabLocations[0].id}]`);
  });
  console.log();

  console.log("🔄 Mock Translation Mapping:");
  mockTranslatedStrings.forEach((translation) => {
    const sourceString = mockSourceStrings.find(s => s.id === translation.sourcestringid);
    const finalTranslation = translation.overridestring || translation.translatedstring;
    console.log(`  "${sourceString?.sourcestring}" → "${finalTranslation}"`);
  });
  console.log();

  console.log("4. 🎯 Processor-Specific Features");
  console.log("---------------------------------");
  
  console.log("TouchChat Processor:");
  console.log("  • Extracts from SQLite database within .ce files");
  console.log("  • Handles button labels, messages, and pronunciations");
  console.log("  • Preserves TouchChat-specific metadata");
  console.log();
  
  console.log("Generic Processors (OBF, Snap, DOT):");
  console.log("  • Use unified extraction logic from BaseProcessor");
  console.log("  • Extract page names and button content");
  console.log("  • Consistent metadata format across all formats");
  console.log();

  console.log("5. ✅ Integration Benefits");
  console.log("-------------------------");
  console.log("✅ Unified API: All processors support the same method signatures");
  console.log("✅ Backward Compatible: Existing methods continue to work unchanged");
  console.log("✅ Extensible: Easy to add new AAC formats with consistent interface");
  console.log("✅ Type Safe: Full TypeScript support with proper type definitions");
  console.log("✅ Error Handling: Consistent error format across all processors");
  console.log("✅ Metadata Rich: Detailed location and casing information for translations");
  console.log();

  console.log("🎉 Demo Complete! The unified interface is ready for aac-tools-platform integration.");
}

// Run the demo
if (require.main === module) {
  demonstrateUnifiedInterface().catch(console.error);
}

export { demonstrateUnifiedInterface };
