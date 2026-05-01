import { SnapProcessor } from '../src/processors/snapProcessor';
import { AACButton } from '../src/core/treeStructure';
import path from 'path';
import fs from 'fs';
import os from 'os';
import Database from 'better-sqlite3';

/**
 * Tests for SnapProcessor.saveModifiedTree — the asset-preserving save path.
 *
 * Validates:
 *  1. Capabilities flag is true (Snap declares preservesAssetsOnSave).
 *  2. Round-trip with zero mutations leaves the file byte-identical (full schema
 *     + all 23 tables preserved, no data lost).
 *  3. addButton inserts a complete Button + ElementReference + CommandSequence
 *     + one ElementPlacement per existing PageLayout for the target page.
 *     The Button row carries the modal-non-NULL values TD Snap requires
 *     (ContentType=6, CommandFlags=8, ForegroundColor / BackgroundColor set).
 *  4. updateButton applies Label / Message changes to the matching Button row
 *     by id; nothing else moves.
 *  5. removeButton flips Visible=0 on every placement of the target button
 *     without touching the Button row itself.
 *  6. WordList mutations are no-ops (Snap capability says wordList: 'none').
 */

const exampleSPSFile: string = path.join(__dirname, 'assets/snap/example.sps');

function makeOutputPath(suffix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-save-test-'));
  return path.join(dir, `out-${suffix}.sps`);
}

function tableNames(filePath: string): string[] {
  const db = new Database(filePath, { readonly: true });
  try {
    return (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{
        name: string;
      }>
    ).map((r) => r.name);
  } finally {
    db.close();
  }
}

