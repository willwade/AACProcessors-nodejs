import uuid
import xml.etree.ElementTree as ET
from typing import Optional, Union

from .file_processor import FileProcessor
from .tree_structure import AACButton, AACPage, AACTree, ButtonType


class OPMLProcessor(FileProcessor):
    """Processor for OPML (Outline Processor Markup Language) files."""

    def __init__(self) -> None:
        """Initialize the OPML processor."""
        super().__init__()
        self.collected_texts = []

    def can_process(self, file_path: str) -> bool:
        """Check if file is an OPML file.

        Args:
            file_path: Path to the file to check.

        Returns:
            True if file is an OPML file.
        """
        return file_path.lower().endswith(".opml")

    def load_into_tree(self, file_path: str) -> AACTree:
        """Load OPML file into a tree structure.

        Args:
            file_path: Path to OPML file to load.

        Returns:
            Tree structure representing the OPML outline.
        """
        tree = AACTree()
        self.set_source_file(file_path)

        try:
            # Parse OPML file
            opml_tree = ET.parse(file_path)
            opml_root = opml_tree.getroot()

            # Get the body element which contains the outline
            body = opml_root.find("body")
            if body is None:
                self._debug_print("No body element found in OPML file")
                return tree

            # Process the root outlines
            root_outlines = body.findall("outline")
            if not root_outlines:
                self._debug_print("No outlines found in OPML file")
                return tree

            # Create a super root page (not in the OPML)
            super_root_id = str(uuid.uuid4())
            super_root_page = AACPage(
                id=super_root_id,
                name="Super Root",
                grid_size=(1, 1),  # One button for root page
            )

            # Create root page
            root_page_id = str(uuid.uuid4())
            root_page = AACPage(
                id=root_page_id,
                name="Root",
                grid_size=(1, 1),  # One button for main page
                parent_id=super_root_id,
            )

            # Create button on super root page that links to root page
            root_button = AACButton(
                id=str(uuid.uuid4()),
                label="Root",
                type=ButtonType.NAVIGATE,
                position=(0, 0),
                target_page_id=root_page_id,
                vocalization="Root",
            )
            super_root_page.buttons.append(root_button)

            # Get the main outline (first one)
            main_outline = root_outlines[0]
            main_text = main_outline.get("text", "Main Page")

            # Create main page
            main_page_id = str(uuid.uuid4())
            main_page = AACPage(
                id=main_page_id,
                name=main_text,
                grid_size=(len(main_outline.findall("outline")), 1),
                parent_id=root_page_id,
            )

            # Create button on root page that links to main page
            main_button = AACButton(
                id=str(uuid.uuid4()),
                label=main_text,
                type=ButtonType.NAVIGATE,
                position=(0, 0),
                target_page_id=main_page_id,
                vocalization=main_text,
            )
            root_page.buttons.append(main_button)

            # Define a recursive function to process outlines
            def process_outline(outline_element, parent_page_id, position=(0, 0)):
                outline_text = outline_element.get("text", "")
                if not outline_text:
                    return None

                # Check if this outline has children
                has_children = len(outline_element.findall("outline")) > 0

                if has_children:
                    # Create a page for this outline
                    outline_id = str(uuid.uuid4())
                    outline_page = AACPage(
                        id=outline_id,
                        name=outline_text,
                        grid_size=(len(outline_element.findall("outline")), 1),
                        parent_id=parent_page_id,
                    )

                    # Process child outlines
                    child_outlines = outline_element.findall("outline")
                    for i, child in enumerate(child_outlines):
                        child_button = process_outline(child, outline_id, (i, 0))
                        if child_button:
                            outline_page.buttons.append(child_button)

                    # Add the outline page to the tree
                    tree.add_page(outline_page)

                    # Create and return a navigation button for this outline
                    return AACButton(
                        id=str(uuid.uuid4()),
                        label=outline_text,
                        type=ButtonType.NAVIGATE,
                        position=position,
                        target_page_id=outline_id,
                        vocalization=outline_text,
                    )
                else:
                    # Create and return a speak button for this outline
                    return AACButton(
                        id=str(uuid.uuid4()),
                        label=outline_text,
                        type=ButtonType.SPEAK,
                        position=position,
                        vocalization=outline_text,
                    )

            # Process category outlines (children of main outline)
            category_outlines = main_outline.findall("outline")
            for i, category in enumerate(category_outlines):
                category_button = process_outline(category, main_page_id, (i, 0))
                if category_button:
                    main_page.buttons.append(category_button)

            # Add main page, root page, and super root page to tree
            tree.add_page(main_page)
            tree.add_page(root_page)
            tree.add_page(super_root_page)
            tree.root_id = super_root_id

        except Exception as e:
            self._debug_print(f"Error loading OPML file: {str(e)}")

        return tree

    def save_from_tree(self, tree: AACTree, output_path: str) -> None:
        """Save tree structure to OPML format.

        Args:
            tree: Tree structure to save.
            output_path: Path where to save the file.
        """
        # Create OPML structure
        opml = ET.Element("opml")
        opml.set("version", "2.0")

        # Add head element
        head = ET.SubElement(opml, "head")
        title = ET.SubElement(head, "title")
        title.text = "AAC Tree Export"

        # Add body element
        body = ET.SubElement(opml, "body")

        # Get the super root page
        if not tree.root_id or tree.root_id not in tree.pages:
            self._debug_print("No root page found in tree")
            return

        super_root_page = tree.pages[tree.root_id]

        # Find the root page (should be the first button on the super root page)
        if not super_root_page.buttons:
            self._debug_print("No buttons found on super root page")
            return

        root_button = super_root_page.buttons[0]
        if root_button.type != ButtonType.NAVIGATE or not root_button.target_page_id:
            self._debug_print(
                "First button on super root page is not a navigation button"
            )
            return

        root_page_id = root_button.target_page_id
        if root_page_id not in tree.pages:
            self._debug_print(f"Root page {root_page_id} not found in tree")
            return

        root_page = tree.pages[root_page_id]

        # Find the main page (should be the first button on the root page)
        if not root_page.buttons:
            self._debug_print("No buttons found on root page")
            return

        main_button = root_page.buttons[0]
        if main_button.type != ButtonType.NAVIGATE or not main_button.target_page_id:
            self._debug_print("First button on root page is not a navigation button")
            return

        main_page_id = main_button.target_page_id
        if main_page_id not in tree.pages:
            self._debug_print(f"Main page {main_page_id} not found in tree")
            return

        main_page = tree.pages[main_page_id]

        # Create main outline element
        main_outline = ET.SubElement(body, "outline")
        main_outline.set("text", main_page.name)

        # Define a recursive function to process pages and buttons
        def process_page_buttons(page, parent_element):
            # Process all buttons on the page
            for button in page.buttons:
                # Create an outline element for this button
                button_outline = ET.SubElement(parent_element, "outline")
                button_outline.set("text", button.label)

                # If this is a navigation button, process the target page
                if (
                    button.type == ButtonType.NAVIGATE
                    and button.target_page_id in tree.pages
                ):
                    target_page = tree.pages[button.target_page_id]
                    process_page_buttons(target_page, button_outline)

        # Process buttons on the main page
        process_page_buttons(main_page, main_outline)

        # Create XML tree and write to file
        xml_tree = ET.ElementTree(opml)
        xml_tree.write(output_path, encoding="utf-8", xml_declaration=True)
        self._debug_print(f"Saved OPML file to {output_path}")

    def export_tree(self, tree: AACTree, output_path: str) -> None:
        """Export tree to OPML format.

        Args:
            tree (AACTree): Tree to export.
            output_path (str): Path where to save the file.
        """
        self.save_from_tree(tree, output_path)

    def extract_texts(self, file_path: str) -> list[str]:
        """Extract translatable texts from OPML file.

        Args:
            file_path: Path to the OPML file.

        Returns:
            List of translatable texts.
        """
        texts: list[str] = []

        # Set the source file path
        self.set_source_file(file_path)

        try:
            # Parse OPML file
            opml_tree = ET.parse(file_path)
            opml_root = opml_tree.getroot()

            # Get the body element which contains the outline
            body = opml_root.find("body")
            if body is None:
                return texts

            # Extract texts from all outlines recursively
            self._extract_texts_from_element(body, texts)

        except Exception as e:
            self._debug_print(f"Error extracting texts from OPML file: {str(e)}")

        return texts

    def _extract_texts_from_element(
        self, element: ET.Element, texts: list[str]
    ) -> None:
        """Extract texts from an element and its children recursively.

        Args:
            element: The element to extract texts from.
            texts: List to add extracted texts to.
        """
        # Process all outline elements
        for outline in element.findall("outline"):
            text = outline.get("text", "")
            if text and text.strip():
                texts.append(text.strip())

            # Process children recursively
            self._extract_texts_from_element(outline, texts)

    def process_texts(
        self,
        file_path: str,
        translations: Optional[dict[str, str]] = None,
        output_path: Optional[str] = None,
    ) -> Union[list[str], str, None]:
        """Process texts in OPML file.

        Args:
            file_path: Path to the OPML file.
            translations: Dictionary of translations.
            output_path: Path where to save the translated file.

        Returns:
            List of texts if extracting, path to translated file if translating, None if error.
        """
        # Set the source file path
        self.set_source_file(file_path)

        if translations is None:
            # Extract mode
            return self.extract_texts(file_path)

        if output_path is None:
            # Generate output path
            output_path = self.get_output_path(translations.get("target_lang"))

        try:
            # Parse OPML file
            opml_tree = ET.parse(file_path)
            opml_root = opml_tree.getroot()

            # Get the body element which contains the outline
            body = opml_root.find("body")
            if body is None:
                self._debug_print("No body element found in OPML file")
                return None

            # Translate texts in all outlines recursively
            self._translate_texts_in_element(body, translations)

            # Write to file
            opml_tree.write(output_path, encoding="utf-8", xml_declaration=True)
            self._debug_print(f"Saved translated OPML file to {output_path}")

            return output_path

        except Exception as e:
            self._debug_print(f"Error translating OPML file: {str(e)}")
            return None

    def _translate_texts_in_element(
        self, element: ET.Element, translations: dict[str, str]
    ) -> bool:
        """Translate texts in an element and its children recursively.

        Args:
            element: The element to translate texts in.
            translations: Dictionary of translations.

        Returns:
            True if any texts were translated, False otherwise.
        """
        modified = False

        # Process all outline elements
        for outline in element.findall("outline"):
            text = outline.get("text", "")
            if text and text.strip() and text.strip() in translations:
                outline.set("text", translations[text.strip()])
                modified = True

            # Process children recursively
            if self._translate_texts_in_element(outline, translations):
                modified = True

        return modified

    def process_files(
        self, directory: str, translations: Optional[dict[str, str]] = None
    ) -> Optional[str]:
        """Process files in directory.

        Args:
            directory: Directory containing files to process.
            translations: Dictionary of translations.

        Returns:
            Path to translated file if successful, None otherwise.
        """
        import os

        for _rel_path, abs_path in self._walk_files(directory):
            if self.can_process(abs_path):
                output_path = None
                if translations:
                    # Generate output path in the same directory
                    target_lang = translations.get("target_lang")
                    filename = os.path.basename(abs_path)
                    if target_lang:
                        base, ext = os.path.splitext(filename)
                        translated_filename = f"{base}_{target_lang}{ext}"
                    else:
                        translated_filename = f"translated_{filename}"
                    output_path = os.path.join(directory, translated_filename)

                result = self.process_texts(abs_path, translations, output_path)
                if result and translations:
                    return result

        return None

    def create_translated_file(
        self, input_file: str, translations: dict, output_path: str
    ) -> Optional[str]:
        """Create a translated version of the OPML file.

        Args:
            input_file: Path to the input file.
            translations: Dictionary of translations.
            output_path: Path to save the translated file.

        Returns:
            Path to the translated file if successful, otherwise None.
        """
        try:
            # Parse the OPML file
            tree = ET.parse(input_file)
            root = tree.getroot()

            # Translate all outline text attributes
            for outline in root.findall(".//outline"):
                text = outline.get("text")
                if text and text in translations:
                    outline.set("text", translations[text])

            # Write the translated tree to the output file
            tree.write(output_path, encoding="utf-8", xml_declaration=True)

            return output_path
        except Exception as e:
            if self._debug_output:
                self._debug_output(f"Error creating translated file: {e}")
            return None

    def _add_page_as_outline(
        self, tree: AACTree, page_id: str, parent_outline: ET.Element
    ) -> None:
        """Add a page as an outline element.

        Args:
            tree: The tree containing the page.
            page_id: ID of the page to add.
            parent_outline: Parent outline element to add to.
        """
        if page_id not in tree.pages:
            return

        page = tree.pages[page_id]

        # Process buttons on this page
        for button in page.buttons:
            outline = ET.SubElement(parent_outline, "outline")
            outline.set("text", button.label or "")

            # If this is a navigation button, add child outlines
            if button.type == ButtonType.NAVIGATE and button.target_page_id:
                self._add_page_as_outline(tree, button.target_page_id, outline)
