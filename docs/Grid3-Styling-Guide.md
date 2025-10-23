# Grid3 Styling Guide

This guide explains how to work with Grid3 styles using the AACProcessors library.

## Overview

Grid3 uses a sophisticated styling system with:
- **Default styles** for common UI elements
- **Category styles** for organizing content by semantic meaning
- **Inline style overrides** for cell-specific customization
- **Style inheritance** through `BasedOnStyle` references

## Default Styles

The library provides built-in default styles for common use cases:

### Available Default Styles

| Style Name | Purpose | Background | Text Color |
|-----------|---------|-----------|-----------|
| `Default` | General purpose cells | Light blue (#E2EDF8) | Black |
| `Workspace` | Message/chat area | White (#FFFFFF) | Black |
| `Auto content` | Wordlists, predictions | Light blue (#E8F4F8) | Black |
| `Vocab cell` | Vocabulary cells | Light blue (#E8F4F8) | Black |
| `Keyboard key` | On-screen keyboard | Light gray (#F0F0F0) | Black |

### Category Styles

Category styles are used for organizing content by semantic meaning:

| Style Name | Color | Use Case |
|-----------|-------|----------|
| `Actions category style` | Blue (#4472C4) | Action verbs, commands |
| `People category style` | Orange (#ED7D31) | Names, people |
| `Places category style` | Gray (#A5A5A5) | Locations, places |
| `Descriptive category style` | Green (#70AD47) | Adjectives, descriptors |
| `Social category style` | Gold (#FFC000) | Social phrases, greetings |
| `Questions category style` | Light blue (#5B9BD5) | Questions, interrogatives |
| `Little words category style` | Brown (#C55A11) | Function words, particles |

## Using Styles in Code

### Import Style Helpers

```typescript
import {
  DEFAULT_GRID3_STYLES,
  CATEGORY_STYLES,
  createDefaultStylesXml,
  createCategoryStyle,
  ensureAlphaChannel,
} from 'aac-processors';
```

### Access Predefined Styles

```typescript
// Get a specific default style
const defaultStyle = DEFAULT_GRID3_STYLES['Default'];
console.log(defaultStyle.BackColour); // #E2EDF8FF

// Get a category style
const actionStyle = CATEGORY_STYLES['Actions category style'];
console.log(actionStyle.BackColour); // #4472C4FF
```

### Create Custom Category Styles

```typescript
// Create a custom category style with automatic border darkening
const customStyle = createCategoryStyle(
  'My Category',
  '#FF6B6B', // Background color
  '#FFFFFF'  // Font color (optional, defaults to white)
);

// Result:
// {
//   BackColour: '#FF6B6BFF',
//   TileColour: '#FF6B6BFF',
//   BorderColour: '#CB5555FF', // Automatically darkened
//   FontColour: '#FFFFFFFF',
//   FontName: 'Arial',
//   FontSize: '16'
// }
```

### Generate Default Styles XML

```typescript
// Generate Settings0/styles.xml with all default and category styles
const stylesXml = createDefaultStylesXml(true);

// Or just default styles without categories
const basicStylesXml = createDefaultStylesXml(false);
```

### Ensure Color Has Alpha Channel

Grid3 requires colors in 8-digit ARGB format (#AARRGGBBFF):

```typescript
import { ensureAlphaChannel } from 'aac-processors';

ensureAlphaChannel('#FF0000');      // Returns: #FF0000FF
ensureAlphaChannel('#F00');         // Returns: #FF0000FF
ensureAlphaChannel('#FF0000FF');    // Returns: #FF0000FF (unchanged)
ensureAlphaChannel(undefined);      // Returns: #FFFFFFFF (white)
```

## Applying Styles to Cells

### Using BasedOnStyle Reference

In Grid3 XML, cells reference styles by name:

```xml
<Cell X="0" Y="0">
  <Content>
    <CaptionAndImage>
      <Caption>Hello</Caption>
    </CaptionAndImage>
    <Style>
      <BasedOnStyle>Actions category style</BasedOnStyle>
    </Style>
  </Content>
</Cell>
```

### Inline Style Overrides

You can override specific properties while keeping the base style:

```xml
<Cell X="1" Y="0">
  <Content>
    <CaptionAndImage>
      <Caption>Custom</Caption>
    </CaptionAndImage>
    <Style>
      <BasedOnStyle>Default</BasedOnStyle>
      <BackColour>#FF0000FF</BackColour>  <!-- Override background -->
      <FontSize>20</FontSize>             <!-- Override font size -->
    </Style>
  </Content>
</Cell>
```

## Color Format

Grid3 uses 8-digit ARGB hexadecimal format: `#AARRGGBBFF`

- **AA**: Alpha channel (FF = fully opaque, 00 = fully transparent)
- **RR**: Red component (00-FF)
- **GG**: Green component (00-FF)
- **BB**: Blue component (00-FF)
- **FF**: Always FF for Grid3 (fully opaque)

### Examples

| Color | Hex Code | Description |
|-------|----------|-------------|
| White | #FFFFFFFF | Fully opaque white |
| Black | #000000FF | Fully opaque black |
| Red | #FF0000FF | Fully opaque red |
| Blue | #0000FFFF | Fully opaque blue |
| Green | #00FF00FF | Fully opaque green |

## Style Inheritance

Grid3 uses a cascading style system:

1. **Theme** provides base properties (Modern, Kids/Bubble, Flat/Blocky, Explorer)
2. **Built-in style** defines category defaults
3. **Cell-specific overrides** apply on top

```xml
<!-- Example: Override just the background color -->
<Style>
  <BasedOnStyle>Actions category style</BasedOnStyle>
  <BackColour>#FF0000FF</BackColour>  <!-- Override just this property -->
</Style>
```

## Creating Gridsets with Styles

### Using GridsetProcessor

```typescript
import { GridsetProcessor, AACTree, AACPage, AACButton } from 'aac-processors';

const processor = new GridsetProcessor();
const tree = new AACTree();

// Create a page with styling
const page = new AACPage({
  id: 'main-page',
  name: 'Main Board',
  grid: [],
  buttons: [],
  parentId: null,
  style: {
    backgroundColor: '#f0f8ff',
    fontFamily: 'Arial',
    fontSize: 16,
  },
});

// Create styled buttons
const button = new AACButton({
  id: 'btn-1',
  label: 'Hello',
  message: 'Hello, how are you?',
  style: {
    backgroundColor: '#4472C4',  // Blue (Actions category)
    fontColor: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Arial',
  },
});

page.addButton(button);
tree.addPage(page);

// Save with styles
processor.saveFromTree(tree, 'output.gridset');
```

### Using Grid-Generator

```typescript
import { generateGridset } from '@willwade/grid-generator';

const template = {
  aacsystem: 'Grid3',
  homeGrid: {
    enabled: true,
    name: 'Home',
    title: 'Categories',
  },
  wordlists: [
    {
      name: 'Greetings',
      items: ['Hello', 'Hi', 'Hey'],
      partOfSpeech: 'Interjection',
    },
  ],
};

const gridset = generateGridset(template);
```

## Best Practices

1. **Use category styles** for semantic organization - helps with accessibility and consistency
2. **Maintain contrast** - ensure text color has sufficient contrast with background
3. **Use consistent fonts** - stick to standard fonts like Arial, Verdana, or Roboto
4. **Test in Grid3** - always verify styling in the actual Grid3 application
5. **Document custom styles** - if creating custom category styles, document their purpose
6. **Use inline overrides sparingly** - prefer creating new styles for significant variations

## Troubleshooting

### Styles Not Appearing

- Verify `Settings0/styles.xml` exists in the gridset
- Check that style names in cells match exactly (case-sensitive)
- Ensure colors are in 8-digit ARGB format

### Colors Look Wrong

- Verify alpha channel is FF (fully opaque)
- Check RGB values are correct
- Test in Grid3 to see actual rendering

### Performance Issues

- Avoid creating too many unique styles (consolidate similar styles)
- Use style references instead of inline overrides when possible
- Keep font sizes reasonable (12-24 points typical)

## See Also

- [Grid3 XML Format Documentation](./Grid3-XML-Format.md)
- [Wordlist Helpers Guide](./Grid3-Wordlist-Helpers.md)
- [AACProcessors API Reference](./API-Reference.md)

