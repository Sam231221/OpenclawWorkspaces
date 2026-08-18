---
name: "save-vocabulary-screenshots-to-notion"
description: "Save English vocabulary from screenshots into Notion safely."
---
Use this skill when Mr. Sam wants English vocabulary captured from an uploaded screenshot/image or typed provided words to be saved into Notion inside Vocabulary page.

The main goal is not to standardise the visual structure of every Vocabulary page. Existing category pages may use different headings, sections, images, or layouts. The priority is to make the explanation for each individual vocabulary word or phrase complete, accurate, learner-friendly, and consistent with the correct entry format.

The task is to:

Extract the intended English vocabulary items.

Determine whether each word item needs the General Vocabulary format or the Social / Slang / Internet Language format.

Build and validate the complete entry in British English.

Choose the best semantic category under the Notion Vocabulary root.

Create or update the entry safely without creating duplicates or unnecessary word pages.

For Notion operations, prefer the local notion-maton-gateway skill and Maton Notion OAuth. Do not use unofficial Notion fallbacks unless Mr. Sam explicitly asks.

Telegram Saara Bot Chat

When this skill is triggered from Telegram direct chat, including the Saara bot
chat, handle it in Saara rather than delegating to notionknowledgeos. Inspect
the uploaded image, extract vocabulary, then use the Maton notion connection
through the local notion-maton-gateway skill for Notion reads and writes.

If no image is attached or the screenshot is unreadable, ask Mr. Sam for a
clearer screenshot or typed words. Never claim a Notion save succeeded unless
Maton confirms the create or update.

Return the completion report to the same Telegram source chat. If a tool run or
internal workflow shows the result only inside OpenClaw, send a normal
human-readable message back to the active Telegram conversation with the saved
items and any review items.

Entry Format Routing

Every vocabulary item must use one of two explanation formats.

A. General Vocabulary Format

Use the General Vocabulary format from
references/vocabulary-entry-rules.md for ordinary vocabulary stored in
semantic category pages such as:

Human Body

House

Day and Time

Films

Education

Emotions

Food

Road

Buildings

Environment

Technology

Law

other general vocabulary categories

The General Vocabulary format is based on [Word](1).md and includes:

Type

Pronunciation

Meanings

Register

Topics

Word Family

Collocations

Common Patterns

Examples

Synonyms

Antonyms

Commonly Confused With

Usage Notes

My Note

B. Social / Slang / Internet Language Format

Use the Social / Slang / Internet Language format from
references/vocabulary-entry-rules.md when the target is mainly understood
through social context, tone, implied meaning, internet culture, or informal
interaction.

Typical targets include:

internet slang

meme expressions

reaction phrases

comment-section language

streamer/gaming/community expressions

insults or rude expressions

dating/social-interaction language

internet-culture terms

expressions whose meaning changes heavily according to tone or context

This format is based on [Word - Phrase].md and includes the general linguistic
information plus:

Tone

Intensity

Social Meaning & Context

When People Use It

Usage Guidance

Opposite Ideas / Antonyms

Related Internet / Social Expressions

My Observation

Routing Rules

Route by the sense shown in the screenshot, not only by the dictionary headword.

If an ordinary word is being used in a clearly slang/internet sense, use the Social / Slang / Internet format for that entry.

If an expression is mostly useful because of online/social implication, use the Social / Slang / Internet format even if its individual words are ordinary English.

Do not create both a general and social entry automatically for the same target.

If the screenshot clearly presents two distinct senses that belong in different contexts, choose the sense being taught. Ask for clarification only if the intended sense cannot be determined safely.

Do not force social-only fields onto ordinary concrete vocabulary.

Do not reduce slang/internet entries to dictionary definitions; tone and social context are part of the meaning.

Notion Write Shape

The Vocabulary root contains category pages. Vocabulary words are not Notion
pages.

Create or reuse category pages under the Vocabulary root, such as Human
Body, House, Road, Emotions, Films, Technology, or
Social & Internet Language.

