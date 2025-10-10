#!/bin/bash

# Build and run Asterics Grid conversion script
# Usage: ./convert.sh

set -e  # Exit on error

echo "Building TypeScript..."
npm run build

echo ""
echo "Running conversion..."
node scripts/convert_asterics_grid.js

echo ""
echo "Done! Output: output/conversions/cs_student_cat.gridset"
