import { useRef, useState } from 'react';
import { FormSchema, Lang } from '../schema/types';
import {
  Answers,
  CONFIRM_PHRASES,
  isFieldActive,
  makeConfirmField,
  MAX_ATTEMPTS_PER_FIELD,
  nextField,
  PHRASES,
  pruneInactive,
  retryPrompt,
} from './conversation';
import type { Heard, VoiceEngine } from './engine';
import { parseAnswer, resolveAnswer } from './parseAnswer';

export type Phase = 'idle' | 'asking' | 'listening' | 'transcribing' | 'done';

// Short gap so the tail of the spoken question isn't picked up as the start of the answer.
const PAUSE_BEFORE_LISTENING_MS = 300;
const MAX_CONFIRM_ATTEMPTS = 2;

export function useFormConversation(schema: FormSchema, engine: VoiceEngine) {
  const [answers, setAnswers] = useState<Answers>({});
  const [needsTyping, setNeedsTyping] = useState<Set<string>>(new Set());
  // Fields whose voice read-back never got a clear Yes/No; must be reviewed by hand before export.
  const [needsConfirmation, setNeedsConfirmation] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [currentFieldId, setCurrentFieldId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [lastHeard, setLastHeard] = useState<Heard | null>(null);
  const [micLevel, setMicLevel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);

  /** Asks one field by voice, retrying up to MAX_ATTEMPTS_PER_FIELD times. Null = never got a usable answer. */
  const askField = async (field: ReturnType<typeof makeConfirmField> | FormSchema['fields'][number], lang: Lang): Promise<string | null> => {
    let prompt = field.labelSpoken;
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_FIELD; attempt++) {
      setPhase('asking');
      await engine.speak(prompt, lang);
      if (cancelledRef.current) return null;

      await new Promise((r) => setTimeout(r, PAUSE_BEFORE_LISTENING_MS));
      setPhase('listening');
      const heard = await engine.listen(field, lang, {
        shouldCancel: () => cancelledRef.current,
        onLevel: setMicLevel,
        onSpeechEnded: () => {
          setMicLevel(null);
          setPhase('transcribing');
        },
      });
      if (!heard || cancelledRef.current) return null;
      setLastHeard(heard);

      const parsed = heard.understood
        ? resolveAnswer(heard, field, new Date(), heard.understood)
        : await parseAnswer(heard, field, lang, new Date(), { offline: engine.isOffline });
      if (cancelledRef.current) return null;
      if (parsed.ok) return parsed.value;
      prompt = retryPrompt(field, lang, parsed.reason);
    }
    return null;
  };

  const start = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    cancelledRef.current = false;
    setError(null);
    setConfirmed(false);

    const lang = schema.detectedLanguage;
    let current = { ...answers };
    // Fields that failed on a previous run get another chance when the user presses Start again.
    const gaveUp = new Set<string>();
    setNeedsTyping(new Set());
    setNeedsConfirmation(new Set());

    try {
      // --- Fill in whatever isn't answered yet ---
      for (let field = nextField(schema.fields, current, gaveUp); field; field = nextField(schema.fields, current, gaveUp)) {
        setCurrentFieldId(field.id);
        setLastHeard(null);
        const value = await askField(field, lang);
        if (cancelledRef.current) return;

        if (value === null) {
          gaveUp.add(field.id);
          setNeedsTyping(new Set(gaveUp));
          continue;
        }
        current = { ...current, [field.id]: value };
        setAnswers(current);
      }

      // --- Read every active answer back for confirmation (PLAN.md's trust loop) ---
      const unconfirmed = new Set<string>();
      for (const field of schema.fields) {
        // A correction just below may have pruned this field's answer if a gate changed; skip it.
        if (current[field.id] === undefined || !isFieldActive(field, current)) continue;

        setCurrentFieldId(field.id);
        let ok = false;
        for (let attempt = 0; attempt < MAX_CONFIRM_ATTEMPTS && !ok; attempt++) {
          setLastHeard(null);
          const confirmAnswer = await askField(makeConfirmField(field, current[field.id], lang), lang);
          if (cancelledRef.current) return;

          if (confirmAnswer === 'Yes') {
            ok = true;
          } else if (confirmAnswer === 'No') {
            setLastHeard(null);
            const corrected = await askField(field, lang);
            if (cancelledRef.current) return;
            if (corrected !== null) {
              current = pruneInactive(schema.fields, { ...current, [field.id]: corrected });
              setAnswers(current);
            } else {
              gaveUp.add(field.id);
              setNeedsTyping(new Set(gaveUp));
            }
            ok = true; // move on either way; a fresh correction still counts as reviewed
          }
          // confirmAnswer === null (didn't catch yes/no): loop again, up to MAX_CONFIRM_ATTEMPTS.
        }
        if (!ok) unconfirmed.add(field.id);
      }

      setNeedsConfirmation(unconfirmed);
      setCurrentFieldId(null);

      if (unconfirmed.size === 0 && gaveUp.size === 0) {
        setConfirmed(true);
        setPhase('done');
        await engine.speak(CONFIRM_PHRASES[lang].allConfirmed, lang);
      } else {
        // Something needs a manual look (see FormFiller) before export unlocks.
        setPhase('idle');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('idle');
    } finally {
      runningRef.current = false;
      if (cancelledRef.current) {
        setPhase('idle');
        setMicLevel(null);
        setCurrentFieldId(null);
      }
    }
  };

  const stop = async () => {
    cancelledRef.current = true;
    await engine.stopSpeaking();
  };

  const reset = () => {
    if (runningRef.current) return;
    setAnswers({});
    setNeedsTyping(new Set());
    setNeedsConfirmation(new Set());
    setConfirmed(false);
    setCurrentFieldId(null);
    setLastHeard(null);
    setPhase('idle');
  };

  /** Typed or corrected answer. Only while the voice loop is stopped; `value` must already be validated. */
  const setAnswer = (fieldId: string, value: string | null) => {
    if (runningRef.current) return;
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === null) delete next[fieldId];
      else next[fieldId] = value;
      return pruneInactive(schema.fields, next);
    });
    setNeedsTyping((prev) => {
      const next = new Set(prev);
      next.delete(fieldId);
      return next;
    });
    setNeedsConfirmation((prev) => {
      const next = new Set(prev);
      next.delete(fieldId);
      return next;
    });
    // Any manual change means the read-back no longer covers the current answers.
    setConfirmed(false);
    if (phase === 'done') setPhase('idle');
  };

  /** Manual fallback for PLAN.md's "only after full confirmation does export unlock": once every
   * flagged field has been reviewed by hand (needsTyping/needsConfirmation both empty), the user
   * can confirm the form themselves instead of redoing voice read-back. */
  const confirmManually = () => {
    if (Object.keys(answers).length > 0 && needsTyping.size === 0 && needsConfirmation.size === 0) {
      setConfirmed(true);
    }
  };

  return {
    answers,
    needsTyping,
    needsConfirmation,
    confirmed,
    currentFieldId,
    phase,
    lastHeard,
    micLevel,
    error,
    start,
    stop,
    reset,
    setAnswer,
    confirmManually,
  };
}
