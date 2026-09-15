import { useRef, useState } from 'react';
import { FormSchema } from '../schema/types';
import {
  Answers,
  MAX_ATTEMPTS_PER_FIELD,
  nextField,
  PHRASES,
  pruneInactive,
  retryPrompt,
} from './conversation';
import { resolveAnswer } from './parseAnswer';
import { speak, stopSpeaking } from './speak';
import { HeardAnswer } from './transcribe';
import { hearRecording } from './transcribeRecording';
import { useAnswerRecorder } from './useAnswerRecorder';

export type Phase = 'idle' | 'asking' | 'listening' | 'transcribing' | 'done';

// Short gap so the tail of the spoken question isn't picked up as the start of the answer.
const PAUSE_BEFORE_LISTENING_MS = 300;

export function useFormConversation(schema: FormSchema) {
  const recorder = useAnswerRecorder();
  const [answers, setAnswers] = useState<Answers>({});
  const [needsTyping, setNeedsTyping] = useState<Set<string>>(new Set());
  const [currentFieldId, setCurrentFieldId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [lastHeard, setLastHeard] = useState<HeardAnswer | null>(null);
  const [micLevel, setMicLevel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);

  const start = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    cancelledRef.current = false;
    setError(null);

    const lang = schema.detectedLanguage;
    let current = { ...answers };
    // Fields that failed on a previous run get another chance when the user presses Start again.
    const gaveUp = new Set<string>();
    setNeedsTyping(new Set());

    try {
      for (let field = nextField(schema.fields, current, gaveUp); field; field = nextField(schema.fields, current, gaveUp)) {
        setCurrentFieldId(field.id);
        setLastHeard(null);
        let prompt = field.labelSpoken;
        let value: string | null = null;

        for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_FIELD && value === null; attempt++) {
          setPhase('asking');
          await speak(prompt, lang);
          if (cancelledRef.current) return;

          await new Promise((r) => setTimeout(r, PAUSE_BEFORE_LISTENING_MS));
          setPhase('listening');
          const { uri } = await recorder.listen({
            shouldCancel: () => cancelledRef.current,
            onLevel: setMicLevel,
          });
          setMicLevel(null);
          if (cancelledRef.current) return;

          setPhase('transcribing');
          const heard = await hearRecording(uri, field, lang);
          if (cancelledRef.current) return;
          setLastHeard(heard);

          const parsed = resolveAnswer(heard, field, new Date(), heard);
          if (parsed.ok) {
            value = parsed.value;
          } else {
            prompt = retryPrompt(field, lang, parsed.reason);
          }
        }

        if (value === null) {
          gaveUp.add(field.id);
          setNeedsTyping(new Set(gaveUp));
          continue;
        }
        current = { ...current, [field.id]: value };
        setAnswers(current);
      }

      setCurrentFieldId(null);
      setPhase('done');
      await speak(PHRASES[lang].done, lang);
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
    await stopSpeaking();
  };

  const reset = () => {
    if (runningRef.current) return;
    setAnswers({});
    setNeedsTyping(new Set());
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
    if (phase === 'done') setPhase('idle');
  };

  return { answers, needsTyping, currentFieldId, phase, lastHeard, micLevel, error, start, stop, reset, setAnswer };
}
