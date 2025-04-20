// ApplePanelsProcessor for .ascconfig (Apple AAC Panels)
// Converts an .ascconfig folder (Apple AAC Panels) into an AACTree
const fs = require('fs');
const path = require('path');
const plist = require('plist');
const { AACButton, AACPage, AACTree } = require('../core/treeStructure');

class ApplePanelsProcessor {
  static canProcess(filePath) {
    return filePath.toLowerCase().endsWith('.ascconfig');
  }

  static loadIntoTree(folderPath) {
    // folderPath: path to .ascconfig directory
    const contentsDir = path.join(folderPath, 'Contents');
    if (!fs.existsSync(contentsDir)) {
      throw new Error(`Invalid Apple Panels config - no Contents directory in ${folderPath}`);
    }
    const infoPath = path.join(contentsDir, 'Info.plist');
    if (!fs.existsSync(infoPath)) {
      throw new Error(`No Info.plist found in ${contentsDir}`);
    }
    const info = plist.parse(fs.readFileSync(infoPath, 'utf8'));
    const panelList = info.Panels || [];
    const tree = new AACTree();
    // Map of panelId to page
    const panelMap = {};
    // First, create all pages
    panelList.forEach(panel => {
      const panelId = panel.ID;
      const page = new AACPage({
        id: panelId,
        name: panel.DisplayName || panel.Title || `Panel ${panelId}`,
        grid: [],
        buttons: [],
        parentId: null
      });
      panelMap[panelId] = page;
      tree.addPage(page);
    });
    // Then, add buttons for each panel
    panelList.forEach(panel => {
      const page = panelMap[panel.ID];
      const buttons = panel.Buttons || [];
      buttons.forEach(btnData => {
        // Extract info
        const btnId = btnData.ID || (btnData.DisplayText ? btnData.DisplayText.replace(/\s+/g, '_') : 'btn_' + Math.random().toString(36).slice(2));
        const label = btnData.DisplayText || '';
        let type = 'SPEAK';
        let targetPageId = null;
        let vocalization = undefined;
        // Actions
        if (btnData.Actions && Array.isArray(btnData.Actions)) {
          btnData.Actions.forEach(action => {
            if (action.ActionType === 'ActionNavigateToPanel' && action.ActionParam && action.ActionParam.PanelID) {
              type = 'NAVIGATE';
              targetPageId = action.ActionParam.PanelID;
              // Set parentId for navigation
              if (panelMap[targetPageId]) {
                panelMap[targetPageId].parentId = page.id;
              }
            } else if (action.ActionType === 'ActionPressKeyCharSequence' && action.ActionParam && action.ActionParam.CharString) {
              vocalization = action.ActionParam.CharString;
            }
          });
        }
        const button = new AACButton({
          id: btnId,
          label,
          type,
          targetPageId,
          action: null,
          vocalization
        });
        page.addButton(button);
      });
    });
    // Set rootId as the first panel (if any)
    if (panelList.length > 0) {
      tree.rootId = panelList[0].ID;
    }
    return tree;
  }
}

module.exports = ApplePanelsProcessor;
