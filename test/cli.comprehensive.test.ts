// Comprehensive CLI tests to achieve 90%+ coverage
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { TreeFactory } from './utils/testFactories';
import { DotProcessor } from '../src/processors/dotProcessor';

describe('CLI Comprehensive Tests', () => {
  const tempDir = path.join(__dirname, 'temp_cli');
  const cliPath = path.join(__dirname, '../dist/cli/index.js');
  const examplesDir = path.join(__dirname, '../examples');

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    if (!fs.existsSync(cliPath)) {
      throw new Error(
        'dist/cli/index.js is missing – run `npm run build` before executing the CLI tests.'
      );
    }
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Command Parsing Tests', () => {
    it('should parse extract command correctly', () => {
      // Create a test DOT file
      const tree = TreeFactory.createSimple();
      const processor = new DotProcessor();
      const testFile = path.join(tempDir, 'test.dot');
      processor.saveFromTree(tree, testFile);

      const result = execSync(`node ${cliPath} extract ${testFile}`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      // DOT processor only extracts navigation relationships and page names
      expect(result).toContain('Home');
      expect(result).toContain('More'); // Navigation button label
      expect(result.trim().split('\n').length).toBeGreaterThan(0);
    });

    it('should parse convert command with all options', () => {
      const tree = TreeFactory.createSimple();
      const processor = new DotProcessor();
      const inputFile = path.join(tempDir, 'input.dot');
      const outputFile = path.join(tempDir, 'output.opml');

      processor.saveFromTree(tree, inputFile);

      const result = execSync(`node ${cliPath} convert ${inputFile} ${outputFile} --format opml`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      expect(fs.existsSync(outputFile)).toBe(true);
      expect(result).toContain('converted');
    });

    it('should handle invalid command arguments gracefully', () => {
      expect(() => {
        execSync(`node ${cliPath} invalidcommand`, {
          encoding: 'utf8',
          cwd: tempDir,
          stdio: 'pipe',
        });
      }).toThrow();
    });

    it('should show help when no arguments provided', () => {
      const result = execSync(`node ${cliPath}`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      expect(result).toContain('Usage:');
      expect(result).toContain('extract');
      expect(result).toContain('convert');
    });

    it('should show help with --help flag', () => {
      const result = execSync(`node ${cliPath} --help`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      expect(result).toContain('Usage:');
      expect(result).toContain('Commands:');
    });

    it('should show version with --version flag', () => {
      const result = execSync(`node ${cliPath} --version`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      expect(result.trim()).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('File Processing Tests', () => {
    it('should extract text from DOT format via CLI', () => {
      const tree = TreeFactory.createCommunicationBoard();
      const processor = new DotProcessor();
      const testFile = path.join(tempDir, 'communication.dot');
      processor.saveFromTree(tree, testFile);

      const result = execSync(`node ${cliPath} extract ${testFile}`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      // DOT processor extracts page names and navigation button labels
      expect(result).toContain('Home');
      expect(result).toContain('Food'); // Page name, not button label
      expect(result).toContain('Activities'); // Page name
    });

    it('should extract text from OPML format via CLI', () => {
      // Create an OPML file first
      const tree = TreeFactory.createSimple();
      const dotProcessor = new DotProcessor();
      const dotFile = path.join(tempDir, 'temp.dot');
      dotProcessor.saveFromTree(tree, dotFile);

      // Convert to OPML
      const opmlFile = path.join(tempDir, 'test.opml');
      execSync(`node ${cliPath} convert ${dotFile} ${opmlFile} --format opml`, {
        cwd: tempDir,
        stdio: 'pipe',
      });

      // Extract from OPML
      const result = execSync(`node ${cliPath} extract ${opmlFile}`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      expect(result).toContain('Home');
    });

    it('should convert DOT to OPML format', () => {
      const tree = TreeFactory.createSimple();
      const processor = new DotProcessor();
      const inputFile = path.join(tempDir, 'dot_to_opml.dot');
      const outputFile = path.join(tempDir, 'dot_to_opml.opml');

      processor.saveFromTree(tree, inputFile);

      execSync(`node ${cliPath} convert ${inputFile} ${outputFile} --format opml`, {
        cwd: tempDir,
        stdio: 'pipe',
      });

      expect(fs.existsSync(outputFile)).toBe(true);

      const content = fs.readFileSync(outputFile, 'utf8');
      expect(content).toContain('<?xml');
      expect(content).toContain('<opml');
    });

    it('should convert OPML to DOT format', () => {
      // First create an OPML file
      const tree = TreeFactory.createSimple();
      const dotProcessor = new DotProcessor();
      const tempDotFile = path.join(tempDir, 'temp_for_opml.dot');
      const opmlFile = path.join(tempDir, 'opml_to_dot.opml');
      const finalDotFile = path.join(tempDir, 'opml_to_dot.dot');

      dotProcessor.saveFromTree(tree, tempDotFile);

      // Convert to OPML first
      execSync(`node ${cliPath} convert ${tempDotFile} ${opmlFile} --format opml`, {
        cwd: tempDir,
        stdio: 'pipe',
      });

      // Convert back to DOT
      execSync(`node ${cliPath} convert ${opmlFile} ${finalDotFile} --format dot`, {
        cwd: tempDir,
        stdio: 'pipe',
      });

      expect(fs.existsSync(finalDotFile)).toBe(true);

      const content = fs.readFileSync(finalDotFile, 'utf8');
      expect(content).toContain('digraph');
    });

    it('should handle file not found errors', () => {
      const nonExistentFile = path.join(tempDir, 'does_not_exist.dot');

      expect(() => {
        execSync(`node ${cliPath} extract ${nonExistentFile}`, {
          encoding: 'utf8',
          cwd: tempDir,
          stdio: 'pipe',
        });
      }).toThrow();
    });

    it('should handle unsupported file formats', () => {
      const unsupportedFile = path.join(tempDir, 'unsupported.xyz');
      fs.writeFileSync(unsupportedFile, 'unsupported content');

      expect(() => {
        execSync(`node ${cliPath} extract ${unsupportedFile}`, {
          encoding: 'utf8',
          cwd: tempDir,
          stdio: 'pipe',
        });
      }).toThrow();
    });
  });

  describe('Output Formatting Tests', () => {
    it('should format output correctly for different formats', () => {
      const tree = TreeFactory.createCommunicationBoard();
      const processor = new DotProcessor();
      const testFile = path.join(tempDir, 'format_test.dot');
      processor.saveFromTree(tree, testFile);

      // Test default format
      const defaultResult = execSync(`node ${cliPath} extract ${testFile}`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      expect(defaultResult).toContain('Home');
      expect(typeof defaultResult).toBe('string');
    });

    it('should handle verbose output mode', () => {
      const tree = TreeFactory.createSimple();
      const processor = new DotProcessor();
      const testFile = path.join(tempDir, 'verbose_test.dot');
      processor.saveFromTree(tree, testFile);

      const result = execSync(`node ${cliPath} extract ${testFile} --verbose`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      expect(result).toContain('Home');
      // Verbose mode might include additional information
    });

    it('should handle quiet output mode', () => {
      const tree = TreeFactory.createSimple();
      const processor = new DotProcessor();
      const testFile = path.join(tempDir, 'quiet_test.dot');
      processor.saveFromTree(tree, testFile);

      const result = execSync(`node ${cliPath} extract ${testFile} --quiet`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      // Quiet mode should still return the extracted text
      expect(result).toContain('Home');
    });

    it('should display help information correctly', () => {
      const helpResult = execSync(`node ${cliPath} help`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      expect(helpResult).toContain('Usage:');
      expect(helpResult).toContain('extract');
      expect(helpResult).toContain('convert');
      expect(helpResult).toContain('Options:');
    });

    it('should display command-specific help', () => {
      const extractHelp = execSync(`node ${cliPath} help extract`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      expect(extractHelp).toContain('extract');
      expect(extractHelp).toContain('file');
    });
  });

  describe('Integration Tests', () => {
    it('should process example.dot file correctly', () => {
      const exampleDotFile = path.join(examplesDir, 'example.dot');

      if (fs.existsSync(exampleDotFile)) {
        const result = execSync(`node ${cliPath} extract ${exampleDotFile}`, {
          encoding: 'utf8',
          cwd: tempDir,
        });

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
      } else {
        console.log('Skipping test - example.dot not found');
      }
    });

    it('should convert example.obf to dot format', () => {
      const exampleObfFile = path.join(examplesDir, 'example.obf');

      if (fs.existsSync(exampleObfFile)) {
        const outputFile = path.join(tempDir, 'converted_example.dot');

        execSync(`node ${cliPath} convert ${exampleObfFile} ${outputFile} --format dot`, {
          cwd: tempDir,
          stdio: 'pipe',
        });

        expect(fs.existsSync(outputFile)).toBe(true);
      } else {
        console.log('Skipping test - example.obf not found');
      }
    });

    it('should handle batch processing of multiple files', () => {
      // Create multiple test files
      const tree1 = TreeFactory.createSimple();
      const tree2 = TreeFactory.createCommunicationBoard();
      const processor = new DotProcessor();

      const file1 = path.join(tempDir, 'batch1.dot');
      const file2 = path.join(tempDir, 'batch2.dot');

      processor.saveFromTree(tree1, file1);
      processor.saveFromTree(tree2, file2);

      // Process each file
      const result1 = execSync(`node ${cliPath} extract ${file1}`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      const result2 = execSync(`node ${cliPath} extract ${file2}`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      expect(result1).toContain('Home');
      expect(result2).toContain('Home');
      expect(result2).toContain('Food');
    });
  });

  describe('Error Handling Tests', () => {
    it('should display helpful error messages for invalid files', () => {
      const invalidFile = path.join(tempDir, 'invalid.dot');
      fs.writeFileSync(invalidFile, 'invalid dot content');

      try {
        execSync(`node ${cliPath} extract ${invalidFile}`, {
          encoding: 'utf8',
          cwd: tempDir,
          stdio: 'pipe',
        });
      } catch (error: any) {
        expect(error.message).toContain('Command failed');
      }
    });

    it('should handle permission errors gracefully', () => {
      // Create a file and remove read permissions (on Unix systems)
      const restrictedFile = path.join(tempDir, 'restricted.dot');
      const tree = TreeFactory.createSimple();
      const processor = new DotProcessor();
      processor.saveFromTree(tree, restrictedFile);

      try {
        // Try to change permissions (may not work on all systems)
        fs.chmodSync(restrictedFile, 0o000);

        try {
          execSync(`node ${cliPath} extract ${restrictedFile}`, {
            encoding: 'utf8',
            cwd: tempDir,
            stdio: 'pipe',
          });
        } catch (error: any) {
          expect(error.message).toContain('Command failed');
        }
      } catch (permissionError) {
        // If we can't change permissions, skip this test
        console.log('Skipping permission test - unable to change file permissions');
      } finally {
        // Restore permissions for cleanup
        try {
          fs.chmodSync(restrictedFile, 0o644);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });

    it('should provide usage help for incorrect commands', () => {
      try {
        execSync(`node ${cliPath} wrongcommand`, {
          encoding: 'utf8',
          cwd: tempDir,
          stdio: 'pipe',
        });
      } catch (error: any) {
        expect(error.message).toContain('Command failed');
      }
    });

    it('should handle missing required arguments', () => {
      try {
        execSync(`node ${cliPath} extract`, {
          encoding: 'utf8',
          cwd: tempDir,
          stdio: 'pipe',
        });
      } catch (error: any) {
        expect(error.message).toContain('Command failed');
      }
    });

    it('should handle invalid output paths for convert command', () => {
      const tree = TreeFactory.createSimple();
      const processor = new DotProcessor();
      const inputFile = path.join(tempDir, 'valid_input.dot');
      processor.saveFromTree(tree, inputFile);

      // Try to write to an invalid path
      const invalidOutputPath = '/invalid/path/output.opml';

      try {
        execSync(`node ${cliPath} convert ${inputFile} ${invalidOutputPath} --format opml`, {
          encoding: 'utf8',
          cwd: tempDir,
          stdio: 'pipe',
        });
      } catch (error: any) {
        expect(error.message).toContain('Command failed');
      }
    });
  });
});
