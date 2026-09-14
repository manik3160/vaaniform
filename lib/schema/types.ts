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
  options: z.array(z.string()).nullish(),
  required: z.boolean(),
  dependsOn: z
    .object({ fieldId: z.string(), equals: z.string() })
    .nullable()
    .optional(),
  validation: z
    .object({
      minLength: z.number().nullish(),
      maxLength: z.number().nullish(),
      pattern: z
        .string()
        .refine((p) => {
          try {
            new RegExp(p);
            return true;
          } catch {
            return false;
          }
        }, 'pattern is not a valid regular expression')
        .nullish(),
    })
    .nullable()
    .optional(),
});
export type FormField = z.infer<typeof FormFieldSchema>;

// Shape the LLM is asked to return: just the form's structure.
// The app fills in id / sourceImageUri / createdAt afterwards.
export const LlmExtractionSchema = z
  .object({
    title: z.string(),
    detectedLanguage: LangSchema,
    fields: z.array(FormFieldSchema),
  })
  .superRefine((form, ctx) => {
    form.fields.forEach((field, index) => {
      if (!field.dependsOn) return;
      const gateIndex = form.fields.findIndex((f) => f.id === field.dependsOn!.fieldId);
      if (gateIndex === -1 || gateIndex >= index) {
        ctx.addIssue({
          code: 'custom',
          path: ['fields', index, 'dependsOn'],
          message: `"${field.id}" depends on "${field.dependsOn.fieldId}", which is not an earlier field`,
        });
        return;
      }
      const gate = form.fields[gateIndex];
      if (gate.options && !gate.options.includes(field.dependsOn.equals)) {
        ctx.addIssue({
          code: 'custom',
          path: ['fields', index, 'dependsOn'],
          message: `"${field.id}" depends on "${gate.id}" = "${field.dependsOn.equals}", which is not one of its options`,
        });
      }
    });
  });
export type LlmExtraction = z.infer<typeof LlmExtractionSchema>;

export interface FormSchema extends LlmExtraction {
  id: string;
  sourceImageUri: string;
  createdAt: string;
}
