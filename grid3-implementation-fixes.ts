// Critical Grid3 Implementation Fixes

// 1. Fix Grid Dimension Detection
private parseGridDimensions(grid: any): { columns: number; rows: number } {
  const columnDefs = grid.ColumnDefinitions?.ColumnDefinition || [];
  const rowDefs = grid.RowDefinitions?.RowDefinition || [];
  
  const columns = Array.isArray(columnDefs) ? columnDefs.length : (columnDefs ? 1 : 4);
  const rows = Array.isArray(rowDefs) ? rowDefs.length : (rowDefs ? 1 : 4);
  
  return { columns, rows };
}

// 2. Parse Cell Content Types
private parseCellContentType(content: any): {
  contentType: 'Normal' | 'AutoContent' | 'Workspace' | 'LiveCell';
  contentSubType?: string;
  parameters?: { [key: string]: any };
} {
  const contentType = content.ContentType || 'Normal';
  const contentSubType = content.ContentSubType;
  const parameters = {};
  
  // Parse Parameters if they exist
  if (content.Parameters?.Parameter) {
    const paramArr = Array.isArray(content.Parameters.Parameter) 
      ? content.Parameters.Parameter 
      : [content.Parameters.Parameter];
      
    paramArr.forEach((param: any) => {
      const key = param.Key || param.key;
      const value = param['#text'];
      if (key && value !== undefined) {
        parameters[key] = value;
      }
    });
  }
  
  return { contentType, contentSubType, parameters };
}

// 3. Parse Cell Positioning with Span Support
private parseCellPosition(cell: any): {
  x: number; y: number; columnSpan: number; rowSpan: number;
} {
  return {
    x: parseInt(cell['@_X'] || '0', 10),
    y: parseInt(cell['@_Y'] || '0', 10),
    columnSpan: parseInt(cell['@_ColumnSpan'] || '1', 10),
    rowSpan: parseInt(cell['@_RowSpan'] || '1', 10)
  };
}

// 4. Parse Accessibility Features
private parseAccessibilityFeatures(cell: any): {
  scanBlocks: number[];
  visibility: string;
  directActivate: boolean;
} {
  const scanBlocks: number[] = [];
  
  // Single ScanBlock attribute
  if (cell['@_ScanBlock']) {
    scanBlocks.push(parseInt(cell['@_ScanBlock'], 10));
  }
  
  // Multiple ScanBlocks element
  if (cell.ScanBlocks?.ScanBlock) {
    const blocks = Array.isArray(cell.ScanBlocks.ScanBlock) 
      ? cell.ScanBlocks.ScanBlock 
      : [cell.ScanBlocks.ScanBlock];
    blocks.forEach((block: any) => {
      const blockNum = parseInt(block, 10);
      if (!isNaN(blockNum) && blockNum >= 1 && blockNum <= 8) {
        scanBlocks.push(blockNum);
      }
    });
  }
  
  return {
    scanBlocks,
    visibility: cell.Visibility || 'Visible',
    directActivate: cell.DirectActivate === '1' || cell.DirectActivate === 1
  };
}

// 5. Parse Symbol References
private parseSymbolReference(image: string): {
  library: string;
  path: string;
  isLibraryReference: boolean;
} {
  const libraryMatch = image.match(/^\[([^\]]+)\](.+)$/);
  
  if (libraryMatch) {
    return {
      library: libraryMatch[1],
      path: libraryMatch[2],
      isLibraryReference: true
    };
  }
  
  return {
    library: '',
    path: image,
    isLibraryReference: false
  };
}

// 6. Enhanced Command Parsing with Rich Parameters
private parseCommandParameters(command: any): { [key: string]: any } {
  const parameters: { [key: string]: any } = {};
  
  if (!command.Parameter) return parameters;
  
  const paramArr = Array.isArray(command.Parameter) 
    ? command.Parameter 
    : [command.Parameter];
    
  paramArr.forEach((param: any) => {
    const key = param.Key || param.key;
    
    if (!key) return;
    
    // Handle different parameter types
    if (param['#text']) {
      // Simple text parameter
      parameters[key] = param['#text'];
    } else if (param.SymbolRun) {
      // Rich text with symbols
      parameters[key] = this.parseSymbolRun(param.SymbolRun);
    } else if (param.WordList) {
      // WordList parameter
      parameters[key] = this.parseWordList(param.WordList);
    } else if (typeof param === 'object') {
      // Complex object parameter
      parameters[key] = param;
    }
  });
  
  return parameters;
}

