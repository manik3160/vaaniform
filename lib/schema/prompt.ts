export const SCHEMA_EXTRACTION_PROMPT = `You are extracting the structure of a paper form so that a voice assistant can
help a person fill it in by speaking.

Look at the attached image of a form and return ONLY a JSON object matching this
schema, with no markdown fences and no explanation:

{
  "title": string,
  "detectedLanguage": "hi" | "en",
  "fields": [
    {
      "id": string,              // snake_case slug
      "label": string,           // exactly as printed on the form
      "labelSpoken": string,     // a natural spoken question in the form's language
      "type": "text"|"number"|"date"|"choice"|"checkbox"|"name"|"address",
      "options": string[],       // only for type "choice"
      "required": boolean,
      "dependsOn": { "fieldId": string, "equals": string } | null
    }
  ]
}

Rules:
- List fields in the order a person should be asked, top to bottom, left to right.
- If a field only applies when another field has a specific value, populate dependsOn.
- Group multi-part fields (e.g. separate day/month/year boxes) into ONE field of type "date".
- Ignore instructions, headers, office-use-only sections, and signature boxes.
- labelSpoken must be a complete, natural question, not a restatement of the label.`;
