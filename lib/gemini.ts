// Tried in order; later models are fallbacks when earlier ones are overloaded.
export const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
const RETRYABLE_STATUSES = new Set([429, 500, 503]);

export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Strips markdown code fences in case the model adds them despite instructions.
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

// Platform-independent (plain fetch) so it runs on the phone and in Node scripts.
export async function generateJson(
  parts: GeminiPart[],
  apiKey: string,
  options: { thinkingLevel?: ThinkingLevel; models?: string[]; timeoutMs?: number } = {}
): Promise<unknown> {
  const models = options.models ?? DEFAULT_MODELS;
  const timeoutMs = options.timeoutMs ?? 60000;
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      response_mime_type: 'application/json',
      ...(options.thinkingLevel && {
        thinkingConfig: { thinkingLevel: options.thinkingLevel },
      }),
    },
  });

  let response: Response | null = null;
  let lastError = '';
  outer: for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body,
            signal: controller.signal,
          }
        );
      } catch (err) {
        // Timed out or network failure: don't retry the same model, move to the next one.
        response = null;
        lastError = controller.signal.aborted
          ? `${model} → no response within ${timeoutMs / 1000}s`
          : `${model} → ${err instanceof Error ? err.message : String(err)}`;
        continue outer;
      } finally {
        clearTimeout(timer);
      }
      if (response.ok) break outer;

      lastError = `${model} → ${response.status}: ${await response.text()}`;
      if (!RETRYABLE_STATUSES.has(response.status)) {
        throw new Error(`Gemini API error ${lastError}`);
      }
      if (attempt === 0) await sleep(1500);
    }
  }

  if (!response?.ok) {
    throw new Error(`Couldn't get a response from Gemini. Last error: ${lastError}`);
  }

  const data = await response.json();
  const responseParts: { text?: string; thought?: boolean }[] =
    data.candidates?.[0]?.content?.parts ?? [];
  const text = responseParts
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join('');
  if (!text) {
    throw new Error('Gemini response had no content (possibly blocked by safety filters).');
  }

  return JSON.parse(stripCodeFences(text));
}
