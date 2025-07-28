# Grid 3 File Docs

## Introduction

This document provides a detailed technical guide to the structure and functionalities of Grid 3 files, focusing on the .gridset format used in Augmentative and Alternative Communication (AAC) boards. This guide is targeted at developers, researchers, and advanced users.

## Terminology

- Gridset: A zipped archive containing grid files and settings.
- AAC: Augmentative and Alternative Communication.
- Cell: A button on an AAC board that can have various functionalities.
- ScanBlock: A group of cells that are scanned together.

## Gridset Archive Structure

The grid files are part of a `.gridset` zipped archive. Renaming the file to `.zip` allows you to unzip and explore its contents.

### Directory Structure

- **Grids/**: Directory where each XML grid file resides. E.g., `Grids/About me/grid.xml`
- **Settings0/**: Directory containing settings and styles for the grid.
- **FileMap.xml** An XML file that maps grid XML files and their associated dynamic files.

```xml
<FileMap xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <!-- Entry for each grid XML file and its dynamic files -->
  <Entries>
    <Entry StaticFile="Grids\Treats\grid.xml">
      <DynamicFiles>
        <File>Grids\Treats\wordlist-0-0.gridbmp</File>
      </DynamicFiles>
    </Entry>
    <!-- ... -->
  </Entries>
</FileMap>
```

- **Settings0/ettings.xml** Contains settings related to the gridset.

### Purpose

The `Settings0/settings.xml` file in a Grid 3 gridset contains various settings related to the gridset, including the identification of the home grid.

### Structure

The file is an XML document with multiple settings, one of which is the `StartGrid`. This setting specifies the home grid, which is the default starting point or main screen for the gridset.

### Key Element: `StartGrid`

- **`<StartGrid>`**: This element holds the name of the home grid. It's the grid that the user sees when they first access the gridset or return to the main menu.

### Example

An example excerpt from a `Settings0/settings.xml` file:

```xml
<GridSetSettings xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <!-- ... other settings ... -->
  <StartGrid>01 CORE pg1</StartGrid>
  <!-- ... other settings ... -->
</GridSetSettings>


- **Settings/Styles/style.xml** Defines various styles that can be applied to cells.

```xml
<StyleData xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <!-- Definition of different styles -->
</StyleData>
```

Each style is documented here for then referencing ib each pages grid.xml e.g

```xml
 <Styles>	
    <Style Key="Workspace">
          <BackColour>#B8312FFF</BackColour>
          <TileColour>#FAC51CFF</TileColour>
          <BorderColour>#FEEFE7FF</BorderColour>
          <FontColour>#FDE8A4FF</FontColour>
          <FontName>Dosis</FontName>
          <FontSize>40</FontSize>
    </Style>
    <!-- ,, -->
```
In this example, the <StartGrid> element indicates that "01 CORE pg1" is the home grid for this gridset.

### Usage in the Application
In the gridset comparison application, this file is parsed to determine the starting grid for navigation path calculations. The home grid is essential for understanding the user's journey through the gridset and for calculating the effort required to access different buttons or commands.

## Grid XML File Format Documentation

### Overview

Grid XML files are used to describe the layout and content of AAC (Augmentative and Alternative Communication) boards used in the Grid software. They contain information about the grid layout (rows and columns), buttons (also called cells), and their properties.


### Cell Positioning System

Cells are positioned using a zero-based coordinate system:
- **X**: 0-based column index (leftmost column = 0)
- **Y**: 0-based row index (topmost row = 0)
- **ColumnSpan**: Number of columns the cell spans (default: 1)
- **RowSpan**: Number of rows the cell spans (default: 1)

```xml
<Cell X="2" Y="1" ColumnSpan="2" RowSpan="1">
  <!-- Cell spans columns 2-3, row 1 -->
</Cell>
```

#### Column/Row Size System

Both columns and rows support size definitions with these values:
- `ExtraSmall` (0.33x)
- `Small` (0.66x) 
- `Medium` (1.0x) - default
- `Large` (1.66x)
- `ExtraLarge` (2.5x)

```xml
<ColumnDefinitions>
  <ColumnDefinition Width="Large" />
  <ColumnDefinition Width="Medium" />
</ColumnDefinitions>
<RowDefinitions>
  <RowDefinition Height="ExtraSmall" />
</RowDefinitions>
```


#### Full Example 

```xml
<Grid xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <!--Background colour - hex code -->
  <BackgroundColour>#E2EDF8FF</BackgroundColour>
  <!-- Unique ID -->
  <GridGuid>e631d2c5-cc2c-49b3-b6bb-eb1c81af84af</GridGuid>
  <!-- This defines the  column size -->
  <ColumnDefinitions>
    <ColumnDefinition />
    <ColumnDefinition />
    <ColumnDefinition />
    <ColumnDefinition />
    <ColumnDefinition />
    <ColumnDefinition />
    <ColumnDefinition />
    <ColumnDefinition />
    <ColumnDefinition />
  </ColumnDefinitions>
  <!-- This defines the row or column size -->
  <RowDefinitions>
    <RowDefinition />
    <RowDefinition />
    <RowDefinition />
    <RowDefinition />
    <RowDefinition />
    <RowDefinition />
    <RowDefinition />
  </RowDefinitions>
  <!-- AutoContentCommands - Need some more testing to detail this  -->
  <AutoContentCommands>
    <AutoContentCommandCollection AutoContentType="Prediction">
      <Commands>
        <Command ID="AutoContent.Activate">
          <Parameter Key="autocontenttype">Prediction</Parameter>
        </Command>
      </Commands>
    </AutoContentCommandCollection>
  </AutoContentCommands>
  <Cells>
    <Cell>
      <Content>
        <Commands>
          <Command ID="Jump.To">
            <Parameter Key="grid">Special</Parameter>
          </Command>
        </Commands>
        <CaptionAndImage>
          <Caption>Special</Caption>
          <Image>[grid3x]star.wmf</Image>
        </CaptionAndImage>
        <Style>
          <BasedOnStyle>Navigation category style</BasedOnStyle>
        </Style>
      </Content>
    </Cell>
    <!--etc-->
  </Cells>
  <!-- this gives highlight description text for each Block in the block scan. NB: max of 8 -->
  <ScanBlockAudioDescriptions>
    <ScanBlockAudioDescription>
      <ScanBlock>1</ScanBlock>
    </ScanBlockAudioDescription>
    <ScanBlockAudioDescription>
      <ScanBlock>2</ScanBlock>
    </ScanBlockAudioDescription>
    <ScanBlockAudioDescription>
      <ScanBlock>3</ScanBlock>
    </ScanBlockAudioDescription>
    <ScanBlockAudioDescription>
      <ScanBlock>4</ScanBlock>
    </ScanBlockAudioDescription>
    <ScanBlockAudioDescription>
      <ScanBlock>5</ScanBlock>
    </ScanBlockAudioDescription>
    <ScanBlockAudioDescription>
      <ScanBlock>6</ScanBlock>
    </ScanBlockAudioDescription>
    <ScanBlockAudioDescription>
      <ScanBlock>7</ScanBlock>
    </ScanBlockAudioDescription>
    <ScanBlockAudioDescription>
      <ScanBlock>8</ScanBlock>
    </ScanBlockAudioDescription>
  </ScanBlockAudioDescriptions>
  <!-- Wordlists - this is an AutoContent Type cell. More info to come here>
  <WordList>
    <Items />
  </WordList>
</Grid>
```

### Structure

- **Root Element**: The root element usually encapsulates the entire XML document and contains all other elements.
  
  ```xml
  <Root>
    <!-- Child elements go here -->
  </Root>
  ```
  
#### Elements and Attributes

- **Grid Element**
- **BackgroundColour**: Specifies the background color of the grid using a hex code. E.g., `<BackgroundColour>#E2EDF8FF</BackgroundColour>`
- **GridGuid**: A unique identifier for the grid. E.g., `<GridGuid>e631d2c5-cc2c-49b3-b6bb-eb1c81af84af</GridGuid>`

#### Layout Information

- **ColumnDefinitions**: Defines the number of columns in the grid.

  ```xml
  <ColumnDefinitions>
    <ColumnDefinition />
    <!-- Repeat for each column -->
  </ColumnDefinitions>
  ```

- **RowDefinitions**: Defines the number of rows in the grid.

  ```xml
  <RowDefinitions>
    <RowDefinition />
    <!-- Repeat for each row -->
  </RowDefinitions>
  ```

- **AutoContentCommands**:  A section for commands related to auto content like predictions.

```xml
<AutoContentCommands>
  <AutoContentCommandCollection AutoContentType="Prediction">
    <Commands>
      <Command ID="AutoContent.Activate">
        <Parameter Key="autocontenttype">Prediction</Parameter>
      </Command>
    </Commands>
  </AutoContentCommandCollection>
</AutoContentCommands>
```

- **ScanBlockAudioDescriptions**: Provides audio descriptions for each scan block. The maximum number of scan blocks is 8.
```xml
<ScanBlockAudioDescriptions>
  <ScanBlockAudioDescription>
    <ScanBlock>1</ScanBlock>
  </ScanBlockAudioDescription>
  <!-- ... -->
</ScanBlockAudioDescriptions>
```

- **WordList:** Defines an AutoContent Type cell, which may contain word lists or other dynamic content. 

```xml
<WordList>
    <Items>
      <WordListItem>
        <Text>
          <s Image="[widgit]widgit rebus\h\hello.emf">
            <r>Hello</r>
          </s>
        </Text>
        <Image>[widgit]widgit rebus\h\hello.emf</Image>
        <PartOfSpeech>Unknown</PartOfSpeech>
      </WordListItem>
	  <!--  etc  -->
    </Items>
  </WordList>
```

### Buttons (Cells)

#### Overview

- **Cells**: Contains the definitions for each button or cell.

  ```xml
  <Cells>
    <Cell>
      <!-- Cell properties go here -->
    </Cell>
    <!-- Repeat for each cell -->
  </Cells>
  ```
#### Attributes of Cell

Cells are the primary elements that make up a grid. They are defined using the <Cell> tag and can have various attributes.

- X and Y: These define the cell's position in the grid, corresponding to its column (X) and row (Y).
- ScanBlock: Optional attribute to define which scan block the cell belongs to.
   - There is a maximum of 8 scan blocks per page.
  - Values range from 1 to 8.
  - A cell can be in any of these blocks.
  - If not specified, the attribute is not needed for that particular cell.
- ColumnSpan and RowSpan: Define how many columns or rows the cell spans. 

- AutoContentType, ID, Key: Used in various elements and commands to define their specific types and identifiers.
- Height: Attribute in RowDefinitions/RowDefinition, specifies the height of rows.



```xml
<Cell X="7" Y="1" ScanBlock="2">
```

##### Properties of Cell

- **Caption**: The text displayed on the button.

```xml
<Caption>Hello</Caption>
```

- **CaptionAndImage**: It has a image and caption. Image relates to a ``[symbol-library]filename.extension`` (NB: The Grid licences Widgit)

- AudioDescription: Found within CaptionAndImage, provides audio descriptions for cells.

```
 <CaptionAndImage>
	  <Caption>Keyboard</Caption>
	  <Image>[grid3x]keyboard.wmf</Image>
	</CaptionAndImage>
```

- **Style**: Styles are referenced within cells to determine their appearance.

- BasedOnStyle: Refers to a predefined style from style.xml.
- BackColour, TileColour, BorderColour, FontColour, FontName, FontSize: Define various aspects of the cell's appearance.

```xml
<Cell X="7" Y="1">
  <Content>
    <!-- ... -->
    <Style>
      <BasedOnStyle>Actions category style</BasedOnStyle>
    </Style>
  </Content>
</Cell>
```

- **BasedOnStyle**: Refers to a predefined style from style.xml.

You can extend the style of a cell like this

```xml
	<Style>
	  <BasedOnStyle>Verbs</BasedOnStyle>
	  <BackColour>#B8312FFF</BackColour>
	  <TileColour>#FAC51CFF</TileColour>
	  <BorderColour>#FEEFE7FF</BorderColour>
	  <FontColour>#FDE8A4FF</FontColour>
	  <FontName>Dosis</FontName>
	  <FontSize>40</FontSize>
	</Style>
```

Note on WordList cells. These should have a ContentType = AutoContent ContentSubType = WodList

- WordList/Items: Specifies items within a word list, crucial for grids that rely on dynamic content.

```xml
<Cell X="3" Y="2" ScanBlock="2">
      <Content>
        <ContentType>AutoContent</ContentType>
        <ContentSubType>WordList</ContentSubType>
        <CaptionAndImage xsi:nil="true" />
        <Style>
          <BasedOnStyle>Auto content</BasedOnStyle>
          <BorderColour>#2C82C9FF</BorderColour>
        </Style>
      </Content>
    </Cell>
```


## WordList

### Overview

`WordList` elements are used to define a list of words or phrases within a grid. They are typically found within `Cell` elements and are used to provide a dynamic list of vocabulary items.

### Structure

- **WordList**: The root element for the word list.
  - **Items**: Container for all the items in the word list.
    - **WordListItem**: Individual item within the word list.
      - **Text**: Contains the textual representation of the item.
        - **s**: An element that may include an image path and encloses the raw text of the item.
          - **r**: The raw text of the item, representing the word or phrase.
      - **Image**: Path to an image representing the item, typically in a symbol library.
      - **PartOfSpeech**: Category of the part of speech for the item (e.g., noun, verb).

### Example XML Structure

```xml
<WordList>
    <Items>
        <WordListItem>
            <Text>
                <s Image="[symbol-library]image-path">
                    <r>word</r>
                </s>
            </Text>
            <Image>[symbol-library]image-path</Image>
            <PartOfSpeech>Part of speech category</PartOfSpeech>
        </WordListItem>
        <!-- Additional WordListItems... -->
    </Items>
</WordList>


## Commands

Commands are actions that a cell can execute when activated. They are defined under the `<Commands>` tag within a `<Content>` tag in a cell.
	
### Simple Command

Commands associated with a cell are defined under the <Commands> tag within a <Content> tag.
A command without parameters looks like the following:

```xml
<Command ID="Jump.Back" />
```

### AutoContent Commands

- AutoContentCommands/AutoContentCommandCollection: Defines a collection of auto content commands, such as predictions or word lists.

### Command with Parameters

A command with additional settings can have parameters:

```xml
<Command ID="Action.Speak">
  <Parameter Key="unit">All</Parameter>
  <Parameter Key="movecaret">0</Parameter>
</Command>
```

### Parameter Types and Serialization

Grid 3 uses several parameter definition types with specific serialization formats:

#### Parameter Definition Types

- **`StringParameterDefinition`**: String values stored as-is
- **`BooleanParameterDefinition`**: Boolean values serialized as "1" (true) or "0" (false)
- **`IntParameterDefinition`**: Integer values stored as strings using invariant culture
- **`DoubleParameterDefinition`**: Double values stored as strings
- **`EnumParameterDefinition<T>`**: Enum values serialized as their string names
- **`TimeSpanParameterDefinition`**: TimeSpan values stored as strings
- **`TextBaseParameterDefinition`**: Rich text with symbols stored as XML
- **`WordListParameterDefinition`**: WordList objects serialized as XML
- **`FileDataParameterDefinition`**: File data for embedded files

### Common Commands and Parameters

#### Navigation Commands

##### `Jump.To`
Navigate to another grid
- **Parameters:**
  - `grid` (string): Target grid name within the .gridset bundle

```xml
<Command ID="Jump.To">
  <Parameter Key="grid">Quantity</Parameter>
</Command>
```

##### `Jump.Back`
Return to previous grid
- **Parameters:** None

```xml
<Command ID="Jump.Back" />
```

##### `Jump.Home`
Navigate to start grid
- **Parameters:** None

```xml
<Command ID="Jump.Home" />
```

##### `Jump.ToKeyboard`
Navigate to keyboard grid
- **Parameters:** None

```xml
<Command ID="Jump.ToKeyboard" />
```

#### Text Commands

##### `Action.InsertText`
Insert text with optional symbols and grammar information
- **Parameters:**
  - `text` (TextBase): Rich text content with optional symbols
  - `pos` (PartOfSpeech): Part of speech (Unknown, Noun, Verb, etc.)
  - `person` (string): Grammatical person information
  - `number` (string): Grammatical number information
  - `gender` (string): Grammatical gender information
  - `verbstate` (VerbState): Verb state (Reset, etc.)
  - `showincelllabel` (ShowInCellLabel): Display options for cell label

```xml
<Command ID="Action.InsertText">
  <Parameter Key="text">
    <SymbolRun Image="[WIDGIT]path/to/symbol.emf">
      <Run>Hello</Run>
      <Run> </Run>
    </SymbolRun>
  </Parameter>
  <Parameter Key="verbstate">Reset</Parameter>
</Command>
```

##### `Action.Letter`
Insert single character
- **Parameters:**
  - `letter` (string): Single character to insert

```xml
<Command ID="Action.Letter">
  <Parameter Key="letter">A</Parameter>
</Command>
```

##### `Action.DeleteWord`
Delete last word
- **Parameters:** None

```xml
<Command ID="Action.DeleteWord" />
```

##### `Action.DeleteLetter`
Delete last character
- **Parameters:** None

```xml
<Command ID="Action.DeleteLetter" />
```

##### `Action.Clear`
Clear message window
- **Parameters:** None

```xml
<Command ID="Action.Clear" />
```

##### `Action.Copy`
Copy text to clipboard
- **Parameters:** None

```xml
<Command ID="Action.Copy" />
```

##### `Action.Paste`
Paste text from clipboard
- **Parameters:** None

```xml
<Command ID="Action.Paste" />
```
  

## Symbols

Symbols (images) are used in cells to represent words, actions, or other elements. They are defined using the <Image> tag. eg 

```xml
Image>[grid3x]star.wmf</Image>
```

So the part in square brackets is the library name, and the part in round brackets is the filename.

### Libraries

Libraries are collections of symbols that can be used in cells. The location of these are found in ``C:\Program Files (x86)\Smartbox\Grid3\Resources\Symbols\``

Here are files names like ``WIDGIT.symbols``

This is a zipped archive. With the following structure

```bash
categories.pix
censored.txt
library.pix
symbols/  # Symbol files. Can be a organised structure of folders files eg widgit rebus/h/hello.wmf or just a list of wmf files
symbols_rtl/  # Same as symbols but ones that have been flipped for rtl languages
```

#### .pix Files (Symbol Index Files)

Based on the Grid 3 source code implementation, .pix files are symbol index files that provide search and categorization capabilities for symbol libraries:

**File Types and Purposes**:

**`[library].pix` (e.g., `WIDGIT.pix`, `SSTIX#.pix`)**:
- **Purpose**: Main symbol search index for a symbol library
- **Implementation**: Uses `CombinedValueIndex` class for symbol-to-caption mapping
- **Content**: Maps symbol IDs to their text captions/names for search functionality
- **Usage**: Enables text-based symbol search (e.g., searching "knife" returns matching symbols)
- **Localization**: Language-specific (e.g., `[widgit] en-GB names.pix`)

**`categories.pix`**:
- **Purpose**: Symbol categorization index for organizing symbols by topic/category
- **Implementation**: Uses `MultiValueIndex` class for category-based organization
- **Content**: Maps category names to lists of symbol IDs within each category
- **Usage**: Enables browsing symbols by categories (e.g., "Food", "Animals", "Actions")
- **Integration**: Works alongside main .pix files to provide category-based symbol browsing

**`library.pix`**:
- **Purpose**: Library metadata and symbol reference index
- **Content**: Contains symbol metadata, file paths, and library organization information
- **Usage**: Supports symbol reference resolution and library management

**Technical Implementation**:

**Index Classes**:
- **`CombinedValueIndex`**: Handles both single-value and multi-value indexing
- **`MultiValueIndex`**: Manages category-to-symbol-list mappings
- **`SingleValueIndex`**: Simple key-value symbol-to-caption mappings
- **`SymbolLibraryPictureSearchSource`**: Provides search interface using these indexes

**Symbol Reference Resolution**:
```csharp
// Library key conversion (source code implementation)
string libKey = PictureLibraryHelper.ConvertLibraryIdToKey(libraryId).ToLower();
var entry = searchFolder.GetEntry(libKey + ".pix");
var combinedIndex = new CombinedValueIndex(entry, languageName, true);

// Category index loading
var categoryEntry = library.GetArchiveEntry("categories.pix");
var categoryIndex = new MultiValueIndex(categoryEntry, languageName, true);
```

**Search Functionality**:
- **Exact Match**: Direct symbol ID to caption lookup
- **Fuzzy Search**: Partial text matching for symbol discovery
- **Predictive Search**: Start-of-word matching for prediction systems
- **Category Browsing**: Category-based symbol organization
- **Deduplication**: Automatic removal of duplicate search results

**File Format Details**:
- **Binary Format**: Custom binary index format optimized for fast lookups
- **Localization Support**: Language-specific indexes with culture-aware text processing
- **Compression**: May use internal compression for efficiency
- **Encoding**: Supports Unicode text with bidirectional text handling
	•	Byte frequency analysis indicates structured data with null padding, suggesting fixed-width or aligned records.

#### censored.txt

Despite the .txt extension, censored.txt does not contain plain text or word lists. It appears to be binary or encoded content, possibly representing internal lookup data or encrypted keywords.

## Complete Style System Documentation

### Built-in Style Keys

Grid 3 includes these predefined styles:

- **`Default`**: Base style for all cells
- **`Workspace`**: Message window/workspace area style
- **`Auto content`**: Dynamic content cells (predictions, word lists)
- **`Vocab cell`**: Vocabulary/word cells
- **`Keyboard key`**: On-screen keyboard buttons
- **Category Styles**: Auto-generated for command categories
  - `Actions category style`
  - `People category style` 
  - `Places category style`
  - `Descriptive category style`
  - `Social category style`
  - `Questions category style`
  - `Little words category style`

### Theme System

Grid 3 supports four themes with distinct visual properties:

#### Modern Theme (Default)
- Border Width: 1px
- Corner Style: Normal (square)
- Drop Shadow: No
- Gradient Fill: Yes
- Font Family: "Roboto"
- Cell Spacing: 1.0x

#### Kids/Bubble Theme
- Border Width: 5px
- Corner Style: Rounded
- Drop Shadow: Yes
- Gradient Fill: Yes
- Font Family: "Short Stack"
- Cell Spacing: 2.0x (double spacing)
- White Border: Yes

#### Flat/Blocky Theme (Grid 2 Compatible)
- Border Width: 2px
- Corner Style: TheGrid2 (square with specific styling)
- Drop Shadow: No
- Gradient Fill: No
- Font Family: "Tahoma"
- Cell Spacing: 1.0x

#### Explorer Theme (Internal)
- Border Width: 2px
- Corner Style: Rounded
- Drop Shadow: Yes
- Gradient Fill: No
- Font Family: "Booster Next FY Light"
- Cell Spacing: 1.0x

### Style Inheritance

Styles use a cascading system:
1. Theme provides base properties
2. Built-in style defines category defaults
3. Cell-specific overrides apply on top

```xml
<Style>
  <BasedOnStyle>Actions category style</BasedOnStyle>
  <BackColour>#FF0000FF</BackColour> <!-- Override just the background -->
</Style>
```

### Font System

- **ThemeFont**: Special value that resolves to the current theme's font
- Custom fonts can be specified directly
- Font sizes are in points (default: 16.0)

## Complete Cell Content Types

### ContentType Values

- **`Normal`** (0): Standard button cells with commands
- **`AutoContent`** (1): Dynamic content cells (predictions, word lists, auto-populated content)
- **`Workspace`** (-1): Message window/text display area for composing text
- **`LiveCell`** (2): Real-time updating cells that display dynamic information

### ContentSubType Values

#### For AutoContent Cells

**Prediction Types:**
- **`Prediction`**: Standard word prediction cells
- **`Prediction.WordList`**: Word list-based predictions
- **`Prediction.Conjugations`**: Verb conjugation predictions

**Content Types:**
- **`WordList`**: Static or dynamic word lists
- **`MessageBanking`**: Message banking categories
- **`MessageBanking.Recordings`**: Message banking recordings
- **`Contacts`**: Contact information cells
- **`Photos`**: Photo gallery cells
- **`InternetFavourites`**: Web browser favorites
- **`SavedPhrases`**: User-saved phrases

#### For Workspace Cells (Message Bar)

**Note**: The "message bar" in Grid 3 refers to Workspace cells - these are text composition and editing areas where users build messages, documents, or other text content.

**Communication Workspaces:**
- **`Chat`**: Text chat/messaging workspace for composing messages to speak aloud
- **`SymbolChat`**: Symbol-based chat workspace with symbol support
- **`Email`**: Email composition workspace for creating email messages
- **`Sms`**: SMS message composition workspace for text messages
- **`Skype`**: Skype messaging workspace for Skype communications
- **`Phone`**: Phone number input workspace

**Productivity Workspaces:**
- **`WordProcessor`**: Document editing workspace for viewing and editing documents
- **`Calculator`**: Calculator workspace for mathematical operations
- **`WebBrowser`**: Web browser workspace for viewing web pages
- **`WebBrowser.AddressBar`**: Web address input workspace for URL entry
- **`Contacts`**: Contact editing workspace for managing contact information

### Workspace Cell Behavior and Text Command Interaction

Workspace cells are the primary target for text manipulation commands. Here's how different commands interact with workspace types:

#### Text Input Commands
All workspace types support these core text commands:

**`Action.InsertText`**: Inserts rich text with symbols
- Supports grammar information (part of speech, verb state)
- Handles symbol integration automatically
- Triggers speak-as-you-type in appropriate workspaces
- Updates word prediction after insertion

**`Action.Letter`**: Inserts single characters
- Used for keyboard input
- Triggers grammar processing for language support
- Updates prediction context

**`Action.Clear`**: Clears workspace content
- Removes all text from the active workspace
- Resets grammar state and prediction context

**`Action.DeleteWord`** / **`Action.DeleteLetter`**: Text deletion
- Removes words or characters from workspace
- Updates prediction and grammar context accordingly

#### Speech Commands and Workspace Types

**`Action.Speak`**: Behavior varies by workspace type
- **Chat workspace**: Speaks content and stores in chat history
- **Email workspace**: Speaks composed email content
- **WordProcessor workspace**: Speaks document content
- **SMS workspace**: Speaks message content
- **Phone workspace**: May speak entered phone number

#### Workspace-Specific Behaviors

**Chat Workspace (`Chat`)**:
- Primary purpose: Compose messages for speaking aloud
- Stores spoken messages in chat history
- Supports speak-as-you-type functionality
- EditModeText: "Write messages here"

**Email Workspace (`Email`)**:
- Purpose: Compose email messages
- Integrates with email contacts for recipient selection
- Supports rich text formatting
- EditModeText: "Write email messages here"

**SMS Workspace (`Sms`)**:
- Purpose: Compose SMS text messages
- Character count considerations for SMS limits
- Plain text focused (limited rich text)
- EditModeText: "Write SMS messages here"

**WordProcessor Workspace (`WordProcessor`)**:
- Purpose: Edit documents selected in Documents LiveCell
- Full rich text editing capabilities
- Document persistence and management
- EditModeText: "Edit documents here"

**Phone Workspace (`Phone`)**:
- Purpose: Enter phone numbers for dialing
- Numeric input focused
- Integration with phone calling functionality
- May display formatted phone numbers

#### Workspace Activation States

Workspaces have different activation behaviors:

**`WritingAreaActivation.SpeakContents`**:
- Clicking workspace speaks its content
- Used when workspace is primarily for speech output

**`WritingAreaActivation.MoveCursor`**:
- Clicking workspace moves text cursor
- Used when workspace is primarily for text editing

#### Example Workspace Configurations

**Chat Workspace**:
```xml
<Cell X="0" Y="0" ColumnSpan="6" RowSpan="2">
  <Content>
    <ContentType>Workspace</ContentType>
    <ContentSubType>Chat</ContentSubType>
    <Style>
      <BasedOnStyle>Workspace</BasedOnStyle>
    </Style>
  </Content>
</Cell>
```

**Email Workspace with Custom Styling**:
```xml
<Cell X="0" Y="2" ColumnSpan="6" RowSpan="3">
  <Content>
    <ContentType>Workspace</ContentType>
    <ContentSubType>Email</ContentSubType>
    <Style>
      <BasedOnStyle>Workspace</BasedOnStyle>
      <BackColour>#FFFFFFFF</BackColour>
      <FontSize>16</FontSize>
    </Style>
  </Content>
</Cell>
```

#### For LiveCell Cells

**Information Displays:**
- **`Clock.FullDate`**: Full date display
- **`Clock.ShortDate`**: Short date display
- **`Clock.Time`**: Time display
- **`Clock.DayOfWeek`**: Day of week display
- **`Clock.Month`**: Month display
- **`Clock.Year`**: Year display

**Media and Communication:**
- **`Photos.Photos`**: Photo viewer
- **`Photos.Camera`**: Camera feed
- **`Sms.Messages`**: SMS message list
- **`Email.Messages`**: Email message list
- **`Contacts.Contacts`**: Contact list

**System Information:**
- **`ComputerControl.DeviceVolume`**: System volume display
- **`WordProcessor.Documents`**: Document list

### LiveCell Types and Behaviors

LiveCells are classified into three types with distinct behaviors and interaction patterns:

#### Info Type LiveCells
**Purpose**: Display summary information with minimal user interaction
**Behavior**:
- Read-only display of dynamic information
- Updates automatically based on system state
- Limited or no direct user interaction
- Typically shows status, time, or system information

**Examples**:
- Clock displays (time, date, day of week)
- System volume indicators
- Timer displays
- Game counters (mines, bombs)

**Common ContentSubType Values**:
- `Clock.Time`, `Clock.FullDate`, `Clock.ShortDate`, `Clock.DayOfWeek`
- `ComputerControl.DeviceVolume`
- `Timer.AnalogueTimer`, `Timer.DigitalTimer`
- Game-specific counters

#### List Type LiveCells
**Purpose**: Display interactive lists of items that users can browse and select
**Behavior**:
- Shows scrollable lists of items
- Items can be selected/activated
- Content updates dynamically based on data sources
- Supports navigation and selection interactions
- Often has wide thumbnail display format

**Examples**:
- SMS message lists
- Email message lists
- Document lists
- Phone call history
- Contact lists

**Common ContentSubType Values**:
- `Sms.Messages` - SMS message list
- `Email.Messages` - Email message list
- `WordProcessor.Documents` - Document list
- `Phone.PhoneCall` - Phone call history
- `Contacts.Contacts` - Contact list

#### Viewer Type LiveCells
**Purpose**: Display and interact with media content or specialized viewers
**Behavior**:
- Shows media content (photos, videos, animations)
- Supports media-specific interactions (play, pause, zoom)
- May include camera feeds or live content
- Often supports touch-only interaction
- Typically has wide thumbnail display format

**Examples**:
- Photo viewers and camera feeds
- Animation players
- Whiteboard viewers
- Symoji animation displays

**Common ContentSubType Values**:
- `Photos.Photos` - Photo viewer
- `Photos.Camera` - Camera feed viewer
- `InteractiveLearning.Animation` - Animation viewer
- `OfflineWebBrowser.Whiteboard` - Whiteboard viewer
- `Symoji.Symoji` - Symoji animation viewer

### LiveCell Parameters

LiveCells can have additional parameters that control their behavior and appearance:

#### Common Parameters
- **`format`**: Display format for time/date cells (e.g., "HH:mm:ss", "dd/MM/yyyy")
- **`timezone`**: Timezone for clock displays ("Local", "UTC", specific timezone)
- **`appearance`**: Visual appearance settings for eye gaze cells
- **`eyetype`**: Left/Right eye specification for eye visibility cells

#### Parameter Examples

**Clock with Custom Format**:
```xml
<Cell X="0" Y="0">
  <Content>
    <ContentType>LiveCell</ContentType>
    <ContentSubType>Clock.Time</ContentSubType>
    <Parameters>
      <Parameter Key="format">HH:mm:ss</Parameter>
      <Parameter Key="timezone">Local</Parameter>
    </Parameters>
  </Content>
</Cell>
```

**Eye Gaze Visibility Cell**:
```xml
<Cell X="1" Y="0">
  <Content>
    <ContentType>LiveCell</ContentType>
    <ContentSubType>Access.EyeVisibility</ContentSubType>
    <Parameters>
      <Parameter Key="eyetype">Left</Parameter>
      <Parameter Key="appearance">Standard</Parameter>
    </Parameters>
  </Content>
</Cell>
```

### LiveCell Properties

#### Caption Editability
- **Info cells**: Usually have editable captions for user customization
- **List cells**: Typically have non-editable captions (auto-generated)
- **Viewer cells**: Usually have non-editable captions

#### Thumbnail Display
- **List and Viewer cells**: Often use `HasWideThumbnail = true` for better display
- **Info cells**: Typically use standard thumbnail size

#### Symbol Preview
- Some LiveCells use `SymbolizeCommandPreview = true` to show static symbols instead of live content in command browsers

### Cell Visibility States

```xml
<Visibility>Visible</Visibility> <!-- Default: fully accessible -->
<Visibility>PointerAndTouchOnly</Visibility> <!-- Skip in scanning -->
<Visibility>Disabled</Visibility> <!-- Not accessible -->
<Visibility>Hidden</Visibility> <!-- Completely hidden -->
<Visibility>Empty</Visibility> <!-- Empty cell (no content) -->
```

### Specialized Cell Properties

#### DirectActivate
Controls direct activation behavior for accessibility:
```xml
<DirectActivate>0</DirectActivate> <!-- Standard activation -->
<DirectActivate>1</DirectActivate> <!-- Direct activation enabled -->
```

#### ScanBlocks
Cells can belong to multiple scan blocks for advanced scanning:
```xml
<ScanBlocks>
  <ScanBlock>1</ScanBlock>
  <ScanBlock>3</ScanBlock>
</ScanBlocks>
```

#### Cell Parameters
Special cells can have additional parameters:
```xml
<Cell>
  <Content>
    <ContentType>LiveCell</ContentType>
    <ContentSubType>Clock.Time</ContentSubType>
    <Parameters>
      <Parameter Key="format">HH:mm</Parameter>
      <Parameter Key="timezone">UTC</Parameter>
    </Parameters>
  </Content>
</Cell>
```

### ScanBlock System

- Maximum 8 scan blocks per grid (1-8)
- Cells without ScanBlock attribute default to block 1
- Used for switch scanning navigation
- Cells can belong to multiple scan blocks

```xml
<Cell X="0" Y="0" ScanBlock="3">
  <!-- Single scan block -->
</Cell>

<Cell X="1" Y="0">
  <ScanBlocks>
    <ScanBlock>1</ScanBlock>
    <ScanBlock>2</ScanBlock>
  </ScanBlocks>
  <!-- Multiple scan blocks -->
</Cell>
```

## Complete Command Reference

### Navigation Commands

#### `Jump.To`
Navigate to another grid
```xml
<Command ID="Jump.To">
  <Parameter Key="grid">GridName</Parameter>
</Command>
```

#### `Jump.Back`
Return to previous grid
```xml
<Command ID="Jump.Back" />
```

#### `Jump.Home`
Navigate to start grid
```xml
<Command ID="Jump.Home" />
```

### Text Commands

#### `Action.InsertText`
Insert text with optional symbols
```xml
<Command ID="Action.InsertText">
  <Parameter Key="text">
    <SymbolRun Image="[WIDGIT]path/to/symbol.emf">
      <Run>Hello</Run>
      <Run> </Run>
    </SymbolRun>
  </Parameter>
  <Parameter Key="verbstate">Reset</Parameter>
</Command>
```

#### `Action.Letter`
Insert single character
```xml
<Command ID="Action.Letter">
  <Parameter Key="letter">A</Parameter>
</Command>
```

#### `Action.DeleteWord`
Delete last word
```xml
<Command ID="Action.DeleteWord" />
```

#### `Action.Clear`
Clear message window
```xml
<Command ID="Action.Clear" />
```

#### Speech Commands

##### `Action.Speak`
Speak text content from workspace
- **Parameters:**
  - `unit` (SpeakUnit): What to speak - All, Paragraph, Sentence, Word, Selection
  - `movecaret` (boolean): Whether to move caret after speaking (default: false)

```xml
<Command ID="Action.Speak">
  <Parameter Key="unit">All</Parameter>
  <Parameter Key="movecaret">0</Parameter>
</Command>
```

##### `Speech.SpeakNow`
Speak specific text immediately
- **Parameters:**
  - `text` (string): Text to speak

```xml
<Command ID="Speech.SpeakNow">
  <Parameter Key="text">Hello World</Parameter>
</Command>
```

##### `Speech.Stop`
Stop current speech
- **Parameters:** None

```xml
<Command ID="Speech.Stop" />
```

##### `Speech.SpeakClipboard`
Speak clipboard content
- **Parameters:** None

```xml
<Command ID="Speech.SpeakClipboard" />
```

#### Prediction Commands

##### `Prediction.PredictThis`
Trigger word prediction with word list
- **Parameters:**
  - `wordlist` (WordList): Word list for predictions
  - `action` (WordListAction): Insert or ReplacePrevious

```xml
<Command ID="Prediction.PredictThis">
  <Parameter Key="wordlist">
    <WordList>
      <Items>
        <WordListItem>
          <Text><s><r>hello</r></s></Text>
        </WordListItem>
      </Items>
    </WordList>
  </Parameter>
  <Parameter Key="action">Insert</Parameter>
</Command>
```

##### `Prediction.PredictConjugations`
Predict verb conjugations
- **Parameters:** None

```xml
<Command ID="Prediction.PredictConjugations" />
```

##### `Prediction.ChangeWordList`
Change active word list
- **Parameters:**
  - `wordlist` (WordList): New word list to activate

```xml
<Command ID="Prediction.ChangeWordList">
  <Parameter Key="wordlist">
    <WordList>
      <Items>
        <!-- WordListItem entries -->
      </Items>
    </WordList>
  </Parameter>
</Command>
```

#### Computer Control Commands

##### `ComputerControl.Keyboard`
Send keyboard input
- **Parameters:**
  - `keystring` (string): Key or key combination to send

```xml
<Command ID="ComputerControl.Keyboard">
  <Parameter Key="keystring">ctrl+c</Parameter>
</Command>
```

##### `ComputerControl.AdvancedKeyboard`
Advanced keyboard control
- **Parameters:**
  - `virtualkeycode` (int): Virtual key code
  - `extendedkey` (boolean): Whether it's an extended key
  - `keyaction` (AdvancedKeyAction): KeyPress, KeyDown, or KeyUp

```xml
<Command ID="ComputerControl.AdvancedKeyboard">
  <Parameter Key="virtualkeycode">65</Parameter>
  <Parameter Key="extendedkey">0</Parameter>
  <Parameter Key="keyaction">KeyPress</Parameter>
</Command>
```

##### `ComputerControl.MouseLeftClick`
Perform left mouse click
- **Parameters:**
  - `button` (MouseButton): Left, Right, or Middle

```xml
<Command ID="ComputerControl.MouseLeftClick">
  <Parameter Key="button">Left</Parameter>
</Command>
```

#### Settings Commands

##### `Settings.EditMode`
Toggle edit mode
- **Parameters:** None

```xml
<Command ID="Settings.EditMode" />
```

##### `Settings.ChangeGridSet`
Change to different gridset
- **Parameters:**
  - `gridsetname` (string): Name of gridset to load

```xml
<Command ID="Settings.ChangeGridSet">
  <Parameter Key="gridsetname">MyGridSet</Parameter>
</Command>
```

##### `Settings.SetScreenBrightness`
Set screen brightness
- **Parameters:**
  - `option` (SetValueOptions): Cycle, Increase, Decrease, or SetToValue
  - `specificvalue` (int): Specific brightness value (0-100)

```xml
<Command ID="Settings.SetScreenBrightness">
  <Parameter Key="option">SetToValue</Parameter>
  <Parameter Key="specificvalue">75</Parameter>
</Command>
```

#### Media Commands

##### `MediaPlayer.OpenVideoFile`
Open video file
- **Parameters:**
  - `filedata` (FileData): Video file data
  - `wait` (CommandExecutionType): Execution behavior
  - `playimmediately` (boolean): Start playing immediately

```xml
<Command ID="MediaPlayer.OpenVideoFile">
  <Parameter Key="filedata">video.mp4</Parameter>
  <Parameter Key="playimmediately">1</Parameter>
</Command>
```

##### `Speech.PlaySound`
Play sound file
- **Parameters:**
  - `filedata` (FileData): Sound file data
  - `wait` (CommandExecutionType): Execution behavior

```xml
<Command ID="Speech.PlaySound">
  <Parameter Key="filedata">sound.wav</Parameter>
</Command>
```

#### Grammar Commands

##### `Grammar.VerbMorphology`
Modify verb form
- **Parameters:**
  - `verbpart` (VerbPart): Root, Past, Present, Future, etc.
  - `person` (string): First, Second, Third person
  - `number` (string): Singular, Plural
  - `autocaption` (boolean): Auto-generate cell caption

```xml
<Command ID="Grammar.VerbMorphology">
  <Parameter Key="verbpart">Past</Parameter>
  <Parameter Key="person">Third</Parameter>
  <Parameter Key="number">Singular</Parameter>
</Command>
```

##### `Grammar.NounMorphology`
Modify noun form
- **Parameters:**
  - `number` (string): Singular, Plural
  - `gender` (string): Masculine, Feminine, Neuter

```xml
<Command ID="Grammar.NounMorphology">
  <Parameter Key="number">Plural</Parameter>
</Command>
```

#### Environment Control Commands

##### `EnvironmentControl.ZWave`
Control Z-Wave devices
- **Parameters:**
  - `deviceid` (string): Z-Wave device identifier
  - `action` (string): Device action to perform

```xml
<Command ID="EnvironmentControl.ZWave">
  <Parameter Key="deviceid">device_01</Parameter>
  <Parameter Key="action">on</Parameter>
</Command>
```

#### AI-Powered Commands

##### `Prediction.CorrectionTool` (Fix Tool)
AI-powered text correction using OpenAI integration
- **Purpose**: Corrects spelling, adds punctuation and missing characters, adjusts grammar
- **Requirements**: Online AI Tools must be enabled in Settings - Data control
- **Limitations**: Maximum 5000 characters, requires internet connection
- **Implementation**: Sends workspace text to OpenAI API for correction
- **Parameters:** None (operates on current workspace content)

```xml
<Command ID="Prediction.CorrectionTool" />
```

**Usage Notes:**
- Appears as a LiveCell with loading spinner during processing
- Automatically disabled when workspace is empty or text is too long
- Requires user opt-in for Online AI Tools functionality
- Supports undo functionality to revert corrections
- Integrates with workspace text selection and cursor positioning

**LiveCell Configuration:**
```xml
<Cell X="0" Y="0">
  <Content>
    <ContentType>LiveCell</ContentType>
    <ContentSubType>Prediction.CorrectionTool</ContentSubType>
    <CaptionAndImage>
      <Caption>Fix</Caption>
      <Image>[GRID3X]fix-command.wmf</Image>
    </CaptionAndImage>
    <Style>
      <BasedOnStyle>Default</BasedOnStyle>
    </Style>
  </Content>
</Cell>
```

#### System Commands

##### `ComputerSession.LogOff`
Log off from system
- **Parameters:** None

```xml
<Command ID="ComputerSession.LogOff" />
```

##### `ComputerSession.Shutdown`
Shutdown system
- **Parameters:** None

```xml
<Command ID="ComputerSession.Shutdown" />
```

##### `Wait`
Wait/pause execution
- **Parameters:**
  - `time` (TimeSpan): Duration to wait

```xml
<Command ID="Wait">
  <Parameter Key="time">00:00:02</Parameter>
</Command>
```

## Command Categories and Complete Reference

### Command Categories

Grid 3 organizes commands into the following categories:

- **Navigation**: Jump.To, Jump.Back, Jump.Home, Jump.ToKeyboard
- **Workspace Actions**: Action.InsertText, Action.Clear, Action.DeleteWord, Action.Copy, Action.Paste
- **Speech**: Action.Speak, Speech.SpeakNow, Speech.Stop, Speech.SpeakClipboard
- **Prediction**: Prediction.PredictThis, Prediction.PredictConjugations, Prediction.ChangeWordList
- **AI Tools**: Prediction.CorrectionTool (Fix tool for text correction)
- **Computer Control**: ComputerControl.Keyboard, ComputerControl.MouseLeftClick, ComputerControl.MouseRightClick
- **Settings**: Settings.EditMode, Settings.ChangeGridSet, Settings.SetScreenBrightness
- **Media**: MediaPlayer.OpenVideoFile, MediaPlayer.OpenMusicFile, Speech.PlaySound
- **Grammar**: Grammar.VerbMorphology, Grammar.NounMorphology
- **Environment Control**: EnvironmentControl.ZWave, EnvironmentControl.RelayAccessory
- **System**: ComputerSession.LogOff, ComputerSession.Shutdown, ComputerSession.Restart

### Complete Command ID Reference

| Command ID | Category | Parameters | Description |
|------------|----------|------------|-------------|
| `Jump.To` | Navigation | grid | Navigate to specified grid |
| `Jump.Back` | Navigation | None | Return to previous grid |
| `Jump.Home` | Navigation | None | Navigate to home grid |
| `Jump.ToKeyboard` | Navigation | None | Navigate to keyboard grid |
| `Action.InsertText` | Workspace | text, pos, verbstate | Insert rich text with symbols |
| `Action.Letter` | Workspace | letter | Insert single character |
| `Action.DeleteWord` | Workspace | None | Delete last word |
| `Action.DeleteLetter` | Workspace | None | Delete last character |
| `Action.Clear` | Workspace | None | Clear workspace content |
| `Action.Speak` | Speech | unit, movecaret | Speak workspace content |
| `Speech.SpeakNow` | Speech | text | Speak specific text |
| `Speech.Stop` | Speech | None | Stop current speech |
| `Prediction.PredictThis` | Prediction | wordlist, action | Trigger word prediction |
| `Prediction.PredictConjugations` | Prediction | None | Predict verb conjugations |
| `Prediction.CorrectionTool` | AI Tools | None | AI-powered text correction (Fix tool) |
| `ComputerControl.Keyboard` | Computer Control | keystring | Send keyboard input |
| `ComputerControl.MouseLeftClick` | Computer Control | button | Perform mouse click |
| `Settings.EditMode` | Settings | None | Toggle edit mode |
| `MediaPlayer.OpenVideoFile` | Media | filedata, playimmediately | Open video file |
| `Speech.PlaySound` | Media | filedata | Play sound file |
| `Grammar.VerbMorphology` | Grammar | verbpart, person, number | Modify verb form |
| `Wait` | System | time | Pause execution |

## Technical Specifications

### Grid Constraints
- Maximum 8 scan blocks per grid
- Cell coordinates are 0-based
- ColumnSpan and RowSpan minimum value: 1
- Grid dimensions defined by ColumnDefinitions/RowDefinitions count
- Maximum grid size is not explicitly limited but practical limits apply

### Color Format
All colors use 8-digit ARGB hex format: `#AARRGGBBFF`
- AA: Alpha (transparency) - 00 (transparent) to FF (opaque)
- RR: Red component - 00 to FF
- GG: Green component - 00 to FF
- BB: Blue component - 00 to FF
- FF: Usually FF for full opacity

### File Format Version
Current gridset format version tracked in `GridSetFileFormatVersion`

### Symbol Library References and Resolution

**Format**: `[LIBRARY_NAME]path/to/symbol.extension`

**Reference Resolution Process** (from source code):
1. **Parse Reference**: `SymbolReference` class parses the library reference
2. **Library Identification**: Extract library name from brackets (e.g., `[WIDGIT]`)
3. **Path Resolution**: Resolve symbol path within the library archive
4. **Symbol Creation**: Create `LibrarySymbol` object with resolved reference
5. **Skin Tone Application**: Apply user's default skin tone if symbol supports it

**Common Symbol Libraries**:
- **`[WIDGIT]`**: Widgit symbol library (licensed commercial content)
  - Example: `[WIDGIT]widgit rebus\h\hello.emf`
  - Requires valid license for full access
  - Extensive vocabulary with multiple languages

- **`[GRID3X]`**: Grid 3 built-in symbols
  - Example: `[GRID3X]settings.wmf`
  - Free symbols included with Grid 3
  - UI icons, basic vocabulary, system symbols

- **`[GRID2X]`**: Grid 2 compatibility symbols
  - Example: `[GRID2X]legacy_symbol.wmf`
  - Maintains compatibility with Grid 2 gridsets
  - Legacy symbol format support

- **`[SSTIX#]`**: Additional symbol library
  - Example: `[SSTIX#]symbol_path.emf`
  - Extended symbol collection
  - Specialized vocabulary sets

**Symbol Reference Processing**:
```csharp
// Source code implementation
var symbolReference = new SymbolReference(reference);
if (symbolReference.IsLibraryReference)
{
    var librarySymbol = new LibrarySymbol(reference);
    if (librarySymbol.SkinTone == SkinTone.SymbolDefault)
        librarySymbol.SkinTone = GridApp.User.Settings.SymbolSettings.SkinTone;
    return librarySymbol;
}
```

**Library Key Conversion**:
- **Library ID to Key**: `PictureLibraryHelper.ConvertLibraryIdToKey("[WIDGIT]")` → `"widgit"`
- **Key to Library ID**: `PictureLibraryHelper.ConvertLibraryKeyToId("widgit")` → `"[WIDGIT]"`
- **Case Handling**: Library keys are normalized to lowercase for file system access

**Symbol Search Integration**:
- **Caption Lookup**: `.pix` files map symbol IDs to human-readable captions
- **Category Organization**: `categories.pix` organizes symbols by topic
- **Search Service**: `PictureSearchService` provides unified search across all libraries
- **Predictive Integration**: Symbol search integrates with word prediction systems

**File Format Support**:
- **WMF**: Windows Metafile format (vector graphics)
- **EMF**: Enhanced Metafile format (enhanced vector graphics)
- **PNG/JPG**: Raster image formats (for photos and complex images)
- **SVG**: Scalable Vector Graphics (modern vector format)

### Cell Spacing System
Uses golden ratio-based spacing (φ = 1.618):
- `None`: φ¹/100 = 0.0162
- `Small`: φ²/100 = 0.0262
- `Medium`: φ³/100 = 0.0424
- `Large`: φ⁴/100 = 0.0686
- `ExtraLarge`: φ⁵/100 = 0.1111

### Cell Background Shapes
Available background shapes for cells:
- `Rectangle` (0): Standard rectangular shape
- `RoundedRectangle` (1): Rectangle with rounded corners
- `FoldedCorner` (2): Rectangle with folded corner effect
- `Octagon` (3): Eight-sided shape
- `Folder` (4): Folder-like appearance
- `Ellipse` (5): Oval shape
- `SpeechBubble` (6): Speech bubble shape
- `ThoughtBubble` (7): Thought bubble shape
- `Star` (8): Star shape
- `Circle` (9): Perfect circle

## Localization and Language Support

### Language Settings
Gridsets include language specification in `Settings0/settings.xml`:
```xml
<GridSetSettings>
  <Language>en-US</Language>
  <!-- Other settings -->
</GridSetSettings>
```

### Symbol Library Localization
- Symbol libraries may include RTL (right-to-left) variants
- Located in `symbols_rtl/` directory within `.symbols` archives
- Affects text direction and symbol orientation

### Screen Selection Methods
Multiple access methods supported:
- `ClickHighlightedCell`: Activate on release
- `ClickFirstCellTouched`: Activate on touch
- `Dwell`: Time-based activation
- `Hold`: Hold button down
- `Switch`: Switch press
- `Blink`: Eye blink detection
- `DesktopZoom`: Desktop zoom navigation
- `MoveMouse`: Mouse movement control

## Complete Examples

### Example 1: Basic Text Button
```xml
<Cell X="0" Y="0" ScanBlock="1">
  <Visibility>Visible</Visibility>
  <DirectActivate>0</DirectActivate>
  <Content>
    <ContentType>Normal</ContentType>
    <CaptionAndImage>
      <Caption>Hello</Caption>
      <Image>[WIDGIT]widgit rebus\h\hello.emf</Image>
    </CaptionAndImage>
    <Style>
      <BasedOnStyle>Vocab cell</BasedOnStyle>
    </Style>
    <Commands>
      <Command ID="Action.InsertText">
        <Parameter Key="text">
          <SymbolRun Image="[WIDGIT]widgit rebus\h\hello.emf">
            <Run>Hello</Run>
            <Run> </Run>
          </SymbolRun>
        </Parameter>
      </Command>
    </Commands>
  </Content>
</Cell>
```

### Example 2: Prediction AutoContent Cell
```xml
<Cell X="1" Y="0" ScanBlock="2">
  <Content>
    <ContentType>AutoContent</ContentType>
    <ContentSubType>Prediction</ContentSubType>
    <Style>
      <BasedOnStyle>Auto content</BasedOnStyle>
    </Style>
  </Content>
</Cell>
```

### Example 3: Workspace Cell
```xml
<Cell X="0" Y="0" ColumnSpan="6" RowSpan="1">
  <Content>
    <ContentType>Workspace</ContentType>
    <ContentSubType>Chat</ContentSubType>
    <Style>
      <BasedOnStyle>Workspace</BasedOnStyle>
    </Style>
  </Content>
</Cell>
```

### Example 4: LiveCell with Parameters
```xml
<Cell X="2" Y="0">
  <Content>
    <ContentType>LiveCell</ContentType>
    <ContentSubType>Clock.Time</ContentSubType>
    <Parameters>
      <Parameter Key="format">HH:mm:ss</Parameter>
      <Parameter Key="timezone">Local</Parameter>
    </Parameters>
    <Style>
      <BasedOnStyle>Default</BasedOnStyle>
    </Style>
  </Content>
</Cell>
```

### Example 5: Navigation Button with Custom Style
```xml
<Cell X="5" Y="6" ScanBlock="8">
  <Content>
    <ContentType>Normal</ContentType>
    <CaptionAndImage>
      <Caption>Settings</Caption>
      <Image>[GRID3X]settings.wmf</Image>
    </CaptionAndImage>
    <Style>
      <BasedOnStyle>Actions category style</BasedOnStyle>
      <BackColour>#FF4444FF</BackColour>
      <FontSize>24</FontSize>
    </Style>
    <Commands>
      <Command ID="Jump.To">
        <Parameter Key="grid">Settings</Parameter>
      </Command>
    </Commands>
  </Content>
</Cell>
```

## Best Practices

### Cell Design
1. **Use appropriate ContentType**: Choose Normal for standard buttons, AutoContent for dynamic content, Workspace for text areas, and LiveCell for real-time information
2. **Organize with ScanBlocks**: Group related cells in the same scan block for better navigation
3. **Apply consistent styling**: Use BasedOnStyle for consistency and override specific properties only when needed
4. **Provide meaningful captions**: Ensure all cells have descriptive captions for accessibility

### Command Usage
1. **Parameter validation**: Always provide required parameters with correct types
2. **Rich text formatting**: Use SymbolRun elements for text with symbols in Action.InsertText commands
3. **Grammar support**: Include part-of-speech and verb state information for language processing
4. **Error handling**: Commands with invalid parameters will be ignored or use default values

### Performance Considerations
1. **Limit AutoContent cells**: Too many AutoContent cells can impact performance
2. **Optimize images**: Use appropriate image formats and sizes for symbols
3. **Minimize complex commands**: Avoid overly complex command chains that might slow execution
4. **Cache considerations**: LiveCells update frequently, so design grids accordingly

This comprehensive documentation covers all major aspects of Grid 3 file format, providing developers and advanced users with the information needed to create, modify, and understand Grid 3 gridsets effectively.
