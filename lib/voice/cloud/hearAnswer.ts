import { z } from 'zod';
import { FAST_MODELS, generateJson } from '../../gemini';
import { FormField, Lang } from '../../schema/types';
import type { Transcript } from '../engine';
import { fieldContext, LlmValue, VALUE_RULES } from '../parseAnswer';

export type HeardAnswer = Transcript & LlmValue & { model: string; ms: number };

const HeardSchema = z.object({
  text: z.string(),
  confidence: z.number(),
  value: z.string().nullable(),
  reason: z.enum(['ok', 'unclear', 'not-an-option']).catch('unclear'),
});

function buildPrompt(field: FormField, lang: Lang, today: Date): string {
  return `The attached audio is a person answering one question while filling in a paper form.
Do two things: transcribe exactly what they said, then work out the value to write in the field.

${fieldContext(field, lang, today)}

Return ONLY a JSON object:
{"text": string, "confidence": number, "value": string | null, "reason": "ok" | "unclear" | "not-an-option"}

Transcript ("text", "confidence"):
- text: exactly what the person said, word for word. Do not translate, correct or summarise.
- The question is context only. The person may say something unrelated ("sorry, what?", talking to
  someone else). Transcribe whatever they actually said. Speech may be quiet or far from the microphone.
- Write Hindi words in Devanagari. Write English words in Latin script even inside a Hindi sentence:
  "मेरी date of birth" is correct, "मेरी डेट ऑफ बर्थ" is wrong.
- In text, never write digits: keep numbers as the spoken words ("बारह मार्च दो हज़ार चार", "nine eight seven").
- Only if there is no human speech at all, text is "" and value is null with reason "unclear".
- confidence: 0 to 1, how sure you are that the transcript is accurate.

Value ("value", "reason"), worked out from what the person said:
${VALUE_RULES}`;
}

// Platform-independent so it runs on the phone and in Node (scripts/transcribe-fixtures.ts).
// One request per spoken answer: transcription and value extraction together halve latency and quota use.
export async function hearAnswer(
  base64: string,
  mimeType: string,
  field: FormField,
  lang: Lang,
  apiKey: string,
  today: Date = new Date()
): Promise<HeardAnswer> {
  let timing = { model: '', ms: 0 };
  const json = await generateJson(
    [{ text: buildPrompt(field, lang, today) }, { inline_data: { mime_type: mimeType, data: base64 } }],
    apiKey,
    {
      models: FAST_MODELS,
      thinkingLevel: 'minimal',
      // A healthy fast model answers in ~2 s; waiting longer mostly means it's overloaded, so try the next one.
      timeoutMs: 8000,
      onAnswered: (info) => (timing = info),
    }
  );
  const heard = HeardSchema.parse(json);
  return {
    ...heard,
    ...timing,
    text: heard.text.trim(),
    confidence: Math.min(1, Math.max(0, heard.confidence)),
  };
}
