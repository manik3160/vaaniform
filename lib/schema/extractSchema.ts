import { File } from 'expo-file-system';
import { requireGeminiKey } from '../apiKey';
import { extractFromImage } from './gemini';
import { FormSchema } from './types';

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

export async function extractFormSchema(photoUri: string, mimeType?: string | null): Promise<FormSchema> {
  const extension = photoUri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  const type = mimeType ?? MIME_BY_EXTENSION[extension] ?? 'image/jpeg';
  const base64 = await new File(photoUri).base64();
  const extraction = await extractFromImage(base64, type, requireGeminiKey());

  return {
    ...extraction,
    id: makeId(),
    sourceImageUri: photoUri,
    createdAt: new Date().toISOString(),
  };
}
