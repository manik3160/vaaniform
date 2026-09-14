import { FormSchema } from './types';

// Short Hindi form for trying the voice loop without photographing a real form.
export const SAMPLE_FORM: FormSchema = {
  id: 'sample-hi',
  title: 'नमूना फॉर्म (टेस्ट)',
  detectedLanguage: 'hi',
  sourceImageUri: '',
  createdAt: '2026-09-14T00:00:00.000Z',
  fields: [
    {
      id: 'full_name',
      label: 'पूरा नाम',
      labelSpoken: 'आपका पूरा नाम क्या है?',
      type: 'name',
      required: true,
    },
    {
      id: 'is_employed',
      label: 'नौकरी करते हैं',
      labelSpoken: 'क्या आप कोई नौकरी करते हैं?',
      type: 'choice',
      options: ['Yes', 'No'],
      required: true,
    },
    {
      id: 'employer_name',
      label: 'नौकरी की जगह',
      labelSpoken: 'आप कहाँ नौकरी करते हैं?',
      type: 'text',
      required: true,
      dependsOn: { fieldId: 'is_employed', equals: 'Yes' },
    },
    {
      id: 'date_of_birth',
      label: 'जन्म की तिथि',
      labelSpoken: 'आपकी जन्म तिथि क्या है?',
      type: 'date',
      required: true,
    },
  ],
};
