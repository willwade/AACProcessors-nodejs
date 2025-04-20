# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "jinja2",
#     "llm",
#     "llm-gemini",
#     "tqdm",
#     "requests",
#     "click",
#     "aac_processors",
#     # Note: OpenAI support is built into llm, no separate plugin needed
# ]
# ///

import difflib
import json
import os
from typing import Optional, Dict, List

import click
import requests
import llm

from aac_processors.base_processor import AACProcessor
from aac_processors.coughdrop_processor import CoughDropProcessor
from aac_processors.gridset_processor import GridsetProcessor
from aac_processors.snap_processor import SnapProcessor
from aac_processors.touchchat_processor import TouchChatProcessor

# List of available processors
PROCESSORS = [
    GridsetProcessor,
    TouchChatProcessor,
    SnapProcessor,
    CoughDropProcessor,
]

# Azure Translator configuration
AZURE_TRANSLATOR_KEY = os.getenv(
    "AZURE_TRANSLATOR_KEY"
)  # Replace with your Azure Translator key
AZURE_TRANSLATOR_REGION = os.getenv(
    "AZURE_TRANSLATOR_REGION", "uksouth"
)  # Replace with your Azure Translator region
AZURE_TRANSLATOR_ENDPOINT = "https://api.cognitive.microsofttranslator.com/translate"

# Google Translate API configuration
GOOGLE_TRANSLATE_KEY = os.getenv(
    "GOOGLE_TRANSLATE_KEY"
)  # Replace with your Google API key
GOOGLE_TRANSLATE_ENDPOINT = "https://translation.googleapis.com/language/translate/v2"

# Gemini LLM configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")  # Replace with your Gemini API key


def load_cache(cache_file: str) -> dict:
    """Load cached translations from file."""
    if os.path.exists(cache_file):
        try:
            with open(cache_file, encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            click.echo(
                f"Warning: Cache file {cache_file} is corrupted. Creating a new one."
            )
            return {}
    return {}


def save_cache(cache: dict, cache_file: str) -> None:
    """Save the updated cache to the JSON file."""
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=4)


def azure_translate_batch(texts: list[str], target_language: str) -> list[str]:
    """Translate a batch of texts using Azure Translator."""
    if not AZURE_TRANSLATOR_KEY:
        raise ValueError(
            "Azure Translator key is not set. Set the AZURE_TRANSLATOR_KEY environment variable."
        )

    headers = {
        "Ocp-Apim-Subscription-Key": AZURE_TRANSLATOR_KEY,
        "Ocp-Apim-Subscription-Region": AZURE_TRANSLATOR_REGION,
        "Content-type": "application/json",
    }

    params = {
        "api-version": "3.0",
        "from": "en",
        "to": target_language,
    }

    # Process in batches to avoid request size limitations
    batch_size = 100  # Azure can handle larger batches, but we'll be conservative
    all_translations = []

    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i : i + batch_size]
        click.echo(
            f"Azure translating batch {i//batch_size + 1}/{(len(texts) + batch_size - 1)//batch_size}..."
        )

        body = [{"text": text} for text in batch_texts]

        try:
            response = requests.post(
                AZURE_TRANSLATOR_ENDPOINT, headers=headers, params=params, json=body
            )
            response.raise_for_status()

            batch_translations = []
            for item in response.json():
                if "translations" in item and len(item["translations"]) > 0:
                    batch_translations.append(item["translations"][0]["text"])
                else:
                    batch_translations.append("")

            all_translations.extend(batch_translations)
        except Exception as e:
            click.echo(
                f"Error with Azure translation batch {i//batch_size + 1}: {str(e)}",
                err=True,
            )
            # Add empty strings for the failed batch
            all_translations.extend([""] * len(batch_texts))

    return all_translations


def google_translate_texts(texts: list[str], target_language: str) -> list[str]:
    """Translate a batch of texts using Google Translate."""
    if not GOOGLE_TRANSLATE_KEY:
        raise ValueError(
            "Google Translate key is not set. Set the GOOGLE_TRANSLATE_KEY environment variable."
        )

    # Process in batches to avoid request size limitations
    batch_size = 50  # Google has stricter limits than Azure
    all_translations = []

    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i : i + batch_size]
        click.echo(
            f"Google translating batch {i//batch_size + 1}/{(len(texts) + batch_size - 1)//batch_size}..."
        )

        params = {
            "key": GOOGLE_TRANSLATE_KEY,
            "target": target_language,
            "q": batch_texts,
        }

        try:
            response = requests.post(GOOGLE_TRANSLATE_ENDPOINT, params=params)
            response.raise_for_status()
            batch_translations = [
                item["translatedText"]
                for item in response.json()["data"]["translations"]
            ]
            all_translations.extend(batch_translations)
        except Exception as e:
            click.echo(
                f"Error with Google translation batch {i//batch_size + 1}: {str(e)}",
                err=True,
            )
            # Add empty strings for the failed batch
            all_translations.extend([""] * len(batch_texts))

    return all_translations


