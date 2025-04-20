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

### Common Commands and Parameters

#### `AutoContent.Activate`
- Parameters: Unknown

#### `Jump.To`
- Parameters: key 
- Value "Grid file name" e.g. "Places" found within the .gridset bundle

```xml
<Parameter Key="grid">Quantity</Parameter>`` is a Jump to the Grid "Quantity" page
```

#### `Jump.Back`
- Parameters: None

#### `Action.Speak`
- Parameters:
  - `unit`: Specifies what to speak (e.g., "All")
  - `movecaret`: Moves the caret position (e.g., "0")

#### `Settings.RestAll`
- Parameters:
  - `indicatorenabled`: Enables or disables an indicator (e.g., "1" for enabled)
  - `action`: Specifies the action to perform (e.g., "Toggle")

#### `Action.InsertText`
- Parameters:
  - `text`: Text to insert into the message window

#### `Action.DeleteWord`
- Parameters: None

#### `Action.Clear`
- Parameters: None

#### `Action.Letter`
- Parameters:
  - `letter`: Letter to insert into the message window
  

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

#### .pix Files

These .pix files contain binary data used internally by Grid 3:
	•	categories.pix appears to store fixed-size 128-byte records that may relate to symbol categories or references, but contains limited human-readable content.
	•	library.pix likely acts as a symbol metadata store or index, but does not contain readable paths or names and does not match .NET BinaryFormatter serialization formats.
	•	Both files are not compressed using standard formats (like ZIP or Zlib) and appear to use a custom binary format, potentially with obfuscation or structured field layouts.
	•	Initial attempts to decode fixed-size records or extract UTF-8/UTF-16 strings suggest these files do not store plain-text references to symbols.
	•	Byte frequency analysis indicates structured data with null padding, suggesting fixed-width or aligned records.

#### censored.txt

Despite the .txt extension, censored.txt does not contain plain text or word lists. It appears to be binary or encoded content, possibly representing internal lookup data or encrypted keywords.
