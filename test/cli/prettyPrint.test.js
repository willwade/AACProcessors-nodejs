const { prettyPrintTree } = require('../../dist/cli/prettyPrint');

describe('prettyPrintTree', () => {
  it('prints a simple tree with one page and buttons', () => {
    const tree = {
      pages: {
        '1': {
          id: '1',
          name: 'Home',
          buttons: [
            { label: 'Hello', type: 'SPEAK' },
            { label: 'Go', type: 'NAVIGATE', targetPageId: '2' }
          ]
        },
        '2': {
          id: '2',
          name: 'Second',
          buttons: []
        }
      }
    };
    const output = prettyPrintTree(tree);
    expect(output).toContain('Page: Home');
    expect(output).toContain('- Button: "Hello"');
    expect(output).toContain('[NAVIGATE to page: 2]');
    expect(output).toContain('Page: Second');
    expect(output).toContain('(no buttons)');
  });
});
