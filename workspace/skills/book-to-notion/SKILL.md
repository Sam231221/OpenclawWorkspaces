---
name: "book-to-notion"
description: "Convert an attached PDF, EPUB, DOCX, TXT, or Markdown book into detailed, structured Notion notes."
metadata:
  openclaw:
    requires:
      bins: ["python3", "node"]
---

# Book to Notion

Use this skill when the user attaches a book or long document and asks for detailed notes in Notion.

This is a **one-time, message-triggered task**. Do not create a cron schedule unless the user explicitly asks to monitor a folder, inbox, or queue for future books.

## Accepted input

- PDF (`.pdf`)
- EPUB (`.epub`)
- Word (`.docx`)
- Plain text (`.txt`)
- Markdown (`.md`)

Use the attachment from the current message. Inbound files are normally staged by OpenClaw under `media/inbound/`.

## Required result

Create one polished Notion page containing:

1. A clear page title.
2. A source-information callout.
3. A table of contents.
4. A book overview.
5. Multi-level chapter and section headings.
6. Detailed numbered explanations.
7. Nested bullet and numbered lists.
8. Tables for comparisons, frameworks, timelines, formulas, or classifications.
9. Callouts for key ideas, warnings, definitions, and exam-worthy points.
10. Toggles for supporting detail when sections are long.
11. A glossary or key-terms section.
12. A final synthesis and review questions.
13. Page or chapter references wherever the source allows them.

Do not invent facts. When text is unreadable or uncertain, mark it as unclear rather than guessing.

## Workflow

### 1. Resolve the attachment

Find exactly one supported attachment from the current turn.

If several supported files are attached, use the one named by the user. If the user did not specify one, process the largest book-like file and mention which file was selected.

Create a run directory:

```bash
mkdir -p workspace/book-notes
```

Use a stable subdirectory based on the filename and current timestamp.

### 2. Extract and chunk

Run:

```bash
PYTHON="{baseDir}/.venv/bin/python"
[ -x "$PYTHON" ] || PYTHON=python3

"$PYTHON" "{baseDir}/scripts/extract_book.py" \
  "<ATTACHMENT_PATH>" \
  --output "<RUN_DIRECTORY>/source"
```

Read `<RUN_DIRECTORY>/source/manifest.json`.

For normal text PDFs and other supported formats, use the generated chunk files.

For a scanned or image-heavy PDF, the manifest may report `requires_ocr: true`. In that case, use OpenClaw's `pdf` tool with a PDF-capable vision model. Process the source in page ranges of roughly 10–20 pages when page filtering is supported. Preserve page-range labels in every intermediate note.

### 3. Build a chapter map first

Before writing full notes, inspect all chunk headings and produce:

```json
{
  "title": "...",
  "author": "...",
  "source_file": "...",
  "sections": [
    {
      "id": "01",
      "title": "...",
      "source_ranges": ["pages 1-18"],
      "main_topics": ["...", "..."]
    }
  ]
}
```

Save it as `<RUN_DIRECTORY>/chapter-map.json`.

Do not start final prose until the map covers the entire source.

### 4. Create section notes

Create `<RUN_DIRECTORY>/partials/`.

For each section, write one enhanced-Markdown file named in source order, for example:

```text
partials/001-introduction.md
partials/002-chapter-1.md
```

Each partial should contain:

- `##` for a chapter or major part.
- `###` and `####` for subtopics.
- Numbered explanations for sequences or arguments.
- Nested lists using tabs for child blocks.
- At least one callout when the section contains a central insight.
- Tables only when a table improves understanding.
- Definitions in bold.
- Source references such as `(p. 42)` or `(Chapter 3)`.

Keep the notes detailed but compressed: explain the book rather than copying it.

### 5. Assemble the final Notion-flavoured Markdown

Use `{baseDir}/templates/notion-note-spec.md` as the structural contract.

Write the final page to:

```text
<RUN_DIRECTORY>/final-notion.md
```

Notion enhanced Markdown rules that matter:

- Use tabs, not spaces, for nested child blocks.
- Headings support levels 1–4.
- Use `<callout>...</callout>` for callouts.
- Use `<details><summary>...</summary>...</details>` for toggles.
- Use `<table>`, `<tr>`, and `<td>` for tables.
- Use `<table_of_contents/>` for the table of contents.
- Escape literal Notion-Markdown special characters when necessary.

### 6. Validate before publishing

Run:

```bash
PYTHON="{baseDir}/.venv/bin/python"
[ -x "$PYTHON" ] || PYTHON=python3

"$PYTHON" "{baseDir}/scripts/validate_notion_markdown.py" \
  "<RUN_DIRECTORY>/final-notion.md"
```

Fix all errors. Warnings may be accepted only when they are appropriate for the source.

### 7. Publish to Notion

The user's request to create the notes in Notion is authorization to publish the new page.

Run:

```bash
node "{baseDir}/scripts/publish_notion.mjs" \
  "<RUN_DIRECTORY>/final-notion.md" \
  "<OPTIONAL_PARENT_PAGE_ID>"
```

The script uses:

- `MATON_API_KEY` when available, matching this server's Maton Notion OAuth configuration
- Fallback direct tokens: `NOTION_API_KEY`, or the server-compatible alias `NOTION_API_TOKEN`
- The exact Notion page titled `Books` as the default parent
- Optional override: `NOTION_PARENT_PAGE_ID`, or a parent page ID supplied as the second CLI argument
- Optional title/connection overrides: `NOTION_BOOKS_PAGE_TITLE`, `MATON_NOTION_CONNECTION_ID`
- Notion API version `2026-03-11`

For large pages it requests asynchronous creation and polls until completion.

### 8. Report completion

Reply with:

- The selected source filename.
- The Notion page URL.
- A short summary of the structure created.
- Any extraction limitations, such as unreadable scanned pages.

Do not include secrets, internal paths, or raw API responses in the reply.
