"""
Creates a clean, production-ready ZIP archive of the ADAPTIVE-PATH Studio project,
excluding bulky build caches, node_modules, and git directories.
"""

import os
import sys
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_ZIP = REPO_ROOT / "ADAPTIVE_PATH_STUDIO_SIH2026.zip"
OUTPUT_DOWNLOADS = REPO_ROOT.parent / "ADAPTIVE_PATH_STUDIO_SIH2026.zip"

EXCLUDE_DIRS = {
    "node_modules",
    ".git",
    "__pycache__",
    ".pytest_cache",
    ".hypothesis",
    ".gemini",
    ".vscode",
    ".idea",
}

EXCLUDE_EXTS = {
    ".pyc",
    ".pyo",
    ".zip",
}

EXCLUDE_FILES = {
    OUTPUT_ZIP.name,
}

def should_exclude(rel_path: Path) -> bool:
    parts = rel_path.parts
    for part in parts:
        if part in EXCLUDE_DIRS:
            return True
    if rel_path.suffix.lower() in EXCLUDE_EXTS:
        return True
    if rel_path.name in EXCLUDE_FILES:
        return True
    return False

def create_archive():
    print(f"[*] Packaging ADAPTIVE-PATH project from {REPO_ROOT}...")
    file_count = 0
    total_uncompressed_bytes = 0

    with zipfile.ZipFile(OUTPUT_ZIP, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for root, dirs, files in os.walk(REPO_ROOT):
            # Prune excluded directories in-place
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            
            for file in files:
                file_path = Path(root) / file
                rel_path = file_path.relative_to(REPO_ROOT)
                
                if should_exclude(rel_path):
                    continue
                
                # Prefix top-level folder name inside ZIP for clean extraction
                arcname = Path("ADAPTIVE-PATH") / rel_path
                zf.write(file_path, arcname=str(arcname))
                file_count += 1
                total_uncompressed_bytes += file_path.stat().st_size

    zip_size_bytes = OUTPUT_ZIP.stat().st_size
    print(f"[+] Successfully created {OUTPUT_ZIP.name}")
    print(f"    - Files archived: {file_count}")
    print(f"    - Uncompressed:   {total_uncompressed_bytes / (1024 * 1024):.2f} MB")
    print(f"    - Compressed:     {zip_size_bytes / (1024 * 1024):.2f} MB")
    
    # Also copy to parent Downloads folder for easy direct access
    try:
        import shutil
        shutil.copy2(OUTPUT_ZIP, OUTPUT_DOWNLOADS)
        print(f"[+] Copied to user Downloads folder: {OUTPUT_DOWNLOADS}")
    except Exception as e:
        print(f"[!] Notice copying to parent folder: {e}")

if __name__ == "__main__":
    create_archive()

