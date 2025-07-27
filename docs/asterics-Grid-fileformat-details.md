# Asterics Grid File Format Details

This document provides a detailed description of the native file format used by Asterics Grid. This information is intended to help developers create their own parsers and tooling for working with Asterics Grid data.

## 1. Core Concepts

The native Asterics Grid format is fundamentally a collection of JSON objects representing the application's data models. These objects are then encrypted and stored in a database. When exporting, these objects are serialized to a `.grd` file, which is an encrypted JSON file.

The key characteristics of the native format are:

*   **JSON-based:** The underlying structure is built on JSON.
*   **Encrypted:** All data is encrypted using AES encryption (via the `sjcl` library). The stored object is an `EncryptedObject`.
*   **Extensible:** The format is highly extensible and supports a rich set of features not found in the OBF (Open Board Format) standard.

The primary data models are:

*   **`GridData`:** Represents a single grid, including its layout and elements.
*   **`MetaData`:** Stores global user settings and application configuration.
*   **`Dictionary`:** Contains user-defined dictionaries for word prediction.
*   **`EncryptedObject`:** A wrapper object that contains the encrypted data for any of the other models.

## 2. Data Models

This section details the main data models and their properties.

### 2.1. `EncryptedObject`

This is the top-level object that is actually stored in the database.

| Property              | Type   | Description                                                                                                                                                                                          |
| --------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | String | The unique ID of the object.                                                                                                                                                                         |
| `modelName`           | String | The name of the data model being encrypted (e.g., "GridData").                                                                                                                                       |
| `modelVersion`      | String | The version of the data model.                                                                                                                                                                       |
| `encryptedDataBase64` | String | A Base64 encoded string of the encrypted JSON data of the contained object.                                                                                                                          |
| `encryptedDataBase64Short` | String | A "short" version of the encrypted data with properties longer than 500 characters removed. This is used for previews and lists to reduce data transfer. `null` if the same as the full version. |

### 2.2. `GridData`

This model represents a single grid.

| Property         | Type            | Description                                                                 |
| ---------------- | --------------- | --------------------------------------------------------------------------- |
| `id`             | String          | The unique ID of the grid.                                                  |
| `modelName`      | String          | "GridData"                                                                  |
| `modelVersion` | String          | The version of the `GridData` model.                                        |
| `label`          | Object          | A map of translations for the grid's name (e.g., `{"en-us": "Home"}`).      |
| `rowCount`       | Number          | The number of rows in the grid.                                             |
| `columnCount`    | Number          | The number of columns in the grid.                                          |
| `gridElements`   | Array<`GridElement`> | An array of the elements contained within the grid.                         |
| `thumbnail`      | Object          | A Base64 encoded thumbnail image of the grid.                               |

### 2.3. `GridElement`

This model represents a single element (cell) within a grid.

| Property          | Type          | Description                                                                      |
| ----------------- | ------------- | -------------------------------------------------------------------------------- |
| `id`              | String        | The unique ID of the element.                                                    |
| `label`           | Object        | A map of translations for the element's label.                                   |
| `image`           | `GridImage`   | The image associated with the element.                                           |
| `backgroundColor` | String        | The background color of the element (e.g., "rgba(255, 255, 255, 1)").           |
| `x`               | Number        | The horizontal position (column) of the element in the grid.                     |
| `y`               | Number        | The vertical position (row) of the element in the grid.                          |
| `width`           | Number        | The width of the element in grid units.                                          |
| `height`          | Number        | The height of the element in grid units.                                         |
| `actions`         | Array<`GridAction`> | An array of actions to be performed when the element is activated.               |
| `dontCollect`     | Boolean       | If `true`, the element's label will not be added to the sentence bar.    |
| `additionalProps` | Object        | An object containing additional, plugin-specific properties.             |

### 2.4. `GridImage`