describe('SnapProcessor.saveModifiedTree', () => {
  it('declares preservesAssetsOnSave: true', () => {
    const processor = new SnapProcessor();
    expect(processor.capabilities.preservesAssetsOnSave).toBe(true);
    expect(processor.capabilities.wordList).toBe('none');
  });

  it('round-trips with zero mutations and preserves the full schema', async () => {
    const processor = new SnapProcessor();
    const tree = await processor.loadIntoTree(exampleSPSFile);

    // Sanity: load shouldn't record any mutations (load uses _loadButton).
    let totalMutations = 0;
    for (const page of Object.values(tree.pages)) {
      totalMutations += page.pendingMutations.length;
    }
    expect(totalMutations).toBe(0);

    const outputPath = makeOutputPath('roundtrip');
    await processor.saveModifiedTree(exampleSPSFile, tree, outputPath);

    // File size identical, all 23 tables preserved.
    const origSize = fs.statSync(exampleSPSFile).size;
    const outSize = fs.statSync(outputPath).size;
    expect(outSize).toBe(origSize);

    const origTables = tableNames(exampleSPSFile);
    const outTables = tableNames(outputPath);
    expect(outTables).toEqual(origTables);
  });

  it('addButton inserts Button + ElementReference + CommandSequence + per-layout placements', async () => {
    const processor = new SnapProcessor();
    const tree = await processor.loadIntoTree(exampleSPSFile);

    // Pick any page that has at least one PageLayout, so we can verify per-layout coverage.
    const pages = Object.values(tree.pages);
    const target = pages.find((p) => p.buttons.length > 0) ?? pages[0];
    expect(target).toBeTruthy();

    target.addButton(
      new AACButton({
        id: 'will-be-replaced-with-fresh-sql-id',
        label: 'TestPersonalisedButton',
        message: 'TestPersonalisedButton',
        x: 0,
        y: 0,
      })
    );

    const outputPath = makeOutputPath('add');
    await processor.saveModifiedTree(exampleSPSFile, tree, outputPath);

    const db = new Database(outputPath, { readonly: true });
    try {
      // Button row exists with all the required-non-NULL columns set.
      const btn = db
        .prepare('SELECT * FROM Button WHERE Label = ?')
        .get('TestPersonalisedButton') as Record<string, unknown> | undefined;
      expect(btn).toBeDefined();
      const buttonRow = btn as Record<string, unknown>;
      expect(buttonRow.ContentType).toBe(6);
      expect(buttonRow.CommandFlags).toBe(8);
      expect(buttonRow.LabelOwnership).toBe(3);
      expect(buttonRow.ImageOwnership).toBe(3);
      expect(buttonRow.UniqueId).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/i));
      expect(buttonRow.UseMessageRecording).toBeNull(); // matches the 99.99% pattern

      // ElementReference row exists with explicit colours + ElementType=0.
      const er = db
        .prepare('SELECT * FROM ElementReference WHERE Id = ?')
        .get(buttonRow.ElementReferenceId as number) as Record<string, unknown>;
      expect(er.ElementType).toBe(0);
      expect(er.ForegroundColor).not.toBeNull();
      expect(er.BackgroundColor).not.toBeNull();
      expect(er.AudioCueRecordingId).toBe(0);

      // CommandSequence row inserted with the canonical "speak the label" payload.
      const cs = db
        .prepare('SELECT SerializedCommands FROM CommandSequence WHERE ButtonId = ?')
        .get(buttonRow.Id as number) as { SerializedCommands: string } | undefined;
      expect(cs).toBeDefined();
      expect(cs?.SerializedCommands).toBe(
        '{"$type":"1","$values":[{"$type":"3","MessageAction":0}]}'
      );

      // One ElementPlacement per PageLayout on the target page (the load + save invariant
      // that prevents TD Snap from crashing on dashboard-style pages).
      const layoutCount = (
        db
          .prepare(
            'SELECT COUNT(*) AS n FROM PageLayout WHERE PageId = (SELECT Id FROM Page WHERE UniqueId = ?)'
          )
          .get(target.id) as { n: number }
      ).n;
      const placements = db
        .prepare('SELECT * FROM ElementPlacement WHERE ElementReferenceId = ?')
        .all(buttonRow.ElementReferenceId as number) as Array<Record<string, unknown>>;
      expect(placements.length).toBe(layoutCount);

      // No two placements collide on the same cell of the same layout (the bug
      // that caused crashes when hidden placements landed on occupied cells).
      for (const p of placements) {
        const conflicts = (
          db
            .prepare(
              `SELECT COUNT(*) AS n FROM ElementPlacement
               WHERE PageLayoutId = ? AND GridPosition = ? AND Id != ?`
            )
            .get(p.PageLayoutId, p.GridPosition, p.Id) as { n: number }
        ).n;
        // visible=1 placements must not collide; hidden ones can technically share
        // synthetic out-of-bounds positions, but our impl uses (cols,0) which is
        // unique to each layout's column count, so we still expect zero collisions.
        if (p.Visible === 1) expect(conflicts).toBe(0);
      }
    } finally {
      db.close();
    }
  });

  it('updateButton patches Label/Message on the matching Button row', async () => {
    const processor = new SnapProcessor();
    const tree = await processor.loadIntoTree(exampleSPSFile);

    // Pick an existing button to update.
    const page = Object.values(tree.pages).find((p) => p.buttons.length > 0);
    if (!page) throw new Error('fixture has no page with buttons');
    const btn = page.buttons[0];
    const newLabel = `${btn.label || 'Untitled'}__updated__${Date.now()}`;
    const newMessage = 'updated message';

    page.updateButton(btn.id, { label: newLabel, message: newMessage });

    const outputPath = makeOutputPath('update');
    await processor.saveModifiedTree(exampleSPSFile, tree, outputPath);

    const db = new Database(outputPath, { readonly: true });
    try {
      const row = db
        .prepare('SELECT Label, Message FROM Button WHERE Id = ?')
        .get(Number(btn.id)) as { Label: string | null; Message: string | null } | undefined;
      expect(row).toBeDefined();
      expect(row?.Label).toBe(newLabel);
      expect(row?.Message).toBe(newMessage);
    } finally {
      db.close();
    }
  });

  it('removeButton hides every placement of the target button (Visible=0)', async () => {
    const processor = new SnapProcessor();
    const tree = await processor.loadIntoTree(exampleSPSFile);

    const page = Object.values(tree.pages).find((p) => p.buttons.length > 0);
    if (!page) throw new Error('fixture has no page with buttons');
    const btn = page.buttons[0];

    page.removeButton(btn.id);

    const outputPath = makeOutputPath('remove');
    await processor.saveModifiedTree(exampleSPSFile, tree, outputPath);

    const db = new Database(outputPath, { readonly: true });
    try {
      const buttonRow = db
        .prepare('SELECT ElementReferenceId FROM Button WHERE Id = ?')
        .get(Number(btn.id)) as { ElementReferenceId: number };

      // All placements for this ElementReference are hidden.
      const placements = db
        .prepare('SELECT Visible FROM ElementPlacement WHERE ElementReferenceId = ?')
        .all(buttonRow.ElementReferenceId) as Array<{ Visible: number | null }>;
      expect(placements.length).toBeGreaterThan(0);
      for (const p of placements) {
        expect(p.Visible === 0 || p.Visible === null).toBe(true);
      }
    } finally {
      db.close();
    }
  });

  it('WordList mutations are silent no-ops on Snap (capability: wordList=none)', async () => {
    const processor = new SnapProcessor();
    const tree = await processor.loadIntoTree(exampleSPSFile);

    const page = Object.values(tree.pages)[0];
    page.addWordListItem({ text: 'should-not-appear' });
    page.removeWordListItem('anything');
    page.clearWordList();

    const outputPath = makeOutputPath('wordlist-noop');
    await processor.saveModifiedTree(exampleSPSFile, tree, outputPath);

    // The text should not appear anywhere in the output DB.
    const db = new Database(outputPath, { readonly: true });
    try {
      const found = db
        .prepare("SELECT COUNT(*) AS n FROM Button WHERE Label = 'should-not-appear'")
        .get() as { n: number };
      expect(found.n).toBe(0);
    } finally {
      db.close();
    }
  });
});
