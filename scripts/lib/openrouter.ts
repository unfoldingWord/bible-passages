// One chat completion through OpenRouter, which serves both models ADR 0002
// measures behind one API. Plain fetch, no SDK: one endpoint, one shape.
// `fetch` is injected so tests never touch the network.
//
// The API key is passed in by the caller, who reads it from the environment.
// It is sent only in the Authorization header and is removed from any error
// text before that text is thrown.

export const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export type Message = { role: "system" | "user"; content: string };

export type Usage = {
  promptTokens: number;
  completionTokens: number;
  /** Reasoning tokens inside completionTokens, when the model reports them. */
  reasoningTokens: number | null;
  /** US dollars, as OpenRouter bills it; null if the response has none. */
  cost: number | null;
};

export type Completion = {
  /** OpenRouter's generation id, for looking the call up later. */
  id: string;
  /** The model that answered, as OpenRouter names it. */
  model: string;
  text: string;
  usage: Usage;
  /** Wall-clock milliseconds for the request. */
  ms: number;
  /**
   * Set when the response was billed (it carries usage) but has no usable
   * reply: an error body or no message content. `text` is then empty.
   */
  problem?: string;
};

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

type Raw = {
  id?: string;
  model?: string;
  choices?: { message?: { content?: string | null } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
  error?: { message?: string; code?: number | string };
};

const redact = (text: string, key: string): string =>
  key.length > 0 ? text.split(key).join("[redacted]") : text;

export async function complete(
  request: { model: string; messages: Message[]; temperature?: number },
  options: { apiKey: string; fetch?: Fetch; now?: () => number }
): Promise<Completion> {
  const { apiKey } = options;
  const doFetch: Fetch = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const started = now();
  const res = await doFetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/unfoldingWord/bible-passages",
      "X-Title": "bible-passages",
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0,
      // Ask for the usage block with the billed cost.
      usage: { include: true },
    }),
  });
  const body = await res.text();
  const ms = now() - started;
  if (!res.ok)
    throw new Error(
      redact(`OpenRouter ${res.status}: ${body.slice(0, 500)}`, apiKey)
    );
  let raw: Raw;
  try {
    raw = JSON.parse(body) as Raw;
  } catch {
    throw new Error(
      redact(`OpenRouter returned non-JSON: ${body.slice(0, 200)}`, apiKey)
    );
  }
  const usage = readUsage(raw);
  const text = raw.choices?.[0]?.message?.content;
  const problem = raw.error
    ? redact(`OpenRouter error: ${raw.error.message ?? "unknown"}`, apiKey)
    : typeof text !== "string"
      ? "OpenRouter response has no message content"
      : undefined;
  if (problem !== undefined || typeof text !== "string") {
    // A body that carries usage was billed: return it so the call reaches
    // the ledger, with the problem, rather than throwing the cost away.
    if (usage)
      return {
        id: raw.id ?? "",
        model: raw.model ?? request.model,
        text: "",
        usage,
        ms,
        problem: problem ?? "OpenRouter response has no message content",
      };
    throw new Error(problem ?? "OpenRouter response has no message content");
  }
  if (!usage)
    throw new Error("OpenRouter response has no usage block with token counts");
  return {
    id: raw.id ?? "",
    model: raw.model ?? request.model,
    text,
    usage,
    ms,
  };
}

/** The usage block, or null when its token counts are missing. */
function readUsage(raw: Raw): Usage | null {
  const u = raw.usage;
  const count = (n: unknown): n is number =>
    typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  if (!u || !count(u.prompt_tokens) || !count(u.completion_tokens)) return null;
  return {
    promptTokens: u.prompt_tokens,
    completionTokens: u.completion_tokens,
    reasoningTokens: count(u.completion_tokens_details?.reasoning_tokens)
      ? u.completion_tokens_details.reasoning_tokens
      : null,
    // A cost that is not a usable dollar amount is unknown, not zero.
    cost:
      typeof u.cost === "number" && Number.isFinite(u.cost) && u.cost >= 0
        ? u.cost
        : null,
  };
}
