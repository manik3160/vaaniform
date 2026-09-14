import { File } from 'expo-file-system';
import { Transcript, transcribeAudio } from './transcribe';

// expo-audio's HIGH_QUALITY preset records AAC in an .m4a container on both iOS and Android.
export async function transcribeRecording(uri: string, question: string): Promise<Transcript> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY. Add it to your .env file (see .env.example).');
  }
  const base64 = await new File(uri).base64();
  return transcribeAudio(base64, 'audio/m4a', question, apiKey);
}