def calculate_similarity(original: str, reverse_translated: str) -> float:
    """Calculate similarity between original and reverse-translated text."""
    return difflib.SequenceMatcher(None, original, reverse_translated).ratio()


def calculate_confidence_factor(
    azure_translation: str, google_translation: str
) -> float:
    """Calculate confidence factor between two translations.

    A lower score means more difference between translations, suggesting
    one might be better than the other. A higher score means translations
    are similar, suggesting both are likely correct.
    """
    return calculate_similarity(azure_translation, google_translation)


def validate_translation(original: str, translated: str, target_language: str) -> dict:
    """Validate translation by reverse-translating and calculating confidence."""
    reverse_translated = google_translate_texts([translated], "en")[0]
    confidence = calculate_similarity(original, reverse_translated)
    return {"reverse_translated": reverse_translated, "confidence": confidence}


def translate_texts(
    texts: list[str],
    cache: dict,
    target_language: str,
    enable_confidence_check: bool,
    accept_most_confident_trans: bool,
    use_llm: bool = False,
) -> list[str]:
    """Translate a list of texts with optional confidence factor validation and LLM translation."""
    # Filter out texts that are already in the cache
    texts_to_translate = []
    text_indices = {}

    for i, text in enumerate(texts):
        if text in cache and cache[text].get("google_translation"):
            click.echo(f"Using cached translation for: {text[:30]}...")
        else:
            texts_to_translate.append(text)
            text_indices[text] = i

    # If all texts are in cache, return them directly
    if not texts_to_translate:
        return [
            (
                cache[text]["google_translation"]
                if not enable_confidence_check
                else (
                    cache[text]["azure_translation"]
                    if cache[text]["quality_score"] < 0.5
                    else cache[text]["google_translation"]
                )
            )
            for text in texts
        ]

    # Translate new texts
    click.echo(f"Translating {len(texts_to_translate)} new texts...")

    # Always use Google Translate for the primary translation
    google_translations = google_translate_texts(texts_to_translate, target_language)

    # Get Azure translations if confidence check is enabled
    azure_translations = (
        azure_translate_batch(texts_to_translate, target_language)
        if enable_confidence_check
        else [None] * len(texts_to_translate)
    )

    # Update cache with translations
    for i, (original, google_translation, azure_translation) in enumerate(
        zip(texts_to_translate, google_translations, azure_translations)
    ):
        if enable_confidence_check:
            quality_score = calculate_confidence_factor(
                azure_translation, google_translation
            )
            cache[original] = {
                "azure_translation": azure_translation,
                "google_translation": google_translation,
                "quality_score": quality_score,
            }
        else:
            cache[original] = {
                "google_translation": google_translation,
                "quality_score": None,
            }

    # If LLM is enabled, get additional context and cultural notes
    if use_llm:
        click.echo("Getting cultural context from LLM...")
        llm_translations = translate_with_gemini(cache, target_language)

        # Update cache with LLM context while preserving existing translations
        for (
            text
        ) in texts:  # Changed from texts_to_translate to texts to include all texts
            if text in llm_translations:
                if text in cache:
                    cache[text].update(
                        {
                            "llm_translation": llm_translations[text],
                            "llm_confidence": 1.0,  # Default confidence for now
                            "cultural_notes": "No cultural notes available",  # Default notes for now
                        }
                    )

        # Save the cache after LLM updates
        save_cache(cache, "translation_cache.json")
        click.echo("Cache updated with LLM translations")

    # Construct the final translations list
    result = [None] * len(texts)
    for i, text in enumerate(texts):
        if text in cache:
            if enable_confidence_check:
                quality_score = cache[text]["quality_score"]
                if accept_most_confident_trans:
                    result[i] = (
                        cache[text]["google_translation"]
                        if quality_score < 0.5
                        else cache[text]["azure_translation"]
                    )
                else:
                    result[i] = (
                        cache[text]["azure_translation"]
                        if quality_score < 0.5
                        else cache[text]["google_translation"]
                    )
            else:
                result[i] = cache[text]["google_translation"]

    return result


