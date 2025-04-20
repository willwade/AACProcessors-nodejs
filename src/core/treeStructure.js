// Core data structures for AAC Processors
// Step 4: Implement TreeStructure module (AACTree, AACPage, AACButton)

class AACButton {
  constructor({ id, label, type, targetPageId, action }) {
    this.id = id || null; // Unique within page
    this.label = label || '';
    this.type = type || 'SPEAK'; // 'SPEAK' | 'NAVIGATE'
    this.targetPageId = targetPageId || null; // For navigation buttons
    this.action = action || null; // Optional: action or payload
  }
}

class AACPage {
  constructor({ id, name, grid = [], buttons = [], parentId = null }) {
    this.id = id;
    this.name = name || '';
    this.grid = grid; // Optional: 2D layout, e.g. [[buttonId, ...], ...]
    this.buttons = buttons; // Array of AACButton
    this.parentId = parentId; // For hierarchy
  }

  addButton(button) {
    this.buttons.push(button);
  }
}

class AACTree {
  constructor() {
    this.pages = {}; // id: AACPage
    this.rootId = null;
  }

  addPage(page) {
    this.pages[page.id] = page;
    if (!this.rootId) this.rootId = page.id;
  }

  getPage(id) {
    return this.pages[id] || null;
  }

  traverse(callback) {
    // BFS traversal from root
    if (!this.rootId) return;
    const queue = [this.rootId];
    const visited = new Set();
    while (queue.length) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      const page = this.getPage(id);
      if (page) {
        callback(page);
        // Enqueue navigation targets
        page.buttons.forEach(btn => {
          if (btn.type === 'NAVIGATE' && btn.targetPageId && this.pages[btn.targetPageId]) {
            queue.push(btn.targetPageId);
          }
        });
      }
    }
  }
}

module.exports = { AACButton, AACPage, AACTree };
