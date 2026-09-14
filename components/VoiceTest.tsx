import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { Lang } from '../lib/schema/types';
import { speak } from '../lib/voice/speak';
import { Transcript } from '../lib/voice/transcribe';
import { transcribeRecording } from '../lib/voice/transcribeRecording';
import { useAnswerRecorder } from '../lib/voice/useAnswerRecorder';

const SAMPLE_QUESTIONS: Record<Lang, string> = {
  hi: 'आपका पूरा नाम क्या है?',
  en: 'What is your full name?',
};

export function VoiceTest() {
  const [lang, setLang] = useState<Lang>('hi');
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [transcript, setTranscript] = useState<(Transcript & { ms: number }) | null>(null);
  const recorder = useAnswerRecorder();
  const player = useAudioPlayer(null);

  const run = async (label: string, action: () => Promise<void>) => {
    try {
      setStatus(label);
      await action();
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const askQuestion = () =>
    run('Speaking…', async () => {
      await speak(SAMPLE_QUESTIONS[lang], lang);
      setStatus('Finished speaking');
    });

  const toggleRecording = () =>
    recorder.isRecording
      ? run('Stopping…', async () => {
          const uri = await recorder.stop();
          setRecordingUri(uri);
          setStatus('Transcribing…');
          const started = Date.now();
          const result = await transcribeRecording(uri, SAMPLE_QUESTIONS[lang]);
          setTranscript({ ...result, ms: Date.now() - started });
          setStatus('Transcribed');
        })
      : run('Recording… tap Stop when done', async () => {
          setTranscript(null);
          await recorder.start();
        });

  const playBack = () => {
    if (!recordingUri) return;
    player.replace({ uri: recordingUri });
    player.seekTo(0);
    player.play();
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Voice test ({lang === 'hi' ? 'Hindi' : 'English'})</Text>
      <Button
        title={lang === 'hi' ? 'Switch to English' : 'Switch to Hindi'}
        onPress={() => setLang(lang === 'hi' ? 'en' : 'hi')}
      />
      <Button title={`Ask: "${SAMPLE_QUESTIONS[lang]}"`} onPress={askQuestion} />
      <Button
        title={
          recorder.isRecording
            ? `Stop recording (${Math.round(recorder.durationMillis / 1000)}s)`
            : 'Record answer'
        }
        onPress={toggleRecording}
      />
      {recordingUri && !recorder.isRecording && (
        <Button title="Play back recording" onPress={playBack} />
      )}
      {status !== '' && <Text>{status}</Text>}
      {transcript && (
        <Text style={styles.transcript}>
          {transcript.text === '' ? '(no speech heard)' : `"${transcript.text}"`}
          {`\nconfidence ${transcript.confidence} · ${(transcript.ms / 1000).toFixed(1)}s`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  title: {
    fontWeight: 'bold',
  },
  transcript: {
    fontSize: 16,
  },
});
