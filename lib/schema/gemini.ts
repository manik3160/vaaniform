import { generateJson } from '../gemini';
import { SCHEMA_EXTRACTION_PROMPT } from './prompt';
import { LlmExtraction, LlmExtractionSchema } from './types';

export async function extractFromImage(
  base64: string,
  mimeType: string,
  apiKey: string
): Promise<LlmExtraction> {
  const json = await generateJson(
    [{ text: SCHEMA_EXTRACTION_PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }],
    apiKey
  );
  return LlmExtractionSchema.parse(json);
}
