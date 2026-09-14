import { File } from 'expo-file-system';
import { SCHEMA_EXTRACTION_PROMPT } from './prompt';
import { FormSchema, LlmExtractionSchema } from './types';

// Tried in order; later models are fallbacks when earlier ones are overloaded.
const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
const RETRYABLE_STATUSES = new Set([429, 500, 503]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Strips markdown code fences in case the model adds them despite instructions.
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

export async function extractFormSchema(photoUri: string): Promise<FormSchema> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_GEMINI_API_KEY. Add it to your .env file (see .env.example).'
    );
  }

  const file = new File(photoUri);
  const base64 = await file.base64();

  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { text: SCHEMA_EXTRACTION_PROMPT },
          { inline_data: { mime_type: 'image/jpeg', data: base64 } },
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
  const text: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini response had no content (possibly blocked by safety filters).');
  }

  const json = JSON.parse(stripCodeFences(text));
  const extraction = LlmExtractionSchema.parse(json);

  return {
    ...extraction,
    id: makeId(),
    sourceImageUri: photoUri,
    createdAt: new Date().toISOString(),
  };
}
