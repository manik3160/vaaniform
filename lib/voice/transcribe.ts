import { z } from 'zod';
import { generateJson, ThinkingLevel } from '../gemini';

const TranscriptSchema = z.object({
  text: z.string(),
  confidence: z.number(),
});

export interface Transcript {
  text: string;
  confidence: number;
}

function buildPrompt(question: string): string {
  return `Transcribe the attached audio. It was recorded right after a person filling in a form was asked:
"${question}"

The question is context only, to help with names and numbers. The person may say something
unrelated (a different answer, "sorry, what?", talking to someone else). Transcribe whatever they
actually said, even if it does not answer the question. Speech may be quiet or far from the
microphone; transcribe it anyway.

They may speak Hindi, English, or a mix of both (Hinglish).

Return ONLY a JSON object: {"text": string, "confidence": number}
- text: exactly what the person said, word for word. Do not translate, correct, summarise or answer the question.
- Write Hindi words in Devanagari. Write English words in Latin script even inside a Hindi
  sentence: "मेरी date of birth" is correct, "मेरी डेट ऑफ बर्थ" is wrong.
- Never write digits. Keep numbers as the words that were spoken, in the language they were
  spoken in: "बारह मार्च दो हज़ार चार", "nine eight seven".
- Only if there is no human speech at all in the recording, text is "".
- confidence: a number from 0 to 1 for how sure you are that the transcript is accurate.`;
}

// Platform-independent so it can run on the phone and in Node (scripts/transcribe-fixtures.ts).
export async function transcribeAudio(
  base64: string,
  mimeType: string,
  question: string,
  apiKey: string,
  options: { models?: string[]; thinkingLevel?: ThinkingLevel } = {}
): Promise<Transcript> {
  const json = await generateJson(
    [{ text: buildPrompt(question) }, { inline_data: { mime_type: mimeType, data: base64 } }],
    apiKey,
    {
      // Fastest accurate option in benchmarks on fixtures/audio (~1.5–2.7 s per answer).
      models: ['gemini-3.5-flash-lite', 'gemini-3.6-flash'],
      thinkingLevel: 'minimal',
      timeoutMs: 15000,
      ...options,
    }
  );
  const { text, confidence } = TranscriptSchema.parse(json);
  return { text: text.trim(), confidence: Math.min(1, Math.max(0, confidence)) };
}