Within the selected category page, create or update one vocabulary entry as a
Notion `heading_2` block followed by Notion child blocks. Do not send Markdown
as entry content.

Do not create a child page for a vocabulary word, expression, phrasal verb,
idiom, or grammatical type.

Do not create category pages named for grammatical types such as Verb,
Verbs, Noun, Adjective, or Phrasal Verbs unless Mr. Sam explicitly
asks for that schema change.

Put grammar in the Type field and topics in the Topics field. A word such
as run may have verb in Type, but it still belongs in the best semantic
category, not on a Verbs page.

If an accidental word page or grammar-type page already exists, do not add to
it by default. Report it under Needs review and ask before moving, merging,
deleting, or restructuring anything.

Do not rewrite a whole category page merely to make its visual layout match
another page. Improve the vocabulary entry itself and preserve unrelated page
structure.

Notion Rendering Contract

The templates in `references/vocabulary-entry-rules.md` define semantic field
order only. They are not literal Markdown to paste into Notion.

Before building or writing an entry, load
`references/notion-block-rendering.md` and convert the selected template into
raw Notion block JSON. Use block types for headings/lists and
`rich_text.annotations.bold` for label formatting. Do not put presentation-only
markers such as `**`, `***`, `##`, or Markdown list prefixes into Notion
`text.content` values.

Core Rules

Prioritise correctness over filling every recommended count.

Never guess unreadable words or unsupported linguistic details.

Never fabricate IPA, meanings, word families, collocations, patterns,
synonyms, antonyms, usage warnings, social implications, or source context.

Never create duplicates knowingly.

Never create a Notion page for an individual vocabulary word.

Never create Verb/Verbs/part-of-speech pages as categories unless Mr. Sam
explicitly approves a schema change.

Never overwrite useful existing notes.

Preserve manually written learning notes, observations, examples, links, and
images unless Mr. Sam explicitly approves their removal.

Never rename, merge, move, delete, or change the workspace/category schema
without explicit approval.

Never claim a Notion write succeeded unless the Notion tool confirms it.

Use clear British English by default.

Treat the two entry formats as maximum useful-information templates, not
permission to invent filler. If a field has no valid content, use the
explicit no-direct-equivalent wording defined in the rules or mark it for
review.

Expanding an incomplete vocabulary entry into the correct selected template
is a normal safe operation when all useful existing information is preserved.
This does not require approval merely because the entry becomes longer.

If expansion would delete, contradict, or substantially rewrite a useful
existing personal note or disputed definition, request approval.

Approval Required

Ask for explicit approval before any of these actions:

Renaming an existing category.

Merging category pages.

Moving a vocabulary entry between categories.

Deleting any page, block, field, entry, personal note, image, or useful example.

Replacing substantial existing content when it cannot be safely preserved.

Resolving category naming conflicts by editing existing pages.

Changing the established Vocabulary category/page schema.

Converting the whole workspace to a new visual page layout.

Use this format when approval is needed:

### Approval required

**Issue:** [Brief description]

**Found:**

* `[Existing category or entry 1]`
* `[Existing category or entry 2]`

**Recommendation:** `[Proposed canonical name or action]`

**Reason:** [Concise explanation]

**Proposed change:** [Exact rename, merge, move, or replacement]

No restricted change has been made.

Process unrelated safe entries before requesting approval unless the issue prevents correct categorisation.

Workflow

1. Validate The Image

Confirm an image/screenshot is available and readable. If missing, unreadable, severely cropped, or too blurry, do not guess and do not modify Notion. Ask Mr. Sam to upload a clearer screenshot or type the words.

2. Extract Candidate Vocabulary

Inspect the screenshot and identify intended vocabulary words or expressions.

Preserve clearly visible spelling.

Correct an obvious spelling error only when the intended word is unambiguous.

Preserve phrasal verbs, idioms, slang phrases, meme expressions, and fixed expressions as complete entries.

Ignore interface labels, page headings, timestamps, usernames, and unrelated text.

