import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import {
  dotNetTicksToDate,
  readGrid3History,
  readSnapUsage,
  type HistoryEntry,
} from "../src/optional/analytics/history";

const EPOCH_TICKS = 621355968000000000n;
const TICKS_PER_MS = 10000n;

function dateToTicks(date: Date): bigint {
  return BigInt(date.getTime()) * TICKS_PER_MS + EPOCH_TICKS;
}

describe("History analytics", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "history-test-"));

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup issues on platforms that briefly lock the file
    }
  });

  it("converts .NET ticks to Date", () => {
    const now = new Date("2024-01-01T00:00:00Z");
    const ticks = dateToTicks(now);
    const converted = dotNetTicksToDate(ticks);
    expect(converted.toISOString()).toBe(now.toISOString());
  });

  it("reads Grid 3 history from sqlite", () => {
    const dbPath = path.join(tempDir, "grid3-history.sqlite");
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE Phrases (Id INTEGER PRIMARY KEY AUTOINCREMENT, Text TEXT NOT NULL, Content TEXT NOT NULL);
      CREATE TABLE PhraseHistory (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        PhraseId INTEGER NOT NULL,
        Timestamp BIGINT NOT NULL,
        Latitude REAL,
        Longitude REAL,
        FOREIGN KEY(PhraseId) REFERENCES Phrases(Id)
      );
    `);

    const phraseId = db
      .prepare("INSERT INTO Phrases (Text, Content) VALUES (?, ?)")
      .run(
        "hello world",
        "<p><s><r>Hello</r></s><s><r><![CDATA[ ]]></r></s><s><r>world</r></s></p>",
      ).lastInsertRowid as number;

    const ts = dateToTicks(new Date("2024-02-02T10:00:00Z"));
    db.prepare(
      "INSERT INTO PhraseHistory (PhraseId, Timestamp, Latitude, Longitude) VALUES (?, ?, ?, ?)",
    ).run(phraseId, ts, 51.5, -1.2);

    const history = readGrid3History(dbPath);
    expect(history).toHaveLength(1);
    const entry = history[0] as HistoryEntry;
    expect(entry.source).toBe("Grid");
    expect(entry.content).toBe("Hello world");
    expect(entry.occurrences).toHaveLength(1);
    expect(entry.occurrences[0].latitude).toBeCloseTo(51.5);
    expect(entry.occurrences[0].longitude).toBeCloseTo(-1.2);
  });

  it("skips Grid 3 history rows without text and falls back to plain text when XML is missing", () => {
    const dbPath = path.join(tempDir, "grid3-history-missing.sqlite");
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE Phrases (Id INTEGER PRIMARY KEY AUTOINCREMENT, Text TEXT, Content TEXT);
      CREATE TABLE PhraseHistory (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        PhraseId INTEGER NOT NULL,
        Timestamp BIGINT NOT NULL,
        Latitude REAL,
        Longitude REAL,
        FOREIGN KEY(PhraseId) REFERENCES Phrases(Id)
      );
    `);

    const missingId = db
      .prepare("INSERT INTO Phrases (Text, Content) VALUES (?, ?)")
      .run(null, null).lastInsertRowid as number;
    const fallbackId = db
      .prepare("INSERT INTO Phrases (Text, Content) VALUES (?, ?)")
      .run("plain text only", "").lastInsertRowid as number;

    const ts1 = dateToTicks(new Date("2024-04-04T00:00:00Z"));
    const ts2 = dateToTicks(new Date("2024-04-04T00:01:00Z"));

    db.prepare(
      "INSERT INTO PhraseHistory (PhraseId, Timestamp, Latitude, Longitude) VALUES (?, ?, ?, ?)",
    ).run(missingId, ts1, null, null);
    db.prepare(
      "INSERT INTO PhraseHistory (PhraseId, Timestamp, Latitude, Longitude) VALUES (?, ?, ?, ?)",
    ).run(fallbackId, ts2, null, null);

    const history = readGrid3History(dbPath);
    expect(history).toHaveLength(1);
    expect(history[0].content).toBe("plain text only");
    expect(history[0].occurrences).toHaveLength(1);
  });

  it("reads Snap usage from pageset sqlite", () => {
    const pagesetPath = path.join(tempDir, "snap.sps");
    const db = new Database(pagesetPath);
    db.exec(`
      CREATE TABLE Button (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        Label TEXT,
        Message TEXT,
        UniqueId TEXT
      );
      CREATE TABLE ButtonUsage (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        Timestamp BIGINT,
        ButtonUniqueId TEXT,
        Modeling INTEGER,
        AccessMethod INTEGER,
        BlockId INTEGER
      );
    `);

    const buttonId = "btn-1";
    db.prepare(
      "INSERT INTO Button (Label, Message, UniqueId) VALUES (?, ?, ?)",
    ).run("Hello", "Hello there", buttonId);

    const ts = dateToTicks(new Date("2024-03-03T12:00:00Z"));
    db.prepare(
      "INSERT INTO ButtonUsage (Timestamp, ButtonUniqueId, Modeling, AccessMethod, BlockId) VALUES (?, ?, ?, ?, ?)",
    ).run(ts, buttonId, 0, 2, 1);

    const history = readSnapUsage(pagesetPath);
    expect(history).toHaveLength(1);
    const entry = history[0] as HistoryEntry;
    expect(entry.source).toBe("Snap");
    expect(entry.platform?.buttonId).toBe(buttonId);
    expect(entry.content).toContain("Hello");
    expect(entry.occurrences[0].modeling).toBe(false);
    expect(entry.occurrences[0].accessMethod).toBe(2);
  });
});
