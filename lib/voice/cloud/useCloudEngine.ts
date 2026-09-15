import { File } from 'expo-file-system';
import { requireGeminiKey } from '../../apiKey';
import type { VoiceEngine } from '../engine';
import { speak, stopSpeaking } from '../speak';
import { useAnswerRecorder } from '../useAnswerRecorder';
import { hearAnswer } from './hearAnswer';

/**
 * CloudEngine: device text-to-speech for questions, Gemini for hearing answers.
 * A hook because recording needs expo-audio's recorder, which is itself a hook.
 */
export function useCloudEngine(): VoiceEngine {
  const recorder = useAnswerRecorder();

  return {
    name: 'Cloud (Gemini)',
    isOffline: false,
    speak,
    stopSpeaking,
    async listen(field, lang, { shouldCancel, onLevel, onSpeechEnded }) {
      const { uri } = await recorder.recordAnswer({ shouldCancel, onLevel });
      if (shouldCancel()) return null;
      onSpeechEnded?.();

      // Recordings are AAC in an .m4a container on both iOS and Android.
      const base64 = await new File(uri).base64();
      const heard = await hearAnswer(base64, 'audio/m4a', field, lang, requireGeminiKey());
      return {
        text: heard.text,
        confidence: heard.confidence,
        understood: { value: heard.value, reason: heard.reason },
        source: heard.model,
        ms: heard.ms,
      };
    },
  };
}
