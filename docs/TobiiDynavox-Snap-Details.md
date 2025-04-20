Exports are .sps files. these are sqlite files. no encryption. 


here is the structure

ERD Diagram here : https://dbdiagram.io/d/TobiiDynavoxSnap-651a8680ffbf5169f0da45d5

```sql

BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "CommandSequence" (
	"Id"	integer NOT NULL,
	"SerializedCommands"	varchar,
	"ButtonId"	integer,
	PRIMARY KEY("Id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "ButtonPlacement" (
	"Id"	integer NOT NULL,
	"GridPosition"	varchar,
	"Visible"	integer,
	"ButtonId"	integer,
	"PageLayoutId"	integer,
	PRIMARY KEY("Id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "PageLayout" (
	"Id"	integer NOT NULL,
	"PageLayoutSetting"	varchar,
	"PageId"	integer,
	PRIMARY KEY("Id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "PageExtra" (
	"Id"	integer,
	"AccessedAt"	bigint,
	PRIMARY KEY("Id"),
	FOREIGN KEY("Id") REFERENCES "Page"("Id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "PageSetData" (
	"Id"	integer NOT NULL,
	"Identifier"	varchar,
	"Data"	blob,
	"RefCount"	integer DEFAULT 0,
	PRIMARY KEY("Id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "SyncData" (
	"UniqueId"	varchar(36) NOT NULL,
	"Type"	integer,
	"Timestamp"	bigint,
	"SyncHash"	integer,
	"Deleted"	integer,
	"Description"	VARCHAR,
	PRIMARY KEY("UniqueId")
);
CREATE TABLE IF NOT EXISTS "Synchronization" (
	"Id"	integer NOT NULL,
	"SyncServerIdentifier"	varchar,
	"PageSetTimestamp"	bigint,
	"PageSetSyncHash"	integer,
	PRIMARY KEY("Id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "Page" (
	"Id"	integer NOT NULL,
	"UniqueId"	varchar(36),
	"Title"	varchar,
	"PageType"	integer,
	"Language"	varchar,
	"BackgroundColor"	integer,
	"ContentTag"	varchar,
	"Timestamp"	bigint,
	"SyncHash"	integer,
	"LibrarySymbolId"	integer,
	"PageSetImageId"	integer,
	"GridDimension"	varchar,
	"MessageBarVisible"	integer,
	PRIMARY KEY("Id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "PageSetProperties" (
	"Id"	integer,
	"ContentIdentifier"	VARCHAR,
	"ContentVersion"	VARCHAR,
	"SchemaVersion"	VARCHAR,
	"UniqueId"	VARCHAR(36),
	"Language"	VARCHAR,
	"Timestamp"	BIGINT,
	"SyncHash"	integer,
	"DefaultHomePageUniqueId"	VARCHAR(36),
	"SerializedHomePageUniqueIdOverrides"	BLOB,
	"DefaultKeyboardPageUniqueId"	VARCHAR(36),
	"SerializedKeyboardPageUniqueIdOverrides"	BLOB,
	"ToolBarUniqueId"	VARCHAR(36),
	"DashboardUniqueId"	VARCHAR(36),
	"MessageBarUniqueId"	VARCHAR(36),
	"MessageBarVisible"	integer,
	"ToolBarVisible"	integer,
	"FriendlyName"	VARCHAR,
	"Description"	VARCHAR,
	"IconImageId"	integer,
	"SerializedPreferredGridDimensions"	VARCHAR,
	"GridDimension"	VARCHAR,
	"SmartSymLayout"	int,
	"FontFamily"	VARCHAR,
	"FontSize"	float,
	"FontStyle"	int,
	"PageBackgroundColor"	integer,
	"MessageBarBackgroundColor"	integer,
	"ToolBarBackgroundColor"	integer,
	"MessageWindowTextColor"	integer,
	"MessageWindowFontSize"	float,
	PRIMARY KEY("Id")
);
CREATE TABLE IF NOT EXISTS "ButtonPageLink" (
	"Id"	INTEGER NOT NULL,
	"ButtonId"	INTEGER NOT NULL,
	"PageUniqueId"	varchar(36) NOT NULL,
	PRIMARY KEY("Id" AUTOINCREMENT),
	FOREIGN KEY("ButtonId") REFERENCES "Button"("Id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "Button" (
	"Id"	INTEGER NOT NULL,
	"Language"	varchar,
	"Label"	varchar,
	"LabelOwnership"	integer,
	"Message"	varchar,
	"AudioCue"	varchar,
	"ImageOwnership"	integer,
	"LabelColor"	integer,
	"BackgroundColor"	integer,
	"BorderColor"	integer,
	"BorderThickness"	float,
	"FontSize"	float,
	"FontFamily"	varchar,
	"FontStyle"	integer,
	"SmartSymLayout"	integer,
	"CommandFlags"	integer,
	"ContentType"	integer,
	"ContentTag"	varchar,
	"LibrarySymbolId"	integer,
	"PageSetImageId"	integer,
	"SerializedContentTypeHandler"	varchar,
	"MessageRecordingId"	integer,
	"AudioCueRecordingId"	integer,
	"PageId"	integer,
	"UseMessageRecording"	integer,
	"UseAudioCueRecording"	integer,
	"UniqueId"	varchar(36),
	PRIMARY KEY("Id" AUTOINCREMENT)
);
CREATE INDEX IF NOT EXISTS "CommandSequence_ButtonId" ON "CommandSequence" (
	"ButtonId"
);
CREATE INDEX IF NOT EXISTS "ButtonPlacement_PageLayoutId" ON "ButtonPlacement" (
	"PageLayoutId"
);
CREATE INDEX IF NOT EXISTS "PageLayout_PageId" ON "PageLayout" (
	"PageId"
);
CREATE INDEX IF NOT EXISTS "Button_AudioCueRecordingId" ON "Button" (
	"AudioCueRecordingId"
);
CREATE INDEX IF NOT EXISTS "Button_MessageRecordingId" ON "Button" (
	"MessageRecordingId"
);
CREATE INDEX IF NOT EXISTS "Button_PageId" ON "Button" (
	"PageId"
);
CREATE INDEX IF NOT EXISTS "Button_PageSetImageId" ON "Button" (
	"PageSetImageId"
);
CREATE UNIQUE INDEX IF NOT EXISTS "PageSetData_Identifier" ON "PageSetData" (
	"Identifier"
);
CREATE UNIQUE INDEX IF NOT EXISTS "Page_UniqueId" ON "Page" (
	"UniqueId"
);
CREATE INDEX IF NOT EXISTS "Page_PageSetImageId" ON "Page" (
	"PageSetImageId"
);
COMMIT;

```

