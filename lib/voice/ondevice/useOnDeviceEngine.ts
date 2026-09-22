import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Lang } from '../../schema/types';
import type { Heard, VoiceEngine } from '../engine';
import { speak, stopSpeaking } from '../speak';

// expo-speech (AVSpeechSynthesizer / Android TTS) already runs on-device with no
// network call, so the cloud and on-device engines share the same speak().
const RECOGNITION_LOCALE: Record<Lang, string> = { hi: 'hi-IN', en: 'en-IN' };

/**
 * OnDeviceEngine (PLAN.md Phase 3): the phone's own speech recognizer, run with
 * requiresOnDeviceRecognition so it works with no network at all. Verified on iPhone
 * in airplane mode for Hindi; English on-device support is unverified.
 *
 * Only produces a transcript, not a parsed value — useFormConversation falls back to
 * parseAnswer's rule-based parser (and Gemini, if reachable) the same as it does for
 * any transcript-only engine.
 */
export function useOnDeviceEngine(): VoiceEngine {
  return {
    name: 'On-device (offline)',
    isOffline: true,
    speak,
    stopSpeaking,
    listen(field, lang, { shouldCancel, onSpeechEnded }) {
      return new Promise<Heard | null>((resolve, reject) => {
        const startedAt = Date.now();
        let settled = false;
        let latest: { text: string; confidence: number } | null = null;

        const cancelPoll = setInterval(() => {
          if (shouldCancel()) ExpoSpeechRecognitionModule.stop();
        }, 200);

        const cleanup = () => {
          clearInterval(cancelPoll);
          resultSub.remove();
          endSub.remove();
          errorSub.remove();
        };

        const finish = (value: Heard | null) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(value);
        };

        const resultSub = ExpoSpeechRecognitionModule.addListener('result', (event) => {
          const top = event.results?.[0];
          if (top) latest = { text: top.transcript ?? '', confidence: top.confidence ?? 0.8 };
        });

        // 'end' fires once the recognizer disconnects, after the final 'result' (or with none heard).
        const endSub = ExpoSpeechRecognitionModule.addListener('end', () => {
          onSpeechEnded?.();
          if (shouldCancel()) {
            finish(null);
            return;
          }
          finish({
            text: latest?.text ?? '',
            confidence: latest?.confidence ?? 0,
            source: 'on-device',
            ms: Date.now() - startedAt,
          });
        });

        const errorSub = ExpoSpeechRecognitionModule.addListener('error', (event) => {
          onSpeechEnded?.();
          // no-speech just means the person said nothing; treat everything else as a real failure
          // (e.g. the on-device model isn't installed for this locale).
          if (event.error === 'no-speech') {
            finish({ text: '', confidence: 0, source: 'on-device', ms: Date.now() - startedAt });
          } else {
            cleanup();
            settled = true;
            reject(new Error(`On-device recognition error: ${event.error} — ${event.message}`));
          }
        });

        ExpoSpeechRecognitionModule.requestPermissionsAsync()
          .then((permission) => {
            if (settled) return;
            if (!permission.granted) {
              finish(null);
              throw new Error('Speech recognition permission was denied.');
            }
            ExpoSpeechRecognitionModule.start({
              lang: RECOGNITION_LOCALE[lang],
              requiresOnDeviceRecognition: true,
              continuous: false,
            });
          })
          .catch((err) => {
            cleanup();
            if (!settled) {
              settled = true;
              reject(err instanceof Error ? err : new Error(String(err)));
            }
          });
      });
    },
  };
}
