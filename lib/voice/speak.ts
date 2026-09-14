import * as Speech from 'expo-speech';
import { Lang } from '../schema/types';

const SPEECH_LANGUAGE: Record<Lang, string> = { hi: 'hi-IN', en: 'en-IN' };

// Resolves when the phone has finished saying the text, so callers can start listening after.
export function speak(text: string, lang: Lang): Promise<void> {
  return new Promise((resolve, reject) => {
    Speech.speak(text, {
      language: SPEECH_LANGUAGE[lang],
      rate: 0.9,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: reject,
    });
  });
}

export function stopSpeaking(): Promise<void> {
  return Speech.stop();
}
