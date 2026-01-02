# Open Board Logging (OBL) Support

This repository provides full support for the **.obl (Open Board Logging)** and **.obla (Anonymized OBL)** file formats. These formats are designed to standardize AAC usage logs across different platforms while protecting user privacy.

## 📁 Format Overview

- **.obl**: Standard JSON-based log containing sessions, events, and metadata (timestamps, names, geolocation).
- **.obla**: Anonymized version where sensitive data is masked or transformed according to standardized protocols.

## 🚀 Key Features

1.  **Bidirectional Conversion**: Seamlessly convert between OBL and the internal `HistoryEntry` format used by the analytics module.
2.  **Semantic Mapping**: Automatically maps unified `AACSemanticIntent` types to OBL-standard actions like `:home`, `:back`, and `:open_board`.
3.  **Privacy Suite**: Built-in support for OBL anonymization protocols.
4.  **Header Handling**: Correctly handles the recommended `/* NOTICE */` header in OBL files.

## 💻 How to Use

### Parsing and Generation

```typescript
import { OblUtil } from '@willwade/aac-processors/optional/analytics';

// Parse an OBL file
const content = fs.readFileSync('user_log.obl', 'utf8');
const obl = OblUtil.parse(content);

// Convert to internal history format for analysis
const history = OblUtil.toHistoryEntries(obl);

// Convert history back to OBL for sharing
const newObl = OblUtil.fromHistoryEntries(history, 'patient_123');
const json = OblUtil.stringify(newObl);
```

### Anonymization

The `OblAnonymizer` allows you to selectively apply privacy protocols:

```typescript
import { OblAnonymizer } from '@willwade/aac-processors/optional/analytics';

const anonymized = OblAnonymizer.anonymize(obl, [
  'timestamp_shift',      // Shift logs to begin on 2000-01-01
  'geolocation_masking',  // Remove GPS and location IDs
  'name_masking',         // Redact user and author names
  'url_stripping'         // Remove links to images or author profiles
]);
```

## 🧠 Semantic Intent Mapping

The OBL implementation leverages the `AACSemanticAction` system. When exporting data to OBL, the following intents are automatically mapped to standard OBL actions:

| Intent | OBL Action String |
| :--- | :--- |
| `NAVIGATE_TO` | `:open_board` |
| `GO_HOME` | `:home` |
| `GO_BACK` | `:back` |
| `CLEAR_TEXT` | `:clear` |
| `DELETE_CHARACTER` | `:backspace` |
| `SPEAK_TEXT` | `:speak` (if not a standard utterance) |

## 📊 Analyzing OBL Data

You can use the OBL utilities to feed external data into the `MetricsCalculator` or other vocabulary analysis tools by converting it to `HistoryEntry` format first.

See `scripts/analysis/analyze_obl_data.ts` for an example of bulk-extracting utterances from a clinical dataset.