Do not treat example-sentence words as separate targets unless the screenshot clearly presents them as target vocabulary.

Assign confidence:

High: clearly visible and unambiguous. Process automatically.

Medium: likely but partly unclear. Ask confirmation before writing.

Low: uncertain spelling or unclear target. Ask confirmation before writing.

3. Determine Entry Format

For each extracted target, decide the entry mode before researching/building it.

general -> General Vocabulary Format

social_internet -> Social / Slang / Internet Language Format

Use the routing rules above.

Record the chosen mode in the internal operation plan. Do not mix field orders from the two formats.

4. Normalise For Matching

Create an internal comparison key by trimming whitespace, collapsing repeated spaces, lowercasing for comparison only, normalising straight/curly apostrophes, and removing accidental trailing punctuation. Preserve meaningful hyphens and grammatically required display capitalisation.

Examples:

Urbanization. -> urbanization

Look after -> look after

self-aware -> self-aware

Bro got humbled! -> bro got humbled

Do not change displayed spelling merely to match an existing entry.

5. Inspect Notion Vocabulary Structure

Locate the configured root Vocabulary page and inspect only relevant Vocabulary areas:

Existing category pages.

Relevant subcategories, if present.

Existing vocabulary headings or records.

Content of possible duplicate entries.

Accidental child pages named after individual words or grammatical types, so
they can be reported instead of reused silently.

For social/slang/internet targets, inspect Social & Internet Language first
unless the workspace clearly uses another established page for the same type of
language.

If the root cannot be found or access is denied, stop before writing and report the exact issue.

6. Detect Category Naming Issues

Compare category names with case-insensitive matching, singular/plural variants, hyphen/spacing differences, common abbreviations, and close equivalents. Examples: Human Body vs The Human Body, Road vs Roads, Technology vs Tech, Food & Drink vs Food and Drinks.

Do not assume similar categories should be merged. If a likely inconsistency appears, continue using the best existing category when unambiguous, inform Mr. Sam, recommend a canonical convention, and request approval before any rename or merge.

Preferred category naming: Title Case, short noun/noun phrase, no unnecessary articles, broad collective nouns, and consistent and/& usage following the workspace.

7. Select Category

Choose the category from the word's central real-world meaning and the sense
shown in the screenshot.

Priority:

Exact semantic category match.

Existing broader category.

Existing related category.

Social & Internet Language when the expression is primarily social/slang/internet language.

New concise semantic category.

Examples:

ankle -> Human Body -> general

cupboard -> House -> general

roundabout -> Road -> general

homesick -> Emotions -> general

algorithm -> Technology -> general

ragebait -> Social & Internet Language -> social_internet

bro got humbled -> Social & Internet Language -> social_internet

When senses vary, use the sense shown/implied by the screenshot; otherwise use the common general-English sense and add relevant domains under Topics. Do not create duplicate entries in several categories unless the Notion design explicitly requires it.

Create a new category only when no existing category is reasonably suitable, the proposed category is useful for future vocabulary, and it is not a duplicate or near-duplicate. A part of speech is not a semantic category for this workspace.

8. Detect Duplicates

Search the relevant category and, when practical, the whole Vocabulary hierarchy. Treat case differences, singular/plural headword variants, UK/US spelling variants, hyphenation differences, headings/database titles, and inconsistent spacing in phrases/phrasal verbs as possible duplicates.

Duplicate policy:

No existing entry: create a complete new entry using the correct format.

Existing short/simple definition: preserve the valid meaning and expand the
entry into the correct full format.

Same-format existing entry: preserve valid content, add missing useful
information, fix only clear spelling/grammar/punctuation/formatting issues,
and remove exact duplicate list items.

Existing entry uses the wrong format for its sense: preserve all valid
information and convert/expand the individual entry into the correct
format; do not reformat the whole category page.

Incomplete entry: add missing fields/items in the required order.

Conflicting information: do not silently overwrite; record the conflict and
ask approval when resolution would substantially alter useful content.

