# TouchChat

## Vocabs



- Export vocabs FileName.ce eg "MyVocabFile.ce" - where we write "FileName" below you can replace with "MyVocabFile" or whatever it is called
- Is just a zip with contents:


    - Images.c4s (SQLite)
    - Manifest.c4i (SQLite)
    - version.txt (Just one int eg 4)
    - FileName.c4v (SQLite)


## Images.c4s

```sql
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "variables" (
	"id"	INTEGER NOT NULL,
	"name"	TEXT NOT NULL,
	"value"	VARCHAR NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "locales" (
	"id"	INTEGER NOT NULL,
	"language"	TEXT NOT NULL,
	"country"	TEXT NOT NULL,
	"variant"	TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "translations" (
	"id"	INTEGER NOT NULL,
	"locale_id"	INTEGER NOT NULL,
	"name"	TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "symbol_translations" (
	"id"	INTEGER NOT NULL,
	"symbol_id"	INTEGER NOT NULL,
	"translation_id"	INTEGER NOT NULL UNIQUE,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE VIRTUAL TABLE [fts_translations] 						USING [fts3]([name], tokenize=porter);
CREATE TABLE IF NOT EXISTS "fts_translations_content" (
	"docid"	INTEGER,
	"c0name"	,
	PRIMARY KEY("docid")
);
CREATE TABLE IF NOT EXISTS "fts_translations_segments" (
	"blockid"	INTEGER,
	"block"	BLOB,
	PRIMARY KEY("blockid")
);
CREATE TABLE IF NOT EXISTS "fts_translations_segdir" (
	"level"	INTEGER,
	"idx"	INTEGER,
	"start_block"	INTEGER,
	"leaves_end_block"	INTEGER,
	"end_block"	INTEGER,
	"root"	BLOB,
	PRIMARY KEY("level","idx")
);
CREATE TABLE IF NOT EXISTS "categories" (
	"id"	INTEGER NOT NULL,
	"parent_id"	INTEGER NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "category_symbols" (
	"id"	INTEGER NOT NULL,
	"category_id"	INTEGER NOT NULL,
	"symbol_id"	INTEGER NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "category_translations" (
	"id"	INTEGER NOT NULL,
	"category_id"	INTEGER NOT NULL,
	"translation_id"	INTEGER NOT NULL UNIQUE,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "symbols" (
	"id"	INTEGER NOT NULL,
	"rid"	TEXT NOT NULL UNIQUE,
	"compressed"	INTEGER NOT NULL,
	"type"	INTEGER NOT NULL,
	"width"	INTEGER NOT NULL,
	"height"	INTEGER NOT NULL,
	"data"	BLOB NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
INSERT INTO "variables" ("id","name","value") VALUES (1,'FeatureID','145'),
 (2,'ReadOnly','false'),
 (3,'Name','Export Symbols Symbols');
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_VARIABLES_NAME" ON "variables" (
	"name"
);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_LOCALES_LANGUAGE_COUNTRY_VARIANT" ON "locales" (
	"language",
	"country",
	"variant"
);
CREATE INDEX IF NOT EXISTS "IDX_TRANSLATIONS_LOCALE_ID" ON "translations" (
	"locale_id"
);
CREATE INDEX IF NOT EXISTS "IDX_SYMBOL_TRANSLATIONS_SYMBOL_ID" ON "symbol_translations" (
	"symbol_id"
);
CREATE INDEX IF NOT EXISTS "IDX_CATEGORIES_PARENT_ID" ON "categories" (
	"parent_id"
);
CREATE INDEX IF NOT EXISTS "IDX_CATEGORY_SYMBOLS_CATEGORY_ID" ON "category_symbols" (
	"category_id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_CATEGORY_SYMBOLS_CATEGORY_ID_SYMBOL_ID" ON "category_symbols" (
	"category_id",
	"symbol_id"
);
CREATE TRIGGER [translations_bu] 						BEFORE UPDATE ON [translations] 						BEGIN DELETE FROM [fts_translations] 						WHERE [docid] = [old].[id]; 						END;
CREATE TRIGGER [translations_bd] 						BEFORE DELETE ON [translations] 						BEGIN DELETE FROM [fts_translations] 						WHERE [docid] = [old].[id]; 						END;
CREATE TRIGGER [translations_au] 						AFTER UPDATE ON [translations] 						BEGIN INSERT INTO [fts_translations]([docid], [name]) 						VALUES([new].[id], [new].[name]); 						END;
CREATE TRIGGER [translations_ai] 						AFTER INSERT ON [translations] 						BEGIN INSERT INTO [fts_translations]([docid], [name]) 						VALUES([new].[id], [new].[name]); 						END;
COMMIT;
```

