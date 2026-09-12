import { z } from 'zod';

export const LangSchema = z.enum(['hi', 'en']);
export type Lang = z.infer<typeof LangSchema>;

export const FieldTypeSchema = z.enum([
  'text',
  'number',
  'date',
  'choice',
  'checkbox',
  'name',
  'address',
]);
export type FieldType = z.infer<typeof FieldTypeSchema>;

export const FormFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  labelSpoken: z.string(),
  type: FieldTypeSchema,
  options: z.array(z.string()).optional(),
  required: z.boolean(),
  dependsOn: z
    .object({ fieldId: z.string(), equals: z.string() })
    .nullable()
    .optional(),
});
export type FormField = z.infer<typeof FormFieldSchema>;

// Shape the LLM is asked to return: just the form's structure.
// The app fills in id / sourceImageUri / createdAt afterwards.
export const LlmExtractionSchema = z.object({
  title: z.string(),
  detectedLanguage: LangSchema,
  fields: z.array(FormFieldSchema),
});
export type LlmExtraction = z.infer<typeof LlmExtractionSchema>;

export interface FormSchema extends LlmExtraction {
  id: string;
  sourceImageUri: string;
  createdAt: string;
}
