#!/usr/bin/env node

/**
 * Publish a Notion-flavoured Markdown file as a new page.
 *
 * Required environment variables:
 *   MATON_API_KEY, NOTION_API_KEY, or server-compatible alias NOTION_API_TOKEN
 *
 * Optional:
 *   MATON_NOTION_CONNECTION_ID
 *   NOTION_BOOKS_PAGE_TITLE defaults to "Books"
 *   NOTION_PARENT_PAGE_ID, or parent page ID as the second CLI argument
 */

import fs from "node:fs/promises";
import process from "node:process";

const NOTION_VERSION = "2026-03-11";
const DEFAULT_BOOKS_PAGE_TITLE = "Books";

function notionAuth() {
  if (process.env.MATON_API_KEY) {
    return {
      apiBase: "https://api.maton.ai/notion/v1",
      token: process.env.MATON_API_KEY,
      connectionId: process.env.MATON_NOTION_CONNECTION_ID,
    };
  }

  return {
    apiBase: "https://api.notion.com/v1",
    token: process.env.NOTION_API_KEY || process.env.NOTION_API_TOKEN,
    connectionId: null,
  };
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function notionRequest(pathOrUrl, options = {}) {
  const auth = notionAuth();
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${auth.apiBase}/${pathOrUrl.replace(/^\/+/, "")}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(auth.connectionId ? { "Maton-Connection": auth.connectionId } : {}),
      ...(options.headers || {}),
    },
  });

  const raw = await response.text();
  let body;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = { raw };
  }

  if (!response.ok) {
    const detail = body?.message || body?.code || raw || response.statusText;
    throw new Error(`Notion API ${response.status}: ${detail}`);
  }

  return body;
}

function richTextPlainText(items = []) {
  return items.map((item) => item?.plain_text || item?.text?.content || "").join("");
}

function pageTitle(page) {
  for (const property of Object.values(page?.properties || {})) {
    if (property?.type === "title") {
      return richTextPlainText(property.title).trim();
    }
  }
  return "";
}

async function findPageByExactTitle(title) {
  const result = await notionRequest("search", {
    method: "POST",
    body: JSON.stringify({
      query: title,
      filter: { property: "object", value: "page" },
      page_size: 25,
    }),
  });

  const matches = (result.results || []).filter((page) => pageTitle(page) === title);
  if (matches.length === 1) {
    return matches[0].id;
  }
  if (matches.length > 1) {
    throw new Error(`Found ${matches.length} Notion pages titled "${title}". Set NOTION_PARENT_PAGE_ID or pass the parent page ID explicitly.`);
  }
  throw new Error(`Could not find a Notion page titled "${title}". Create/share it with the Notion connection, or set NOTION_PARENT_PAGE_ID.`);
}

async function pollAsyncTask(task) {
  let current = task;

  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (current.status === "succeeded") {
      return current.result;
    }
    if (current.status === "failed") {
      const detail =
        current.error?.message || current.error?.code || "Unknown asynchronous failure";
      throw new Error(`Notion asynchronous task failed: ${detail}`);
    }

    const seconds = Math.max(1, Number(current.poll_after_seconds || 2));
    await sleep(seconds * 1000);

    const statusPath = current.status_url || `async_tasks/${current.id}`;
    current = await notionRequest(statusPath, { method: "GET" });
  }

  throw new Error("Timed out while polling the Notion asynchronous task.");
}

async function main() {
  const markdownPath = process.argv[2];
  if (!markdownPath) {
    fail("Usage: node publish_notion.mjs <final-notion.md> [parent-page-id]", 2);
  }

  if (!notionAuth().token) {
    fail("MATON_API_KEY, NOTION_API_KEY, or NOTION_API_TOKEN is not configured.", 3);
  }
  const parentPageId =
    process.argv[3] ||
    process.env.NOTION_PARENT_PAGE_ID ||
    (await findPageByExactTitle(process.env.NOTION_BOOKS_PAGE_TITLE || DEFAULT_BOOKS_PAGE_TITLE));

  const markdown = (await fs.readFile(markdownPath, "utf8")).trim();
  if (!markdown) fail("The Markdown file is empty.", 4);

  const payload = {
    parent: { page_id: parentPageId },
    icon: { type: "emoji", emoji: "📚" },
    markdown,
    allow_async: true,
  };

  let result = await notionRequest("pages", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (result.object === "async_task") {
    result = await pollAsyncTask(result);
  }

  const pageId = result?.id;
  const pageUrl =
    result?.url ||
    result?.public_url ||
    (pageId ? `https://www.notion.so/${String(pageId).replaceAll("-", "")}` : null);

  console.log(
    JSON.stringify(
      {
        ok: true,
        page_id: pageId || null,
        page_url: pageUrl || null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error), 1);
});
