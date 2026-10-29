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
  if (raw.error)
    throw new Error(
      redact(`OpenRouter error: ${raw.error.message ?? "unknown"}`, apiKey)
    );
  const text = raw.choices?.[0]?.message?.content;
  if (typeof text !== "string")
    throw new Error("OpenRouter response has no message content");
  const u = raw.usage;
  if (!u || typeof u.prompt_tokens !== "number")
    throw new Error("OpenRouter response has no usage block");
  return {
    id: raw.id ?? "",
    model: raw.model ?? request.model,
    text,
    usage: {
      promptTokens: u.prompt_tokens,
      completionTokens: u.completion_tokens ?? 0,
      reasoningTokens: u.completion_tokens_details?.reasoning_tokens ?? null,
      cost: typeof u.cost === "number" ? u.cost : null,
    },
    ms,
  };
}
