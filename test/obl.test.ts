import { OblUtil, OblAnonymizer } from '../src/optional/analytics/index';
import * as fs from 'fs';
import * as path from 'path';
import { AACSemanticIntent, AACSemanticCategory } from '../src/core/treeStructure';

describe('OBL Support', () => {
  const sampleOBL = {
    format: 'open-board-log-0.1',
    user_id: 'test-user',
    source: 'test-source',
    sessions: [
      {
        id: 'session-1',
        type: 'log' as const,
        started: '2023-01-01T10:00:00.000Z',
        ended: '2023-01-01T10:05:00.000Z',
        events: [
          {
            id: 'event-1',
            type: 'button' as const,
            timestamp: '2023-01-01T10:01:00.000Z',
            label: 'Hello',
            vocalization: 'Hello there',
            board_id: 'board-main',
          },
          {
            id: 'event-2',
            type: 'action' as const,
            timestamp: '2023-01-01T10:02:00.000Z',
            action: ':open_board',
            destination_board_id: 'board-food',
          },
          {
            id: 'event-3',
            type: 'utterance' as const,
            timestamp: '2023-01-01T10:03:00.000Z',
            text: 'I want apple',
          },
        ],
      },
    ],
  };

  test('should parse OBL JSON with notice comment', () => {
    const json = `/* This is a notice */\n${JSON.stringify(sampleOBL)}`;
    const parsed = OblUtil.parse(json);
    expect(parsed.user_id).toBe('test-user');
    expect(parsed.sessions[0].events).toHaveLength(3);
  });

  test('should stringify OBL with notice comment', () => {
    const json = OblUtil.stringify(sampleOBL as any);
    expect(json).toContain('/* NOTICE:');
    expect(json).toContain('"user_id": "test-user"');
  });

  test('should convert OBL to HistoryEntries', () => {
    const entries = OblUtil.toHistoryEntries(sampleOBL as any);

    // Should have entries for 'Hello there', ':open_board', and 'I want apple'
    expect(entries).toHaveLength(3);

    const helloEntry = entries.find((e) => e.content === 'Hello there');
    expect(helloEntry).toBeDefined();
    expect(helloEntry?.occurrences[0].type).toBe('button');
    expect(helloEntry?.occurrences[0].pageId).toBe('board-main');

    const uttEntry = entries.find((e) => e.content === 'I want apple');
    expect(uttEntry).toBeDefined();
    expect(uttEntry?.occurrences[0].type).toBe('utterance');
  });

  test('should maintain bidirectional mapping (OBL -> History -> OBL)', () => {
    const originalOBL = sampleOBL as any;
    const entries = OblUtil.toHistoryEntries(originalOBL);
    const roundTripOBL = OblUtil.fromHistoryEntries(entries, 'test-user', 'test-source');

    expect(roundTripOBL.user_id).toBe('test-user');
    expect(roundTripOBL.sessions[0].events).toHaveLength(3);

    // Check if the utterance was preserved
    const uttEvent = roundTripOBL.sessions[0].events.find((e) => e.type === 'utterance');
    expect(uttEvent).toBeDefined();
    expect((uttEvent as any).text).toBe('I want apple');

    // Check if the action was preserved and mapped back to :open_board
    // (HistoryEntry stores ':open_board' as content, fromHistoryEntries should see it)
    const actionEvent = roundTripOBL.sessions[0].events.find((e) => e.type === 'action');
    expect(actionEvent).toBeDefined();
    expect((actionEvent as any).action).toBe(':open_board');
  });

  test('should use semantic intents for mapping', () => {
    const entries = [
      {
        id: '1',
        source: 'Grid',
        content: 'Home',
        occurrences: [
          {
            timestamp: new Date('2023-01-01T12:00:00Z'),
            intent: AACSemanticIntent.GO_HOME,
            category: AACSemanticCategory.NAVIGATION,
            type: 'button' as const,
          },
        ],
      },
    ];

    const obl = OblUtil.fromHistoryEntries(entries as any, 'user1');
    const event = obl.sessions[0].events[0] as any;

    expect(event.type).toBe('action');
    expect(event.action).toBe(':home');
  });

  test('should anonymize data correctly', () => {
    const obl = JSON.parse(JSON.stringify(sampleOBL)) as any;
    obl.user_name = 'Will Wade';
    obl.sessions[0].events[0].geo = [51.5, -0.1];

    const anonymized = OblAnonymizer.anonymize(obl, [
      'timestamp_shift',
      'geolocation_masking',
      'name_masking',
    ]);

    expect(anonymized.anonymized).toBe(true);
    expect(anonymized.user_name).toBeUndefined();
    expect(anonymized.sessions[0].events[0].geo).toBeUndefined();

    // Timestamp shift check
    const originalDate = new Date(obl.sessions[0].started).getTime();
    const shiftedDate = new Date(anonymized.sessions[0].started).getTime();
    expect(shiftedDate).not.toBe(originalDate);
    expect(anonymized.sessions[0].started).toBe('2000-01-01T00:00:00.000Z');
  });

  test('should parse real OBLA data from dataset', () => {
    const oblaPath = path.join(__dirname, '../obla-improvements/small-obla/small/0036a290e0.obla');
    const content = fs.readFileSync(oblaPath, 'utf8');
    const parsed = OblUtil.parse(content);

    expect(parsed.format).toContain('open-board-log');
    expect(parsed.sessions.length).toBeGreaterThan(0);

    const history = OblUtil.toHistoryEntries(parsed);
    const totalOriginalEvents = parsed.sessions.reduce((acc, s) => acc + s.events.length, 0);
    const roundTrip = OblUtil.fromHistoryEntries(history, parsed.user_id, parsed.source);
    expect(roundTrip.sessions[0].events.length).toBe(totalOriginalEvents);
  });

  test('bulk test real OBLA files (first 10)', () => {
    const oblaDir = path.join(__dirname, '../obla-improvements/small-obla/small');
    const files = fs
      .readdirSync(oblaDir)
      .filter((f) => f.endsWith('.obla'))
      .slice(0, 10);

    for (const file of files) {
      const content = fs.readFileSync(path.join(oblaDir, file), 'utf8');
      const parsed = OblUtil.parse(content);
      expect(parsed.sessions).toBeDefined();

      const history = OblUtil.toHistoryEntries(parsed);
      expect(history.length).toBeGreaterThan(0);
    }
  });
});
