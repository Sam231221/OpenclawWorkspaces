#!/usr/bin/env python3
"""Basic structural validation for Notion enhanced Markdown."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("markdown_file", type=Path)
    args = parser.parse_args()

    path = args.markdown_file.expanduser().resolve()
    if not path.exists():
        print(f"ERROR: File not found: {path}")
        return 2

    text = path.read_text(encoding="utf-8")
    errors: list[str] = []
    warnings: list[str] = []

    if not re.search(r"^#\s+\S", text, flags=re.MULTILINE):
        errors.append("Missing H1 page title.")
    if not re.search(r"^##\s+\S", text, flags=re.MULTILINE):
        errors.append("Missing H2 sections.")
    if "<table_of_contents" not in text:
        warnings.append("No <table_of_contents/> block.")
    if "<callout" not in text:
        warnings.append("No callout block.")
    if not re.search(r"^\d+\.\s+\S", text, flags=re.MULTILINE):
        warnings.append("No numbered list.")
    if len(text.strip()) < 1200:
        warnings.append("The final note is unusually short for a book.")

    tag_pairs = [
        (r"<callout(?:\s|>)", r"</callout>", "callout"),
        (r"<details(?:\s|>)", r"</details>", "details"),
        (r"<table(?:\s|>)", r"</table>", "table"),
        (r"<columns(?:\s|>)", r"</columns>", "columns"),
    ]
    for opening_pattern, closing_pattern, name in tag_pairs:
        opening_count = len(re.findall(opening_pattern, text))
        closing_count = len(re.findall(closing_pattern, text))
        if opening_count != closing_count:
            errors.append(
                f"Unbalanced {name} tags: {opening_count} opening and "
                f"{closing_count} closing."
            )

    # Notion enhanced Markdown uses tabs for nesting. Flag common space-indented lists.
    space_indented = re.findall(r"^( {2,})(?:[-*]|\d+\.)\s+", text, flags=re.MULTILINE)
    if space_indented:
        warnings.append("Found space-indented nested list items; use tabs for Notion children.")

    for item in errors:
        print(f"ERROR: {item}")
    for item in warnings:
        print(f"WARNING: {item}")

    if errors:
        return 1

    print("Validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
