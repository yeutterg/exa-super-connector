#!/usr/bin/env node
// Regenerate demo fixtures with REAL Exa responses.
// Usage: EXA_API_KEY must be set in .env.local (or the environment), then:
//   npm run fixtures
// Re-runs the three hero queries via /search and writes lib/fixtures/hero-*.json.
// Then pre-warms the Build Brief for the person you plan to click on stage:
//   npm run fixtures -- --brief "<result id from the regenerated hero-1.json>"
// Review the output before the demo — pick queries whose result sets look good.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Minimal .env.local loader (no dotenv dependency).
const envPath = resolve(root, ".env.local");
if (!process.env.EXA_API_KEY && existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m) process.env[m[1]] ??= m[2];
  }
}

const API_KEY = process.env.EXA_API_KEY;
if (!API_KEY) {
  console.error("EXA_API_KEY not set (env or .env.local). Aborting.");
  process.exit(1);
}

const HERO_QUERIES = [
  "Companies that raised a Series B in the last 6 months and don't have a RevOps leader yet",
  "People who've written publicly about migrating off Salesforce",
  "Sales leaders at Series B SaaS companies hiring their first RevOps role",
];

const SYSTEM_PROMPT =
  "Prefer official LinkedIn profiles and company websites. " +
  "Return only individuals currently employed at the target company. " +
  "Collapse duplicate profiles for the same person.";

async function search(query) {
  const started = Date.now();
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({
      query,
      type: "auto",
      category: "people",
      numResults: 5,
      systemPrompt: SYSTEM_PROMPT,
      contents: { highlights: { query: "current role and responsibilities" } },
    }),
  });
  if (!res.ok) throw new Error(`exa ${res.status}: ${await res.text()}`);
  return { response: await res.json(), durationMs: Date.now() - started };
}

for (let i = 0; i < HERO_QUERIES.length; i++) {
  const query = HERO_QUERIES[i];
  console.log(`[${i + 1}/3] ${query}`);
  const { response, durationMs } = await search(query);
  const out = resolve(root, `lib/fixtures/hero-${i + 1}.json`);
  writeFileSync(out, JSON.stringify({ query, durationMs, response }, null, 2));
  console.log(
    `  → ${response.results?.length ?? 0} results, $${response.costDollars?.total ?? "?"}, wrote ${out}`,
  );
}

console.log(
  "\nDone. Inspect the hero-*.json result sets, then pre-warm the brief for the person",
  "you'll click on stage by hitting POST /api/brief once and saving the response as",
  "lib/fixtures/brief-<result-id>.json (see brief-h1-r2.json for the shape).",
);
