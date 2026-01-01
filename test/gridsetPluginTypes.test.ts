import {
  detectPluginCellType,
  Grid3CellType,
  WORKSPACE_TYPES,
  LIVECELL_TYPES,
  getCellTypeDisplayName,
  isWorkspaceCell,
  isLiveCell,
  isAutoContentCell,
  isRegularCell,
} from '../src/processors/gridset/pluginTypes';

describe('Grid 3 Plugin Type Detection', () => {
  describe('Workspace Detection', () => {
    it('should detect Workspace cell from ContentType', () => {
      const content = {
        ContentType: 'Workspace',
        ContentSubType: 'Chat',
      };
      const metadata = detectPluginCellType(content);
      expect(metadata.cellType).toBe(Grid3CellType.Workspace);
      expect(metadata.subType).toBe('Chat');
      expect(metadata.pluginId).toBe('Grid3.Chat');
    });

    it('should detect Workspace cell from Style', () => {
      const content = {
        Style: {
          BasedOnStyle: 'Workspace',
        },
        ContentSubType: 'Email',
      };
      const metadata = detectPluginCellType(content);
      expect(metadata.cellType).toBe(Grid3CellType.Workspace);
      expect(metadata.subType).toBe('Email');
    });

    it('should infer correct plugin IDs for various workspaces', () => {
      const workspaces = [
        { sub: WORKSPACE_TYPES.EMAIL, expected: 'Grid3.Email' },
        { sub: WORKSPACE_TYPES.WORD_PROCESSOR, expected: 'Grid3.WordProcessor' },
        { sub: WORKSPACE_TYPES.WEB_BROWSER, expected: 'Grid3.WebBrowser' },
        { sub: WORKSPACE_TYPES.SETTINGS, expected: 'Grid3.Settings' },
      ];

      workspaces.forEach(({ sub, expected }) => {
        const metadata = detectPluginCellType({ ContentType: 'Workspace', ContentSubType: sub });
        expect(metadata.pluginId).toBe(expected);
      });
    });
  });

  describe('LiveCell Detection', () => {
    it('should detect LiveCell from ContentType', () => {
      const content = {
        ContentType: 'LiveCell',
        ContentSubType: 'DigitalClock',
      };
      const metadata = detectPluginCellType(content);
      expect(metadata.cellType).toBe(Grid3CellType.LiveCell);
      expect(metadata.liveCellType).toBe('DigitalClock');
      expect(metadata.pluginId).toBe('Grid3.Clock');
    });

    it('should infer correct plugin IDs for live cells', () => {
      expect(
        detectPluginCellType({ ContentType: 'LiveCell', ContentSubType: LIVECELL_TYPES.BATTERY })
          .pluginId
      ).toBe('Grid3.Battery');
      expect(
        detectPluginCellType({
          ContentType: 'LiveCell',
          ContentSubType: LIVECELL_TYPES.WIFI_STRENGTH,
        }).pluginId
      ).toBe('Grid3.Wifi');
    });
  });

  describe('AutoContent Detection', () => {
    it('should detect AutoContent from ContentType', () => {
      const content = {
        ContentType: 'AutoContent',
        Commands: {
          Command: [
            {
              '@_ID': 'AutoContent.Activate',
              Parameter: { '@_Key': 'autocontenttype', '#text': 'Prediction' },
            },
          ],
        },
      };
      const metadata = detectPluginCellType(content);
      expect(metadata.cellType).toBe(Grid3CellType.AutoContent);
      expect(metadata.autoContentType).toBe('Prediction');
      expect(metadata.pluginId).toBe('Grid3.Prediction');
    });

    it('should detect AutoContent from Style', () => {
      const content = {
        Style: { BasedOnStyle: 'AutoContent' },
        Commands: {
          Command: {
            '@_ID': 'AutoContent.Activate',
            Parameter: { '@_Key': 'autocontenttype', '#text': 'Grammar' },
          },
        },
      };
      const metadata = detectPluginCellType(content);
      expect(metadata.cellType).toBe(Grid3CellType.AutoContent);
      expect(metadata.autoContentType).toBe('Grammar');
    });

    it('should return undefined pluginId for unknown types', () => {
      const metadata = detectPluginCellType({ ContentType: 'AutoContent', Commands: {} });
      expect(metadata.cellType).toBe(Grid3CellType.AutoContent);
      expect(metadata.pluginId).toBeUndefined();
    });
  });

  describe('Regular Cell Detection', () => {
    it('should detect regular cells', () => {
      const content = { Label: 'Hello' };
      const metadata = detectPluginCellType(content);
      expect(metadata.cellType).toBe(Grid3CellType.Regular);
    });
  });

  describe('Utility Functions', () => {
    it('getCellTypeDisplayName should return correct names', () => {
      expect(getCellTypeDisplayName(Grid3CellType.Workspace)).toBe('Workspace');
      expect(getCellTypeDisplayName(Grid3CellType.LiveCell)).toBe('Live Cell');
      expect(getCellTypeDisplayName(Grid3CellType.AutoContent)).toBe('Auto Content');
      expect(getCellTypeDisplayName(Grid3CellType.Regular)).toBe('Regular');
    });

    it('type checking functions should work', () => {
      const workspace = { cellType: Grid3CellType.Workspace };
      const live = { cellType: Grid3CellType.LiveCell };
      const auto = { cellType: Grid3CellType.AutoContent };
      const regular = { cellType: Grid3CellType.Regular };

      expect(isWorkspaceCell(workspace as any)).toBe(true);
      expect(isLiveCell(live as any)).toBe(true);
      expect(isAutoContentCell(auto as any)).toBe(true);
      expect(isRegularCell(regular as any)).toBe(true);

      expect(isWorkspaceCell(regular as any)).toBe(false);
    });
  });
});
