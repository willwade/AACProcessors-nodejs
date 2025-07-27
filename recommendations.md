# Styling Support Recommendations

This document outlines the current state of styling support in the AAC processing library and provides recommendations for improving it.

## 1. Current State of Styling Support

The library currently extracts basic information like labels, messages, and navigation links from various AAC file formats. However, it largely ignores styling information such as colors, fonts, and borders, which are crucial for preserving the visual fidelity of AAC boards.

Here's a breakdown of the styling information available in each format and what is currently being missed:

### OBF (`.obf`, `.obz`)

*   **Buttons:**
    *   `border_color`
    *   `background_color`
*   **Pages:**
    *   The OBF format does not specify page-level styling.

### TouchChat (`.ce`)

*   **Buttons (`button_styles` table):**
    *   `label_on_top`
    *   `force_label_on_top`
    *   `transparent`
    *   `force_transparent`
    *   `font_color`
    *   `force_font_color`
    *   `body_color`
    *   `force_body_color`
    *   `border_color`
    *   `force_border_color`
    *   `border_width`
    *   `force_border_width`
    *   `font_name`
    *   `font_bold`
    *   `font_underline`
    *   `font_italic`
    *   `font_height`
    *   `force_font`
*   **Pages (`page_styles` table):**
    *   `bg_color`
    *   `force_bg_color`
    *   `bg_alignment`
    *   `force_bg_alignment`

### Grid 3 (`.gridset`)

*   **Buttons and Pages (`style.xml`):**
    *   `BackColour`
    *   `TileColour`
    *   `BorderColour`
    *   `FontColour`
    *   `FontName`
    *   `FontSize`
*   **Pages (`grid.xml`):**
    *   `BackgroundColour`

### Asterics Grid (`.grd`)

*   **Buttons (`GridElement`):**
    *   `backgroundColor`
*   **Pages (`MetaData` and `ColorConfig`):**
    *   `elementBackgroundColor`
    *   `elementBorderColor`
    *   `gridBackgroundColor`
    *   `borderWidth`
    *   `elementMargin`
    *   `borderRadius`
    *   `colorMode`
    *   `fontFamily`
    *   `fontSizePct`
    *   `lineHeight`
    *   `maxLines`
    *   `textPosition`
    *   `fittingMode`
    *   `fontColor`

### Apple Panels (`.ascconfig`)

*   **Buttons (`PanelDefinitions.plist`):**
    *   `DisplayColor`
    *   `DisplayImageWeight`
    *   `FontSize`
*   **Pages (`PanelDefinitions.plist`):**
    *   The format does not specify page-level styling in a way that is easily applicable to our data model.

## 2. Recommendations for Improvement

To better support styling, I propose the following changes:

### 2.1. Enhance the Core AAC Types

The `AACButton` and `AACPage` interfaces in `src/types/aac.ts` should be extended to include optional styling properties. I recommend creating a separate `AACStyle` interface for better code organization.

**Proposed changes to `src/types/aac.ts`:**

```typescript
export interface AACButtonAction {
  type: "SPEAK" | "NAVIGATE";
  targetPageId?: string;
}

export interface AACStyle {
  backgroundColor?: string;
  fontColor?: string;
  borderColor?: string;
  borderWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textUnderline?: boolean;
  labelOnTop?: boolean;
  transparent?: boolean;
}

export interface AACButton {
  id: string;
  label: string;
  message: string;
  type: AACButtonAction["type"];
  action: AACButtonAction | null;
  targetPageId?: string;
  style?: AACStyle;
  audioRecording?: {
    id?: number;
    data?: Buffer;
    identifier?: string;
    metadata?: string;
  };
}

export interface AACPage {
  id: string;
  name: string;
  grid: Array<Array<AACButton | null>>;
  buttons: AACButton[];
  parentId: string | null;
  style?: AACStyle;
}

export interface AACTree {
  pages: { [key: string]: AACPage };
  addPage(page: AACPage): void;
  getPage(id: string): AACPage | undefined;
}

export interface AACProcessor {
  extractTexts(filePath: string): string[];
  loadIntoTree(filePath: string): AACTree;
}
```

### 2.2. Update the Processors

Each processor should be updated to map the styling information from its specific format to the new `style` property in the `AACButton` and `AACPage` objects during both loading and saving.

#### `obfProcessor.ts`

*   **Loading:** When reading an OBF file, map `background_color` and `border_color` to the `style` property of the `AACButton`.
*   **Saving:** When writing an OBF file, if a button has a `style` property, write the `background_color` and `border_color` attributes.

#### `snapProcessor.ts`

*   **Loading:** Map the various color, border, and font properties from the `Button` and `Page` tables to the `style` property of the `AACButton` and `AACPage` objects.
*   **Saving:** When writing a Snap file, create the necessary entries in the `Button` and `Page` tables to store the styling information from the `style` property.

#### `touchchatProcessor.ts`

*   **Loading:** Read the `button_styles` and `page_styles` tables. When creating `AACButton` and `AACPage` objects, look up their corresponding styles and populate the `style` property.
*   **Saving:** When writing a TouchChat file, create entries in the `button_styles` and `page_styles` tables based on the `style` properties of the `AACButton` and `AACPage` objects.

#### `astericsGridProcessor.ts`

*   **Loading:** Map the `backgroundColor` from the `GridElement` and the various properties from `MetaData` and `ColorConfig` to the `style` property of the `AACButton` and `AACPage`.
*   **Saving:** When writing an Asterics Grid file, set the `backgroundColor` of the `GridElement` and other styling properties based on the `style` property of the `AACButton` and `AACPage`.

#### `gridsetProcessor.ts`

*   **Loading:** Read the `style.xml` file to get the base styles. When processing a `grid.xml` file, for each cell, get its style and any overrides and map them to the `style` property of the `AACButton`. Map the `BackgroundColour` of the grid to the `style.backgroundColor` of the `AACPage`.
*   **Saving:** When writing a Grid 3 file, create a `style.xml` file with the styles from the `AACButton` and `AACPage` objects. In the `grid.xml` files, reference these styles in the cells.

#### `applePanelsProcessor.ts`

*   **Loading:** Map `DisplayColor`, `DisplayImageWeight`, and `FontSize` to the `style` property of the `AACButton`.
*   **Saving:** When writing an Apple Panels file, set the corresponding properties in the `PanelDefinitions.plist` file.

## 3. Conclusion

By implementing these changes, the library will be able to preserve the visual appearance of AAC boards when converting between different formats, which will significantly improve the user experience.
