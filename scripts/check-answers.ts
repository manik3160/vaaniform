/// <reference types="node" />
import { isFieldActive, nextField, pruneInactive } from '../lib/voice/conversation';
import { parseAnswer, parseByRules } from '../lib/voice/parseAnswer';
import { FormField, Lang } from '../lib/schema/types';

const TODAY = new Date(2026, 8, 15);

const f = (partial: Partial<FormField> & Pick<FormField, 'id' | 'type'>): FormField => ({
  label: partial.id,
  labelSpoken: partial.id,
  required: true,
  ...partial,
});

const FIELDS = {
  nameHi: f({ id: 'full_name', type: 'name', label: 'पूरा नाम', labelSpoken: 'आपका पूरा नाम क्या है?' }),
  nameEn: f({ id: 'full_name', type: 'name', label: 'Full Name', labelSpoken: 'What is your full name?' }),
  nameCapitals: f({ id: 'child_name_english', type: 'text', label: 'नवजात शिशु का नाम (अंग्रेजी के बड़े अक्षरों में)', labelSpoken: 'नवजात शिशु का अंग्रेजी में क्या नाम है?' }),
  dob: f({ id: 'date_of_birth', type: 'date', label: 'जन्म की तिथि', labelSpoken: 'आपकी जन्म तिथि क्या है?' }),
  filling: f({ id: 'date_of_filling', type: 'date', label: 'Date', labelSpoken: 'What date should go on the form?' }),
  age: f({ id: 'mother_age', type: 'number', label: 'माता की आयु', labelSpoken: 'विवाह के समय माता की आयु कितने वर्ष थी?' }),
  year: f({ id: 'year_of_passing', type: 'number', label: 'Year of passing', labelSpoken: 'Which year did you pass?' }),
  mobile: f({ id: 'mobile_number', type: 'number', label: 'Mobile number', labelSpoken: 'What is your mobile number?', validation: { pattern: '^\\d{10}$' } }),
  religion: f({ id: 'family_religion', type: 'choice', label: 'परिवार का धर्म', labelSpoken: 'परिवार का धर्म क्या है?', options: ['हिन्दू', 'मुस्लिम', 'ईसाई', 'अन्य धर्म'] }),
  gender: f({ id: 'gender', type: 'choice', label: 'Gender', labelSpoken: 'What is your gender?', options: ['Female', 'Male', 'Third gender / Transgender'] }),
  gate: f({ id: 'is_employed', type: 'choice', label: 'Employed', labelSpoken: 'क्या आप कोई नौकरी करते हैं?', options: ['Yes', 'No'] }),
  updates: f({ id: 'information_to_be_updated', type: 'checkbox', label: 'Information to be updated', labelSpoken: 'Which information do you wish to update?', options: ['Biometric (photo, fingerprints and irises)', 'Name', 'Date of Birth', 'Gender', 'Address', 'Mobile', 'Email'] }),
  address: f({ id: 'address', type: 'address', label: 'Address', labelSpoken: 'What is your address?' }),
};

