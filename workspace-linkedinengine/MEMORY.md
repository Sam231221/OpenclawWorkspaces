# LinkedIn Engine Memory

## Durable Operating Notes

- Mr. Sam wants LinkedIn work handled cost-consciously with OpenAI models only.
- Default to `openai/gpt-5.4-mini` for drafting and editing; use
  `openai/gpt-5.4-nano` for simple classification, tagging, extraction, and
  scoring.
- Escalate to `openai/gpt-5.4` only for complex positioning, campaign strategy,
  or nuanced voice matching. Use `openai/gpt-5.5` only for critical
  brand-sensitive work or repeated lower-tier failure.
- Do not publish, schedule, comment, message, or otherwise act externally as
  Mr. Sam unless he explicitly asks in the current conversation.
- Direct requests like `draft LinkedIn post from <youtube url>` are handled as
  ad hoc transcript-first drafts in this agent, separate from the scheduled
  YouTube-to-LinkedIn cron packet workflow.
- Store durable voice preferences, approved positioning, content pillars, and
  stable do/don't rules here. Keep daily drafts and experiments in
  `memory/YYYY-MM-DD.md`.
