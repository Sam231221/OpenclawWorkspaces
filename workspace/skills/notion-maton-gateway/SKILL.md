---
name: notion-maton-gateway
description: "Use Maton Notion OAuth for Notion pages, blocks, databases, and data sources."
compatibility: Requires network access, Maton CLI or MATON_API_KEY, and an active Notion connection.
metadata:
  author: Saara
  source: Maton API Gateway Notion reference
---

# Notion Maton Gateway

Use for Notion work in Mr. Sam's workspace. Prefer this Maton-backed Notion path over the official `ntn` CLI because the direct `ntn` integration has failed when pages were not shared with it.

## Workflow

1. Confirm the target workspace, page, database, or data source from the request or current context.
2. Start read-only: list connections, `whoami`, search, page view, block children, database view, or data-source view.
3. For writes, verify the exact target ID, endpoint, body, and expected result before executing.
4. Use `--connection <connection_id>` when multiple Notion connections exist or a known connection is required.
5. Prefer page and block operations for normal notes. Use database/data-source operations only for structured data.
6. Verify creates and updates with a read call before reporting success.

If `maton` is not on PATH, use `/home/sam/.npm-global/bin/maton`.

## Commands

```bash
maton connection list notion --status ACTIVE
maton notion whoami
maton notion search 'query' --filter page
maton notion page view PAGE_ID
maton notion block children PAGE_OR_BLOCK_ID
maton notion page create --parent-page PARENT_PAGE_ID --title 'Title'
maton notion page update PAGE_ID --properties '{"Status":{"select":{"name":"Done"}}}'
maton notion block append PAGE_OR_BLOCK_ID --children '[{"object":"block","type":"paragraph","paragraph":{"rich_text":[{"type":"text","text":{"content":"Text"}}]}}]'
```

## API Notes

- Use `Notion-Version: 2025-09-03` for raw API calls through Maton.
- Route raw calls through `https://api.maton.ai/notion/v1/...`.
- In the 2025-09-03 API, databases and data sources are separate. Use `GET /notion/v1/databases/{databaseId}` to discover data source IDs, then use `/notion/v1/data_sources/{dataSourceId}` for schema and query operations.
- For pages inside structured collections, create under `parent.data_source_id`, not `database_id`.

## Safety

Treat `MATON_API_KEY` as secret. Never print, log, paste, or store it. Do not create, delete, or broaden connections without explicit approval. Do not use the official `ntn` CLI for Mr. Sam's Notion writes unless he explicitly asks for that fallback.

## Reference

See `references/notion.md` for endpoint shapes and examples.