| Property | Type   | Description                                            |
| -------- | ------ | ------------------------------------------------------ |
| `id`     | String | The unique ID of the image.                            |
| `data`   | String | A Base64 encoded data URI of the image.                |
| `url`    | String | A URL to an external image.                            |
| `author` | String | The author of the image.                               |
| `authorURL` | String | A URL to the author's website.                         |
| `searchProviderName` | String | The name of the search provider used to find the image (e.g., "ARASAAC"). |
| `searchProviderOptions` | Array<Object> | An array of options used for the image search. |

## 3. Extended Actions

The native format supports a wide range of actions that go far beyond the capabilities of OBF. The `actions` property of a `GridElement` is an array of `GridAction` objects. Each action object has a `modelName` property that specifies its type.

Here are the available action types and their properties:

### `GridActionARE`
Interface to the AsTeRICS Runtime Environment (ARE).

| Property             | Type   | Description                                                     |
| -------------------- | ------ | --------------------------------------------------------------- |
| `areURL`             | String | The URL of the ARE instance.                                    |
| `areModelGridFileName` | String | The name of the ARE model file stored in the `GridData`.        |
| `componentId`        | String | The ID of the component in the ARE model to interact with.      |
| `dataPortId`         | String | The ID of the data port to send data to.                        |
| `dataPortSendData`   | String | The data to send to the data port.                              |
| `eventPortId`        | String | The ID of the event port to trigger.                            |

### `GridActionAudio`
Plays a recorded audio file.

| Property      | Type   | Description                               |
| ------------- | ------ | ----------------------------------------- |
| `dataBase64`  | String | A Base64 encoded string of the audio data. |
| `mimeType`    | String | The MIME type of the audio.               |
| `durationMs`  | Number | The duration of the audio in milliseconds. |
| `filename`    | String | The name of the audio file.               |

### `GridActionChangeLang`
Changes the current content language or voice.

| Property   | Type   | Description                               |
| ---------- | ------ | ----------------------------------------- |
| `language` | String | The language code to switch to (e.g., "en-us"). |
| `voice`    | String | The voice to use for text-to-speech.      |

### `GridActionCollectElement`
Performs an action on the "collected elements" area (the sentence bar).

| Property | Type   | Description                                                              |
| `action` | String | The specific action to perform. See the list of available actions below. |

**Available Actions:**

*   `COLLECT_ACTION_SPEAK`: Speak the collected text.
*   `COLLECT_ACTION_SPEAK_CONTINUOUS`: Speak the collected text continuously.
*   `COLLECT_ACTION_SPEAK_CLEAR`: Speak the collected text and then clear it.
*   `COLLECT_ACTION_SPEAK_CONTINUOUS_CLEAR`: Speak the collected text continuously and then clear it.
*   `COLLECT_ACTION_CLEAR`: Clear the collected text.
*   `COLLECT_ACTION_REMOVE_WORD`: Remove the last word from the collected text.
*   `COLLECT_ACTION_REMOVE_CHAR`: Remove the last character from the collected text.
*   `COLLECT_ACTION_SHARE`: Share the collected text.
*   `COLLECT_ACTION_COPY_IMAGE_CLIPBOARD`: Copy the image of the collected element to the clipboard.
*   `COLLECT_ACTION_COPY_CLIPBOARD`: Copy the collected text to the clipboard.
*   `COLLECT_ACTION_APPEND_CLIPBOARD`: Append the collected text to the clipboard.
*   `COLLECT_ACTION_CLEAR_CLIPBOARD`: Clear the clipboard.
*   `COLLECT_ACTION_TO_YOUTUBE`: Search for the collected text on YouTube.

### `GridActionHTTP`
Sends an HTTP request.

| Property       | Type    | Description                                                                 |
| -------------- | ------- | --------------------------------------------------------------------------- |
| `restUrl`      | String  | The URL for the HTTP request.                                               |
| `method`       | String  | The HTTP method (e.g., "POST", "GET").                                      |
| `contentType`  | String  | The content type of the request (e.g., "text/plain", "application/json").   |
| `acceptHeader` | String  | The "Accept" header for the request.                                        |
| `body`         | String  | The body of the request.                                                    |
| `authUser`     | String  | The username for HTTP authentication.                                       |
| `authPw`       | String  | The password for HTTP authentication.                                       |
| `noCorsMode`   | Boolean | If `true`, "no-cors" mode is used for the fetch request.                    |
| `useCorsProxy` | Boolean | If `true`, a CORS proxy is used for the request.                            |
| `isLiveAction` | Boolean | If `true`, this action is treated as a live action.                         |

