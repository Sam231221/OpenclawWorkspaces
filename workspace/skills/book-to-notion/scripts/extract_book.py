#!/usr/bin/env python3
"""Extract and chunk supported book formats for the book-to-notion skill."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


@dataclass
class Unit:
    label: str
    text: str
    start_page: int | None = None
    end_page: int | None = None


def clean_text(text: str) -> str:
    text = text.replace("\x00", "")
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{4,}", "\n\n\n", text)
    return text.strip()


def extract_pdf(path: Path) -> tuple[list[Unit], dict]:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise RuntimeError("Install pypdf: pip install -r requirements.txt") from exc

    reader = PdfReader(str(path))
    metadata = reader.metadata or {}
    units: list[Unit] = []
    page_char_counts: list[int] = []

    for index, page in enumerate(reader.pages, start=1):
        try:
            text = clean_text(page.extract_text() or "")
        except Exception:
            text = ""
        page_char_counts.append(len(text))
        units.append(Unit(label=f"Page {index}", text=text, start_page=index, end_page=index))

    nonempty = [count for count in page_char_counts if count > 0]
    median_chars = sorted(nonempty)[len(nonempty) // 2] if nonempty else 0
    sparse_ratio = (
        sum(1 for count in page_char_counts if count < 80) / len(page_char_counts)
        if page_char_counts
        else 1.0
    )

    extra = {
        "title": str(getattr(metadata, "title", "") or path.stem),
        "author": str(getattr(metadata, "author", "") or ""),
        "page_count": len(reader.pages),
        "median_extracted_chars_per_nonempty_page": median_chars,
        "sparse_page_ratio": round(sparse_ratio, 3),
        "requires_ocr": sparse_ratio > 0.45 or median_chars < 120,
    }
    return units, extra


def extract_docx(path: Path) -> tuple[list[Unit], dict]:
    try:
        from docx import Document
    except ImportError as exc:
        raise RuntimeError("Install python-docx: pip install -r requirements.txt") from exc

    document = Document(str(path))
    units: list[Unit] = []
    current_title = "Document"
    buffer: list[str] = []

    def flush() -> None:
        nonlocal buffer
        text = clean_text("\n".join(buffer))
        if text:
            units.append(Unit(label=current_title, text=text))
        buffer = []

    for paragraph in document.paragraphs:
        text = clean_text(paragraph.text)
        if not text:
            continue
        style = (paragraph.style.name or "").lower() if paragraph.style else ""
        if style.startswith("heading"):
            flush()
            current_title = text
        else:
            buffer.append(text)
    flush()

    if not units:
        units = [Unit(label="Document", text="")]

    core = document.core_properties
    return units, {
        "title": core.title or path.stem,
        "author": core.author or "",
        "requires_ocr": False,
    }


def extract_epub(path: Path) -> tuple[list[Unit], dict]:
    try:
        from bs4 import BeautifulSoup
        from ebooklib import ITEM_DOCUMENT, epub
    except ImportError as exc:
        raise RuntimeError(
            "Install ebooklib and beautifulsoup4: pip install -r requirements.txt"
        ) from exc

    book = epub.read_epub(str(path))
    units: list[Unit] = []

    for item in book.get_items_of_type(ITEM_DOCUMENT):
        soup = BeautifulSoup(item.get_content(), "html.parser")
        title_node = soup.find(["h1", "h2", "title"])
        label = clean_text(title_node.get_text(" ", strip=True)) if title_node else item.get_name()
        text = clean_text(soup.get_text("\n", strip=True))
        if text:
            units.append(Unit(label=label or item.get_name(), text=text))

    title_meta = book.get_metadata("DC", "title")
    author_meta = book.get_metadata("DC", "creator")
    return units, {
        "title": title_meta[0][0] if title_meta else path.stem,
        "author": author_meta[0][0] if author_meta else "",
        "requires_ocr": False,
    }


def extract_text(path: Path) -> tuple[list[Unit], dict]:
    text = clean_text(path.read_text(encoding="utf-8", errors="replace"))
    heading_pattern = re.compile(r"^(#{1,4})\s+(.+)$", re.MULTILINE)
    matches = list(heading_pattern.finditer(text))

    if not matches:
        units = [Unit(label=path.stem, text=text)]
    else:
        units = []
        if matches[0].start() > 0:
            preface = clean_text(text[: matches[0].start()])
            if preface:
                units.append(Unit(label="Preface", text=preface))
        for i, match in enumerate(matches):
            start = match.end()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            body = clean_text(text[start:end])
            label = clean_text(match.group(2))
            if body:
                units.append(Unit(label=label, text=body))

    return units, {"title": path.stem, "author": "", "requires_ocr": False}


def chunk_units(units: Iterable[Unit], max_chars: int) -> list[dict]:
    chunks: list[dict] = []
    buffer: list[str] = []
    labels: list[str] = []
    start_page: int | None = None
    end_page: int | None = None
    current_chars = 0

    def flush() -> None:
        nonlocal buffer, labels, start_page, end_page, current_chars
        if not buffer:
            return
        chunks.append(
            {
                "label": " / ".join(dict.fromkeys(labels))[:240],
                "text": clean_text("\n\n".join(buffer)),
                "start_page": start_page,
                "end_page": end_page,
            }
        )
        buffer = []
        labels = []
        start_page = None
        end_page = None
        current_chars = 0

    for unit in units:
        text = unit.text
        if not text:
            continue

        parts = [text[i : i + max_chars] for i in range(0, len(text), max_chars)]
        for part_index, part in enumerate(parts, start=1):
            part_label = unit.label if len(parts) == 1 else f"{unit.label} (part {part_index})"
            addition = len(part) + 2

            if buffer and current_chars + addition > max_chars:
                flush()

            buffer.append(f"## SOURCE UNIT: {part_label}\n\n{part}")
            labels.append(part_label)
            current_chars += addition

            if unit.start_page is not None:
                start_page = unit.start_page if start_page is None else min(start_page, unit.start_page)
                end_page = unit.end_page if end_page is None else max(end_page, unit.end_page or unit.start_page)

    flush()
    return chunks


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--max-chars", type=int, default=24000)
    args = parser.parse_args()

    source = args.input.expanduser().resolve()
    output = args.output.expanduser().resolve()

    if not source.exists() or not source.is_file():
        print(f"Input file not found: {source}", file=sys.stderr)
        return 2

    suffix = source.suffix.lower()
    try:
        if suffix == ".pdf":
            units, metadata = extract_pdf(source)
        elif suffix == ".epub":
            units, metadata = extract_epub(source)
        elif suffix == ".docx":
            units, metadata = extract_docx(source)
        elif suffix in {".txt", ".md", ".markdown"}:
            units, metadata = extract_text(source)
        else:
            print(f"Unsupported file type: {suffix}", file=sys.stderr)
            return 3
    except Exception as exc:
        print(f"Extraction failed: {exc}", file=sys.stderr)
        return 4

    output.mkdir(parents=True, exist_ok=True)
    chunks_dir = output / "chunks"
    chunks_dir.mkdir(exist_ok=True)

    chunks = chunk_units(units, max_chars=max(4000, args.max_chars))
    chunk_records: list[dict] = []

    for index, chunk in enumerate(chunks, start=1):
        filename = f"{index:04d}.md"
        path = chunks_dir / filename
        path.write_text(chunk.pop("text"), encoding="utf-8")
        chunk_records.append({"index": index, "file": f"chunks/{filename}", **chunk})

    manifest = {
        "source_file": source.name,
        "source_path": str(source),
        "format": suffix.lstrip("."),
        "title": metadata.get("title") or source.stem,
        "author": metadata.get("author") or "",
        "requires_ocr": bool(metadata.get("requires_ocr", False)),
        "page_count": metadata.get("page_count"),
        "extraction_metrics": {
            key: value
            for key, value in metadata.items()
            if key not in {"title", "author", "requires_ocr", "page_count"}
        },
        "chunk_count": len(chunk_records),
        "chunks": chunk_records,
    }

    (output / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(json.dumps(manifest, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