DBML 
```dbml
Table CommandSequence {
  Id int [pk, not null]
  SerializedCommands varchar
  ButtonId int
}

Table ButtonPlacement {
  Id int [pk, not null]
  GridPosition varchar
  Visible int
  ButtonId int
  PageLayoutId int
}

Table PageLayout {
  Id int [pk, not null]
  PageLayoutSetting varchar
  PageId int
}

Table PageExtra {
  Id int [pk, not null, ref: > Page.Id]
  AccessedAt bigint
}

Table PageSetData {
  Id int [pk, not null]
  Identifier varchar
  Data blob
  RefCount int [default: 0]
}

Table SyncData {
  UniqueId varchar(36) [pk, not null]
  Type int
  Timestamp bigint
  SyncHash int
  Deleted int
  Description varchar
}

Table Synchronization {
  Id int [pk, not null]
  SyncServerIdentifier varchar
  PageSetTimestamp bigint
  PageSetSyncHash int
}

Table Page {
  Id int [pk, not null]
  UniqueId varchar(36)
  Title varchar
  PageType int
  Language varchar
  BackgroundColor int
  ContentTag varchar
  Timestamp bigint
  SyncHash int
  LibrarySymbolId int
  PageSetImageId int
  GridDimension varchar
  MessageBarVisible int
}

Table PageSetProperties {
  Id int [pk, not null]
  ContentIdentifier varchar
  ContentVersion varchar
  SchemaVersion varchar
  UniqueId varchar(36)
  Language varchar
  Timestamp bigint
  SyncHash int
  DefaultHomePageUniqueId varchar(36)
  SerializedHomePageUniqueIdOverrides blob
  DefaultKeyboardPageUniqueId varchar(36)
  SerializedKeyboardPageUniqueIdOverrides blob
  ToolBarUniqueId varchar(36)
  DashboardUniqueId varchar(36)
  MessageBarUniqueId varchar(36)
  MessageBarVisible int
  ToolBarVisible int
  FriendlyName varchar
  Description varchar
  IconImageId int
  SerializedPreferredGridDimensions varchar
  GridDimension varchar
  SmartSymLayout int
  FontFamily varchar
  FontSize float
  FontStyle int
  PageBackgroundColor int
  MessageBarBackgroundColor int
  ToolBarBackgroundColor int
  MessageWindowTextColor int
  MessageWindowFontSize float
}

Table ButtonPageLink {
  Id int [pk, not null]
  ButtonId int [not null, ref: > Button.Id]
  PageUniqueId varchar(36) [not null]
}

Table Button {
  Id int [pk, not null]
  Language varchar
  Label varchar
  LabelOwnership int
  Message varchar
  AudioCue varchar
  ImageOwnership int
  LabelColor int
  BackgroundColor int
  BorderColor int
  BorderThickness float
  FontSize float
  FontFamily varchar
  FontStyle int
  SmartSymLayout int
  CommandFlags int
  ContentType int
  ContentTag varchar
  LibrarySymbolId int
  PageSetImageId int
  SerializedContentTypeHandler varchar
  MessageRecordingId int
  AudioCueRecordingId int
  PageId int
  UseMessageRecording int
  UseAudioCueRecording int
  UniqueId varchar(36)
}

// Relationships
Ref: CommandSequence.ButtonId > Button.Id
Ref: ButtonPlacement.ButtonId > Button.Id
Ref: ButtonPlacement.PageLayoutId > PageLayout.Id
Ref: PageLayout.PageId > Page.Id
Ref: PageExtra.Id > Page.Id
Ref: ButtonPageLink.ButtonId > Button.Id
Ref: Button.PageId > Page.Id

```