### `GridActionMatrix`
Interacts with a Matrix chat room.

| Property       | Type   | Description                                                              |
| -------------- | ------ | ------------------------------------------------------------------------ |
| `action`       | String | The Matrix action to perform (e.g., "MATRIX_SEND_COLLECTED").            |
| `sendText`     | String | Custom text to send.                                                     |
| `scrollPx`     | Number | The number of pixels to scroll in the chat window.                       |
| `selectRoomId` | String | The ID of the Matrix room to select.                                     |

### `GridActionNavigate`
Navigates between grids.

| Property            | Type    | Description                                                              |
| ------------------- | ------- | ------------------------------------------------------------------------ |
| `navType`           | String  | The type of navigation (e.g., "TO_GRID", "TO_HOME", "TO_LAST").          |
| `toGridId`          | String  | The ID of the grid to navigate to (if `navType` is "TO_GRID").           |
| `addToCollectElem`  | Boolean | If `true`, the label of the element is added to the collected elements.  |
| `searchCollectedText`| Boolean | If `true`, the collected text is used as the search query.               |
| `searchText`        | String  | A custom search query.                                                   |

### `GridActionOpenHAB`
Interacts with an openHAB home automation system.

| Property     | Type   | Description                                       |
| ------------ | ------ | ------------------------------------------------- |
| `openHABUrl` | String | The URL of the openHAB instance.                  |
| `itemType`   | String | The type of the openHAB item (e.g., "Dimmer").    |
| `itemName`   | String | The name of the openHAB item.                     |
| `actionType` | String | The action to perform on the item (e.g., "ON").   |
| `actionValue`| String | The value to send with the action (e.g., "50").   |

### `GridActionOpenWebpage`
Opens a webpage.

| Property        | Type   | Description                                    |
| --------------- | ------ | ---------------------------------------------- |
| `openURL`       | String | The URL of the webpage to open.                |
| `timeoutSeconds`| Number | The number of seconds before timing out.       |

### `GridActionPodcast`
Controls podcast playback.

| Property      | Type   | Description                                                                  |
| ------------- | ------ | ---------------------------------------------------------------------------- |
| `action`      | String | The podcast action to perform (e.g., "PLAY", "PAUSE").                       |
| `podcastGuid` | String | The GUID of the podcast to control.                                          |
| `step`        | Number | The number of seconds to step forward or backward.                           |

### `GridActionPredefined`
A predefined action for a specific device or service.

| Property       | Type   | Description                                                     |
| -------------- | ------ | --------------------------------------------------------------- |
| `groupId`      | String | The ID of the group this action belongs to (e.g., "Shelly Plus Plug S"). |
| `actionInfo`   | Object | Information about the custom values for this action.            |
| `customValues` | Object | A map of key-value pairs for the custom values.                 |
| `isLiveAction` | Boolean| If `true`, this action is treated as a live action.             |

### `GridActionPredict`
Fills prediction elements with suggestions from a dictionary.

| Property        | Type    | Description                                                     |
| --------------- | ------- | --------------------------------------------------------------- |
| `dictionaryKey` | String  | The key of the dictionary to use for predictions.               |
| `suggestOnChange`| Boolean | If `true`, suggestions are updated as the user types.           |

### `GridActionSpeak`
Speaks the label of the grid element.

| Property      | Type   | Description                                     |
| ------------- | ------ | ----------------------------------------------- |
| `speakLanguage`| String | The language to use for text-to-speech.         |

### `GridActionSpeakCustom`
Speaks a custom text.

| Property      | Type   | Description                                     |
| ------------- | ------ | ----------------------------------------------- |
| `speakLanguage`| String | The language to use for text-to-speech.         |
| `speakText`   | Object | A map of translations for the text to be spoken. |

