import AdmZip from 'adm-zip';
import { auditGridsetImages, formatImageAuditSummary } from '../src/processors/gridset/imageDebug';

describe('Image Debugging Utilities', () => {
  function createMinimalGridset(
    options: {
      includeImages?: boolean;
      includeBrokenImages?: boolean;
      includeSymbolLibrary?: boolean;
    } = {}
  ): Buffer {
    const zip = new AdmZip();

    // Add Settings
    zip.addFile(
      'Settings0/settings.xml',
      Buffer.from(
        '<?xml version="1.0"?><Settings><Workspaces><Workspace /></Workspaces></Settings>'
      )
    );

    // Create a simple grid with images
    let gridXml = `<?xml version="1.0"?>
<Grid xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <GridGuid>test-grid-guid</GridGuid>
  <Name>Test Grid</Name>
  <BackgroundColour>#FFFFFFFF</BackgroundColour>
  <ColumnDefinitions>
    <ColumnDefinition Width="Large" />
    <ColumnDefinition Width="Large" />
  </ColumnDefinitions>
  <RowDefinitions>
    <RowDefinition />
    <RowDefinition />
  </RowDefinitions>
  <Cells>
    <Cell X="1" Y="1">
      <Content>
        <CaptionAndImage>
          <Caption>Test Cell 1</Caption>`;

    if (options.includeBrokenImages) {
      gridXml += `          <Image>-0-text-0.png</Image>`;
    } else if (options.includeSymbolLibrary) {
      gridXml += `          <Image>[widgit]symbols/food/apple.png</Image>`;
    } else if (options.includeImages) {
      gridXml += `          <Image>test-image.png</Image>`;
    }

    gridXml += `        </CaptionAndImage>
      </Content>
    </Cell>
    <Cell X="2" Y="1">
      <Content>
        <CaptionAndImage>
          <Caption>Test Cell 2</Caption>`;

    if (options.includeImages) {
      gridXml += `          <Image>another-image.png</Image>`;
    }

    gridXml += `        </CaptionAndImage>
      </Content>
    </Cell>
  </Cells>
</Grid>`;

    zip.addFile('Grids/Test Grid/grid.xml', Buffer.from(gridXml));

    // Add image files
    if (options.includeImages) {
      zip.addFile('Grids/Test Grid/test-image.png', Buffer.from('PNG-DATA'));
      zip.addFile('Grids/Test Grid/another-image.png', Buffer.from('PNG-DATA'));
    }

    if (options.includeBrokenImages) {
      // Add image with coordinate prefix
      zip.addFile('Grids/Test Grid/1-1-0-text-0.png', Buffer.from('PNG-DATA'));
    }

    return zip.toBuffer();
  }

  describe('auditGridsetImages', () => {
    it('should audit gridset with all images resolved', async () => {
      const buffer = createMinimalGridset({ includeImages: true });
      const audit = await auditGridsetImages(buffer);

      expect(audit.totalCells).toBe(2);
      expect(audit.cellsWithImages).toBe(2);
      expect(audit.resolvedImages).toBe(2);
      expect(audit.unresolvedImages).toBe(0);
      expect(audit.issues).toHaveLength(0);
      expect(audit.availableImages.length).toBeGreaterThan(0);
    });

    it('should detect broken image references', async () => {
      const buffer = createMinimalGridset({ includeBrokenImages: true });
      const audit = await auditGridsetImages(buffer);

      expect(audit.unresolvedImages).toBeGreaterThan(0);
      expect(audit.issues.length).toBeGreaterThan(0);

      const issue = audit.issues[0];
      expect(issue.issue).toBe('not_found');
      expect(issue.gridName).toBe('Test Grid');
      expect(issue.cellX).toBe(1);
      expect(issue.cellY).toBe(1);
    });

    it('should identify symbol library references', async () => {
      const buffer = createMinimalGridset({ includeSymbolLibrary: true });
      const audit = await auditGridsetImages(buffer);

      expect(audit.unresolvedImages).toBeGreaterThan(0);

      const issue = audit.issues.find((i: { issue: string }) => i.issue === 'symbol_library');
      expect(issue).toBeDefined();
      expect(issue?.declaredImage).toContain('widgit');
      expect(issue?.suggestion).toContain('symbol library');
    });

    it('should provide available images list', async () => {
      const buffer = createMinimalGridset({ includeImages: true });
      const audit = await auditGridsetImages(buffer);

      expect(audit.availableImages).toContain('Grids/Test Grid/test-image.png');
      expect(audit.availableImages).toContain('Grids/Test Grid/another-image.png');
    });
  });

  describe('formatImageAuditSummary', () => {
    it('should format audit results as readable text', async () => {
      const buffer = createMinimalGridset({ includeImages: true });
      const audit = await auditGridsetImages(buffer);
      const summary = formatImageAuditSummary(audit);

      expect(summary).toContain('Grid3 Image Audit Summary');
      expect(summary).toContain('Total cells: 2');
      expect(summary).toContain('Resolved images: 2');
      expect(summary).toContain('Unresolved images: 0');
    });

    it('should include issue details when problems exist', async () => {
      const buffer = createMinimalGridset({ includeBrokenImages: true });
      const audit = await auditGridsetImages(buffer);
      const summary = formatImageAuditSummary(audit);

      expect(summary).toContain('Image Issues');
      expect(summary).toContain('NOT_FOUND');
    });

    it('should group issues by type', async () => {
      const buffer = createMinimalGridset({ includeSymbolLibrary: true });
      const audit = await auditGridsetImages(buffer);
      const summary = formatImageAuditSummary(audit);

      expect(summary).toContain('SYMBOL_LIBRARY');
    });
  });
});
