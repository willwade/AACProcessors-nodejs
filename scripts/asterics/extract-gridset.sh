#!/bin/bash

# Extract gridset file to temp-data subdirectory based on gridset name
# Usage: ./extract_gridset.sh <path-to-gridset-file>

set -e  # Exit on error

if [ $# -eq 0 ]; then
    echo "Usage: ./extract_gridset.sh <path-to-gridset-file>"
    exit 1
fi

GRIDSET_FILE="$1"

if [ ! -f "$GRIDSET_FILE" ]; then
    echo "Error: File '$GRIDSET_FILE' not found"
    exit 1
fi

# Extract gridset name from filename (without extension)
GRIDSET_NAME=$(basename "$GRIDSET_FILE" .gridset)

# Create output directory path
OUTPUT_DIR="temp-data/$GRIDSET_NAME"

# Clean up existing directory if it exists
if [ -d "$OUTPUT_DIR" ]; then
    echo "Cleaning up existing directory: $OUTPUT_DIR..."
    rm -rf "$OUTPUT_DIR"
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "Extracting gridset file to $OUTPUT_DIR/..."
unzip -q "$GRIDSET_FILE" -d "$OUTPUT_DIR"

echo ""
echo "Done! Gridset extracted to $OUTPUT_DIR/"
echo ""
echo "Directory structure:"
tree "$OUTPUT_DIR" -L 2 2>/dev/null || find "$OUTPUT_DIR" -type f | head -20

echo ""
echo "Total files: $(find "$OUTPUT_DIR" -type f | wc -l)"
echo "Total images: $(find "$OUTPUT_DIR" -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' | wc -l)"