## Manifest.c4i

```sql
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "variables" (
	"id"	INTEGER NOT NULL,
	"name"	TEXT NOT NULL,
	"value"	VARCHAR NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
INSERT INTO "variables" ("id","name","value") VALUES (1,'Origin','ChatEditor');
COMMIT;
```

### Filename.c4v

```sql

BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "variables" (
	"id"	INTEGER NOT NULL,
	"name"	TEXT NOT NULL,
	"value"	VARCHAR NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "resources" (
	"id"	INTEGER NOT NULL,
	"rid"	TEXT NOT NULL UNIQUE,
	"name"	TEXT NOT NULL,
	"type"	INTEGER NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "sounds" (
	"id"	INTEGER NOT NULL,
	"resource_id"	INTEGER NOT NULL,
	"data"	BLOB,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "button_styles" (
	"id"	INTEGER NOT NULL,
	"label_on_top"	INTEGER,
	"force_label_on_top"	INTEGER,
	"transparent"	INTEGER,
	"force_transparent"	INTEGER,
	"font_color"	INTEGER,
	"force_font_color"	INTEGER,
	"body_color"	INTEGER,
	"force_body_color"	INTEGER,
	"border_color"	INTEGER,
	"force_border_color"	INTEGER,
	"border_width"	INTEGER,
	"force_border_width"	INTEGER,
	"font_name"	TEXT,
	"font_bold"	INTEGER,
	"font_underline"	INTEGER,
	"font_italic"	INTEGER,
	"font_height"	INTEGER,
	"force_font"	INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "action_data" (
	"id"	INTEGER NOT NULL,
	"action_id"	INTEGER NOT NULL,
	"key"	INTEGER NOT NULL,
	"value"	VARCHAR NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "button_sets" (
	"id"	INTEGER NOT NULL,
	"resource_id"	INTEGER NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "button_boxes" (
	"id"	INTEGER NOT NULL,
	"resource_id"	INTEGER NOT NULL,
	"layout_x"	INTEGER,
	"layout_y"	INTEGER,
	"init_size_x"	INTEGER,
	"init_size_y"	INTEGER,
	"scan_pattern_id"	INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "page_styles" (
	"id"	INTEGER NOT NULL,
	"bg_color"	INTEGER,
	"force_bg_color"	INTEGER,
	"bg_alignment"	INTEGER,
	"force_bg_alignment"	INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "button_box_instances" (
	"id"	INTEGER NOT NULL,
	"page_id"	INTEGER NOT NULL,
	"button_box_id"	INTEGER NOT NULL,
	"position_x"	INTEGER,
	"position_y"	INTEGER,
	"size_x"	INTEGER,
	"size_y"	INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "button_box_cells" (
	"id"	INTEGER NOT NULL,
	"button_box_id"	INTEGER NOT NULL,
	"resource_id"	INTEGER NOT NULL,
	"location"	INTEGER NOT NULL,
	"span_x"	INTEGER NOT NULL,
	"span_y"	INTEGER NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "symbol_links" (
	"id"	INTEGER NOT NULL,
	"rid"	TEXT NOT NULL,
	"feature"	Integer NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "button_set_modifiers" (
	"id"	INTEGER NOT NULL,
	"button_set_id"	INTEGER NOT NULL,
	"button_id"	INTEGER NOT NULL,
	"modifier"	INTEGER NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "buttons" (
	"id"	INTEGER NOT NULL,
	"resource_id"	INTEGER NOT NULL,
	"label"	TEXT,
	"message"	TEXT,
	"symbol_link_id"	INTEGER,
	"visible"	INTEGER,
	"button_style_id"	INTEGER NOT NULL,
	"pronunciation"	TEXT DEFAULT NULL,
	"skin_tone_override"	INTEGER DEFAULT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "actions" (
	"id"	INTEGER NOT NULL,
	"resource_id"	INTEGER NOT NULL,
	"rank"	INTEGER NOT NULL,
	"code"	INTEGER NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "gestures" (
	"id"	INTEGER NOT NULL,
	"resource_id"	INTEGER NOT NULL UNIQUE,
	"label"	TEXT,
	"message"	TEXT,
	"code"	INTEGER NOT NULL,
	"type"	INTEGER NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "page_gestures" (
	"id"	INTEGER NOT NULL,
	"gesture_id"	INTEGER NOT NULL UNIQUE,
	"page_id"	INTEGER NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "vocabulary_gestures" (
	"id"	INTEGER NOT NULL,
	"gesture_id"	INTEGER NOT NULL UNIQUE,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "vocabulary_lists" (
	"id"	INTEGER NOT NULL,
	"name"	TEXT NOT NULL UNIQUE,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "vocabulary_list_buttons" (
	"id"	INTEGER NOT NULL,
	"vocabulary_list_id"	INTEGER NOT NULL,
	"button_id"	INTEGER NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "pages" (
	"id"	INTEGER NOT NULL,
	"resource_id"	INTEGER NOT NULL UNIQUE,
	"symbol_link_id"	INTEGER,
	"page_style_id"	INTEGER NOT NULL,
	"button_style_id"	INTEGER NOT NULL,
	"feature"	INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "scan_groups" (
	"id"	INTEGER NOT NULL,
	"parent_id"	INTEGER NOT NULL,
	"rank"	INTEGER NOT NULL,
	"name"	TEXT,
	"node_type"	INTEGER NOT NULL,
	"pattern"	INTEGER NOT NULL,
	"rows"	INTEGER NOT NULL,
	"columns"	INTEGER NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "scan_patterns" (
	"id"	INTEGER NOT NULL,
	"layout_x"	INTEGER NOT NULL,
	"layout_y"	INTEGER NOT NULL,
	"scan_group_id"	INTEGER NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "default_scan_patterns" (
	"id"	INTEGER NOT NULL,
	"layout_x"	INTEGER NOT NULL,
	"layout_y"	INTEGER NOT NULL,
	"scan_pattern_id"	INTEGER NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "scan_cells" (
	"id"	INTEGER NOT NULL,
	"scan_group_id"	INTEGER NOT NULL,
	"index"	INTEGER NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "sqlite_stat4" (
	"tbl"	,
	"idx"	,
	"neq"	,
	"nlt"	,
	"ndlt"	,
	"sample"	
);
CREATE TABLE IF NOT EXISTS "special_pages" (
	"id"	INTEGER NOT NULL,
	"name"	TEXT NOT NULL UNIQUE,
	"page_id"	INTEGER NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE INDEX IF NOT EXISTS "IDX_SYMBOL_LINKS_RID" ON "symbol_links" (
	"rid"
);
CREATE INDEX IF NOT EXISTS "IDX_RESOURCES_NAME_TYPE" ON "resources" (
	"name",
	"type"
);
CREATE INDEX IF NOT EXISTS "IDX_BUTTON_SET_MODIFIERS_BUTTON_SET_ID" ON "button_set_modifiers" (
	"button_set_id"
);
CREATE INDEX IF NOT EXISTS "IDX_BUTTON_BOX_CELLS_RESOURCE_ID" ON "button_box_cells" (
	"resource_id"
);
CREATE INDEX IF NOT EXISTS "IDX_BUTTON_BOX_INSTANCES_PAGE_ID" ON "button_box_instances" (
	"page_id"
);
CREATE INDEX IF NOT EXISTS "IDX_BUTTON_BOX_CELLS_BUTTON_BOX_ID" ON "button_box_cells" (
	"button_box_id"
);
CREATE INDEX IF NOT EXISTS "IDX_ACTION_DATA_ACTION_ID" ON "action_data" (
	"action_id"
);
CREATE INDEX IF NOT EXISTS "IDX_ACTIONS_RESOURCE_ID" ON "actions" (
	"resource_id"
);
CREATE INDEX IF NOT EXISTS "IDX_ACTIONS_CODE" ON "actions" (
	"code"
);
CREATE INDEX IF NOT EXISTS "IDX_PAGE_GESTURES_PAGE_ID" ON "page_gestures" (
	"page_id"
);
CREATE INDEX IF NOT EXISTS "IDX_SCAN_GROUPS_PARENT_ID" ON "scan_groups" (
	"parent_id"
);
CREATE INDEX IF NOT EXISTS "IDX_SCAN_CELLS_SCAN_GROUP_ID" ON "scan_cells" (
	"scan_group_id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_SOUNDS_RESOURCE_ID" ON "sounds" (
	"resource_id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_BUTTON_SETS_RESOURCE_ID" ON "button_sets" (
	"resource_id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_BUTTON_BOXES_RESOURCE_ID" ON "button_boxes" (
	"resource_id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_VARIABLES_NAME" ON "variables" (
	"name"
);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_BUTTONS_RESOURCE_ID" ON "buttons" (
	"resource_id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_VOCABULARY_LIST_BUTTONS_VOCABULARY_LIST_ID_BUTTON_ID" ON "vocabulary_list_buttons" (
	"vocabulary_list_id",
	"button_id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_DEFAULT_SCAN_PATTERNS_LAYOUT_X_LAYOUT_Y" ON "default_scan_patterns" (
	"layout_x",
	"layout_y"
);
COMMIT;
```


