import { AstericsGridProcessor } from '../src/processors/astericsGridProcessor';
import { AACTree } from '../src/core/treeStructure';
import path from 'path';
import fs from 'fs';

describe('AstericsGridProcessor', () => {
  const exampleGrdFile = path.join(__dirname, '../examples/example2.grd');
  const tempOutputPath = path.join(__dirname, 'temp_test.grd');

  afterEach(() => {
    if (fs.existsSync(tempOutputPath)) {
      fs.unlinkSync(tempOutputPath);
    }
  });

  it('should load an Asterics Grid file into an AACTree', () => {
    const processor = new AstericsGridProcessor();
    const tree = processor.loadIntoTree(exampleGrdFile);
    expect(tree).toBeInstanceOf(AACTree);
    expect(Object.keys(tree.pages).length).toBeGreaterThan(0);
  });

  it('should extract texts from an Asterics Grid file', () => {
    const processor = new AstericsGridProcessor();
    const texts = processor.extractTexts(exampleGrdFile);
    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts).toContain('Change in element');
  });

  it('should process texts and save the changes', () => {
    const processor = new AstericsGridProcessor();
    const translations = new Map<string, string>();
    translations.set('Change in element', 'Changed Element');
    
    const buffer = processor.processTexts(exampleGrdFile, translations, tempOutputPath);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    
    const newTexts = processor.extractTexts(tempOutputPath);
    expect(newTexts).toContain('Changed Element');
  });

  it('should perform a roundtrip (load -> save -> load)', () => {
    const processor = new AstericsGridProcessor();
    const initialTree = processor.loadIntoTree(exampleGrdFile);
    processor.saveFromTree(initialTree, tempOutputPath);
    const finalTree = processor.loadIntoTree(tempOutputPath);

    expect(Object.keys(finalTree.pages).length).toEqual(Object.keys(initialTree.pages).length);
    // More detailed checks could be added here
  });

  it('should handle audio when the loadAudio option is true', () => {
    const processor = new AstericsGridProcessor({ loadAudio: true });
    const tree = processor.loadIntoTree(exampleGrdFile);

    let foundAudioButton = false;
    Object.values(tree.pages).forEach(page => {
      page.buttons.forEach(button => {
        if (button.audioRecording) {
          foundAudioButton = true;
          expect(button.audioRecording.data).toBeInstanceOf(Buffer);
        }
      });
    });

    // This depends on the content of example2.grd having audio actions.
    // Based on the docs, GridActionAudio exists. We'll assume the example might have it.
    // If not, this test might need a dedicated test file with audio.
    const fileContent = JSON.parse(fs.readFileSync(exampleGrdFile, 'utf-8'));
    const hasAudioAction = fileContent.grids.some((g: any) => g.gridElements.some((e:any) => e.actions.some((a:any) => a.modelName === 'GridActionAudio')));
    
    if(hasAudioAction) {
        expect(foundAudioButton).toBe(true);
    } else {
        console.warn("Test file does not contain audio actions, skipping audio assertion");
    }
  });
});
