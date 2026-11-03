"""
Hardened XML & Scenario Archive Security Module.
Implements OWASP ASVS L2 defenses:
1. Strict prohibition of DOCTYPE declarations and external entities (XXE defense).
2. Defense against Billion Laughs exponential entity expansion.
3. Path traversal (../../) prevention during archive extraction.
4. Zip bomb (decompression bomb) and malicious executable rejection.
"""

import io
import os
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Optional


ALLOWED_SCENARIO_EXTENSIONS = {
    ".xodr", # OpenDRIVE road network
    ".xosc", # OpenSCENARIO dynamic scenario
    ".xml",
    ".json",
    ".yaml",
    ".yml",
    ".png",
    ".jpg",
    ".jpeg",
}

DISALLOWED_EXECUTABLE_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".sh", ".py", ".pyw", ".ps1", ".vbs",
    ".dll", ".so", ".dylib", ".bin", ".elf", ".js", ".mjs",
}


def safe_parse_xml(xml_content: str | bytes) -> ET.Element:
    """
    Safely parses OpenDRIVE / OpenSCENARIO XML strings.
    Strictly forbids DOCTYPE declarations, entity expansions, and external references (XXE).
    """
    if isinstance(xml_content, bytes):
        text = xml_content.decode("utf-8", errors="replace")
    else:
        text = xml_content

    # 1. Reject DOCTYPE declarations entirely (ASVS V5.5.2)
    # This proactively eliminates XXE and Billion Laughs recursive entity attacks
    doctype_pattern = re.compile(r"<!DOCTYPE\s+[^>]*>", re.IGNORECASE | re.DOTALL)
    if doctype_pattern.search(text):
        raise ValueError("Malformed or insecure XML: DOCTYPE declarations are strictly forbidden.")

    # 2. Reject inline entity declarations
    if "<!ENTITY" in text.upper():
        raise ValueError("Malformed or insecure XML: External and custom ENTITY definitions are forbidden.")

    # 3. Parse XML using standard parser without DTD support
    try:
        parser = ET.XMLParser()
        root = ET.fromstring(text, parser=parser)
        return root
    except ET.ParseError as e:
        raise ValueError(f"XML parsing failed: {str(e)}")


def validate_and_extract_scenario_archive(
    zip_bytes: bytes,
    target_dir: Path,
    max_uncompressed_bytes: int = 50 * 1024 * 1024, # 50 MB
    max_file_count: int = 100,
) -> List[Path]:
    """
    Safely inspects and extracts scenario archive packages (OpenDRIVE + OpenSCENARIO).
    Enforces path traversal, zip bomb, and executable extension limits.
    """
    target_dir = Path(target_dir).resolve()
    target_dir.mkdir(parents=True, exist_ok=True)

    extracted_files: List[Path] = []
    total_uncompressed_size = 0

    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
            infolist = zf.infolist()

            if len(infolist) > max_file_count:
                raise ValueError(f"Archive contains {len(infolist)} files, exceeding limit of {max_file_count}.")

            # Pre-scan archive members before writing any bytes to disk
            for member in infolist:
                # 1. Path traversal check (ASVS V12.3.1)
                filename = member.filename
                if os.path.isabs(filename) or ".." in filename.split("/") or ".." in filename.split("\\"):
                    raise ValueError(f"Insecure path traversal detected in archive entry: '{filename}'.")

                dest_path = (target_dir / filename).resolve()
                try:
                    dest_path.relative_to(target_dir)
                except ValueError:
                    raise ValueError(f"Archive entry '{filename}' attempts directory traversal outside destination.")

                # 2. Executable / dangerous extension check
                ext = dest_path.suffix.lower()
                if ext in DISALLOWED_EXECUTABLE_EXTENSIONS:
                    raise ValueError(f"Disallowed executable file type '{ext}' in archive entry '{filename}'.")

                if ext and ext not in ALLOWED_SCENARIO_EXTENSIONS:
                    raise ValueError(f"Unsupported file extension '{ext}' in entry '{filename}'.")

                # 3. Zip bomb size check
                total_uncompressed_size += member.file_size
                if total_uncompressed_size > max_uncompressed_bytes:
                    raise ValueError(
                        f"Archive uncompressed size ({total_uncompressed_size / (1024*1024):.1f} MB) "
                        f"exceeds safety threshold of {max_uncompressed_bytes / (1024*1024):.1f} MB (Zip Bomb detected)."
                    )

            # Safe extraction
            for member in infolist:
                if member.is_dir():
                    (target_dir / member.filename).mkdir(parents=True, exist_ok=True)
                    continue

                dest_path = (target_dir / member.filename).resolve()
                dest_path.parent.mkdir(parents=True, exist_ok=True)

                with zf.open(member) as source, open(dest_path, "wb") as target:
                    target.write(source.read())

                extracted_files.append(dest_path)

        return extracted_files

    except zipfile.BadZipFile:
        raise ValueError("Provided file is not a valid ZIP archive.")