### Notes

- In many packages you find Images and Manifest very thin - I think particularly if you just stick to inbuild symbols
- Most raw language data is in buttons and labels

eg
``sql
SELECT id, label, message
FROM buttons
WHERE label IS NOT NULL OR message IS NOT NULL;
``

will get you most of the lang data

## Symbols

Symbols in TouchChat are referenced indirectly in `.c4v` vocabulary files and resolved via external symbol library files located in:

```
C:\Program Files (x86)\Chat Editor\Symbols\
```

### Symbol Library Files

These are SQLite databases containing symbol image data in the form of binary blobs. Example files include:

```
AntiquatedLink.db
Imagine.c4s
Metacom.c4s
MinSpeak.c4s
PCS.c45
Pixon.c4s
PRC.c4s
Saltillo.c4s
Sample.c4s
SymbolStix.c4s
Tawasol.c4s
```

Each file typically includes a `Symbols` table, where:
- `id` is the internal symbol identifier.
- `rid` is a UUID (RID) used to reference the symbol from vocabularies.
- `data` is a BLOB that stores the image (usually PNG or WMF).


###  How Symbols Link to Buttons

In a `.c4v` vocabulary (also a SQLite file), symbols are referenced using two tables:

#### `Buttons` table
Each button can include a `symbol_link_id` column:

