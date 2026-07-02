// Builds the JSON string shown in the inline API call block. Server routes
// hit api.exa.ai directly over REST — no exa-js SDK in the request path — so
// this is the one true representation of "the actual call we make."

export function apiJsonSnippet(body: object): string {
  return JSON.stringify(body, null, 2);
}
