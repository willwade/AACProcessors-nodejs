# AAC Processors Examples

This directory contains example scripts demonstrating various uses of the AAC Processors library.

## Translation Demo

Demonstrates how to translate AAC files between languages using various translation services.

### Setup

```bash
# Install example-specific dependencies
cd examples
npm install

# Set up environment variables
export AZURE_TRANSLATOR_KEY="your-key"
export GOOGLE_TRANSLATE_KEY="your-key"
```

### Usage

```bash
# Basic usage
node translate_demo.js ../path/to/input.gridset --endlang fr

# With confidence checking
node translate_demo.js ../path/to/input.gridset --endlang fr --enable-confidence-check
```

Note: These examples are for demonstration purposes only and have their own dependencies separate from the main package.