type Expect = { value: string } | { rejected: true };
const CASES: [string, FormField, Lang, string, Expect][] = [
  // rule-based
  ['yes: हाँ जी', FIELDS.gate, 'hi', 'हाँ जी', { value: 'Yes' }],
  ['no: नहीं जी', FIELDS.gate, 'hi', 'नहीं जी', { value: 'No' }],
  ['no: nahi, koi job nahi', FIELDS.gate, 'hi', 'nahi, koi job nahi', { value: 'No' }],
  ['option contained', FIELDS.religion, 'hi', 'हम हिन्दू हैं', { value: 'हिन्दू' }],
  ['mobile in a sentence', FIELDS.mobile, 'en', 'My mobile number is nine eight seven six five four three two one zero.', { value: '9876543210' }],
  ['mobile, Hindi digit words', FIELDS.mobile, 'hi', 'नौ आठ सात छह पांच चार तीन दो एक शून्य', { value: '9876543210' }],
  ['mobile with "double"', FIELDS.mobile, 'en', 'double nine eight seven six five four three two one', { value: '9987654321' }],
  ['mobile, typed-style digits', FIELDS.mobile, 'en', '98765 43210', { value: '9876543210' }],
  ['numeric date', FIELDS.dob, 'hi', '12/03/2004', { value: '12/03/2004' }],
  ['today', FIELDS.filling, 'en', 'today', { value: '15/09/2026' }],
  ['आज की तारीख', FIELDS.filling, 'hi', 'आज की तारीख डाल दो', { value: '15/09/2026' }],
  // LLM fallback
  ['name without filler (hi)', FIELDS.nameHi, 'hi', 'मेरा नाम मानिक है।', { value: 'मानिक' }],
  ['Hinglish name on English form', FIELDS.nameEn, 'en', 'mera naam Manik Sharma hai', { value: 'Manik Sharma' }],
  ['English capitals requested', FIELDS.nameCapitals, 'hi', 'इसका नाम आरव है', { value: 'AARAV' }],
  ['Hinglish date', FIELDS.dob, 'hi', 'मेरी date of birth बारह मार्च दो हज़ार चार है।', { value: '12/03/2004' }],
  ['date with no year', FIELDS.dob, 'hi', 'twelve march', { rejected: true }],
  ['impossible date', FIELDS.dob, 'hi', '31 फरवरी 2004', { rejected: true }],
  ['age in words', FIELDS.age, 'hi', 'पच्चीस साल', { value: '25' }],
  ['do hazaar chaar', FIELDS.year, 'en', 'do hazaar chaar', { value: '2004' }],
  ['option in English on Hindi form', FIELDS.religion, 'hi', 'we are Christian', { value: 'ईसाई' }],
  ['gender paraphrase', FIELDS.gender, 'en', 'I am a man', { value: 'Male' }],
  ['multi-tick checkbox', FIELDS.updates, 'en', 'name aur address update karna hai', { value: 'Name, Address' }],
  ['non-answer to yes/no', FIELDS.gate, 'hi', 'मैं student हूँ', { rejected: true }],
  ['9-digit mobile', FIELDS.mobile, 'en', 'nine eight seven six five four three two one', { rejected: true }],
  ['address without filler', FIELDS.address, 'en', 'mera address hai 12 Gandhi Nagar, Sonipat', { value: '12 Gandhi Nagar, Sonipat' }],
];

async function main() {
  let failures = 0;
  const report = (ok: boolean, line: string) => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${line}`);
  };

  console.log('--- flow logic ---');
  const detail = f({ id: 'employer', type: 'text', dependsOn: { fieldId: 'is_employed', equals: 'Yes' } });
  const flow = [FIELDS.gate, detail, FIELDS.nameHi];
  report(isFieldActive(detail, {}) === false, 'details hidden before gate is answered');
  report(isFieldActive(detail, { is_employed: 'Yes' }), 'details shown after Yes');
  report(nextField(flow, { is_employed: 'No' }, new Set())?.id === 'full_name', 'No skips the details question');
  report(nextField(flow, { is_employed: 'No' }, new Set(['full_name'])) === null, 'given-up field is not re-asked');
  report(
    JSON.stringify(pruneInactive(flow, { is_employed: 'No', employer: 'ACME', full_name: 'x' })) ===
      JSON.stringify({ is_employed: 'No', full_name: 'x' }),
    'changing gate to No drops the old details answer'
  );

  const useLlm = Boolean(process.env.EXPO_PUBLIC_GEMINI_API_KEY);
  console.log(`--- answers${useLlm ? '' : ' (no API key: skipping LLM cases)'} ---`);
  for (const [label, field, lang, text, expect] of CASES) {
    const viaRules = parseByRules(text, field, TODAY) !== null;
    if (!viaRules && !useLlm) continue;
    const started = Date.now();
    try {
      const result = await parseAnswer({ text, confidence: 0.95 }, field, lang, TODAY);
      const got = result.ok ? `"${result.value}"` : `rejected (${result.reason})`;
      const ok = 'rejected' in expect ? !result.ok : result.ok && result.value === expect.value;
      const wanted = 'rejected' in expect ? 'rejected' : `"${expect.value}"`;
      report(ok, `${label} [${viaRules ? 'rules' : `llm ${Date.now() - started}ms`}]: ${got}${ok ? '' : ` — expected ${wanted}`}`);
    } catch (err) {
      report(false, `${label}: threw ${err instanceof Error ? err.message.split('\n')[0] : err}`);
    }
  }

  console.log(failures ? `\n${failures} FAILED` : '\nALL PASS');
  process.exitCode = failures ? 1 : 0;
}

main();
