// Hover glossary for JSON keys/values shown in the inline API call blocks and
// the Raw response view. Descriptions are sourced from Exa's own docs
// (exa.ai/docs) and from the real request/response shapes observed against
// the live API in this project — not guessed.
//
// Annotation is PATH-AWARE: the same key means different things in different
// places ("type" is Exa's search mode at the root but a JSON-Schema primitive
// inside outputSchema; "title" is a page title on a result but a job title
// inside workHistory), so we track each key's JSON path while walking the
// pretty-printed code line by line, and resolve the description in context.

/** Flat descriptions for keys that mean the same thing everywhere. */
const FLAT: Record<string, string> = {
  // ---- Request: /search ----
  category:
    "Narrows retrieval to a specific corpus (people, company, news, …). Omit it to search the entire web. The core debugging lever: search can only match what lives in the corpus you point it at.",
  startPublishedDate:
    "Only return content published after this date — supported on news/web scopes, not on the people/company categories.",
  numResults:
    "How many results to return (1–100, default 10). Free tier covers up to 10 per search; results beyond that cost extra ($1/1k).",
  systemPrompt:
    'Steers retrieval and ranking (e.g. "prefer LinkedIn profiles", "current employees only") without hard filters.',
  contents:
    "Requests extra content alongside each result, such as highlight excerpts.",

  // ---- Request: /agent/runs ----
  input:
    "Existing records for the Agent to process — the documented way to hand a candidate list to a run. The agent returns one output row per input row.",
  data: "The records themselves — one object per input row.",
  dataSources:
    "Attaches Exa Connect partner providers to an Agent run. The agent auto-routes between attached providers + live web research per query — you don't pick which one fires.",
  provider:
    "Which Exa Connect partner is attached to this run. The Agent decides whether to actually call it.",
  outputSchema:
    "JSON Schema the Agent's answer must conform to — returns typed fields directly instead of free text you'd have to parse.",

  // ---- JSON Schema vocabulary (inside outputSchema) ----
  properties: "The fields the Agent must return, per JSON Schema.",
  items: "Schema for each element of this array.",
  required:
    "Fields the Agent must always include. Anything it shouldn't invent (like an email it can't verify) is deliberately left optional.",
  maxItems: "Upper bound on how many array entries the Agent may return.",
  description:
    "Field-level guidance the Agent reads when filling this field — including hints about which Connect provider should supply it.",

  // ---- Our outputSchema field names ----
  email:
    "Field the Agent fills: verified work email, sourced from Fiber.ai. Not in `required`, so the Agent returns nothing rather than inventing an address.",
  whyNow:
    'Field the Agent fills: 2–3 recent, cited "reasons to reach out now" — funding, launches, hiring, talks, press.',
  signal: "One why-now finding, written as a cold-email-ready fact.",
  source: "Citation URL backing this finding.",
  date: "When the cited event happened.",
  verified: "Field the Agent fills: one verdict per input row.",
  findings:
    "Structured synthesis field: entities the deep search surfaced for this query, each with a citation.",
  entity: "Company or organization name this finding is about.",
  evidence: "Citation URL backing this finding.",
  note: "One line on why this entity satisfies the query.",
  personId:
    "Echoes the input row's personId so each verdict maps back to a table row.",
  matches:
    "The Agent's verdict: does this candidate actually satisfy the full query (including negation/absence conditions semantic search can't express)?",
  reason: "One-sentence justification citing what the Agent's research found.",

  // ---- Response: /search (Raw view) ----
  requestId: "Exa's unique identifier for this specific API call.",
  resolvedSearchType:
    'Which retrieval mode Exa actually used under the hood for type: "auto" (e.g. neural).',
  results:
    "The array of matched results — one entry per person/page Exa's search returned.",
  url: "The source URL — for people results, their public profile.",
  publishedDate: "When Exa last saw this content published or updated.",
  image:
    "Profile/OG image URL when available — not guaranteed on every result, so the UI falls back to initials.",
  favicon:
    "The result's site favicon URL — returned when the result resolves to a company/organization page.",
  entities:
    "Structured data Exa extracted for a result — for people search, this is where name/location/workHistory/educationHistory live.",
  version: "Schema version of the extracted entity.",
  firstName: "Parsed component of the person's name.",
  lastName: "Parsed component of the person's name.",
  location: "Person's location, as listed on their profile.",
  workHistory:
    "The person's employment timeline, extracted natively by Exa — an entry with to: null marks the current role.",
  educationHistory:
    "The person's education history, extracted natively by Exa alongside workHistory.",
  dates: "The period for this entry — to: null means current.",
  from: "Start date of this entry.",
  to: "End date — null marks the person's current role.",
  position: "Job title for this role.",
  company: "The employer for this role, as an entity reference.",
  institution: "The school, as an entity reference.",
  degree: "Degree and field of study.",
  costDollars: "The exact, real cost of this call in USD — not an estimate.",
  total: "Total cost of this call in USD.",
  search: "Cost split by search type.",
  neural: "Cost attributed to neural retrieval.",
  searchTime: "Time Exa spent searching, as reported by the API.",
};

