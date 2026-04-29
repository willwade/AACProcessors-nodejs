import { AACTree, AACPage, AACButton } from '../../src/index';

describe('AACPage Mutations', () => {
  describe('addButton', () => {
    it('should record an addButton mutation', () => {
      const page = new AACPage({ id: 'page1' });
      const button = new AACButton({ id: 'btn1', label: 'Button 1' });

      page.addButton(button);

      expect(page.buttons).toHaveLength(1);
      expect(page.buttons[0]).toBe(button);

      const mutations = page.pendingMutations;
      expect(mutations).toHaveLength(1);
      expect(mutations[0]).toEqual({
        type: 'addButton',
        button,
      });
    });

    it('should record multiple addButton mutations in order', () => {
      const page = new AACPage({ id: 'page1' });
      const button1 = new AACButton({ id: 'btn1', label: 'Button 1' });
      const button2 = new AACButton({ id: 'btn2', label: 'Button 2' });

      page.addButton(button1);
      page.addButton(button2);

      const mutations = page.pendingMutations;
      expect(mutations).toHaveLength(2);
      if (mutations[0].type === 'addButton') {
        expect(mutations[0].button).toBe(button1);
      }
      if (mutations[1].type === 'addButton') {
        expect(mutations[1].button).toBe(button2);
      }
    });
  });

  describe('removeButton', () => {
    it('should record a removeButton mutation', () => {
      const page = new AACPage({ id: 'page1' });

      page.removeButton('btn1');

      const mutations = page.pendingMutations;
      expect(mutations).toHaveLength(1);
      expect(mutations[0]).toEqual({
        type: 'removeButton',
        buttonId: 'btn1',
      });
    });

    it('should be idempotent on unknown id (records without error)', () => {
      const page = new AACPage({ id: 'page1' });

      // Should not throw
      expect(() => page.removeButton('nonexistent')).not.toThrow();

      const mutations = page.pendingMutations;
      expect(mutations).toHaveLength(1);
      expect(mutations[0]).toEqual({
        type: 'removeButton',
        buttonId: 'nonexistent',
      });
    });
  });

  describe('updateButton', () => {
    it('should record an updateButton mutation', () => {
      const page = new AACPage({ id: 'page1' });

      page.updateButton('btn1', { label: 'New Label' });

      const mutations = page.pendingMutations;
      expect(mutations).toHaveLength(1);
      expect(mutations[0]).toEqual({
        type: 'updateButton',
        buttonId: 'btn1',
        patch: { label: 'New Label' },
      });
    });

    it('should record multiple updates to the same button', () => {
      const page = new AACPage({ id: 'page1' });

      page.updateButton('btn1', { label: 'Label 1' });
      page.updateButton('btn1', { message: 'Message 1' });
      page.updateButton('btn1', { label: 'Label 2' });

      const mutations = page.pendingMutations;
      expect(mutations).toHaveLength(3);

      // Each mutation is recorded separately; the save path will handle merging
      if (mutations[0].type === 'updateButton') {
        expect(mutations[0].patch).toEqual({ label: 'Label 1' });
      }
      if (mutations[1].type === 'updateButton') {
        expect(mutations[1].patch).toEqual({ message: 'Message 1' });
      }
      if (mutations[2].type === 'updateButton') {
        expect(mutations[2].patch).toEqual({ label: 'Label 2' });
      }
    });

    it('should accept complex partial updates', () => {
      const page = new AACPage({ id: 'page1' });

      page.updateButton('btn1', {
        label: 'New Label',
        message: 'New Message',
        style: { backgroundColor: '#FF0000' },
      });

      const mutations = page.pendingMutations;
      expect(mutations).toHaveLength(1);
      if (mutations[0].type === 'updateButton') {
        expect(mutations[0].patch).toEqual({
          label: 'New Label',
          message: 'New Message',
          style: { backgroundColor: '#FF0000' },
        });
      }
    });
  });

  describe('addWordListItem', () => {
    it('should record an addWordListItem mutation with text only', () => {
      const page = new AACPage({ id: 'page1' });

      page.addWordListItem({ text: 'hello' });

      const mutations = page.pendingMutations;
      expect(mutations).toHaveLength(1);
      expect(mutations[0]).toEqual({
        type: 'addWordListItem',
        item: { text: 'hello' },
      });
    });

    it('should record an addWordListItem mutation with image', () => {
      const page = new AACPage({ id: 'page1' });

      page.addWordListItem({ text: 'hello', image: 'symbol_hello.png' });

      const mutations = page.pendingMutations;
      expect(mutations).toHaveLength(1);
      expect(mutations[0]).toEqual({
        type: 'addWordListItem',
        item: { text: 'hello', image: 'symbol_hello.png' },
      });
    });

    it('should record an addWordListItem mutation with part of speech', () => {
      const page = new AACPage({ id: 'page1' });

      page.addWordListItem({ text: 'run', partOfSpeech: 'Verb' });

      const mutations = page.pendingMutations;
      expect(mutations).toHaveLength(1);
      expect(mutations[0]).toEqual({
        type: 'addWordListItem',
        item: { text: 'run', partOfSpeech: 'Verb' },
      });
    });

    it('should record multiple addWordListItem mutations in order', () => {
      const page = new AACPage({ id: 'page1' });

      page.addWordListItem({ text: 'hello' });
      page.addWordListItem({ text: 'goodbye' });

      const mutations = page.pendingMutations;
      expect(mutations).toHaveLength(2);
      if (mutations[0].type === 'addWordListItem') {
        expect(mutations[0].item.text).toBe('hello');
      }
      if (mutations[1].type === 'addWordListItem') {
        expect(mutations[1].item.text).toBe('goodbye');
      }
    });
  });

  describe('removeWordListItem', () => {
    it('should record a removeWordListItem mutation with string match', () => {
      const page = new AACPage({ id: 'page1' });

      page.removeWordListItem('hello');

      const mutations = page.pendingMutations;
      expect(mutations).toHaveLength(1);
      expect(mutations[0]).toEqual({
        type: 'removeWordListItem',
        match: 'hello',
      });
    });

    it('should record a removeWordListItem mutation with predicate function', () => {
      const page = new AACPage({ id: 'page1' });
      const predicate = (item: any) => item.partOfSpeech === 'Verb';

      page.removeWordListItem(predicate);

      const mutations = page.pendingMutations;
      expect(mutations).toHaveLength(1);
      expect(mutations[0]).toEqual({
        type: 'removeWordListItem',
        match: predicate,
      });
    });

    it('should be idempotent on unknown text', () => {
      const page = new AACPage({ id: 'page1' });

      // Should not throw
      expect(() => page.removeWordListItem('nonexistent')).not.toThrow();

      const mutations = page.pendingMutations;
      expect(mutations).toHaveLength(1);
      if (mutations[0].type === 'removeWordListItem') {
        expect(mutations[0].match).toBe('nonexistent');
      }
    });
  });

  describe('clearWordList', () => {
    it('should record a single clearWordList mutation', () => {
      const page = new AACPage({ id: 'page1' });

      page.clearWordList();

      const mutations = page.pendingMutations;
      expect(mutations).toHaveLength(1);
      expect(mutations[0]).toEqual({
        type: 'clearWordList',
      });
    });

    it('should not be split into multiple remove mutations', () => {
      const page = new AACPage({ id: 'page1' });

      page.clearWordList();

      const mutations = page.pendingMutations;
      expect(mutations).toHaveLength(1);
      expect(mutations[0].type).toBe('clearWordList');
    });
  });

  describe('pendingMutations', () => {
    it('should be read-only externally', () => {
      const page = new AACPage({ id: 'page1' });
      const button = new AACButton({ id: 'btn1', label: 'Button 1' });

      page.addButton(button);

      const mutations = page.pendingMutations;

      // The returned array should be frozen (readonly in TypeScript, but Object.freeze at runtime)
      // In TypeScript, readonly arrays can't have push called at compile time
      // At runtime, we return a frozen copy
      expect(Object.isFrozen(mutations)).toBe(true);

      // Original mutations should be unchanged
      expect(page.pendingMutations).toHaveLength(1);
    });

    it('should return a copy, not the internal array', () => {
      const page = new AACPage({ id: 'page1' });
      const button = new AACButton({ id: 'btn1', label: 'Button 1' });

      page.addButton(button);

      const mutations1 = page.pendingMutations;
      const mutations2 = page.pendingMutations;

      // Should be different arrays (frozen copies)
      expect(mutations1).not.toBe(mutations2);
      // But with same content
      expect(mutations1).toEqual(mutations2);
    });

    it('should accumulate mutations across different types', () => {
      const page = new AACPage({ id: 'page1' });
      const button = new AACButton({ id: 'btn1', label: 'Button 1' });

      page.addButton(button);
      page.removeButton('btn2');
      page.updateButton('btn3', { label: 'Updated' });
      page.addWordListItem({ text: 'hello' });
      page.removeWordListItem('goodbye');
      page.clearWordList();

      const mutations = page.pendingMutations;
      expect(mutations).toHaveLength(6);

      expect(mutations[0].type).toBe('addButton');
      expect(mutations[1].type).toBe('removeButton');
      expect(mutations[2].type).toBe('updateButton');
      expect(mutations[3].type).toBe('addWordListItem');
      expect(mutations[4].type).toBe('removeWordListItem');
      expect(mutations[5].type).toBe('clearWordList');
    });
  });

  describe('Integration with existing AACPage functionality', () => {
    it('should work with existing page properties', () => {
      const page = new AACPage({
        id: 'page1',
        name: 'Test Page',
        parentId: 'root',
      });

      const button = new AACButton({ id: 'btn1', label: 'Button 1' });
      page.addButton(button);

      // Page properties should still work
      expect(page.id).toBe('page1');
      expect(page.name).toBe('Test Page');
      expect(page.parentId).toBe('root');
      expect(page.buttons).toHaveLength(1);

      // Mutations should be recorded
      expect(page.pendingMutations).toHaveLength(1);
    });

    it('should work with empty mutations (newly created page)', () => {
      const page = new AACPage({ id: 'page1' });

      expect(page.pendingMutations).toHaveLength(0);
      expect(page.pendingMutations).toEqual([]);
    });
  });

  describe('Type safety', () => {
    it('should correctly type mutation properties', () => {
      const page = new AACPage({ id: 'page1' });
      const button = new AACButton({ id: 'btn1', label: 'Button 1' });

      page.addButton(button);
      page.updateButton('btn2', { label: 'New Label' });
      page.addWordListItem({ text: 'hello', image: 'test.png' });

      const mutations = page.pendingMutations;

      // Type checks: addButton mutation should have button
      if (mutations[0].type === 'addButton') {
        expect(mutations[0].button.id).toBe('btn1');
      }

      // Type checks: updateButton mutation should have buttonId and patch
      if (mutations[1].type === 'updateButton') {
        expect(mutations[1].buttonId).toBe('btn2');
        expect(mutations[1].patch.label).toBe('New Label');
      }

      // Type checks: addWordListItem mutation should have item
      if (mutations[2].type === 'addWordListItem') {
        expect(mutations[2].item.text).toBe('hello');
        expect(mutations[2].item.image).toBe('test.png');
      }
    });
  });
});
