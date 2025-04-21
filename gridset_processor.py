import logging
import os
import zipfile
from typing import Any, Optional, Union, cast

from lxml import etree
from lxml.etree import _Element, _ElementTree

from .file_processor import FileProcessor
from .tree_structure import AACButton, AACPage, AACTree, ButtonType

# Set up logging
logger = logging.getLogger(__name__)


class GridsetProcessor(FileProcessor):
    """Processor for Grid3 files (.gridset)."""

    def __init__(self) -> None:
        """Initialize the GridsetProcessor."""
        super().__init__()
        self.collected_texts = []

    def can_process(self, file_path: str) -> bool:
        """Check if file is a Grid3 gridset.

        Args:
            file_path (str): Path to the file to check.

        Returns:
            bool: True if file is a Grid3 gridset.
        """
        return file_path.lower().endswith(".gridset")

    def process_files(
        self, directory: str, translations: Optional[dict[str, str]] = None
    ) -> Optional[str]:
        """Process XML files in the gridset directory.

        Args:
            directory (str): Directory containing the files to process.
            translations (Optional[Dict[str, str]]): Dictionary of translations.

        Returns:
            Optional[str]: Path to translated file if successful, None otherwise.
        """
        modified = False
        self.collected_texts = []

        # Look for Grids directory
        grids_dir = os.path.join(directory, "Grids")
        if not os.path.exists(grids_dir):
            self.debug("No Grids directory found")
            return None

        # Process settings.xml file for Description
        settings_dir = os.path.join(directory, "Settings0")
        settings_path = os.path.join(settings_dir, "settings.xml")
        if os.path.exists(settings_path):
            try:
                parser = etree.XMLParser(remove_blank_text=True)
                settings_tree = etree.parse(settings_path, parser)
                settings_root = settings_tree.getroot()

                # Extract and process Description
                description_elem = settings_root.find("Description")
                if description_elem is not None and description_elem.text:
                    description_text = description_elem.text.strip()
                    if translations is None:
                        self.collected_texts.append(description_text)
                    elif description_text in translations:
                        description_elem.text = translations[description_text]
                        modified = True

                # Update Language tag if translations are provided
                if translations is not None and "target_lang" in translations:
                    target_lang = translations["target_lang"]
                    # Map language code to Grid3 format if needed
                    grid3_lang = self._map_language_code(target_lang)

                    # Find or create Language element
                    language_elem = settings_root.find("Language")
                    if language_elem is None:
                        # Create new Language element after Description or at the end
                        if description_elem is not None:
                            # Insert after Description
                            description_index = list(settings_root).index(
                                description_elem
                            )
                            language_elem = etree.Element("Language")
                            settings_root.insert(description_index + 1, language_elem)
                        else:
                            # Add at the end
                            language_elem = etree.SubElement(settings_root, "Language")

                    language_elem.text = grid3_lang
                    modified = True

                # Save changes to settings.xml
                if modified:
                    settings_tree.write(
                        settings_path,
                        encoding="utf-8",
                        xml_declaration=False,
                        pretty_print=True,
                    )
                    self.debug(f"Saved changes to {settings_path}")

            except Exception as e:
                self.debug(f"Error processing settings file {settings_path}: {str(e)}")

        # Walk through all subdirectories in Grids
        for root, _, files in os.walk(grids_dir):
            for file in files:
                if file == "grid.xml":
                    grid_path = os.path.join(root, file)
                    try:
                        parser = etree.XMLParser(remove_blank_text=True)
                        tree = etree.parse(grid_path, parser)
                        grid_root = tree.getroot()

                        # Process all captions
                        for caption in grid_root.xpath(".//Caption"):
                            if caption.text and caption.text.strip():
                                text = caption.text.strip()
                                if translations is None:
                                    self.collected_texts.append(text)
                                elif text in translations:
                                    caption.text = translations[text]
                                    modified = True

                        # Process all text parameters
                        for element in grid_root.xpath(".//Parameter[@Key='text']"):
                            try:
                                full_text, metadata, original_parts = (
                                    self._extract_text_and_metadata_from_element(
                                        element
                                    )
                                )
                                if full_text.strip():
                                    if translations is None:
                                        self.collected_texts.append(full_text)
                                    elif full_text in translations:
                                        translated_text = translations[full_text]
                                        self._update_element_with_translation(
                                            element,
                                            translated_text,
                                            metadata,
                                            original_parts,
                                        )
                                        modified = True
                            except Exception as e:
                                self.debug(f"Error processing text parameter: {str(e)}")
                                continue

                        # Process WordList items
                        for text_elem in grid_root.xpath(".//WordListItem/Text//r"):
                            if text_elem.text and text_elem.text.strip():
                                text = text_elem.text.strip()
                                if translations is None:
                                    self.collected_texts.append(text)
                                elif text in translations:
                                    text_elem.text = translations[text]
                                    modified = True

                        if modified:
                            tree.write(
                                grid_path,
                                encoding="utf-8",
                                xml_declaration=False,
                                pretty_print=True,
                            )
                            self.debug(f"Saved changes to {grid_path}")

                    except Exception as e:
                        self.debug(f"Error processing grid file {grid_path}: {str(e)}")
                        continue

        # If translations were applied, create new gridset
        if modified and translations is not None:
            # Get target language from translations dict
            target_lang = translations.get("target_lang", "unknown")

            # Create new filename with target language
            base_name = os.path.splitext(directory)[0]
            translated_path = f"{base_name}_{target_lang}.gridset"

            # Create new gridset file
            with zipfile.ZipFile(translated_path, "w", zipfile.ZIP_DEFLATED) as zip_ref:
                # Add all files from temp directory to the new gridset
                for root, _, files in os.walk(directory):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, directory)
                        zip_ref.write(file_path, arcname)
                        logger.debug(f"Added to zip: {arcname}")

            logger.debug(f"Created translated gridset: {translated_path}")
            return translated_path  # Return the path to the translated file

        return None

    def _extract_text_and_metadata_from_element(
        self, element: etree.Element
    ) -> tuple[str, list[dict], list[tuple[str, bool]]]:
        """Extract text and metadata from an element.

        Args:
            element (etree.Element): XML element to process.

        Returns:
            Tuple[str, List[Dict], List[Tuple[str, bool]]]:
                Text, metadata, and text parts.
        """
        text_parts = []
        metadata = []
        for s_elem in element.findall(".//s"):
            s_meta = dict(s_elem.attrib) if s_elem.attrib else {}
            for r_elem in s_elem.findall(".//r"):
                if r_elem.text is not None:
                    # Store whether this was originally a CDATA space
                    is_space = r_elem.text.isspace()
                    text = r_elem.text.strip() if not is_space else ""
                    # Always include the part, even if it's an empty string
                    text_parts.append((text, is_space))
            metadata.append(s_meta)

        # Join only non-empty parts for translation, but keep track of all parts
        translatable_text = " ".join(part[0] for part in text_parts if part[0])
        return (
            translatable_text,
            metadata,
            text_parts,
        )

    def _update_element_with_translation(
        self,
        element: etree.Element,
        translated_text: str,
        metadata: list[dict],
        original_parts: Optional[list[tuple[str, bool]]] = None,
    ) -> None:
        """Update an element with translated text and preserve metadata.

        Args:
            element (etree.Element): XML element to update.
            translated_text (str): Translated text to insert.
            metadata (List[Dict]): List of metadata dictionaries.
            original_parts (Optional[List[Tuple[str, bool]]]): Original text parts.
        """
        # Clear existing children
        for child in element:
            element.remove(child)

        # Rebuild the structure with translated text
        p_elem = etree.SubElement(element, "p")
        # Split the translated text while preserving spaces
        words = []
        current_word = ""
        for char in translated_text:
            if char.isspace():
                if current_word:
                    words.append((current_word, False))  # Regular word
                    words.append((" ", True))  # Space
                    current_word = ""
                elif not words or words[-1][0] != " ":
                    words.append((" ", True))  # Space
            else:
                current_word += char
        if current_word:
            words.append((current_word, False))

        # Create elements for each word/space
        for i, (word, is_space) in enumerate(words):
            s_elem = etree.SubElement(p_elem, "s")
            if i < len(metadata):
                for k, v in metadata[i].items():
                    s_elem.set(k, v)
            r_elem = etree.SubElement(s_elem, "r")
            if is_space:
                r_elem.text = etree.CDATA(" ")
            else:
                r_elem.text = word

    def _create_cdata(self, text: str) -> etree.CDATA:
        """Create a CDATA section.

        Args:
            text (str): Text to wrap in CDATA.

        Returns:
            etree.CDATA: CDATA section.
        """
        return etree.CDATA(text)

    def extract_texts(
        self, file_path: str, include_context: bool = False
    ) -> Union[list[str], list[dict[str, Any]]]:
        """Extract translatable texts from gridset.

        Args:
            file_path (str): Path to the gridset file.
            include_context (bool): Whether to include contextual information.

        Returns:
            If include_context is False: List of translatable texts.
            If include_context is True: List of dictionaries with context info.
        """
        if not include_context:
            # Simple text extraction without context
            texts = []
            temp_dir = self.create_temp_dir()

            with zipfile.ZipFile(file_path, "r") as zf:
                zf.extractall(temp_dir)

                # Process each grid.xml file
                grids_dir = os.path.join(temp_dir, "Grids")
                if os.path.exists(grids_dir):
                    for grid_dir in os.listdir(grids_dir):
                        grid_path = os.path.join(grids_dir, grid_dir, "grid.xml")
                        if not os.path.exists(grid_path):
                            continue

                        try:
                            tree = etree.parse(grid_path)
                            root = tree.getroot()

                            # Extract grid name
                            name = root.get("Name")
                            if name:
                                texts.append(name)

                            # Extract captions
                            for caption in root.findall(".//CaptionAndImage/Caption"):
                                if caption.text and caption.text.strip():
                                    texts.append(caption.text.strip())

                            # Extract wordlist items
                            for text in root.findall(
                                ".//WordList/Items/WordListItem/Text"
                            ):
                                if text.text and text.text.strip():
                                    texts.append(text.text.strip())

                        except Exception as e:
                            self.debug(
                                f"Error processing grid file {grid_path}: {str(e)}"
                            )

            return list(set(texts))  # Remove duplicates
        else:
            # Extract texts with context information
            texts_with_context = []
            temp_dir = self.create_temp_dir()

            # Load the gridset into a tree structure to get context
            tree = self.load_into_tree(file_path)

            # Process each page and button to extract texts with context
            for page_id, page in tree.pages.items():
                # Add page title
                if page.name and page.name.strip():
                    # Get path to page
                    path = " > ".join(
                        [tree.pages[p].name for p in tree.get_path_to_page(page_id)]
                    )

                    texts_with_context.append(
                        {
                            "text": page.name,
                            "path": path,
                            "symbol_name": None,
                            "symbol_library": None,
                            "symbol_id": None,
                            "button_type": "page",
                            "page_name": page.name,
                        }
                    )

                # Process buttons on the page
                for button in page.buttons:
                    # Add button label
                    if button.label and button.label.strip():
                        # Get path to button
                        button_path = f"{path} > {button.label}"

                        # Get symbol information if available
                        symbol_name = None
                        symbol_library = None
                        symbol_id = None
                        if button.symbol:
                            symbol_name = button.symbol.label
                            symbol_library = button.symbol.library
                            symbol_id = (
                                button.symbol.system_id or button.symbol.internal_id
                            )

                        texts_with_context.append(
                            {
                                "text": button.label,
                                "path": button_path,
                                "symbol_name": symbol_name,
                                "symbol_library": symbol_library,
                                "symbol_id": symbol_id,
                                "button_type": button.type.value,
                                "page_name": page.name,
                            }
                        )

                    # Add button vocalization if different from label
                    if (
                        button.vocalization
                        and button.vocalization.strip()
                        and button.vocalization != button.label
                    ):
                        # Get path to button vocalization
                        vocal_path = f"{path} > {button.label} (vocalization)"

                        texts_with_context.append(
                            {
                                "text": button.vocalization,
                                "path": vocal_path,
                                "symbol_name": (
                                    symbol_name if "symbol_name" in locals() else None
                                ),
                                "symbol_library": (
                                    symbol_library
                                    if "symbol_library" in locals()
                                    else None
                                ),
                                "symbol_id": (
                                    symbol_id if "symbol_id" in locals() else None
                                ),
                                "button_type": button.type.value,
                                "page_name": page.name,
                            }
                        )

            return texts_with_context

    def load_into_tree(self, file_path: str) -> AACTree:
        """Load gridset into tree structure.

        Args:
            file_path (str): Path to the gridset file.

        Returns:
            AACTree: Tree structure representing the gridset.
        """
        tree = AACTree()
        self.tree = tree  # Store reference to tree

        # Extract gridset
        temp_dir = self.create_temp_dir()
        with zipfile.ZipFile(file_path, "r") as zf:
            zf.extractall(temp_dir)

            # Find all grid.xml files
            grids_dir = os.path.join(temp_dir, "Grids")
            if not os.path.exists(grids_dir):
                self.debug("No Grids directory found")
                return tree

            # Process each grid.xml file
            for grid_dir in os.listdir(grids_dir):
                grid_path = os.path.join(grids_dir, grid_dir, "grid.xml")
                if not os.path.exists(grid_path):
                    continue

                try:
                    grid_tree = etree.parse(grid_path)
                    grid_root = grid_tree.getroot()

                    # Get grid dimensions
                    rows = len(grid_root.findall(".//RowDefinitions/RowDefinition"))
                    cols = len(
                        grid_root.findall(".//ColumnDefinitions/ColumnDefinition")
                    )

                    # Create page
                    page = AACPage(
                        id=grid_dir, name=grid_dir, grid_size=(rows or 1, cols or 1)
                    )

                    # Process cells
                    for cell in grid_root.findall(".//Cells/Cell"):
                        x = int(cell.get("X", "0"))
                        y = int(cell.get("Y", "0"))

                        # Get content
                        content = cell.find(".//Content")
                        if content is None:
                            continue

                        # Get caption
                        caption = content.find(".//CaptionAndImage/Caption")
                        if caption is not None and caption.text:
                            # Create button
                            button = AACButton(
                                id=f"{grid_dir}_button_{x}_{y}",
                                label=caption.text.strip(),
                                type=ButtonType.SPEAK,
                                position=(x, y),
                                vocalization=caption.text.strip(),
                            )

                            # Check for navigation
                            commands = content.findall(".//Commands/Command")
                            for command in commands:
                                if command.get("ID") == "Jump.To":
                                    target = command.find(".//Parameter[@Key='grid']")
                                    if target is not None and target.text:
                                        button.type = ButtonType.NAVIGATE
                                        button.target_page_id = target.text

                            page.buttons.append(button)

                    # Process wordlist items if any
                    for item in grid_root.findall(".//WordList/Items/WordListItem"):
                        text = item.find(".//Text")
                        if text is not None and text.text:
                            button = AACButton(
                                id=f"{grid_dir}_word_{text.text}",
                                label=text.text.strip(),
                                type=ButtonType.SPEAK,
                                position=(
                                    0,
                                    0,
                                ),  # Position doesn't matter for wordlists
                                vocalization=text.text.strip(),
                            )
                            page.buttons.append(button)

                    tree.add_page(page)

                except Exception as e:
                    self.debug(f"Error processing grid file {grid_path}: {str(e)}")
                    continue

            # Read settings to find start grid
            settings_path = os.path.join(temp_dir, "Settings0", "settings.xml")
            if os.path.exists(settings_path):
                try:
                    settings_tree = etree.parse(settings_path)
                    start_grid = settings_tree.find(".//StartGrid")
                    if start_grid is not None and start_grid.text:
                        tree.root_id = start_grid.text
                except Exception as e:
                    self.debug(f"Error reading settings: {str(e)}")

        return tree

    def save_from_tree(self, tree: AACTree, output_path: str) -> None:
        """Save tree structure back to gridset format.

        Args:
            tree (AACTree): Tree structure to save.
            output_path (str): Path where to save the file.
        """
        # Create temp directory for building gridset
        temp_dir = self.create_temp_dir()
        grids_dir = os.path.join(temp_dir, "Grids")
        os.makedirs(grids_dir)

        # Create settings directory
        settings_dir = os.path.join(temp_dir, "Settings0")
        os.makedirs(settings_dir)

        # Save settings
        settings = etree.Element("GridSetSettings")
        start_grid = etree.SubElement(settings, "StartGrid")
        start_grid.text = tree.root_id or next(iter(tree.pages.keys()))
        settings_path = os.path.join(settings_dir, "settings.xml")
        etree.ElementTree(settings).write(
            settings_path, encoding="utf-8", xml_declaration=False, pretty_print=True
        )

        # Process each page
        for page_id, page in tree.pages.items():
            # Create grid directory
            grid_dir = os.path.join(grids_dir, page_id)
            os.makedirs(grid_dir)

            # Create grid XML
            grid = etree.Element("Grid")
            grid.set("Name", page.name)
            grid.set("GridGuid", page.id)

            # Add row and column definitions
            row_defs = etree.SubElement(grid, "RowDefinitions")
            for _ in range(page.grid_size[0]):
                etree.SubElement(row_defs, "RowDefinition")

            col_defs = etree.SubElement(grid, "ColumnDefinitions")
            for _ in range(page.grid_size[1]):
                etree.SubElement(col_defs, "ColumnDefinition")

            # Add cells
            cells = etree.SubElement(grid, "Cells")
            for button in page.buttons:
                # Skip wordlist items - they go in the WordList section
                if button.id.startswith(f"{page_id}_word_"):
                    continue

                cell = etree.SubElement(cells, "Cell")
                cell.set("X", str(button.position[0]))
                cell.set("Y", str(button.position[1]))

                content = etree.SubElement(cell, "Content")
                caption_and_image = etree.SubElement(content, "CaptionAndImage")
                caption = etree.SubElement(caption_and_image, "Caption")
                caption.text = button.label

                if button.type == ButtonType.NAVIGATE:
                    commands = etree.SubElement(content, "Commands")
                    command = etree.SubElement(commands, "Command")
                    command.set("ID", "Jump.To")
                    param = etree.SubElement(command, "Parameter")
                    param.set("Key", "grid")
                    param.text = button.target_page_id

            # Add wordlist items
            wordlist_buttons = [
                b for b in page.buttons if b.id.startswith(f"{page_id}_word_")
            ]
            if wordlist_buttons:
                wordlist = etree.SubElement(grid, "WordList")
                wordlist.set("Name", page.name)
                items = etree.SubElement(wordlist, "Items")
                for button in wordlist_buttons:
                    item = etree.SubElement(items, "WordListItem")
                    text = etree.SubElement(item, "Text")
                    text.text = button.label

            # Save grid XML
            grid_path = os.path.join(grid_dir, "grid.xml")
            etree.ElementTree(grid).write(
                grid_path, encoding="utf-8", xml_declaration=False, pretty_print=True
            )

        # Create FileMap.xml
        filemap = etree.Element("FileMap")
        entries = etree.SubElement(filemap, "Entries")
        for page_id in tree.pages:
            entry = etree.SubElement(entries, "Entry")
            entry.set("StaticFile", f"Grids\\{page_id}\\grid.xml")

        filemap_path = os.path.join(temp_dir, "FileMap.xml")
        etree.ElementTree(filemap).write(
            filemap_path, encoding="utf-8", xml_declaration=False, pretty_print=True
        )

        # Create gridset file
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zip_ref:
            for root, _, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zip_ref.write(file_path, arcname)

        self.debug(f"Created gridset file: {output_path}")

    def export_tree(self, tree: AACTree, output_path: str) -> None:
        """Export tree to GridSet format.

        Args:
            tree (AACTree): Tree to export.
            output_path (str): Path where to save the file.
        """
        self.save_from_tree(tree, output_path)

    def create_translated_file(
        self, file_path: str, translations: dict[str, str]
    ) -> Optional[str]:
        """Create a translated version of the gridset.

        Args:
            file_path (str): Path to the original gridset file.
            translations (Dict[str, str]): Dictionary of translations.

        Returns:
            Optional[str]: Path to translated file if successful, None otherwise.
        """
        # Extract gridset
        temp_dir = self.create_temp_dir()
        with zipfile.ZipFile(file_path, "r") as zf:
            zf.extractall(temp_dir)

        modified = False
        grids_dir = os.path.join(temp_dir, "Grids")

        # Process each grid.xml file
        for grid_dir in os.listdir(grids_dir):
            grid_path = os.path.join(grids_dir, grid_dir, "grid.xml")
            if not os.path.exists(grid_path):
                continue

            try:
                tree = etree.parse(grid_path)
                root = tree.getroot()
                grid_modified = False

                # Translate grid name
                name = root.get("Name")
                if name in translations:
                    root.set("Name", translations[name])
                    grid_modified = True

                # Translate captions
                for caption in root.findall(".//CaptionAndImage/Caption"):
                    if caption.text and caption.text.strip() in translations:
                        caption.text = translations[caption.text.strip()]
                        grid_modified = True

                # Translate wordlist items
                for text in root.findall(".//WordList/Items/WordListItem/Text"):
                    if text.text and text.text.strip() in translations:
                        text.text = translations[text.text.strip()]
                        grid_modified = True

                if grid_modified:
                    tree.write(
                        grid_path,
                        encoding="utf-8",
                        xml_declaration=False,
                        pretty_print=True,
                    )
                    modified = True

            except Exception as e:
                self.debug(f"Error processing grid file {grid_path}: {str(e)}")

        if modified:
            # Get target language from translations
            target_lang = translations.get("target_lang")
            if not target_lang:
                self.debug("No target language found in translations")
                return None

            # Create base name without any existing language suffix
            base_name = os.path.splitext(file_path)[0]
            if "_" in base_name:
                base_parts = base_name.split("_")
                if len(base_parts[-1]) <= 5:  # Assuming language codes are <= 5 chars
                    base_name = "_".join(base_parts[:-1])

            # Create new filename with target language
            translated_path = f"{base_name}_{target_lang}.gridset"

            # Create new gridset file
            with zipfile.ZipFile(translated_path, "w", zipfile.ZIP_DEFLATED) as zip_ref:
                for root, _, files in os.walk(temp_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, temp_dir)
                        zip_ref.write(file_path, arcname)

            return translated_path

        return None

    def _parse_grid_xml(self, grid_path: str) -> _Element:
        """Parse a grid XML file and return its root element"""
        tree: _ElementTree = etree.parse(grid_path)
        return tree.getroot()

    def _process_grid(self, grid_root: _Element) -> AACPage:
        """Process a grid XML element into an AACPage"""
        # Get grid name and ID
        name = cast(str, grid_root.get("Name", ""))
        grid_id = cast(str, grid_root.get("GridGuid", ""))

        # Get grid dimensions
        rows = len(grid_root.findall(".//RowDefinition"))
        cols = len(grid_root.findall(".//ColumnDefinition"))

        # Create page
        page = AACPage(id=grid_id, name=name, grid_size=(rows, cols))

        # Process cells
        for cell in grid_root.findall(".//Cell"):
            button = self._process_cell(cell)
            if button:
                page.buttons.append(button)

        return page

    def _process_cell(self, cell: _Element) -> Optional[AACButton]:
        """Process a cell XML element into an AACButton"""
        # Get content
        content = cell.find(".//Content")
        if content is None:
            return None

        # Get caption
        caption = content.find(".//CaptionAndImage/Caption")
        if caption is not None and caption.text:
            # Create button
            button = AACButton(
                id=f"{grid_dir}_button_{x}_{y}",
                label=caption.text.strip(),
                type=ButtonType.SPEAK,
                position=(x, y),
                vocalization=caption.text.strip(),
            )

            # Check for navigation
            commands = content.findall(".//Commands/Command")
            for command in commands:
                if command.get("ID") == "Jump.To":
                    target = command.find(".//Parameter[@Key='grid']")
                    if target is not None and target.text:
                        button.type = ButtonType.NAVIGATE
                        button.target_page_id = target.text

            return button

        return None

    def replace_cell_with_xml(
        self,
        gridset_path: str,
        target_caption: Optional[str],
        target_action: Optional[str],
        new_content_xml: str,
        output_path: str,
    ) -> None:
        """Replace a cell's content with a new XML fragment across the gridset.

        Args:
            gridset_path (str): Path to the original gridset file.
            target_caption (Optional[str]): Caption of the button to replace.
            target_action (Optional[str]): Action command of the button to replace.
            new_content_xml (str): New XML content for the cell.
            output_path (str): Path to save the modified gridset.
        """
        temp_dir = self.create_temp_dir()
        with zipfile.ZipFile(gridset_path, "r") as zf:
            zf.extractall(temp_dir)

        grids_dir = os.path.join(temp_dir, "Grids")
        if not os.path.exists(grids_dir):
            self.debug("No Grids directory found")
            return

        new_content_element = etree.fromstring(new_content_xml)

        for grid_dir in os.listdir(grids_dir):
            grid_path = os.path.join(grids_dir, grid_dir, "grid.xml")
            if not os.path.exists(grid_path):
                continue

            try:
                tree = etree.parse(grid_path)
                root = tree.getroot()
                grid_modified = False

                for cell in root.findall(".//Cell"):
                    content = cell.find(".//Content")
                    caption = (
                        content.find(".//CaptionAndImage/Caption")
                        if content is not None
                        else None
                    )
                    commands = (
                        content.find(".//Commands") if content is not None else None
                    )
                    action_command = (
                        commands.find(".//Command[@ID='Action.Speak']")
                        if commands is not None
                        else None
                    )

                    if (caption is not None and caption.text == target_caption) or (
                        action_command is not None and target_action == "Action.Speak"
                    ):
                        # Replace the cell content with new_content_element
                        cell.remove(content)
                        cell.append(new_content_element)
                        grid_modified = True

                if grid_modified:
                    tree.write(
                        grid_path,
                        encoding="utf-8",
                        xml_declaration=False,
                        pretty_print=True,
                    )

            except Exception as e:
                self.debug(f"Error processing grid file {grid_path}: {str(e)}")

        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zip_ref:
            for root, _, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zip_ref.write(file_path, arcname)

        self.debug(f"Created modified gridset file: {output_path}")

    def _map_language_code(self, lang_code: str) -> str:
        """Map standard language codes to Grid3 language format.

        Args:
            lang_code (str): Standard language code (e.g., 'en', 'fr', 'es')

        Returns:
            str: Grid3 language code (e.g., 'en-GB', 'fr-FR', 'es-ES')
        """
        # List of right-to-left languages
        rtl_languages = ["ar", "fa", "ur", "yi", "dv", "ha", "ps"]

        # If the language is right-to-left and not explicitly mapped, use Arabic
        if lang_code in rtl_languages and lang_code != "ar" and lang_code != "he":
            return "ar-SA"  # Default to Arabic for RTL languages

        # Map of language codes to Grid3 language codes
        language_map = {
            # Common languages with short codes
            "af": "af-ZA",  # Afrikaans (South Africa)
            "ar": "ar-SA",  # Arabic (Saudi Arabia)
            "eu": "eu-ES",  # Basque (Spain)
            "ca": "ca-ES",  # Catalan (Spain)
            "hr": "hr-HR",  # Croatian (Croatia)
            "cs": "cs-CZ",  # Czech (Czechia)
            "da": "da-DK",  # Danish (Denmark)
            "nl": "nl-NL",  # Dutch (Netherlands)
            "en": "en-GB",  # English (United Kingdom)
            "fo": "fo-FO",  # Faroese (Faroe Islands)
            "fi": "fi-FI",  # Finnish (Finland)
            "fr": "fr-FR",  # French (France)
            "de": "de-DE",  # German (Germany)
            "el": "el-GR",  # Greek (Greece)
            "he": "he-IL",  # Hebrew (Israel)
            "it": "it-IT",  # Italian (Italy)
            "nb": "nb-NO",  # Norwegian Bokmål (Norway)
            "no": "nb-NO",  # Norwegian (Norway) - alias for nb-NO
            "pl": "pl-PL",  # Polish (Poland)
            "pt": "pt-PT",  # Portuguese (Portugal)
            "ru": "ru-RU",  # Russian (Russia)
            "sk": "sk-SK",  # Slovak (Slovakia)
            "sl": "sl-SI",  # Slovenian (Slovenia)
            "es": "es-ES",  # Spanish (Spain)
            "sv": "sv-SE",  # Swedish (Sweden)
            "uk": "uk-UA",  # Ukrainian (Ukraine)
            "cy": "cy-GB",  # Welsh (United Kingdom)
            "zh": "zh-CN",  # Chinese (China)
            "ja": "ja-JP",  # Japanese (Japan)
            "ko": "ko-KR",  # Korean (Korea)
            # Full language-region codes
            "af-ZA": "af-ZA",  # Afrikaans (South Africa)
            "ar-SA": "ar-SA",  # Arabic (Saudi Arabia)
            "eu-ES": "eu-ES",  # Basque (Spain)
            "ca-ES": "ca-ES",  # Catalan (Spain)
            "hr-HR": "hr-HR",  # Croatian (Croatia)
            "cs-CZ": "cs-CZ",  # Czech (Czechia)
            "da-DK": "da-DK",  # Danish (Denmark)
            "nl-BE": "nl-BE",  # Dutch (Belgium)
            "nl-NL": "nl-NL",  # Dutch (Netherlands)
            "en-AU": "en-AU",  # English (Australia)
            "en-CA": "en-CA",  # English (Canada)
            "en-NZ": "en-NZ",  # English (New Zealand)
            "en-ZA": "en-ZA",  # English (South Africa)
            "en-GB": "en-GB",  # English (United Kingdom)
            "en-US": "en-US",  # English (United States)
            "fo-FO": "fo-FO",  # Faroese (Faroe Islands)
            "fi-FI": "fi-FI",  # Finnish (Finland)
            "fr-CA": "fr-CA",  # French (Canada)
            "fr-FR": "fr-FR",  # French (France)
            "de-AT": "de-AT",  # German (Austria)
            "de-DE": "de-DE",  # German (Germany)
            "el-GR": "el-GR",  # Greek (Greece)
            "he-IL": "he-IL",  # Hebrew (Israel)
            "it-IT": "it-IT",  # Italian (Italy)
            "nb-NO": "nb-NO",  # Norwegian Bokmål (Norway)
            "pl-PL": "pl-PL",  # Polish (Poland)
            "pt-BR": "pt-BR",  # Portuguese (Brazil)
            "pt-PT": "pt-PT",  # Portuguese (Portugal)
            "ru-RU": "ru-RU",  # Russian (Russia)
            "sk-SK": "sk-SK",  # Slovak (Slovakia)
            "sl-SI": "sl-SI",  # Slovenian (Slovenia)
            "es-ES": "es-ES",  # Spanish (Spain)
            "es-US": "es-US",  # Spanish (United States)
            "sv-SE": "sv-SE",  # Swedish (Sweden)
            "uk-UA": "uk-UA",  # Ukrainian (Ukraine)
            "cy-GB": "cy-GB",  # Welsh (United Kingdom)
            "zh-CN": "zh-CN",  # Chinese (China)
            "ja-JP": "ja-JP",  # Japanese (Japan)
            "ko-KR": "ko-KR",  # Korean (Korea)
        }

        return language_map.get(lang_code, lang_code)
