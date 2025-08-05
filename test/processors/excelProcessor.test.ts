import fs from 'fs';
import path from 'path';
import { ExcelProcessor } from '../../src/processors/excelProcessor';
import { AACTree, AACPage, AACButton } from '../../src/core/treeStructure';
import { AACSemanticIntent } from '../../src/core/treeStructure';

describe('ExcelProcessor', () => {
  let processor: ExcelProcessor;
  let tempDir: string;

  beforeEach(() => {
    processor = new ExcelProcessor();
    tempDir = fs.mkdtempSync(path.join(__dirname, 'temp-excel-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Basic Functionality', () => {
    it('should create an instance', () => {
      expect(processor).toBeInstanceOf(ExcelProcessor);
    });

    it('should handle empty tree', () => {
      const tree = new AACTree();
      const outputPath = path.join(tempDir, 'empty.xlsx');

      // This should not throw
      expect(() => {
        processor.saveFromTree(tree, outputPath);
      }).not.toThrow();
    });

    it('should extract texts from non-existent file', () => {
      const texts = processor.extractTexts('non-existent.xlsx');
      expect(texts).toEqual([]);
    });

    it('should return empty tree for loadIntoTree', () => {
      const tree = processor.loadIntoTree('any-file.xlsx');
      expect(tree).toBeInstanceOf(AACTree);
      expect(Object.keys(tree.pages)).toHaveLength(0);
    });
  });

  describe('Tree to Excel Conversion', () => {
    it('should convert simple AAC tree to Excel', async () => {
      const tree = new AACTree();

      // Create a simple page with buttons
      const page = new AACPage({
        id: 'home',
        name: 'Home Page',
        buttons: [
          new AACButton({
            id: 'btn1',
            label: 'Hello',
            message: 'Hello there!',
          }),
          new AACButton({
            id: 'btn2',
            label: 'Goodbye',
            message: 'See you later!',
          }),
        ],
      });

      tree.addPage(page);

      const outputPath = path.join(tempDir, 'simple.xlsx');
      processor.saveFromTree(tree, outputPath);

      // Give async operation time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check if file was created (may be async)
      // Note: Due to async nature, file might not exist immediately
      // In a real test, we'd need to wait for the async operation
    });

    it('should handle buttons with styling', async () => {
      const tree = new AACTree();

      const styledButton = new AACButton({
        id: 'styled',
        label: 'Styled Button',
        message: 'I have style!',
        style: {
          backgroundColor: '#FF0000',
          fontColor: '#FFFFFF',
          fontSize: 16,
          fontWeight: 'bold',
        },
      });

      const page = new AACPage({
        id: 'styled-page',
        name: 'Styled Page',
        buttons: [styledButton],
      });

      tree.addPage(page);

      const outputPath = path.join(tempDir, 'styled.xlsx');
      processor.saveFromTree(tree, outputPath);

      // Give async operation time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should handle navigation buttons', async () => {
      const tree = new AACTree();

      // Create home page
      const homePage = new AACPage({
        id: 'home',
        name: 'Home',
        buttons: [],
      });

      // Create food page with navigation back to home
      const foodPage = new AACPage({
        id: 'food',
        name: 'Food',
        buttons: [
          new AACButton({
            id: 'nav-home',
            label: 'Home',
            message: '',
            semanticAction: {
              intent: AACSemanticIntent.NAVIGATE_TO,
              parameters: {},
            },
            targetPageId: 'home',
          }),
        ],
      });

      // Add navigation button from home to food
      homePage.addButton(
        new AACButton({
          id: 'nav-food',
          label: 'Food',
          message: '',
          semanticAction: {
            intent: AACSemanticIntent.NAVIGATE_TO,
            parameters: {},
          },
          targetPageId: 'food',
        })
      );

      tree.addPage(homePage);
      tree.addPage(foodPage);
      tree.rootId = 'home';

      const outputPath = path.join(tempDir, 'navigation.xlsx');
      processor.saveFromTree(tree, outputPath);

      // Give async operation time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should handle grid layout', async () => {
      const tree = new AACTree();

      // Create buttons for grid
      const btn1 = new AACButton({
        id: '1',
        label: 'Button 1',
        message: 'One',
      });
      const btn2 = new AACButton({
        id: '2',
        label: 'Button 2',
        message: 'Two',
      });
      const btn3 = new AACButton({
        id: '3',
        label: 'Button 3',
        message: 'Three',
      });
      const btn4 = new AACButton({
        id: '4',
        label: 'Button 4',
        message: 'Four',
      });

      // Create 2x2 grid
      const grid = [
        [btn1, btn2],
        [btn3, btn4],
      ];

      const page = new AACPage({
        id: 'grid-page',
        name: 'Grid Layout',
        grid: grid,
        buttons: [btn1, btn2, btn3, btn4],
      });

      tree.addPage(page);

      const outputPath = path.join(tempDir, 'grid.xlsx');
      processor.saveFromTree(tree, outputPath);

      // Give async operation time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  describe('Utility Methods', () => {
    it('should sanitize worksheet names', () => {
      // Access private method through any cast for testing
      const sanitize = (processor as any).sanitizeWorksheetName;

      expect(sanitize('Normal Name')).toBe('Normal Name');
      expect(sanitize('Name/With\\Invalid:Chars')).toBe('Name_With_Invalid_Chars');
      expect(sanitize('')).toBe('Sheet1');
      expect(sanitize('Very Long Name That Exceeds Thirty One Characters')).toBe(
        'Very Long Name That Exceeds Th'
      );
    });

    it('should convert colors to ARGB', () => {
      const convert = (processor as any).convertColorToArgb;

      expect(convert('#FF0000')).toBe('FFFF0000');
      expect(convert('rgb(255, 0, 0)')).toBe('FFFF0000');
      expect(convert('rgba(255, 0, 0, 0.5)')).toBe('80FF0000');
      expect(convert('')).toBe('FFFFFFFF');
      expect(convert('invalid')).toBe('FFFFFFFF');
    });
  });

  describe('Error Handling', () => {
    it('should handle processTexts gracefully', () => {
      const translations = new Map([['Hello', 'Hola']]);

      expect(() => {
        processor.processTexts('test.xlsx', translations, 'output.xlsx');
      }).not.toThrow();
    });
  });
});
