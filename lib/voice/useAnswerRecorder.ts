import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

export function useAnswerRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);

  const start = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Microphone permission was denied.');
    }
    // iOS "record" mode can route output to the quiet earpiece, so only enable it while recording.
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const stop = async (): Promise<string> => {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (!recorder.uri) {
      throw new Error('Recording finished but produced no audio file.');
    }
    return recorder.uri;
  };

  return {
    start,
    stop,
    isRecording: state.isRecording,
    durationMillis: state.durationMillis,
  };
}
