/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transcribeAudio } from '../lib/voice/transcribe';

const QUESTIONS: Record<string, string> = {
  '01-hi-name.m4a': 'आपका पूरा नाम क्या है?',
  '02-hinglish-dob.m4a': 'आपकी जन्म तिथि क्या है?',
  '03-en-mobile.m4a': 'What is your mobile number?',
};

async function main() {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY (run with --env-file=.env)');

  const dir = join(process.cwd(), 'fixtures', 'audio');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.m4a'))) {
    const question = QUESTIONS[file] ?? 'What is your answer?';
    const started = Date.now();
    try {
      const base64 = readFileSync(join(dir, file)).toString('base64');
      const t = await transcribeAudio(base64, 'audio/m4a', question, apiKey);
      console.log(`${file} (${Date.now() - started} ms, confidence ${t.confidence}): "${t.text}"`);
    } catch (err) {
      console.log(`${file} FAILED after ${Date.now() - started} ms: ${err instanceof Error ? err.message : err}`);
    }
  }
}

main();
