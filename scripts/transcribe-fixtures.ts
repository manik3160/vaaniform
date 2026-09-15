/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FormField, Lang } from '../lib/schema/types';
import { resolveAnswer } from '../lib/voice/parseAnswer';
import { hearAnswer } from '../lib/voice/cloud/hearAnswer';

const TODAY = new Date(2026, 8, 15);

const CLIPS: { file: string; lang: Lang; field: FormField; expect: string }[] = [
  {
    file: '01-hi-name.m4a',
    lang: 'hi',
    field: { id: 'full_name', label: 'पूरा नाम', labelSpoken: 'आपका पूरा नाम क्या है?', type: 'name', required: true },
    expect: 'मानिक',
  },
  {
    file: '02-hinglish-dob.m4a',
    lang: 'hi',
    field: { id: 'date_of_birth', label: 'जन्म की तिथि', labelSpoken: 'आपकी जन्म तिथि क्या है?', type: 'date', required: true },
    expect: '12/03/2004',
  },
  {
    file: '03-en-mobile.m4a',
    lang: 'en',
    field: { id: 'mobile_number', label: 'Mobile number', labelSpoken: 'What is your mobile number?', type: 'number', required: true, validation: { pattern: '^\\d{10}$' } },
    expect: '9876543210',
  },
  {
    file: '04-hi-no-job.m4a',
    lang: 'hi',
    field: { id: 'is_employed', label: 'नौकरी करते हैं', labelSpoken: 'क्या आप कोई नौकरी करते हैं?', type: 'choice', options: ['Yes', 'No'], required: true },
    expect: 'No',
  },
];

async function main() {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY (run with --env-file=.env)');

  let failures = 0;
  for (const clip of CLIPS) {
    const started = Date.now();
    try {
      const base64 = readFileSync(join(process.cwd(), 'fixtures', 'audio', clip.file)).toString('base64');
      const heard = await hearAnswer(base64, 'audio/m4a', clip.field, clip.lang, apiKey, TODAY);
      const result = resolveAnswer(heard, clip.field, TODAY, heard);
      const ok = result.ok && result.value === clip.expect;
      if (!ok) failures++;
      console.log(
        `${ok ? 'PASS' : 'FAIL'} ${clip.file} (${Date.now() - started} ms): heard "${heard.text}" → ` +
          `${result.ok ? `"${result.value}"` : `rejected (${result.reason})`}${ok ? '' : ` — expected "${clip.expect}"`}`
      );
    } catch (err) {
      failures++;
      console.log(`FAIL ${clip.file} after ${Date.now() - started} ms: ${err instanceof Error ? err.message.slice(0, 200) : err}`);
    }
  }
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASS');
  process.exitCode = failures ? 1 : 0;
}

main();