/** Context-dependent keys, resolved by JSON path. */
function describeKey(key: string, path: string[]): string | undefined {
  const inSchema = path.includes("outputSchema");
  switch (key) {
    case "type":
      if (inSchema) return "JSON Schema type for this field — the shape the Agent must return.";
      if (path.includes("entities"))
        return 'The kind of structured entity Exa extracted — "person" for people-category results.';
      return 'Search mode. "auto" lets Exa pick; alternatives range from "instant"/"fast" to the slower, higher-quality "deep" modes.';
    case "query":
      if (path.includes("highlights"))
        return "Steers which excerpt is pulled from each result — the snippet is chosen for similarity to this phrase, not the main query.";
      return "The natural-language search query. Exa's neural model reads intent directly from the sentence — no filters or dropdowns.";
    case "highlights":
      if (path.includes("results"))
        return "The excerpt(s) Exa extracted for this result, steered by the highlights query in the request.";
      return "Bias-able excerpt extraction — the nested query steers which part of a long page/profile becomes the snippet shown.";
    case "properties":
      if (path.includes("entities"))
        return "The structured fields Exa extracted for this entity — name, location, work and education history.";
      return FLAT.properties;
    case "title":
      if (path.includes("workHistory")) return "Job title for this role.";
      if (path.includes("data"))
        return "Current title from the search result row we're asking the Agent to verify.";
      return "Result title — for people results, the person's name/headline.";
    case "id":
      if (path.includes("company") || path.includes("institution"))
        return "Exa's entity id for this organization (null if it isn't in the entity library).";
      return "Exa's canonical id for this result — people results use a library entity URL.";
    case "name":
      if (path.includes("company") || path.includes("institution"))
        return "Organization name.";
      if (path.includes("data"))
        return "Name from the search result row we're asking the Agent to verify.";
      return "Person's full name, extracted by Exa.";
    case "company":
      if (path.includes("data"))
        return "Current company from the search result row we're asking the Agent to verify.";
      return FLAT.company;
    default:
      return FLAT[key];
  }
}

/** Connect provider names — annotated as VALUES, not keys. */
const VALUE_TIPS: Record<string, string> = {
  fiber_ai:
    "Exa Connect partner: B2B company/people database, used here for verified work-email lookups.",
  financial_datasets:
    "Exa Connect partner: ticker-based news for public companies — skipped when the target company is private.",
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const wrapTip = (token: string, description: string) =>
  `<span class="cursor-help underline decoration-dotted decoration-muted-foreground/60 underline-offset-2" data-tip="${escapeHtml(description)}">${token}</span>`;

/**
 * For each line of pretty-printed JSON, extract the key (if any) and the
 * JSON path of keys leading to it. Line-oriented parsing is exact here:
 * JSON.stringify(obj, null, 2) emits one key per line, never inlines
 * objects/arrays with children, and escapes newlines inside strings.
 */
function keyPathsByLine(
  code: string,
): ({ key: string; path: string[] } | null)[] {
  const stack: string[] = [];
  return code.split("\n").map((line) => {
    if (/^\s*[}\]]/.test(line)) stack.pop();
    const m = /^\s*"([^"]+)"\s*:/.exec(line);
    const key = m?.[1];
    const entry = key ? { key, path: [...stack] } : null;
    if (/[{[]\s*$/.test(line)) stack.push(key ?? "*");
    return entry;
  });
}

/**
 * Annotates every recognized key in Shiki-rendered JSON with a `data-tip`
 * description (CodeBlock renders these as instant styled tooltips — native
 * `title` tooltips proved unreliable). Shiki preserves the code's line
 * structure, so HTML line N corresponds to code line N; each line's key is
 * its first quoted token, so wrapping the first occurrence is unambiguous.
 * Keys with no description stay plain rather than getting a wrong tooltip.
 */
export function annotateGlossary(html: string, code: string): string {
  const infos = keyPathsByLine(code);
  const htmlLines = html.split("\n");
  // Line counts must correspond or the mapping is invalid — skip annotation
  // rather than risk mislabeling.
  if (htmlLines.length !== infos.length) return html;

  let out = htmlLines
    .map((htmlLine, i) => {
      const info = infos[i];
      if (!info) return htmlLine;
      const desc = describeKey(info.key, info.path);
      if (!desc) return htmlLine;
      const token = `"${info.key}"`;
      const idx = htmlLine.indexOf(token);
      if (idx === -1) return htmlLine;
      return (
        htmlLine.slice(0, idx) +
        wrapTip(token, desc) +
        htmlLine.slice(idx + token.length)
      );
    })
    .join("\n");

  // Provider names appear as values (`"provider": "fiber_ai"`), never keys.
  for (const [value, tip] of Object.entries(VALUE_TIPS)) {
    out = out.replaceAll(`"${value}"`, wrapTip(`"${value}"`, tip));
  }
  return out;
}
