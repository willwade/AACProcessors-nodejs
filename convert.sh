#!/bin/bash

# Build and run Asterics Grid conversion script
# Usage: ./convert.sh

set -e  # Exit on error

# Clean up previous output
if [ -f "output/conversions/cs_student_cat.gridset" ]; then
  echo "Cleaning up previous output..."
  rm -f output/conversions/cs_student_cat.gridset
fi

echo "Building TypeScript..."
npm run build

echo ""
echo "Running conversion..."
node scripts/convert_asterics_grid.js

echo ""
echo "Done! Output: output/conversions/cs_student_cat.gridset"
