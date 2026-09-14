import { SCHEMA_EXTRACTION_PROMPT } from './prompt';
import { LlmExtraction, LlmExtractionSchema } from './types';

// Tried in order; later models are fallbacks when earlier ones are overloaded.
const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
const RETRYABLE_STATUSES = new Set([429, 500, 503]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Strips markdown code fences in case the model adds them despite instructions.
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

// Platform-independent so it can run on the phone and in Node (scripts/extract-fixtures.ts).
export async function extractFromImage(
  base64: string,
  mimeType: string,
  apiKey: string
): Promise<LlmExtraction> {
  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { text: SCHEMA_EXTRACTION_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
    },
  });

  let response: Response | null = null;
  let lastError = '';
  outer: for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body,
        }
      );
      if (response.ok) break outer;

      lastError = `${model} → ${response.status}: ${await response.text()}`;
      if (!RETRYABLE_STATUSES.has(response.status)) {
        throw new Error(`Gemini API error ${lastError}`);
      }
      if (attempt === 0) await sleep(1500);
    }
  }

  if (!response?.ok) {
    throw new Error(`All Gemini models are busy right now. Last error: ${lastError}`);
  }

  const data = await response.json();
  const parts: { text?: string; thought?: boolean }[] =
    data.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join('');
  if (!text) {
    throw new Error('Gemini response had no content (possibly blocked by safety filters).');
  }

  return LlmExtractionSchema.parse(JSON.parse(stripCodeFences(text)));
}