def get_processor(file_path: str) -> AACProcessor:
    """Identify the appropriate processor for the given file."""
    for processor_cls in PROCESSORS:
        processor = processor_cls()
        if processor.can_process(file_path):
            return processor
    raise ValueError(f"No suitable processor found for file: {file_path}")


def process_file(
    file_path: str,
    start_lang: str,
    end_lang: str,
    translation_cache: str,
    enable_confidence_check: bool,
    accept_most_confident_trans: bool,
    use_llm: bool,
    output_path: Optional[str] = None,
) -> str:
    """Process the file and translate its content."""
    # Validate file exists
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    # Get the appropriate processor
    processor = get_processor(file_path)
    click.echo(f"Using processor: {processor.__class__.__name__}")

    # Extract texts to translate with context
    click.echo("Extracting texts from file...")
    texts_with_context = processor.extract_texts(file_path, include_context=True)

    # Check if we got context information or just plain texts
    if texts_with_context and isinstance(texts_with_context[0], dict):
        # We have context information
        click.echo(f"Found {len(texts_with_context)} texts to translate with context")
        # Extract just the text for translation
        texts = [item["text"] for item in texts_with_context]
    else:
        # We just have plain texts
        texts = texts_with_context
        click.echo(f"Found {len(texts)} texts to translate")

    # Load translation cache
    cache = load_cache(translation_cache)

    # Translate texts
    click.echo(f"Translating from {start_lang} to {end_lang}...")
    translations = {}

    # Add the target language to the translations dictionary
    translations["target_lang"] = end_lang

    # Translate and add to translations dictionary
    translated_texts = translate_texts(
        texts,
        cache,
        end_lang,
        enable_confidence_check,
        accept_most_confident_trans,
        use_llm,
    )

    # Add translations to the dictionary
    if texts_with_context and isinstance(texts_with_context[0], dict):
        # We have context information - add it to the cache for future reference
        for item, translated in zip(texts_with_context, translated_texts):
            original_text = item["text"]
            translations[original_text] = translated

            # Add context information to the cache
            if original_text in cache and "context" not in cache[original_text]:
                context_info = {
                    key: value for key, value in item.items() if key != "text"
                }
                cache[original_text]["context"] = context_info
    else:
        # Simple text-to-text translations
        for original, translated in zip(texts, translated_texts):
            translations[original] = translated

    # Save updated cache
    save_cache(cache, translation_cache)
    click.echo(f"Translation cache saved to {translation_cache}")

    # If output_path is not provided, generate it based on the input file name and target language
    if not output_path:
        file_name, file_ext = os.path.splitext(file_path)
        output_path = f"{file_name}_{end_lang}{file_ext}"

    # Process translations and save the output
    click.echo("Creating translated file...")
    translated_file = processor.process_texts(file_path, translations, output_path)

    if translated_file:
        return translated_file
    else:
        raise RuntimeError("Failed to create translated file")


