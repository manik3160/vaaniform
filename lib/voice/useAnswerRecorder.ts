import { useRef } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface RecordAnswerOptions {
  /** Hard cap on one answer. */
  maxMs?: number;
  /** Give up if no speech has started by then. */
  noSpeechMs?: number;
  /** Stop this long after speech goes quiet. */
  silenceMs?: number;
  shouldCancel?: () => boolean;
  onLevel?: (db: number) => void;
}

export interface RecordAnswerResult {
  uri: string;
  heardSpeech: boolean;
  /** False if the platform reported no mic levels, so silence detection could not run. */
  meteringAvailable: boolean;
}

// Levels in the first moments set the room's noise floor; speech is anything clearly louder.
const CALIBRATION_MS = 400;
const SPEECH_ABOVE_FLOOR_DB = 10;
const QUIETEST_FLOOR_DB = -60;
const NOISIEST_FLOOR_DB = -35;
// Without mic levels we can't detect the end of speech, so record a fixed window instead.
const FIXED_WINDOW_MS = 8000;

// Mono 16 kHz is what speech recognition needs; ~4x smaller upload than HIGH_QUALITY (stereo 44.1 kHz 128 kbps).
const SPEECH_RECORDING = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
};

export function useAnswerRecorder() {
  const recorder = useAudioRecorder(SPEECH_RECORDING);
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  const start = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Microphone permission was denied.');
    }
    // iOS "record" mode can route output to the quiet earpiece, so only enable it while recording.
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorderRef.current.prepareToRecordAsync();
    recorderRef.current.record();
  };

  const stop = async (): Promise<string> => {
    await recorderRef.current.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (!recorderRef.current.uri) {
      throw new Error('Recording finished but produced no audio file.');
    }
    return recorderRef.current.uri;
  };

  const recordAnswer = async (options: RecordAnswerOptions = {}): Promise<RecordAnswerResult> => {
    const { maxMs = 15000, noSpeechMs = 6000, silenceMs = 900, shouldCancel, onLevel } = options;
    await start();

    const startedAt = Date.now();
    const calibration: number[] = [];
    let threshold: number | null = null;
    let meteringAvailable = false;
    let heardSpeech = false;
    let lastSpeechAt = 0;

    while (true) {
      await sleep(100);
      const elapsed = Date.now() - startedAt;
      const level = recorderRef.current.getStatus().metering;

      if (typeof level === 'number' && Number.isFinite(level)) {
        meteringAvailable = true;
        onLevel?.(level);
        if (elapsed < CALIBRATION_MS) {
          calibration.push(level);
        } else {
          if (threshold === null) {
            const floor = calibration.length
              ? calibration.reduce((a, b) => a + b, 0) / calibration.length
              : level;
            const clamped = Math.min(NOISIEST_FLOOR_DB, Math.max(QUIETEST_FLOOR_DB, floor));
            threshold = clamped + SPEECH_ABOVE_FLOOR_DB;
          }
          if (level > threshold) {
            heardSpeech = true;
            lastSpeechAt = elapsed;
          }
        }
      }

      if (shouldCancel?.()) break;
      if (elapsed >= maxMs) break;
      if (!meteringAvailable) {
        if (elapsed >= FIXED_WINDOW_MS) break;
        continue;
      }
      if (heardSpeech && elapsed - lastSpeechAt >= silenceMs) break;
      if (!heardSpeech && elapsed >= noSpeechMs) break;
    }

    const uri = await stop();
    return { uri, heardSpeech, meteringAvailable };
  };

  return { recordAnswer };
}
