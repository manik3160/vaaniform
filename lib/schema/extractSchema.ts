import { File } from 'expo-file-system';
import { SCHEMA_EXTRACTION_PROMPT } from './prompt';
import { FormSchema, LlmExtractionSchema } from './types';

const GEMINI_MODEL = 'gemini-3.8-flash';

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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
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