@click.command()
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--startlang", default="en", help="Source language code (default: en)")
@click.option("--endlang", default="de", help="Target language code (default: de)")
@click.option(
    "--translationcache",
    default="translation_cache.json",
    help="Path to translation cache file (default: translation_cache.json)",
)
@click.option(
    "--enable-confidence-check",
    is_flag=True,
    default=False,
    help="Enable confidence check using multiple translation engines",
)
@click.option(
    "--accept-most-confident-trans",
    is_flag=True,
    default=False,
    help="Accept the most confident translation when confidence check is enabled",
)
@click.option(
    "--use-llm",
    is_flag=True,
    default=False,
    help="Use LLM (Gemini) for translation instead of traditional translation services",
)
@click.option(
    "--output",
    type=click.Path(),
    help="Output file path (default: input_filename_targetlang.ext)",
)
def main(
    file_path: str,
    startlang: str,
    endlang: str,
    translationcache: str,
    enable_confidence_check: bool,
    accept_most_confident_trans: bool,
    use_llm: bool,
    output: Optional[str] = None,
):
    """Translate AAC files from one language to another.

    This tool translates AAC files (Gridset, TouchChat, Snap, CoughDrop)
    from one language to another using translation APIs.

    Example usage:

    \b
    # Simple translation with defaults
    uv run translate_gridset.py myfile.gridset

    \b
    # Advanced translation with options
    uv run translate_gridset.py myfile.gridset --startlang en --endlang fr \\
        --translationcache my_cache.json --enable-confidence-check \\
        --accept-most-confident-trans

    \b
    # Use LLM for translation
    uv run translate_gridset.py myfile.gridset --endlang fr --use-llm
    """
    try:
        # Display configuration
        click.echo("=== Translation Configuration ===")
        click.echo(f"Source language: {startlang}")
        click.echo(f"Target language: {endlang}")
        click.echo(f"Translation cache: {translationcache}")
        click.echo(
            f"Confidence check: {'Enabled' if enable_confidence_check else 'Disabled'}"
        )
        if enable_confidence_check:
            click.echo(
                f"Accept most confident: {'Yes' if accept_most_confident_trans else 'No'}"
            )
        click.echo(f"Using LLM: {'Yes' if use_llm else 'No'}")
        click.echo("==============================")

        # Process the file
        translated_file = process_file(
            file_path,
            startlang,
            endlang,
            translationcache,
            enable_confidence_check,
            accept_most_confident_trans,
            use_llm,
            output,
        )

        click.echo(
            click.style(
                f"✅ Success! Translated file saved at: {translated_file}", fg="green"
            )
        )

    except Exception as e:
        click.echo(click.style(f"❌ Error: {str(e)}", fg="red"), err=True)
        raise click.Abort()


def process_aac_json_for_gemini(json_data: Dict, target_language: str) -> List[Dict]:
    """
    Processes AAC pageset JSON data to extract relevant information and format it for Gemini translation,
    handling potential missing image data and cultural suitability in translations.

    Args:
        json_data: A dictionary representing the AAC pageset data in JSON format.
        target_language: The target language for translation (e.g., "Swahili").

    Returns:
        A list of dictionaries, where each dictionary contains the data for a single translation unit,
        formatted for Gemini prompting.  The list is ready to be converted to CSV.
        Returns an empty list if the input is invalid.
    """
    output_data = []

    if not isinstance(json_data, dict):
        print("Error: Input data must be a dictionary.")
        return []

    for key, value in json_data.items():
        if not isinstance(value, dict):
            print(f"Warning: Value for key '{key}' is not a dictionary. Skipping.")
            continue

        # The key is the original English text
        original_text = key.strip()  # Remove leading/trailing spaces

        # Get the context information
        context = value.get("context", {})
        path = context.get("path", "")
        page_name = context.get("page_name", "")
        symbol_name = context.get("symbol_name", None)
        symbol_library = context.get("symbol_library", None)
        symbol_id = context.get("symbol_id", None)

        # Extract image details
        image_details = "No image data available."
        if symbol_name is not None:
            image_details = f"Symbol Name: {symbol_name}, Library: {symbol_library}, ID: {symbol_id}"

        output_data.append(
            {
                "original_text": original_text,  # This is the English text
                "path": path,
                "page_name": page_name,
                "image_details": image_details,
                "target_language": target_language,
            }
        )
    return output_data


