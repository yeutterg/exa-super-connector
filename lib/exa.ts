// Exa REST helpers. We call api.exa.ai directly (no SDK) so the JSON tab in the
// inspector shows the exact bytes on the wire — "the REST body is authoritative."

import type {
  BriefRequestBody,
  ExaSearchResponse,
  ExaSearchResult,
  Person,
  RerunOptions,
  SearchRequestBody,
  VerifyRequestBody,
} from "./types";

export const EXA_BASE = "https://api.exa.ai";

/** Display names for Exa Connect providers — single source of truth. */
export const PROVIDER_LABELS: Record<string, string> = {
  fiber_ai: "Fiber.ai",
  financial_datasets: "Financial Datasets",
};

export const SEARCH_SYSTEM_PROMPT =
  "Prefer official LinkedIn profiles and company websites. " +
  "Return only individuals currently employed at the target company. " +
  "Collapse duplicate profiles for the same person.";

export const HIGHLIGHTS_QUERY = "current role and responsibilities";

/** Generic entity-extraction schema for deep-search structured synthesis —
 *  works for any query shape ("which companies/orgs does this query surface,
 *  with a citation each"), which is what makes the Re-run debugging workflow
 *  generalizable instead of a per-query hardcoded pipeline. */
export function buildExtractionSchema(maxItems: number): object {
  return {
    type: "object",
    properties: {
      findings: {
        type: "array",
        maxItems,
        items: {
          type: "object",
          required: ["entity", "evidence"],
          properties: {
            entity: {
              type: "string",
              description: "company or organization name this finding is about",
            },
            evidence: { type: "string", description: "citation URL backing this finding" },
            note: {
              type: "string",
              description: "one line on why this satisfies the query",
            },
          },
        },
      },
    },
  };
}

export function buildSearchBody(
  query: string,
  options?: RerunOptions,
): SearchRequestBody {
  if (!options) {
    // The default first-pass search: fast people-profile retrieval.
    return {
      query,
      type: "auto",
      category: "people",
      numResults: 5, // stays inside the free-tier base bracket (≤10)
      systemPrompt: SEARCH_SYSTEM_PROMPT,
      contents: { highlights: { query: HIGHLIGHTS_QUERY } },
    };
  }
  const isDeep = options.type.startsWith("deep");
  const body: SearchRequestBody = {
    query,
    type: options.type,
    numResults: options.numResults,
    contents: { highlights: { query: HIGHLIGHTS_QUERY } },
  };
  if (options.category) body.category = options.category;
  // The people-specific retrieval steering only makes sense on that corpus.
  if (options.category === "people") body.systemPrompt = SEARCH_SYSTEM_PROMPT;
  // Date filters aren't supported on the people/company categories (per docs).
  if (
    options.startPublishedDate &&
    options.category !== "people" &&
    options.category !== "company"
  ) {
    body.startPublishedDate = options.startPublishedDate;
  }
  if (options.extractEntities && isDeep) {
    body.outputSchema = buildExtractionSchema(options.numResults);
  }
  return body;
}

/** The join step: given an extracted company, find the person to contact. */
export function buildPeopleAtCompanyQuery(company: string): string {
  return `Head of Sales, CRO, or revenue leader at ${company}`;
}

export function buildBriefBody(person: {
  name: string;
  title: string;
  company: string;
}): BriefRequestBody {
  return {
    query:
      `Profile ${person.name}, ${person.title} at ${person.company}. ` +
      `Return their verified work email, and 2-3 recent, specific "why now" signals a salesperson ` +
      `could open a cold email with — funding, launches, hiring, exec talks, migrations, or press ` +
      `from the last 6 months. Each signal must cite a source URL and date.`,
    // Attach providers; the Agent auto-selects among these + web research per query.
    dataSources: [{ provider: "fiber_ai" }, { provider: "financial_datasets" }],
    outputSchema: {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "verified work email, from Fiber.ai",
        },
        // email is intentionally NOT in `required` — the agent should return
        // nothing rather than invent an address when Fiber has no record.
        whyNow: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            required: ["signal", "source", "date"],
            properties: {
              signal: {
                type: "string",
                description:
                  "recent news for public cos, from Financial Datasets; else web",
              },
              source: { type: "string", description: "citation URL" },
              date: { type: "string" },
            },
          },
        },
      },
    },
  };
}

/** Ask the Agent to actually research and verify each candidate against the
 *  original query — the fix for negation/absence conditions that /search's
 *  embedding similarity can't express (see VerifiedCandidate doc comment).
 *  Candidates ride in `input.data` — the documented Agent API pattern for
 *  handing existing records to a run ("one report per input row"), not
 *  string-concatenated into the query. No dataSources attached: this is pure
 *  web-research fact-checking, not a Connect/contact-enrichment call. */
export function buildVerifyBody(
  query: string,
  candidates: { id: string; name: string; title: string; company: string }[],
): VerifyRequestBody {
  return {
    query:
      `The input rows are candidates a semantic search returned for the query: "${query}". ` +
      `For each input row, research and verify whether the person actually satisfies the full ` +
      `query — pay special attention to any negative or absence condition (e.g. "does NOT have X", ` +
      `"hasn't done Y"), since semantic search cannot reliably exclude on those. Return one verdict ` +
      `per input row, preserving its personId, with matches true/false and a one-sentence reason ` +
      `citing what you found.`,
    input: {
      data: candidates.map((c) => ({
        personId: c.id,
        name: c.name,
        title: c.title,
        company: c.company,
      })),
    },
    outputSchema: {
      type: "object",
      properties: {
        verified: {
          type: "array",
          maxItems: candidates.length,
          items: {
            type: "object",
            required: ["personId", "matches", "reason"],
            properties: {
              personId: { type: "string", description: "personId from the input row" },
              matches: { type: "boolean" },
              reason: { type: "string" },
            },
          },
        },
      },
    },
  };
}

/** Derive the flat table row from a raw people-search result. */
export function normalizePerson(result: ExaSearchResult): Person {
  const props = result.entities?.[0]?.properties;
  // "Current" = dates.to is null; workHistory isn't guaranteed to be sorted,
  // so don't just take [0] — fall back to the first entry if none is open.
  const current =
    props?.workHistory?.find((w) => w.dates?.to === null) ??
    props?.workHistory?.[0];
  return {
    id: result.id,
    name: props?.name ?? result.title,
    title: current?.title ?? "—",
    company: current?.company?.name ?? "—",
    location: props?.location ?? null,
    image: result.image ?? null,
    favicon: result.favicon ?? null,
    url: result.url,
    highlight: result.highlights?.[0] ?? null,
    highlights: result.highlights ?? [],
  };
}

export function normalizePeople(response: ExaSearchResponse): Person[] {
  return (response.results ?? []).map(normalizePerson);
}