### `GridActionSystem`
Performs a system-level action.

| Property    | Type   | Description                                     |
| ----------- | ------ | ----------------------------------------------- |
| `action`    | String | The system action to perform (e.g., "SYS_VOLUME_UP"). |
| `actionValue`| Number | The value to use for the action (e.g., 10 for volume). |

### `GridActionUART`
Sends data over a UART (Universal Asynchronous Receiver-Transmitter) connection.

| Property       | Type   | Description                                     |
| -------------- | ------ | ----------------------------------------------- |
| `data`         | String | The data to send.                               |
| `connectionType`| String | The type of connection ("CONN_TYPE_BT" or "CONN_TYPE_SERIAL"). |

### `GridActionWebradio`
Controls webradio playback.

| Property | Type   | Description                                     |
| -------- | ------ | ----------------------------------------------- |
| `action` | String | The webradio action to perform (e.g., "WEBRADIO_ACTION_START"). |
| `radioId`| String | The ID of the webradio station to control.      |

### `GridActionWordForm`
Changes the grammatical form of words.

| Property      | Type          | Description                                                     |
| ------------- | ------------- | --------------------------------------------------------------- |
| `type`        | String        | The type of word form change to apply.                          |
| `secondaryType`| String        | A secondary type for the word form change.                      |
| `tags`        | Array<String> | An array of tags to filter which elements are affected.         |
| `toggle`      | Boolean       | If `true`, the action toggles between word forms.               |

### `GridActionYoutube`
Controls YouTube playback.

| Property          | Type    | Description                                                     |
| ----------------- | ------- | --------------------------------------------------------------- |
| `action`          | String  | The YouTube action to perform (e.g., "YT_PLAY").                |
| `playType`        | String  | The type of content to play (e.g., "YT_PLAY_VIDEO").            |
| `data`            | String  | The data for the play type (e.g., a video URL or search query). |
| `stepSeconds`     | Number  | The number of seconds to step forward or backward.              |
| `stepVolume`      | Number  | The amount to change the volume by.                             |
| `showCC`          | Boolean | If `true`, closed captions are shown.                           |
| `playMuted`       | Boolean | If `true`, the video plays muted.                               |
| `performAfterNav` | Boolean | If `true`, the action is performed after a navigation.          |

## 4. Other Key Data Models and Extensions

Beyond the basic models, Asterics Grid uses several other data models to provide its advanced features.

### 4.1. `GridElementCollect`

This is a special type of `GridElement` that displays the "collected elements" (the sentence bar). It has additional properties to control its appearance and behavior.

| Property              | Type    | Description                                                                 |
| --------------------- | ------- | --------------------------------------------------------------------------- |
| `showLabels`          | Boolean | If `true`, the labels of the collected elements are shown.                  |
| `showFullLabels`      | Boolean | If `true`, the full labels are shown, otherwise they may be truncated.      |
| `imageHeightPercentage`| Number  | The height of the images in the collected elements as a percentage.         |
| `mode`                | String  | The display mode ("MODE_AUTO", "MODE_COLLECT_SEPARATED", "MODE_COLLECT_TEXT"). |
| `singleLine`          | Boolean | If `true`, the collected elements are displayed on a single line.           |
| `convertToLowercase`  | Boolean | If `true`, the labels are converted to lowercase.                           |
| `textElemSizeFactor`  | Number  | A factor to control the size of the text elements.                          |

### 4.2. `GridElementLive`

A `GridElement` that can display dynamic content from various sources.

