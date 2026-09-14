import { File } from 'expo-file-system';
import { extractFromImage } from './gemini';
import { FormSchema } from './types';

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function extractFormSchema(photoUri: string): Promise<FormSchema> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_GEMINI_API_KEY. Add it to your .env file (see .env.example).'
    );
  }

  const base64 = await new File(photoUri).base64();
  const extraction = await extractFromImage(base64, 'image/jpeg', apiKey);

  return {
    ...extraction,
    id: makeId(),
    sourceImageUri: photoUri,
    createdAt: new Date().toISOString(),
  };
}
