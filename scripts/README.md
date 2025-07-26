# Scripts Directory

This directory contains experimental scripts, analysis tools, and development utilities that are not part of the core AACProcessors library.

## Directory Structure

### `/audio/`
Audio processing and TTS integration scripts:
- Scripts for Azure TTS integration
- Audio enhancement tools
- Audio file generation utilities

### `/punjabi/`
Punjabi language translation and audio generation scripts:
- Translation utilities
- Punjabi-specific audio file generation
- Language-specific vocabulary processing

### `/analysis/`
Analysis and reporting tools:
- Vocabulary extraction and analysis
- Communication repairs analysis
- Validation and testing reports
- CSV generation utilities

### `/examples/`
Example files and test pagesets:
- Enhanced pagesets with audio
- Language-specific examples
- Test files for development

## Important Notes

⚠️ **Security**: These scripts may contain API keys or sensitive configuration. Do not commit:
- `.envrc` files with API keys
- Audio files (`.wav`, `.mp3`, etc.)
- Large binary assets
- Temporary output files

## Usage

These scripts are primarily for development and experimentation. They may require:
- API keys for translation/TTS services
- Additional dependencies not in the main package.json
- Specific configuration files

## Documentation

- `AUDIO_ENHANCEMENT_SUMMARY.md` - Audio feature development notes
- `LIBRARY_ENHANCEMENT_SUMMARY.md` - Library enhancement documentation

## Contributing

When adding new scripts:
1. Place them in the appropriate subdirectory
2. Update this README with a brief description
3. Ensure no sensitive data is committed
4. Add appropriate .gitignore entries if needed