// 7. Parse Rich Text SymbolRun
private parseSymbolRun(symbolRun: any): {
  text: string;
  symbols: Array<{ text: string; image?: string }>;
} {
  const symbols: Array<{ text: string; image?: string }> = [];
  let text = '';
  
  if (symbolRun.Run) {
    const runs = Array.isArray(symbolRun.Run) ? symbolRun.Run : [symbolRun.Run];
    runs.forEach((run: any) => {
      const runText = typeof run === 'string' ? run : run['#text'] || '';
      text += runText;
      symbols.push({ 
        text: runText, 
        image: symbolRun.Image || symbolRun['@_Image'] 
      });
    });
  }
  
  return { text, symbols };
}

// 8. Parse WordList Structure
private parseWordList(wordList: any): {
  items: Array<{
    text: string;
    image?: string;
    partOfSpeech?: string;
  }>;
} {
  const items: Array<{ text: string; image?: string; partOfSpeech?: string }> = [];
  
  if (wordList.Items?.WordListItem) {
    const itemArr = Array.isArray(wordList.Items.WordListItem) 
      ? wordList.Items.WordListItem 
      : [wordList.Items.WordListItem];
      
    itemArr.forEach((item: any) => {
      let text = '';
      
      // Extract text from complex structure
      if (item.Text?.s?.r) {
        text = item.Text.s.r;
      } else if (item.Text) {
        text = typeof item.Text === 'string' ? item.Text : item.Text['#text'] || '';
      }
      
      items.push({
        text,
        image: item.Image,
        partOfSpeech: item.PartOfSpeech
      });
    });
  }
  
  return { items };
}

// 9. Missing Command Implementations
private generateMissingCommands(action: AACAction): any {
  switch (action.type) {
    case "JUMP_HOME":
      return { Command: { "@_ID": "Jump.Home" } };
      
    case "JUMP_TO_KEYBOARD":
      return { Command: { "@_ID": "Jump.ToKeyboard" } };
      
    case "DELETE_LETTER":
      return { Command: { "@_ID": "Action.DeleteLetter" } };
      
    case "COPY":
      return { Command: { "@_ID": "Action.Copy" } };
      
    case "PASTE":
      return { Command: { "@_ID": "Action.Paste" } };
      
    case "SPEAK_NOW":
      return {
        Command: {
          "@_ID": "Speech.SpeakNow",
          Parameter: {
            "@_Key": "text",
            "#text": action.text || ""
          }
        }
      };
      
    case "STOP_SPEECH":
      return { Command: { "@_ID": "Speech.Stop" } };
      
    case "KEYBOARD_INPUT":
      return {
        Command: {
          "@_ID": "ComputerControl.Keyboard",
          Parameter: {
            "@_Key": "keystring",
            "#text": action.keyString || ""
          }
        }
      };
      
    case "MOUSE_CLICK":
      return {
        Command: {
          "@_ID": "ComputerControl.MouseLeftClick",
          Parameter: {
            "@_Key": "button",
            "#text": action.mouseButton || "Left"
          }
        }
      };
      
    case "VERB_MORPHOLOGY":
      const verbParams = [];
      if (action.verbPart) verbParams.push({ "@_Key": "verbpart", "#text": action.verbPart });
      if (action.person) verbParams.push({ "@_Key": "person", "#text": action.person });
      if (action.number) verbParams.push({ "@_Key": "number", "#text": action.number });
      
      return {
        Command: {
          "@_ID": "Grammar.VerbMorphology",
          ...(verbParams.length > 0 ? { Parameter: verbParams } : {})
        }
      };
      
    case "PREDICTION_TOOL":
      return { Command: { "@_ID": "Prediction.CorrectionTool" } };
      
    default:
      return null;
  }
}