| Property         | Type   | Description                                                                 |
| ---------------- | ------ | ----------------------------------------------------------------------------|
| `mode`           | String | The source of the live data ("MODE_ACTION_RESULT", "MODE_DATETIME", etc.). |
| `updateSeconds`  | Number | The interval in seconds at which to update the live data.              |
| `liveAction`     | Object | The action to execute to get the live data (if `mode` is "MODE_ACTION_RESULT"). |
| `dateTimeFormat` | String | The format to use for date and time display (if `mode` is "MODE_DATETIME"). |
| `state`          | String | The state to display (e.g., for podcasts).                             |
| `appState`       | String | The application state to display (e.g., "APP_STATE_BATTERY_LEVEL").    |
| `extractMode`    | String | The mode to use for extracting data from the result ("EXTRACT_JSON", etc.). |
| `extractSelector`| String | The selector to use for extracting data (e.g., a JSON path or CSS selector). |
| `extractIndex`   | String | An index for the extraction (e.g., for substrings).                   |
| `extractMappings`| Object | A map to convert extracted values to different display values.         |
| `chooseValues`   | String | A semicolon-separated list of values to choose from randomly.          |

### 4.3. `GridElementMatrixConversation`

A special type of `GridElement` that displays a Matrix chat conversation.

| Property  | Type    | Description                                 |
| --------- | ------- | ------------------------------------------- |
| `autoSpeak` | Boolean | If `true`, incoming messages are spoken aloud. |

### 4.4. `WordForm`

Represents a grammatical form of a word.

| Property      | Type          | Description                                                     |
| ------------- | ------------- | --------------------------------------------------------------- |
| `lang`        | String        | The language of the word form.                                  |
| `tags`        | Array<String> | An array of tags associated with the word form (e.g., "noun", "plural"). |
| `value`       | String        | The actual word form (e.g., "apples").                          |
| `pronunciation`| String        | The phonetic pronunciation of the word form.                    |

### 4.5. `Dictionary`

Represents a user-defined dictionary for word prediction.

| Property      | Type    | Description                                                     |
| ------------- | ------- | --------------------------------------------------------------- |
| `dictionaryKey`| String  | The key of the dictionary.                                      |
| `lang`        | String  | The language of the dictionary.                                 |
| `data`        | String  | The dictionary data as a JSON string.                           |
| `isDefault`   | Boolean | If `true`, this is a default dictionary.                        |

## 5. `MetaData`

The `MetaData` object stores global user settings and application configuration. There is only one `MetaData` object per user.

| Property                     | Type                | Description                                                                 |
| ---------------------------- | ------------------- | --------------------------------------------------------------------------- |
| `id`                         | String              | The unique ID of the metadata object.                                       |
| `modelName`                  | String              | "MetaData"                                                                  |
| `modelVersion`             | String              | The version of the `MetaData` model.                                        |
| `homeGridId`                 | String              | The ID of the user's home grid.                                             |
| `lastOpenedGridId`           | String              | The ID of the last opened grid.                                             |
| `globalGridId`               | String              | The ID of the global grid.                                                  |
| `globalGridActive`           | Boolean             | If `true`, the global grid is active.                                       |
| `globalGridHeightPercentage` | Number              | The height of the global grid as a percentage of the screen height.         |
| `locked`                     | Boolean             | If `true`, the grid set is locked and cannot be edited.                     |
| `fullscreen`                 | Boolean             | If `true`, the application is in fullscreen mode.                           |
| `inputConfig`                | `InputConfig`       | The user's input configuration.                                             |
| `colorConfig`                | `ColorConfig`       | The user's color configuration.                                             |
| `textConfig`                 | `TextConfig`        | The user's text configuration.                                              |
| `notificationConfig`         | `NotificationConfig`| The user's notification configuration.                                      |
| `integrations`               | `IntegrationConfigSync` | Configuration for integrations with other services like Matrix and podcasts. |

### 5.1. `ColorConfig`

| Property                 | Type    | Description                                                                 |
| ------------------------ | ------- | --------------------------------------------------------------------------- |
| `colorSchemesActivated`  | Boolean | If `true`, color schemes are activated.                                     |
| `activeColorScheme`      | String  | The name of the active color scheme.                                        |
| `additionalColorSchemes` | Array   | An array of additional user-defined color schemes.                          |
| `elementBackgroundColor` | String  | The default background color for grid elements.                             |
| `elementBorderColor`     | String  | The default border color for grid elements.                                 |
| `gridBackgroundColor`    | String  | The background color for the grid.                                          |
| `borderWidth`            | Number  | The width of the border around grid elements.                               |
| `elementMargin`          | Number  | The margin around grid elements.                                            |
| `borderRadius`           | Number  | The border radius for grid elements.                                        |
| `colorMode`              | String  | The color mode ("COLOR_MODE_BACKGROUND", "COLOR_MODE_BORDER", "COLOR_MODE_BOTH"). |

