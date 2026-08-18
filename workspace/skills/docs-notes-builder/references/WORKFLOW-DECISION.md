# Workflow decision

## Selected design

**Message-triggered one-time skill run**

This matches the request because a different URL is supplied interactively each time. A cron schedule would run without a new URL and is therefore the wrong primary trigger.

## Components

1. Incoming chat message
2. `docs-notes-builder` skill
3. URL discovery and guarded crawl
4. Learning-oriented plan
5. Multi-page generation
6. Quality review
7. Local Markdown/MkDocs output

## When cron becomes useful

Add a recurring cron job only for an existing notes collection that should be checked for source changes, such as every Monday. The refresh run should compare content hashes and update only affected pages.

## When a plugin-backed Task Flow becomes useful

Use a managed Task Flow plugin when you need stronger durability, retries, approvals, progress dashboards, or very large crawls. For a personal workflow and normal documentation sections, the skill-first design is simpler to install and maintain.
