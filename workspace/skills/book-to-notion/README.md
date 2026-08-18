# Book to Notion — OpenClaw one-time workflow

This starter package installs a custom OpenClaw skill that turns an attached book into a detailed Notion page.

## Why this is a one-time task

A book is supplied at an unpredictable time and each upload needs one independent processing run. A cron job would wake on a schedule even when no book exists. Use cron only if you later decide to poll a specific folder, inbox, or database queue.

## What the workflow produces

The generated Notion page can include:

- Multi-level headings
- Numbered explanations
- Nested bullet and numbered lists
- Callouts
- Toggles
- Tables
- A table of contents
- Definitions and glossary
- Chapter/page references
- Final synthesis and review questions

## 1. Install the skill

Copy the folder into your OpenClaw workspace:

```bash
mkdir -p ~/.openclaw/workspace/skills
cp -R book-to-notion-openclaw ~/.openclaw/workspace/skills/book-to-notion
```

## 2. Install extraction dependencies

```bash
cd ~/.openclaw/workspace/skills/book-to-notion
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Node.js 20 or newer is recommended because the publishing script uses the built-in `fetch` API.

## 3. Create a Notion connection

Create a Notion internal integration or personal access token, grant it permission to insert content, and share the destination parent page with that connection.

Set one Notion-capable credential for the OpenClaw Gateway process. On this
server, prefer the existing Maton OAuth credential:

```bash
export MATON_API_KEY="..."
```

Direct Notion tokens are also supported as a fallback:

```bash
export NOTION_API_KEY="ntn_..."
```

Do not paste tokens into chat messages or commit them to a repository.

The publishing script also accepts `NOTION_API_TOKEN` as an alias for
`NOTION_API_KEY`. By default it searches Notion for an exact page titled `Books`
and creates the generated book-note page under it. If needed, you can override
this with `NOTION_PARENT_PAGE_ID`, `NOTION_BOOKS_PAGE_TITLE`,
`MATON_NOTION_CONNECTION_ID`, or a parent page ID as the second CLI argument.

You may instead inject the variables through `skills.entries.book-to-notion.env` in OpenClaw configuration. Skill-level environment injection applies to host runs; sandboxed runs need separate secret injection.

## 4. Ensure the tools are available

The skill needs:

- `exec`
- `pdf` for scanned/image-heavy PDFs
- A PDF-capable model when the `pdf` tool is required

Merge the relevant parts of `openclaw.config.example.json5` into your existing OpenClaw configuration. Do not replace the whole file blindly.

Restart the gateway or begin a new session:

```bash
openclaw gateway restart
openclaw skills list
```

## 5. Use it

Attach a book and send a message such as:

```text
Use book-to-notion. Make detailed Notion notes from this attached book.
Preserve the chapter hierarchy, explain every important concept, add numbered
steps, nested lists, useful comparison tables, key-point callouts, a glossary,
and review questions. Include page references when available.
```

You can also invoke the skill explicitly:

```text
/skill book-to-notion
```

## Suggested user message options

### Full study notes

```text
Make detailed Notion study notes from the attached book. Cover the full book,
use multi-level headings, numbered explanations, nested lists, callouts,
comparison tables, definitions, a glossary, and revision questions.
```

### Chapter-focused notes

```text
Make detailed Notion notes for Chapters 3–7 only. Emphasize concepts,
examples, arguments, and any formulas. Include page references.
```

### Exam revision

```text
Turn the attached book into exam-revision notes in Notion. Prioritize key
definitions, likely questions, common confusions, comparison tables, and
chapter summaries.
```

## Supported formats

- PDF
- EPUB
- DOCX
- TXT
- Markdown

Normal text PDFs are extracted locally. Scanned/image-only PDFs are flagged so OpenClaw can use its PDF vision path.

## Files in this package

- `SKILL.md` — OpenClaw agent workflow
- `scripts/extract_book.py` — extraction and chunking
- `scripts/validate_notion_markdown.py` — structural checks
- `scripts/publish_notion.mjs` — Notion publishing and async polling
- `templates/notion-note-spec.md` — final page structure
- `openclaw.config.example.json5` — configuration fragment