Existing entry in another category: do not create a second copy
automatically; report the found category, proposed category, and whether
current placement seems reasonable; ask approval before moving it.

9. Build And Validate Entry

Load references/vocabulary-entry-rules.md.

For every item:

Select general or social_internet.

Use the exact field order for that format.

Treat the reference structure as semantic field order. Convert it into Notion
blocks before writing; do not preserve Markdown heading, bold, bullet, or
numbered-list characters as literal text.

Preserve useful existing content.

Fill only linguistically valid information.

Validate every field against the selected format's rules.

Never add weak filler merely to reach a recommended count.

For general vocabulary, prioritise usable knowledge: meaning, natural
collocations, grammatical patterns, examples, distinctions, and usage notes.

For social/slang/internet language, a dictionary definition alone is
insufficient. Also explain tone, intensity, social situation, implication,
literal/figurative status, safe/unsafe usage contexts, and related expressions
when valid.

Before each write, prepare an internal operation plan:

Extracted word/phrase.

Confidence.

Entry mode: general or social_internet.

Selected category.

Existing-entry status.

Intended operation: create, expand, append, update, or request approval.

10. Write Safely To Notion

Before every write:

Recheck whether the entry already exists.

Recheck whether intended content already exists.

Avoid duplicate headings, fields, examples, or list items.

Avoid duplicate category pages.

Confirm the target is the selected category page, not a newly created word
page.

Confirm the entry uses the correct format for its mode.

Confirm the prepared content is valid Notion block JSON and contains no Markdown
formatting syntax in presentation-only positions. Labels such as `Type:`,
`Pronunciation:`, `Primary:`, and `Where I found it:` must be bold via
`rich_text.annotations.bold`, not surrounded by asterisks.

Use the normalised word and category path as an idempotency key when supported.

Preserve comments, links, images, manually written notes, observations, and unrelated content. Prefer block-level appends/updates over replacing pages. Place new entries consistently with the existing page style while preserving the required field order inside each vocabulary entry.

Use Notion page creation only for missing semantic category pages. For entries,
use block append/update operations on the category page. If the available Notion
tool only exposes page creation and cannot append blocks/content to an existing
category page, stop and report the blocker instead of creating word pages.
With Maton CLI, the normal entry write path is
`maton notion block append <category-page-id> --children '<blocks-json>'`; use
`--dry-run` first when validating a new block shape. The `<blocks-json>` value
must be a JSON array of Notion block objects, not Markdown.

For multiple words, treat each word as a separate operation. Continue after individual failures, record every status, retry only transient errors such as timeouts/rate limits with a small exponential backoff, and never report failed items as saved.

Completion Report

Return a concise report without repeating full entries unless requested. For
Telegram-triggered runs, this report must appear in the Telegram Saara bot chat,
not only in the OpenClaw/internal chat.

### Saved

* **[Word / Phrase]** — [Category]; [General or Social/Internet format]; [created/expanded/updated]; [Notion page/link if available]

### Needs review

* [Uncertain screenshot text, conflicting definition, duplicate, category ambiguity, naming issue, unsupported field, permission/API error]

### Suggested category changes

* [Recommendation only; state that no rename, merge, move, or deletion was performed without approval]

Omit empty sections if nothing belongs there, but always make clear what was saved and what still needs review.

Current Setup Notes

As of 2026-08-18:

Maton Notion OAuth is active for Sameer Shahi's Notion.

The Vocabulary root page is reachable at page ID
fd52fa87-f29d-8303-83fa-8169ea14008c.

The Vocabulary root contains general semantic category pages and a
Social & Internet Language page.

General vocabulary entries must use the General Vocabulary format derived
from [Word](1).md.

Social, slang, meme, reaction, insult, and internet-language entries must use
the Social / Slang / Internet Language format derived from
[Word - Phrase].md.

Telegram direct chat, including the Saara bot chat, is routed to this skill
directly in Saara.

Entries must be saved as headings/blocks inside category pages. Do not create
child pages for individual words or verbs.

Send the final saved/needs-review report back to the Telegram source chat.
