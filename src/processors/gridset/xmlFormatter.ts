/**
 * Grid3 XML Formatter
 *
 * Utilities for formatting XML to match Grid 3's specific requirements.
 * Grid 3 has strict formatting requirements including line endings, self-closing
 * tag spacing, and specific tag expansion rules.
 */

/**
 * Tags that Grid 3 requires in full opening/closing format instead of self-closing
 * Grid 3 cannot parse <AudioDescription /> - it requires <AudioDescription></AudioDescription>
 */
const TAGS_NEEDING_EXPANSION = ["AudioDescription", "VideoDescription"];

/**
 * Format XML string to match Grid 3's requirements
 *
 * Grid 3 requires specific formatting:
 * - Windows line endings (\r\n)
 * - Space before /> in self-closing tags: <Element /> not <Element/>
 * - Plain apostrophes instead of &apos;
 * - Specific tags expanded to full opening/closing format
 * - CDATA for empty/whitespace captions and <r> tags
 *
 * @param xml - The XML string to format
 * @returns Formatted XML string compatible with Grid 3
 *
 * @example
 * const formatted = formatGrid3Xml('<Grid><Cell X="0"/></Grid>');
 * // Returns: '<Grid>\r\n<Cell X="0" />\r\n</Grid>'
 */
export function formatGrid3Xml(xml: string): string {
  let formatted = xml;

  // Convert Unix line endings to Windows (\r\n) for Grid 3 compatibility
  formatted = formatted.replace(/\n/g, "\r\n");

  // Add space before /> in self-closing tags to match Grid 3's expected format
  // Grid 3 original files use <Element /> not <Element/>
  formatted = formatted.replace(/<(\w+)([^>]*)\/>/g, "<$1$2 />");

  // Decode XML entities back to plain text to match Grid 3's expected format
  // Grid 3 expects plain apostrophes, not &apos;
  formatted = formatted.replace(/&apos;/g, "'");
  formatted = formatted.replace(/&quot;/g, '"');
  formatted = formatted.replace(/&lt;/g, "<");
  formatted = formatted.replace(/&gt;/g, ">");

  // Expand only specific self-closing tags that Grid 3 requires in full opening/closing format
  // This must be done AFTER adding spaces, so we need to match the format with spaces
  for (const tag of TAGS_NEEDING_EXPANSION) {
    formatted = formatted.replace(
      new RegExp(`<${tag}(\\s+[^>]*)? />`, "g"),
      `<${tag}$1></${tag}>`,
    );
  }

  return formatted;
}

/**
 * Format empty/whitespace captions with CDATA for Grid 3 compatibility
 *
 * Grid 3 requires <![CDATA[ ]]> for empty captions, not plain text.
 * Also handles <r> tags which need CDATA for spaces to prevent stripping.
 *
 * @param xml - The XML string to format
 * @returns XML string with CDATA-wrapped empty content
 */
export function formatEmptyCaptionsWithCdata(xml: string): string {
  let formatted = xml;

  // Convert empty/whitespace captions to CDATA format for Grid 3 compatibility
  // Grid 3 requires <![CDATA[ ]]> for empty captions, not plain text
  formatted = formatted.replace(
    /<Caption><\/Caption>/g,
    "<Caption><![CDATA[ ]]></Caption>",
  );
  formatted = formatted.replace(
    /<Caption> <\/Caption>/g,
    "<Caption><![CDATA[ ]]></Caption>",
  );
  formatted = formatted.replace(
    /<Caption> {2}<\/Caption>/g,
    "<Caption><![CDATA[ ]]></Caption>",
  );

  // Preserve CDATA in <r> tags for text parameters
  // Spaces in <r> tags must use CDATA or they get stripped during rendering
  // e.g., <r> </r> becomes <r><![CDATA[ ]]></r>
  formatted = formatted.replace(/<r> <\/r>/g, "<r><![CDATA[ ]]></r>");
  formatted = formatted.replace(/<r> {2}<\/r>/g, "<r><![CDATA[  ]]></r>");

  return formatted;
}

/**
 * Complete XML formatting for Grid 3 compatibility
 * Combines all Grid 3 XML formatting requirements
 *
 * @param xml - The XML string to format
 * @returns Fully formatted XML string compatible with Grid 3
 */
export function formatGrid3XmlComplete(xml: string): string {
  let formatted = formatGrid3Xml(xml);
  formatted = formatEmptyCaptionsWithCdata(formatted);
  return formatted;
}
