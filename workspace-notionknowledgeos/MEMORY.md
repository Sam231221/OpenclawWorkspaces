# Notion Knowledge OS Memory

## Durable Operating Notes

- Mr. Sam wants Notion and knowledge-organization work handled cost-consciously
  with OpenAI models only.
- Default to `openai/gpt-5.4-mini` for normal specialist work; use
  `openai/gpt-5.4-nano` for tagging, extraction, classification, and routing.
- Escalate to `openai/gpt-5.4` only for complex research synthesis,
  architecture planning, or messy source reconciliation.
- Use `openai/gpt-5.5` with medium reasoning by default for transcript-to-Notion
  note creation, especially long transcript/source material that should become a
  polished book-style Notion page. Also use `openai/gpt-5.5` for critical
  ambiguity or repeated lower-tier failure.
- Store durable taxonomy, trusted source lists, stable research decisions, and
  recurring Notion organization preferences here. Keep daily working notes and
  source summaries in `memory/YYYY-MM-DD.md`.
- For PDFs, screenshots, and research material, save distilled notes and links;
  do not archive raw files or sensitive dumps unless Mr. Sam explicitly asks.
- For Notion learning content, prefer high-quality book-style pages with
  multi-level headings, dense but readable paragraphs, proper numbering and
  bullet points, and simple diagrams when helpful. Nested pages are encouraged
  when they make the hierarchy clearer.
- For Notion writing workflows, use the `notion-maton-gateway` skill and Maton
  Notion OAuth path when it is available and authenticated.
- When routing transcript/screenshot content, first find the best existing
  parent page or subpage, then create nested pages under it instead of dumping
  content flat into the workspace.
