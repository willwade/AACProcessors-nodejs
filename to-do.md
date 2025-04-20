# AAC Processors Node.js Port: To-Do List

## Urgent Tasks

### 1. Fix CLI Test Issues
- [ ] Debug and fix `MODULE_NOT_FOUND` errors in CLI tests
- [ ] Check for any remaining hardcoded paths in CLI code
- [ ] Ensure all imports use relative paths
- [ ] Clean up any npm link/global installations

### 2. Clean Up Repository
- [x] Remove Python-related files and dependencies
- [x] Update package.json for Node.js
- [x] Set up proper bin entry for CLI
- [ ] Clean up any remaining Python references in docs/comments

### 3. Fix Processor Issues
- [x] Update DotProcessor to handle different node definition formats
- [x] Fix SnapProcessor navigation structure handling
- [ ] Ensure all processors are properly exported
- [ ] Add comprehensive error handling

## Completed Core Tasks
- [x] Initialize repo with npm
- [x] Set up linter, formatter, and test framework
- [x] Create src/ directory structure
- [x] Implement TreeStructure module
- [x] Implement BaseProcessor
- [x] Implement FileProcessor
- [x] Port GridsetProcessor & TouchChatProcessor

## Next Phase Tasks

### Testing & Documentation
- [ ] Write unit tests for all processors
- [ ] Add integration tests for format conversions
- [ ] Update README with Node.js installation/usage
- [ ] Document API for each processor
- [ ] Create example files and usage demos

### Feature Development
- [ ] Complete CLI interface implementation
- [ ] Add pretty printer for tree structure
- [ ] Port remaining processors (Snap, OPML, etc.)
- [ ] Add translation support
- [ ] Consider web/desktop UI for visualization

### Future Enhancements
- [ ] Add support for additional AAC formats
- [ ] Implement batch processing capabilities
- [ ] Add validation for input/output formats
- [ ] Consider adding a web API interface
