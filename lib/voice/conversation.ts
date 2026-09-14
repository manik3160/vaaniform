import { FormField, Lang } from '../schema/types';
import { Transcript } from './transcribe';

export type Answers = Record<string, string>;

export const MAX_ATTEMPTS_PER_FIELD = 3;
const MIN_CONFIDENCE = 0.5;

export const PHRASES: Record<Lang, { didNotCatch: string; notAnOption: string; done: string }> = {
  hi: {
    didNotCatch: 'माफ़ कीजिए, मैं समझ नहीं पाया।',
    notAnOption: 'कृपया इनमें से एक चुनिए:',
    done: 'धन्यवाद, सारे सवाल पूरे हो गए।',
  },
  en: {
    didNotCatch: "Sorry, I didn't catch that.",
    notAnOption: 'Please choose one of:',
    done: "Thank you, that's all the questions.",
  },
};

export function isFieldActive(field: FormField, answers: Answers): boolean {
  if (!field.dependsOn) return true;
  const gateAnswer = answers[field.dependsOn.fieldId];
  return gateAnswer !== undefined && sameText(gateAnswer, field.dependsOn.equals);
}

/** The next field that applies and has no answer yet, or null when the form is complete. */
export function nextField(fields: FormField[], answers: Answers, skip: Set<string>): FormField | null {
  return (
    fields.find((f) => answers[f.id] === undefined && !skip.has(f.id) && isFieldActive(f, answers)) ??
    null
  );
}

const YES_WORDS = ['yes', 'yeah', 'haan', 'han', 'ha', 'haa', 'ji', 'हाँ', 'हां', 'हा', 'जी'];
const NO_WORDS = ['no', 'nahi', 'nahin', 'na', 'nope', 'नहीं', 'नही', 'ना', 'न'];

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function words(text: string): string[] {
  return text.toLowerCase().split(/[\s,.!?।"'-]+/).filter(Boolean);
}

function matchOption(text: string, options: string[]): string | null {
  const spoken = text.trim().toLowerCase();
  const exact = options.find((o) => sameText(o, spoken));
  if (exact) return exact;

  const tokens = words(text);
  const isYesNo = options.length === 2 && options.some((o) => sameText(o, 'Yes')) && options.some((o) => sameText(o, 'No'));
  if (isYesNo) {
    // Check "no" first: "नहीं जी" is a no even though it contains "जी".
    if (tokens.some((t) => NO_WORDS.includes(t))) return options.find((o) => sameText(o, 'No'))!;
    if (tokens.some((t) => YES_WORDS.includes(t))) return options.find((o) => sameText(o, 'Yes'))!;
    return null;
  }

  const contained = options.filter((o) => spoken.includes(o.trim().toLowerCase()));
  return contained.length === 1 ? contained[0] : null;
}

export type ParseResult =
  | { ok: true; value: string }
  | { ok: false; reason: 'not-heard' | 'not-an-option' };

// Step 3 placeholder: takes the transcript as the answer. Step 4 replaces this with real
// normalisation (dates, numbers, Hinglish) and an LLM fallback.
export function parseAnswer(transcript: Transcript, field: FormField): ParseResult {
  const text = transcript.text.trim();
  if (!text || transcript.confidence < MIN_CONFIDENCE) return { ok: false, reason: 'not-heard' };

  if (field.type === 'choice' && field.options?.length) {
    const option = matchOption(text, field.options);
    return option ? { ok: true, value: option } : { ok: false, reason: 'not-an-option' };
  }
  return { ok: true, value: text };
}

export function retryPrompt(field: FormField, lang: Lang, reason: 'not-heard' | 'not-an-option'): string {
  const phrases = PHRASES[lang];
  if (reason === 'not-an-option' && field.options?.length) {
    return `${phrases.notAnOption} ${field.options.join(', ')}. ${field.labelSpoken}`;
  }
  return `${phrases.didNotCatch} ${field.labelSpoken}`;
}
