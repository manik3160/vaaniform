import { z } from 'zod';
import { requireGeminiKey } from '../apiKey';
import { FAST_MODELS, generateJson } from '../gemini';
import { FormField, Lang } from '../schema/types';
import type { Transcript } from './engine';

export type FailReason = 'not-heard' | 'not-an-option' | 'unclear';
export type ParseResult = { ok: true; value: string } | { ok: false; reason: FailReason };

const MIN_CONFIDENCE = 0.5;

// ---------------------------------------------------------------- helpers

export function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function words(text: string): string[] {
  return text.toLowerCase().split(/[\s,.!?।"'()-]+/).filter(Boolean);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatDate(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function isRealDate(day: number, month: number, year: number): boolean {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(year, month, 0).getDate();
}

// ---------------------------------------------------------------- validation
// Every value, whether parsed by rules, returned by the LLM, or typed, must pass this before it is stored.

export function validateValue(field: FormField, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const options = field.options ?? [];

  if (field.type === 'choice' && options.length) {
    return options.find((o) => sameText(o, v)) ?? null;
  }
  if (field.type === 'checkbox') {
    if (!options.length) {
      if (sameText(v, 'Yes')) return 'Yes';
      if (sameText(v, 'No')) return 'No';
      return null;
    }
    const picked = v.split(',').map((p) => options.find((o) => sameText(o, p)));
    if (picked.some((p) => p === undefined)) return null;
    return [...new Set(picked as string[])].join(', ');
  }
  if (field.type === 'date') {
    const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (!m || !isRealDate(+m[1], +m[2], +m[3])) return null;
    return `${pad2(+m[1])}/${pad2(+m[2])}/${m[3]}`;
  }

  let result = v;
  if (field.type === 'number') {
    result = v.replace(/[\s-]/g, '');
    if (!/^\d+$/.test(result)) return null;
  }
  const { pattern, minLength, maxLength } = field.validation ?? {};
  if (pattern && !new RegExp(pattern).test(result)) return null;
  if (minLength != null && result.length < minLength) return null;
  if (maxLength != null && result.length > maxLength) return null;
  return result;
}

// ---------------------------------------------------------------- rule-based parsing

const YES_WORDS = ['yes', 'yeah', 'yep', 'haan', 'han', 'ha', 'haa', 'ji', 'हाँ', 'हां', 'हा', 'जी'];
const NO_WORDS = ['no', 'nahi', 'nahin', 'nahi.', 'na', 'nope', 'नहीं', 'नही', 'ना', 'न'];

function yesNo(text: string): 'Yes' | 'No' | null {
  const tokens = words(text);
  // Check "no" first: "नहीं जी" is a no even though it contains "जी".
  if (tokens.some((t) => NO_WORDS.includes(t))) return 'No';
  if (tokens.some((t) => YES_WORDS.includes(t))) return 'Yes';
  return null;
}

const DIGIT_WORDS: Record<string, string> = {
  zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  shunya: '0', ek: '1', do: '2', teen: '3', char: '4', chaar: '4', panch: '5', paanch: '5', chhe: '6', che: '6', saat: '7', aath: '8', nau: '9',
  'शून्य': '0', 'ज़ीरो': '0', 'जीरो': '0', 'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4', 'पांच': '5', 'पाँच': '5',
  'छह': '6', 'छः': '6', 'छे': '6', 'सात': '7', 'आठ': '8', 'नौ': '9',
};
const REPEAT_WORDS: Record<string, number> = { double: 2, triple: 3, 'डबल': 2, 'ट्रिपल': 3 };
// Words that make a number more than a digit sequence ("दो हज़ार चार"); leave those to the LLM.
const MAGNITUDE_WORDS = ['hundred', 'thousand', 'lakh', 'lac', 'crore', 'sau', 'hazaar', 'hazar', 'सौ', 'हज़ार', 'हजार', 'लाख', 'करोड़'];

/** Digits from a spoken digit-by-digit number, or null if it isn't one. */
export function spokenDigits(text: string, wholeAnswerOnly: boolean): string | null {
  const tokens = words(text);
  if (tokens.some((t) => MAGNITUDE_WORDS.includes(t))) return null;
  let digits = '';
  let repeat = 1;
  let other = 0;
  for (const t of tokens) {
    if (REPEAT_WORDS[t]) {
      repeat = REPEAT_WORDS[t];
    } else if (/^\d+$/.test(t)) {
      digits += t.repeat(t.length === 1 ? repeat : 1);
      repeat = 1;
    } else if (DIGIT_WORDS[t]) {
      digits += DIGIT_WORDS[t].repeat(repeat);
      repeat = 1;
    } else {
      other++;
    }
  }
  if (!digits || (wholeAnswerOnly && other > 0)) return null;
  return digits;
}

const TODAY_WORDS = ['today', 'aaj', 'आज'];

// Best-effort cleanup for free-text answers (name/text/address) when there's no network to
// ask an LLM to do this properly. Only strips clearly-anchored filler; leaves anything else untouched.
export function stripAnswerFiller(text: string): string {
  return text
    .trim()
    .replace(/^(my\s+name\s+is|my\s+address\s+is|mera\s+naam|hamara\s+naam|मेरा\s+नाम|हमारा\s+नाम|मेरा\s+पता|हमारा\s+पता)\s*/i, '')
    .replace(/\s*(hai|hain|hoon|hun|है|हैं|हूँ|हूं)[.।]?\s*$/i, '')
    .trim();
}

export function parseByRules(text: string, field: FormField, today: Date): string | null {
  const options = field.options ?? [];

  if (field.type === 'choice' && options.length) {
    const isYesNo = options.length === 2 && options.some((o) => sameText(o, 'Yes')) && options.some((o) => sameText(o, 'No'));
    if (isYesNo) return yesNo(text);
    const exact = options.find((o) => sameText(o, text));
    if (exact) return exact;
    const contained = options.filter((o) => text.toLowerCase().includes(o.trim().toLowerCase()));
    return contained.length === 1 ? contained[0] : null;
  }
  if (field.type === 'checkbox' && !options.length) {
    return yesNo(text);
  }
  if (field.type === 'number') {
    // A known pattern (e.g. 10-digit mobile) can safely pick digits out of a sentence; otherwise the
    // whole answer must be digits, so "मेरे दो बच्चे हैं, उम्र पच्चीस" doesn't become "2".
    const digits = spokenDigits(text, !field.validation?.pattern);
    return digits ? validateValue(field, digits) : null;
  }
  if (field.type === 'date') {
    const tokens = words(text);
    if (tokens.some((t) => TODAY_WORDS.includes(t)) && !/\d/.test(text)) return formatDate(today);
    const m = text.match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})/);
    return m ? validateValue(field, `${m[1]}/${m[2]}/${m[3]}`) : null;
  }
  return null;
}

