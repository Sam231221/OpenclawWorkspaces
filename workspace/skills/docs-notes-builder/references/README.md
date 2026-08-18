# OpenClaw Documentation Notes Builder

This package provides a reusable OpenClaw skill that turns a documentation URL into a nested, learning-first Markdown knowledge base.

## Why this is a one-time task

The workflow starts only when you send a URL. It therefore should be message-triggered, not scheduled. Add a cron job only when you want existing notes refreshed automatically.

## Install

Copy the skill folder into your OpenClaw workspace:

```bash
mkdir -p ~/.openclaw/workspace/skills/docs-notes-builder
cp SKILL.md ~/.openclaw/workspace/skills/docs-notes-builder/SKILL.md
```

OpenClaw normally watches skill files. To verify:

```bash
openclaw skills list
```

Start a fresh session if the current session does not see the skill.

## Recommended tool setup

Configure web retrieval:

```bash
openclaw configure --section web
```

For JavaScript-heavy documentation, enable the managed browser and allow it for the agent.

## Use

Natural-language trigger:

```text
Make detailed notes from https://react.dev/learn
```

Explicit trigger:

```text
/skill docs-notes-builder Make detailed notes from https://react.dev/learn
```

More controlled request:

```text
/skill docs-notes-builder
Create detailed beginner-friendly notes from https://react.dev/learn.
Scope: only the Learn section.
Maximum source pages: 35.
Output: docs-notes/react-learn.
Include Mermaid diagrams, exercises, glossary, FAQs, and source links.
```

## Default output

```text
docs-notes/<site-slug>/
├── index.md
├── getting-started/
│   └── index.md
├── fundamentals/
│   ├── index.md
│   └── ...
├── advanced/
│   └── ...
├── glossary.md
├── faq.md
├── practice.md
├── mkdocs.yml
└── _meta/
    ├── crawl-manifest.json
    ├── plan.json
    └── quality-report.md
```

## Preview

Install MkDocs separately if needed, then run:

```bash
mkdocs serve -f docs-notes/<site-slug>/mkdocs.yml
```

## Optional refresh cron

Do not add this for the initial workflow. Use it only after a notes set exists and you want periodic updates.

Example shape:

```bash
openclaw cron add \
  --name "Refresh React learning notes" \
  --cron "0 6 * * 1" \
  --tz "Europe/London" \
  --session session:docs-react-learn \
  --message "Use the docs-notes-builder skill in update mode for https://react.dev/learn. Update only changed pages, preserve user edits, and report differences." \
  --announce
```

Review the exact delivery/channel flags for your installation before enabling an unattended run.

## Important behavior

The generated guide should synthesize and teach. It should not clone the original documentation or copy long passages. Every page keeps source links and retrieval metadata for verification.