def create_gemini_prompt(data_for_translation: List[Dict]) -> str:
    """
    Creates a prompt for the Gemini LLM, incorporating context about AAC pageset translation
    and instructions for handling cultural suitability.

    Args:
        data_for_translation: A list of dictionaries, where each dictionary contains the data for a single translation unit.
            as generated by the  process_aac_json_for_gemini function.

    Returns:
        A string representing the prompt to be used with the Gemini LLM.
    """
    if not data_for_translation:
        return "Error: No data provided for translation."

    prompt = """
You are a highly skilled translator specializing in AAC (Augmentative and Alternative Communication) pagesets. Your task is to translate words and short phrases from {source_language} into {target_language}. AAC pagesets often contain single words or short, context-dependent phrases, so you must pay close attention to the provided context to ensure accurate and culturally appropriate translations.

Here is the data for translation, provided in CSV format. The columns are:

* **original_text**: The original English word or phrase.
* **google_translation**: A first-pass translation from Google Translate (provide for additional context, but do not rely on this completely).
* **path**: The path within the AAC pageset to the button containing the text.
* **page_name**: The name of the page within the AAC pageset.
* **image_details**: Details about the image associated with the button.
* **target_language**: The language to translate into.

Your translation should adhere to the following guidelines:

* Prioritize accuracy and clarity for AAC users.
* When translating single words, use the context provided in the "path", "page_name", and "image_details" columns to determine the most appropriate meaning. For example, the word "go" might have different translations depending on whether it's used in the context of "places" or "actions".
* Ensure the translations are culturally appropriate for {target_language} speakers. If a direct translation of a concept (e.g., "ice cream," "milkshake") is not commonly understood or available in {target_language} culture, provide a suitable cultural equivalent or a descriptive translation that conveys the meaning.
* For cultural_notes, provide meaningful insights about:
  - Cultural differences in how the concept is expressed
  - Regional variations in the target language
  - Alternative translations that might be more appropriate in different contexts
  - Any cultural sensitivities or considerations
  - If there are no significant cultural considerations, explain why (e.g., "This is a universal concept with direct translation")
* Provide ONLY the translation. Do not include any additional text, explanations, or formatting.
* Maintain any trailing spaces that exist in the original text.

Your response must be valid JSON following this exact schema:
{
  "items": [
    {
      "original_text": "original text here",
      "translation": "translated text here",
      "confidence": 1.0,
      "cultural_notes": "detailed cultural notes here"
    }
  ]
}

Begin!
"""
    # Add the data to the prompt. Convert the list of dicts to a CSV string.
    header = ",".join(data_for_translation[0].keys()) + "\n"

    for row in data_for_translation:
        row_values = [
            str(v).replace(",", "") for v in row.values()
        ]  # remove any commas from the data
        header += ",".join(row_values) + "\n"

    prompt += header

    return prompt


def translate_with_gemini(cache: dict, target_language: str) -> dict:
    """
    Translate texts using Gemini LLM, incorporating context and cultural considerations.

    Args:
        cache: Dictionary containing texts to translate and their context
        target_language: Target language for translation

    Returns:
        Dictionary with Gemini translations
    """
    if not GEMINI_API_KEY:
        raise ValueError(
            "Gemini API key is not set. Set the GEMINI_API_KEY environment variable."
        )

    # Process the cache data for Gemini
    data_for_translation = process_aac_json_for_gemini(cache, target_language)

    if not data_for_translation:
        return {}

    # Define schema for translations
    translation_schema = {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "original_text": {"type": "string"},
                        "translation": {"type": "string"},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                        "cultural_notes": {"type": "string"},
                    },
                    "required": [
                        "original_text",
                        "translation",
                        "confidence",
                        "cultural_notes",
                    ],
                },
            }
        },
        "required": ["items"],
    }

    # Create the prompt
    prompt = create_gemini_prompt(data_for_translation)

    # Initialize Gemini
    model = llm.get_model("gemini-2.0-flash")
    model.key = GEMINI_API_KEY

    try:
        # Get translations from Gemini with schema
        response = model.prompt(prompt, schema=translation_schema)

        # Get the raw response text
        response_text = response.text()

        # Debug: Print the first 1000 characters of the response
        click.echo("\nFirst 1000 characters of response:")
        click.echo(response_text[:1000])

        # Debug: Save the full response to a file for inspection
        with open("gemini_response.txt", "w", encoding="utf-8") as f:
            f.write(response_text)
        click.echo("\nFull response saved to gemini_response.txt")

        # Try to parse the response
        try:
            translations_data = json.loads(response_text)
        except json.JSONDecodeError as e:
            click.echo(f"\nJSON Parse Error: {str(e)}")
            click.echo("\nTrying to clean the response...")

            # Try to extract JSON from the response
            import re

            # Look for a complete JSON object with schema validation
            json_match = re.search(
                r'\{.*"items":\s*\[.*\]\s*\}', response_text, re.DOTALL
            )
            if json_match:
                cleaned_text = json_match.group(0)
                click.echo("\nExtracted JSON:")
                click.echo(cleaned_text[:1000])
                translations_data = json.loads(cleaned_text)
            else:
                raise

        # Convert to our expected format
        translations = {}
        for item in translations_data["items"]:
            translations[item["original_text"]] = item["translation"]

            # Update cache with additional information
            if item["original_text"] in cache:
                cache[item["original_text"]].update(
                    {
                        "llm_translation": item["translation"],
                        "llm_confidence": item["confidence"],
                        "cultural_notes": item["cultural_notes"],
                    }
                )

        return translations

    except Exception as e:
        click.echo("Error with Gemini translation: " + str(e), err=True)
        return {}


if __name__ == "__main__":
    main()
