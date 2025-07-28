# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-01-28

### 🎨 Major Feature - Comprehensive Styling Support

This release adds comprehensive styling support across all AAC file formats, enabling preservation of visual appearance when converting between formats.

### Added

#### Styling Features
- **AACStyle Interface** - Unified styling model supporting colors, fonts, borders, and layout properties
- **Cross-format styling preservation** - Styling information maintained when converting between formats
- **Comprehensive styling properties** - Support for background colors, font colors, borders, font families, sizes, weights, and more
- **Format-specific styling capabilities** - Each format supports styling to the extent of its technical capabilities

#### Enhanced Processors
- **TouchChat Processor** - Complete button_styles and page_styles table support with dynamic style creation
- **Asterics Grid Processor** - Enhanced MetaData and ColorConfig styling support for comprehensive visual properties
- **Grid 3 Processor** - Full style.xml generation and style referencing system
- **Apple Panels Processor** - DisplayColor, FontSize, and DisplayImageWeight property support
- **OBF/Snap Processors** - Enhanced styling preservation (already had good support)

#### Testing & Documentation
- **Comprehensive test suite** - 7 new styling test cases covering all processors and cross-format scenarios
- **Complete documentation** - Detailed styling guide with examples and format capability matrix
- **Practical examples** - Working styling example demonstrating all features

### Technical Details
- All processors now support the unified AACStyle interface
- Styling information is intelligently mapped between different format capabilities
- Backward compatibility maintained - existing code continues to work unchanged
- Production-ready implementation with comprehensive test coverage

## [2.0.0] - 2024-12-19

### 🚀 Major Release - Complete TypeScript Rewrite

This is a major release representing a complete rewrite and modernization of the AACProcessors library.

### Added

#### Core Features

- **Complete TypeScript conversion** - 100% TypeScript codebase with full type safety
- **Translation workflows** - Built-in `processTexts()` method for all processors
- **Cross-format conversion** - Convert between any supported AAC formats
- **Factory pattern** - `getProcessor()` function for automatic format detection
- **Comprehensive error handling** - Graceful handling of corrupted data and edge cases

#### New Processors

- **ApplePanelsProcessor** - Support for iOS Apple Panels (.plist) format
- Enhanced **SnapProcessor** - Improved SQLite database handling
- Enhanced **TouchChatProcessor** - Better SQLite schema support
- Enhanced **GridsetProcessor** - Improved XML parsing and ZIP handling

#### Testing Infrastructure

- **140+ comprehensive tests** - Unit, integration, property-based, and performance tests
- **77% test coverage** - High-quality test coverage across all modules
- **Property-based testing** - Using fast-check for automated edge case discovery
- **Performance testing** - Memory usage monitoring and large file handling
- **Error handling tests** - Comprehensive validation of error scenarios
- **Real-world data testing** - Validation with actual AAC files

#### Developer Experience

- **Modern build system** - TypeScript compilation with proper module exports
- **Enhanced CLI** - Improved command-line interface with better error messages
- **Comprehensive documentation** - Updated README with examples and API reference
- **Coverage reporting** - Detailed coverage analysis and reporting tools
- **Automated formatting** - Prettier and ESLint configuration

### Changed

#### Breaking Changes

- **Minimum Node.js version** - Now requires Node.js 16.0.0 or higher
- **Module exports** - Changed from CommonJS to modern ES modules with TypeScript definitions
- **API signatures** - Some method signatures updated for better type safety
- **File structure** - Reorganized source code structure for better maintainability

#### Improvements

- **Performance** - Significantly improved memory usage and processing speed
- **Error messages** - More descriptive and actionable error messages
- **Code quality** - Complete refactoring with modern TypeScript patterns
- **Documentation** - Comprehensive API documentation and usage examples

### Fixed

- **Memory leaks** - Resolved memory leaks in database connections and file handling
- **Concurrent access** - Fixed thread safety issues with simultaneous file access
- **Unicode support** - Improved handling of international characters and emoji
- **File corruption** - Better recovery from partially corrupted files
- **Navigation links** - Fixed preservation of navigation relationships across formats

### Technical Details

#### Test Coverage by Module

- **Core module**: 100% coverage
- **DotProcessor**: 98.66% coverage
- **OpmlProcessor**: 91.3% coverage
- **OBFProcessor**: 81.18% coverage
- **ApplePanelsProcessor**: 78.04% coverage
- **GridsetProcessor**: 71.69% coverage
- **SnapProcessor**: 67.11% coverage
- **TouchChatProcessor**: 57.62% coverage

#### Dependencies

- **Added**: TypeScript 5.5+, Jest 29+, fast-check 4+, ESLint 8+, Prettier 3+
- **Updated**: All dependencies to latest stable versions
- **Removed**: Legacy JavaScript build tools and outdated dependencies

## [1.0.0] - 2024-01-01

### Initial Release

- Basic JavaScript implementation
- Support for DOT, OPML, OBF, Snap, Grid3, and TouchChat formats
- Simple text extraction functionality
- Basic CLI interface

---

## Migration Guide from 1.x to 2.x

### Installation

```bash
# Old
npm install aac-processors@1.x

# New
npm install aac-processors@2.x
```

### Import Changes

```javascript
// Old (CommonJS)
const { DotProcessor } = require("aac-processors/dist/processors");

// New (ES Modules + TypeScript)
import { DotProcessor, getProcessor } from "aac-processors";
```

### API Changes

```typescript
// Old
const processor = new DotProcessor();
const tree = processor.loadIntoTree("file.dot");

// New (same API, but with TypeScript support)
const processor = new DotProcessor();
const tree: AACTree = processor.loadIntoTree("file.dot");

// New factory pattern
const processor = getProcessor("file.dot"); // Auto-detects format
```

### New Translation Workflow

```typescript
// New in 2.x
const texts = processor.extractTexts("file.dot");
const translations = new Map([["Hello", "Hola"]]);
const result = processor.processTexts("file.dot", translations, "output.dot");
```

For detailed migration assistance, see the [Migration Guide](docs/MIGRATION.md).

---

## Support

- **Issues**: [GitHub Issues](https://github.com/willwade/AACProcessors-nodejs/issues)
- **Discussions**: [GitHub Discussions](https://github.com/willwade/AACProcessors-nodejs/discussions)
- **Email**: wwade@acecentre.org.uk
