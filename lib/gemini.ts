// Tried in order; later models are fallbacks when earlier ones are overloaded or out of quota.
// flash-lite is last: less thorough on complex forms, but on the free tier it often still has quota.
export const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
// For short per-answer calls where latency matters more than depth (~1–2 s in benchmarks).
// The larger models are last-resort fallbacks: slower, but each model has its own quota.
export const FAST_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.8-flash'];

// gemini-3.8-flash rejects thinkingLevel "minimal" with a 400.
const LOWEST_THINKING: Record<string, ThinkingLevel> = { 'gemini-3.8-flash': 'low' };

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

function requestBody(parts: GeminiPart[], model: string, thinkingLevel?: ThinkingLevel): string {
  const level = thinkingLevel === 'minimal' ? LOWEST_THINKING[model] ?? 'minimal' : thinkingLevel;
  return JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      response_mime_type: 'application/json',
      ...(level && { thinkingConfig: { thinkingLevel: level } }),
    },
  });
}

// Platform-independent (plain fetch) so it runs on the phone and in Node scripts.
export async function generateJson(
  parts: GeminiPart[],
  apiKey: string,
  options: {
    thinkingLevel?: ThinkingLevel;
    models?: string[];
    timeoutMs?: number;
    onAnswered?: (info: { model: string; ms: number }) => void;
  } = {}
): Promise<unknown> {
  const startedAt = Date.now();
  const models = options.models ?? DEFAULT_MODELS;
  const timeoutMs = options.timeoutMs ?? 60000;

  let response: Response | null = null;
  let answeredBy = '';
  const errors: string[] = [];
  let quotaExhausted = 0;

  outer: for (const model of models) {
    const body = requestBody(parts, model, options.thinkingLevel);
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
        // Timed out or network failure: move straight to the next model.
        response = null;
        errors.push(
          controller.signal.aborted
            ? `${model}: no response within ${timeoutMs / 1000}s`
            : `${model}: ${err instanceof Error ? err.message : String(err)}`
        );
        continue outer;
      } finally {
        clearTimeout(timer);
      }
      if (response.ok) {
        answeredBy = model;
        break outer;
      }

      const detail = (await response.text()).slice(0, 300);
      errors.push(`${model}: ${response.status} ${detail}`);
      if (response.status === 429) {
        // Quota is per model, so another model may still have some left. Retrying this one won't help.
        quotaExhausted++;
        continue outer;
      }
      if (response.status !== 500 && response.status !== 503) {
        throw new Error(`Gemini API error ${errors[errors.length - 1]}`);
      }
      if (attempt === 0) await sleep(1500);
    }
  }

  if (!response?.ok) {
    // Full per-model details go to the Metro log; the thrown message is shown to the user.
    console.warn(`[gemini] all models failed: ${errors.join(' | ')}`);
    if (quotaExhausted === models.length) {
      throw new Error("Today's free Gemini limit is used up. It resets tomorrow; until then, tap a question to type the answer.");
    }
    throw new Error('Gemini is busy or unreachable right now. Wait a minute and tap Continue, or tap a question to type the answer.');
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

  options.onAnswered?.({ model: answeredBy, ms: Date.now() - startedAt });
  return JSON.parse(stripCodeFences(text));
}