```csv
id  resource_id  label     message    symbol_link_id
1   3            building  building   1
```

#### `symbol_links` table
This table provides the mapping from `symbol_link_id` to a symbol RID (UUID):

```csv
id  rid                                     feature
1   {32BA0E22-7FE1F748-AA1C879C-BF24066D}   14
```

- `rid` is a globally unique identifier for the symbol.
- `feature` may control symbol variants (e.g. color, rotation, skin tone).


### How the Symbol Library is Resolved

The `.c4v` file does **not** explicitly record which symbol library a RID comes from. Instead, Chat Editor or TouchChat:

1. Scans all installed symbol libraries (e.g., `PCS.c45`, `SymbolStix.c4s`).
2. Finds the first matching RID.
3. Loads the corresponding symbol from that file.

This means:
- RIDs must be unique across all symbol libraries.
- If the matching `.c4s` file is missing, the symbol won't display.


### Suggested Usage for Developers

To resolve symbols programmatically:

1. Extract `symbol_link_id` from the `Buttons` table.
2. Join with `symbol_links` to get the `rid` (UUID).
3. Search across all `.c4s`/`.c45` symbol databases for that RID.
4. Extract the `data` BLOB for the matching symbol (image).

You can use SQLite queries such as:

```sql
SELECT data FROM Symbols WHERE rid = '{UUID}';
```

Then write the BLOB as a `.png` or `.wmf` file, depending on the symbol system.

---

By building an index of RIDs across all available libraries, you can create a full symbol mapping layer for any `.c4v` vocabulary file.

