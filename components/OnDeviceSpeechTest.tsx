import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

// Phase 3 spike (PLAN.md §12): does the phone's own speech recognizer understand
// Hindi with no network at all? If yes, that alone can replace the Gemini transcription
// call. Tested by turning on airplane mode and tapping Start.
export function OnDeviceSpeechTest() {
  const [status, setStatus] = useState('Not started');
  const [transcript, setTranscript] = useState('');
  const [localesInfo, setLocalesInfo] = useState('');
  const [listening, setListening] = useState(false);

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    setTranscript(event.results[0]?.transcript ?? '');
  });
  useSpeechRecognitionEvent('error', (event) => {
    setStatus(`Error: ${event.error} — ${event.message}`);
  });

  const checkHindiSupport = async () => {
    setStatus('Checking...');
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setStatus(`Permission denied: ${perm.status}`);
      return;
    }
    const { locales, installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({});
    const hindiListed = locales.some((l) => l.toLowerCase().startsWith('hi'));
    const hindiInstalled = installedLocales.some((l) => l.toLowerCase().startsWith('hi'));
    setLocalesInfo(
      `hi-IN listed: ${hindiListed ? 'yes' : 'no'} · installed on-device: ${hindiInstalled ? 'yes' : 'no'}\n` +
        `(${installedLocales.length} locales installed total)`
    );
    setStatus(hindiInstalled ? 'Hindi looks available offline — try Start' : 'Hindi not shown as installed; Start may still work if this check is unreliable');
  };

  const start = () => {
    setTranscript('');
    setStatus('Listening (on-device only — this fails if it needs network)');
    ExpoSpeechRecognitionModule.start({
      lang: 'hi-IN',
      requiresOnDeviceRecognition: true,
      continuous: false,
      iosTaskHint: 'confirmation',
    });
  };

  const stop = () => {
    ExpoSpeechRecognitionModule.stop();
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>On-device Hindi test (Phase 3 spike)</Text>
      <Text style={styles.hint}>
        Turn on airplane mode before testing Start, so a real result proves it works with
        no network at all.
      </Text>
      <View style={styles.row}>
        <Button title="Check Hindi support" onPress={checkHindiSupport} />
        <Button title={listening ? 'Stop' : 'Start (say something in Hindi)'} onPress={listening ? stop : start} />
      </View>
      {localesInfo !== '' && <Text style={styles.mono}>{localesInfo}</Text>}
      <Text>{status}</Text>
      {transcript !== '' && <Text style={styles.transcript}>Heard: "{transcript}"</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', gap: 8, padding: 12, borderWidth: 1, borderColor: '#ccc' },
  title: { fontWeight: 'bold' },
  hint: { fontSize: 12, color: '#555' },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  mono: { fontSize: 12, color: '#333' },
  transcript: { fontSize: 18 },
});
