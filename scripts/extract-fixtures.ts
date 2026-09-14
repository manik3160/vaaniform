/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { extractFromImage } from '../lib/schema/gemini';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

async function main() {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY (run with --env-file=.env)');

  const dir = join(process.cwd(), 'fixtures');
  const filter = process.argv[2];
  const files = readdirSync(dir).filter(
    (f) => MIME_TYPES[extname(f).toLowerCase()] && (!filter || f.includes(filter))
  );

  for (const file of files) {
    console.log(`\n=== ${file} ===`);
    try {
      const base64 = readFileSync(join(dir, file)).toString('base64');
      const form = await extractFromImage(base64, MIME_TYPES[extname(file).toLowerCase()], apiKey);
      console.log(`${form.title} (${form.detectedLanguage})`);
      for (const f of form.fields) {
        const flags = [f.type, f.required ? 'required' : 'optional'];
        if (f.options?.length) flags.push(`options: ${f.options.join('/')}`);
        if (f.dependsOn) flags.push(`if ${f.dependsOn.fieldId} = ${f.dependsOn.equals}`);
        console.log(`- ${f.id} [${flags.join(', ')}] ${f.label}\n    → "${f.labelSpoken}"`);
      }
    } catch (err) {
      console.log(`FAILED: ${err instanceof Error ? err.message : err}`);
    }
  }
}

main();
