Notion Block Rendering

Use this reference before writing vocabulary entries with Maton.

The templates in `vocabulary-entry-rules.md` define field order and entry
content only. They are not literal Markdown to paste into Notion.

Build raw Notion block JSON for:

```bash
maton notion block append <category-page-id> --children '<blocks-json>'
```

Formatting must be represented with Notion rich text annotations, not Markdown
characters inside `text.content`.

Block shape:

- Entry title: one `heading_2` block with the vocabulary word or phrase in
  `heading_2.rich_text[0].text.content`. Apply bold with
  `heading_2.rich_text[0].annotations.bold: true` if bold display is desired.
- Type row: one `paragraph` block. Put the label `Type:` in a rich_text span
  with `annotations.bold: true`, followed by a plain rich_text span containing
  the type value.
- Numbered fields: use `numbered_list_item` blocks for Pronunciation, Meanings,
  Register, Topics, Word Family, Collocations, Common Patterns, Examples,
  Synonyms, Antonyms, Commonly Confused With, Usage Notes, My Note, and the
  social/internet-only fields. Put each field label in a bold rich_text span and
  the field value in plain rich_text spans.
- Nested numbered details such as `Primary` and `Secondary`: use child
  `numbered_list_item` blocks, with the nested label in a bold rich_text span.
- Bullet details such as topics, collocations, word-family items, situations,
  and note rows: use `bulleted_list_item` child blocks. Bold only the label span
  when a row has a label, such as `Where I found it:`.
- Multi-part sections such as Social Meaning & Context and Usage Guidance: use
  one parent `numbered_list_item` for the section, then child paragraph or
  bulleted blocks for labelled subfields.

Pre-write gate:

Before every append/update, inspect the final JSON string and reject the write
if any Notion `text.content` value contains Markdown formatting markers used
only for presentation:

- `**`
- `***`
- leading `##`
- leading `- `, `* `, or numbered Markdown list syntax

This check does not forbid those characters when they are genuinely part of the
vocabulary expression, source text, or example sentence. If a marker appears
only to request formatting, convert it to block type or rich_text annotations
before writing.

Minimal valid pattern:

```json
[
  {
    "object": "block",
    "type": "heading_2",
    "heading_2": {
      "rich_text": [
        {
          "type": "text",
          "text": { "content": "ankle" },
          "annotations": { "bold": true }
        }
      ]
    }
  },
  {
    "object": "block",
    "type": "paragraph",
    "paragraph": {
      "rich_text": [
        {
          "type": "text",
          "text": { "content": "Type:" },
          "annotations": { "bold": true }
        },
        { "type": "text", "text": { "content": " noun" } }
      ]
    }
  },
  {
    "object": "block",
    "type": "numbered_list_item",
    "numbered_list_item": {
      "rich_text": [
        {
          "type": "text",
          "text": { "content": "Pronunciation:" },
          "annotations": { "bold": true }
        },
        { "type": "text", "text": { "content": " /ˈæŋ.kəl/" } }
      ]
    }
  }
]
```