// ---------------------------------------------------------------- LLM fallback

export function fieldContext(field: FormField, lang: Lang, today: Date): string {
  const options = field.options?.length ? `Options (copy exactly): ${JSON.stringify(field.options)}` : 'Options: none';
  return `Form language: ${lang === 'hi' ? 'Hindi' : 'English'}
Field label: "${field.label}"
Question the person was asked: "${field.labelSpoken}"
Field type: ${field.type}
${options}
Today's date: ${formatDate(today)}`;
}

export const VALUE_RULES = `How to write value for each type:
- name: only the name itself, without "my name is" / "मेरा नाम ... है". Devanagari on a Hindi form,
  Latin script on an English form. If the label asks for English or capital letters, use Latin CAPITALS.
- date: DD/MM/YYYY. Convert spoken numbers and month names ("बारह मार्च दो हज़ार चार" → "12/03/2004").
  "today" / "आज" means today's date.
- number: digits only ("nine eight seven" → "987", "दो हज़ार चार" → "2004", "double five" → "55").
- choice: exactly one of the options, copied character for character.
- checkbox with options: every option the person chose, copied exactly, joined with ", ".
- checkbox without options: "Yes" or "No".
- text / address: just the answer, without filler like "my address is" / "मेरा पता ... है".
  Devanagari on a Hindi form; on an English form write it in Latin script (transliterate Hindi words).

Rules:
- Never invent anything the person did not say, and never infer an answer from other facts.
  For Yes/No options the person must clearly say yes or no (or an unmistakable equivalent like
  "बिल्कुल" / "not at all"); "I am a student" does NOT answer "Do you have a job?". This is a
  legal form, so asking again is always better than guessing.
- If the answer does not answer this question, is ambiguous, or is incomplete (e.g. a date with no year),
  value is null and reason is "unclear".
- For choice or checkbox answers that match none of the options, value is null and reason is "not-an-option".`;

export const LlmValueSchema = z.object({
  value: z.string().nullable(),
  reason: z.enum(['ok', 'unclear', 'not-an-option']).catch('unclear'),
});
export type LlmValue = z.infer<typeof LlmValueSchema>;

/** Rules first; otherwise the model's value, but only if it passes local validation. */
export function resolveAnswer(heard: Transcript, field: FormField, today: Date, llm: LlmValue): ParseResult {
  const text = heard.text.trim();
  if (!text || heard.confidence < MIN_CONFIDENCE) return { ok: false, reason: 'not-heard' };

  const byRules = parseByRules(text, field, today);
  if (byRules !== null) return { ok: true, value: byRules };

  if (llm.value === null) return { ok: false, reason: llm.reason === 'not-an-option' ? 'not-an-option' : 'unclear' };
  const valid = validateValue(field, llm.value);
  return valid !== null ? { ok: true, value: valid } : { ok: false, reason: 'unclear' };
}

/**
 * Text-only path (already-transcribed answers). Voice answers use hearAnswer, which does both
 * in one call, EXCEPT the on-device engine, which only transcribes and comes through here.
 *
 * `offline: true` skips the network call entirely (best-effort filler-stripping instead), so an
 * on-device answer in airplane mode never crashes the loop waiting on an unreachable Gemini.
 */
export async function parseAnswer(
  transcript: Transcript,
  field: FormField,
  lang: Lang,
  today: Date = new Date(),
  options: { offline?: boolean } = {}
): Promise<ParseResult> {
  const text = transcript.text.trim();
  if (!text || transcript.confidence < MIN_CONFIDENCE) return { ok: false, reason: 'not-heard' };

  const byRules = parseByRules(text, field, today);
  if (byRules !== null) return { ok: true, value: byRules };

  if (options.offline) {
    const valid = validateValue(field, stripAnswerFiller(text));
    return valid !== null ? { ok: true, value: valid } : { ok: false, reason: 'unclear' };
  }

  const prompt = `You are filling in one field of a paper form from a person's spoken answer.

${fieldContext(field, lang, today)}
The person said (speech-to-text, may mix Hindi and English): "${text}"

Return ONLY a JSON object: {"value": string | null, "reason": "ok" | "unclear" | "not-an-option"}

${VALUE_RULES}`;
  const json = await generateJson([{ text: prompt }], requireGeminiKey(), {
    models: FAST_MODELS,
    thinkingLevel: 'minimal',
    timeoutMs: 15000,
  });
  return resolveAnswer(transcript, field, today, LlmValueSchema.parse(json));
}
