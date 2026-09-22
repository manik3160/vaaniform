import { FormField, Lang } from '../schema/types';
import { FailReason, sameText } from './parseAnswer';

export type Answers = Record<string, string>;

export const MAX_ATTEMPTS_PER_FIELD = 3;

export const PHRASES: Record<Lang, { didNotCatch: string; unclear: string; notAnOption: string; done: string }> = {
  hi: {
    didNotCatch: 'माफ़ कीजिए, मैं सुन नहीं पाया।',
    unclear: 'माफ़ कीजिए, मैं समझ नहीं पाया।',
    notAnOption: 'कृपया इनमें से एक चुनिए:',
    done: 'धन्यवाद, सारे सवाल पूरे हो गए।',
  },
  en: {
    didNotCatch: "Sorry, I didn't catch that.",
    unclear: "Sorry, I didn't understand that.",
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

/** Drops answers to fields that no longer apply, e.g. details after a gate changed from Yes to No. */
export function pruneInactive(fields: FormField[], answers: Answers): Answers {
  const kept: Answers = {};
  // Fields are ordered with gates before their dependents, so one pass handles chains.
  for (const field of fields) {
    if (answers[field.id] !== undefined && isFieldActive(field, kept)) kept[field.id] = answers[field.id];
  }
  return kept;
}

export function retryPrompt(field: FormField, lang: Lang, reason: FailReason): string {
  const phrases = PHRASES[lang];
  if (reason === 'not-an-option' && field.options?.length) {
    return `${phrases.notAnOption} ${field.options.join(', ')}. ${field.labelSpoken}`;
  }
  return `${reason === 'not-heard' ? phrases.didNotCatch : phrases.unclear} ${field.labelSpoken}`;
}

// ---------------------------------------------------------------- read-back confirmation

export const CONFIRM_PHRASES: Record<Lang, { isThisCorrect: string; allConfirmed: string }> = {
  hi: {
    isThisCorrect: 'क्या यह सही है?',
    allConfirmed: 'सभी जानकारी की पुष्टि हो गई है। अब आप फॉर्म को PDF के रूप में सुरक्षित कर सकते हैं।',
  },
  en: {
    isThisCorrect: 'Is this correct?',
    allConfirmed: 'All your answers are confirmed. You can now export the form as a PDF.',
  },
};

/** A throwaway Yes/No field used to ask "label: value — is this correct?" during read-back. */
export function makeConfirmField(field: FormField, value: string, lang: Lang): FormField {
  return {
    id: `__confirm_${field.id}__`,
    label: 'Confirm',
    labelSpoken: `${field.label}: ${value}. ${CONFIRM_PHRASES[lang].isThisCorrect}`,
    type: 'choice',
    options: ['Yes', 'No'],
    required: true,
  };
}