## Button/Language data

- There are really only two tables with this data in it `Button`- `Label` and `Button`- `Message` and `Page` - `Title`

## Symbols

### Symbol References in Snap Files

Snap files (.sps) store symbols in the following way:

1. **Button and Page References**
   - `Button.PageSetImageId`: References an entry in the PageSetData table
   - `Page.PageSetImageId`: Similar to Button, for page symbols

2. **PageSetData Table**
   - Contains the actual symbol data and references
   - Each entry has:
     - `Id`: Referenced by PageSetImageId
     - `Identifier`: Can be:
       - A symbol reference (e.g., 'SYM:33053')
       - A custom image identifier
     - `Data`: The actual image data as a BLOB

3. **Element Structure**
   - `ElementReference`: Contains metadata about elements (buttons, pages, etc.)
   - `ElementPlacement`: Controls where elements are placed in the grid
   - Buttons link to ElementReference through `Button.ElementReferenceId`

When processing a Snap file, symbols should be loaded by:
1. Getting the PageSetImageId from Button or Page
2. Looking up the entry in PageSetData
3. Using the image Data directly, with the Identifier as the label

Note: While Snap uses a separate symbol database (`SymbolsSnapCoreFoundation.db3`) in its installed version, exported .sps files contain all necessary symbol data within the PageSetData table.

### Symbol Resolution

`SymbolsSnapCoreFoundation.db3` is the symbol database used by Snap. It contains the following tables:

| Table             | Description                                                  |
|------------------|--------------------------------------------------------------|
| `Symbol`          | Stores the main symbol image and label text.                |
| `Library`         | Defines named symbol libraries (e.g., PCS, SymbolStix).      |
| `Tag`             | Defines tags or categories (e.g., “people”, “actions”).      |
| `SymbolTag`       | Many-to-many join between symbols and tags.                 |
| `SymbolLibrary`   | Many-to-many join between symbols and libraries.            |
| `SymbolSetProperties` | Metadata for the symbol set (e.g., version, GUID).      |

Full schema below

```sql
CREATE TABLE Symbol (SymbolId INTEGER NOT NULL, Image BLOB NOT NULL, MonoImage BLOB, Label TEXT NOT NULL, PRIMARY KEY(SymbolId)) WITHOUT ROWID;
CREATE TABLE Library (Id INTEGER NOT NULL UNIQUE, LibraryName varchar NOT NULL UNIQUE, LibraryCategory varchar NOT NULL, PRIMARY KEY(Id));
CREATE TABLE Tag (Id INTEGER NOT NULL UNIQUE, TagCategory varchar NOT NULL, TagName varchar NOT NULL, PRIMARY KEY(Id));
CREATE TABLE SymbolTag (SymbolId INTEGER NOT NULL, TagId INTEGER NOT NULL, CONSTRAINT SymbolTag_pk PRIMARY KEY(SymbolId, TagId));
CREATE TABLE SymbolLibrary (SymbolId INTEGER NOT NULL, LibraryId INTEGER NOT NULL, CONSTRAINT SymbolLibrary_pk PRIMARY KEY(SymbolId, LibraryId));
CREATE TABLE SymbolSetProperties (Guid varchar NOT NULL UNIQUE, Version varchar NOT NULL, Description varchar, DisplayName varchar, IsBuiltIn INTEGER NOT NULL);
CREATE INDEX LabelIndex ON Symbol (Label collate nocase ASC);
CREATE INDEX SymbolTagIndex ON SymbolTag (SymbolId ASC);
CREATE INDEX SymbolLibraryIndex ON SymbolLibrary (SymbolId ASC);
```


So to resolve a symbol reference in a Snap file, you would need to:
1. Get the PageSetImageId from Button or Page
2. Look up the entry in PageSetData
3. Use the image Data directly, with the Identifier as the label