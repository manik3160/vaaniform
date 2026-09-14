import { File } from 'expo-file-system';
import { requireGeminiKey } from '../apiKey';
import { FormField, Lang } from '../schema/types';
import { HeardAnswer, hearAnswer } from './transcribe';

// expo-audio's HIGH_QUALITY preset records AAC in an .m4a container on both iOS and Android.
export async function hearRecording(uri: string, field: FormField, lang: Lang): Promise<HeardAnswer> {
  const base64 = await new File(uri).base64();
  return hearAnswer(base64, 'audio/m4a', field, lang, requireGeminiKey());
}
