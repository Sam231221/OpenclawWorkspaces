# Maton Notion Reference

## Connection

Use `/home/sam/.npm-global/bin/maton` if `maton` is not on PATH.

```bash
maton connection list notion --status ACTIVE
maton api -X GET /connections -f app=notion -f status=ACTIVE
maton notion whoami
```

If more than one active Notion connection exists, pass the selected connection explicitly:

```bash
maton notion page view PAGE_ID --connection CONNECTION_ID
maton api '/notion/v1/pages/PAGE_ID' --connection CONNECTION_ID
```

## Search

```bash
maton notion search 'meeting notes' --filter page
maton notion search --filter data_source
```

Raw shape:

```http
POST /notion/v1/search
Notion-Version: 2025-09-03
Content-Type: application/json

{"query":"meeting notes","filter":{"property":"object","value":"page"}}
```

## Pages

```bash
maton notion page view PAGE_ID
maton notion page create --parent-page PARENT_PAGE_ID --title 'Child Page'
maton notion page create --data-source DATA_SOURCE_ID --title 'New Page' --properties '{"Status":{"select":{"name":"Active"}}}'
maton notion page update PAGE_ID --properties '{"Status":{"select":{"name":"Done"}}}'
maton notion page archive PAGE_ID
```

Raw create child page:

```json
{
  "parent": {"page_id": "PARENT_PAGE_ID"},
  "properties": {
    "title": {"title": [{"text": {"content": "Child Page"}}]}
  }
}
```

Raw create data-source page:

```json
{
  "parent": {"data_source_id": "DATA_SOURCE_ID"},
  "properties": {
    "Name": {"title": [{"text": {"content": "New Page"}}]},
    "Status": {"select": {"name": "Active"}}
  }
}
```

## Blocks

```bash
maton notion block children BLOCK_OR_PAGE_ID
maton notion block append BLOCK_OR_PAGE_ID --children '[{"object":"block","type":"paragraph","paragraph":{"rich_text":[{"type":"text","text":{"content":"New paragraph"}}]}}]'
maton notion block delete BLOCK_ID
```

Common block types: `paragraph`, `heading_1`, `heading_2`, `heading_3`, `bulleted_list_item`, `numbered_list_item`, `to_do`, `code`, `quote`, `divider`.

## Databases And Data Sources

Use database endpoints for database creation and data-source discovery. Use data-source endpoints for schema and data.

```bash
maton notion database view DATABASE_ID
maton notion database create --parent-page PARENT_PAGE_ID --title 'New Database'
maton notion data-source view DATA_SOURCE_ID
maton notion data-source query DATA_SOURCE_ID --page-size 100
maton notion data-source update DATA_SOURCE_ID --body '{"properties":{"NewColumn":{"rich_text":{}}}}'
```

Migration reminders for `Notion-Version: 2025-09-03`:

- Old `POST /databases/{id}/query` becomes `POST /data_sources/{id}/query`.
- Old schema reads from `GET /databases/{id}` become `GET /data_sources/{id}`.
- Old schema updates from `PATCH /databases/{id}` become `PATCH /data_sources/{id}`.
- Page parents use `data_source_id` for structured collection pages.

## Raw HTTP

```bash
maton api -X POST /notion/v1/data_sources/DATA_SOURCE_ID/query \
  -H 'Notion-Version: 2025-09-03' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Python fallback:

```python
import json
import os
import urllib.request

data = json.dumps({}).encode()
req = urllib.request.Request(
    "https://api.maton.ai/notion/v1/data_sources/DATA_SOURCE_ID/query",
    data=data,
    method="POST",
)
req.add_header("Authorization", f"Bearer {os.environ['MATON_API_KEY']}")
req.add_header("Content-Type", "application/json")
req.add_header("Notion-Version", "2025-09-03")
print(json.dumps(json.load(urllib.request.urlopen(req)), indent=2))
```