### 5.2. `InputConfig`

This object contains a large number of properties related to input methods like scanning, hovering, and direct selection. For brevity, only a subset of the properties are listed here.

| Property            | Type    | Description                                                                 |
| ------------------- | ------- | --------------------------------------------------------------------------- |
| `scanEnabled`       | Boolean | If `true`, scanning is enabled.                                             |
| `scanAuto`          | Boolean | If `true`, scanning starts automatically.                                   |
| `scanTimeoutMs`     | Number  | The timeout in milliseconds for scanning.                                   |
| `hoverEnabled`      | Boolean | If `true`, hovering is enabled.                                             |
| `hoverTimeoutMs`    | Number  | The timeout in milliseconds for hovering.                                   |
| `mouseclickEnabled` | Boolean | If `true`, mouse clicks are enabled.                                        |

### 5.3. `TextConfig`

| Property          | Type   | Description                                                                 |
| ----------------- | ------ | --------------------------------------------------------------------------- |
| `convertMode`     | String | The case conversion mode ("CONVERT_MODE_UPPERCASE", "CONVERT_MODE_LOWERCASE"). |
| `fontFamily`      | String | The font family to use for element labels.                                  |
| `fontSizePct`     | Number | The font size as a percentage.                                              |
| `lineHeight`      | Number | The line height for element labels.                                         |
| `maxLines`        | Number | The maximum number of lines for element labels.                             |
| `textPosition`    | String | The position of the text relative to the image ("ABOVE", "BELOW").          |
| `fittingMode`     | String | The text fitting mode ("AUTO", "TRUNCATE", "ELLIPSIS").                     |
| `fontColor`       | String | The color of the font.                                                      |

### 5.4. `NotificationConfig`

| Property                 | Type   | Description                                                                 |
| ------------------------ | ------ | --------------------------------------------------------------------------- |
| `backupNotifyIntervalDays` | Number | The interval in days to notify the user to create a backup.                 |
| `lastBackupNotification` | Number | The timestamp of the last backup notification.                              |
| `lastBackup`             | Number | The timestamp of the last backup.                                           |

### 5.5. `IntegrationConfigSync`

| Property       | Type          | Description                                    |
| -------------- | ------------- | ---------------------------------------------- |
| `matrixConfig` |`MatrixConfigSync`| The configuration for the Matrix integration.  |
| `podcasts`     | Array<`PodcastInfo`> | An array of podcast configurations.          |

## 6. Comparison with OBF

While Asterics Grid can import and export files in the Open Board Format (OBF), its native format is significantly more powerful and feature-rich. The OBF export should be considered a "lossy" conversion, as it does not preserve all of the information contained in the native format.

The key features of the native format that are **not** supported by OBF include:

*   **Encryption:** The native format is always encrypted. OBF has no concept of encryption.
*   **Rich Actions:** The vast majority of the `GridAction` types are not part of the OBF standard. OBF primarily supports navigation and simple speech actions. All the advanced actions for interacting with web services, home automation, and other devices are lost when converting to OBF.
*   **Advanced Element Types:** Special element types like `GridElementCollect`, `GridElementLive`, and `GridElementMatrixConversation` are not supported by OBF.
*   **Word Forms:** The concept of word forms does not exist in OBF.
*   **User Dictionaries:** Custom dictionaries for word prediction are not part of the OBF standard.
*   **Global Metadata:** The `MetaData` object, which stores a wide range of user preferences and settings, is not part of the OBF standard.
*   **Multilingual Labels:** While OBF has a `locale` property, the native format's use of a map for translations in labels is more flexible and is not fully preserved in the conversion.
