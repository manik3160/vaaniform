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
      "label": string,           // short name for the field, understandable on its own
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
- Group multi-part fields (e.g. separate day/month/year boxes) into ONE field of type "date".
- Ignore instructions, headers, office-use-only sections, and signature boxes.
- labelSpoken must be a complete, natural question, not a restatement of the label.

Labels:
- Use the printed wording when it is clear on its own (e.g. "Date of Birth").
- When the printed text next to a blank is generic ("Provide details", "If yes, specify",
  "Remarks"), write a label that says what the details are about, e.g.
  "Criminal case details" instead of "If yes, provide details".
  The label is read aloud back to the user later, so it must make sense without the form.

Conditional sections:
- Forms often say "If yes, provide details", "If employed, ...", or "If applicable, ...".
  Never ask for those details unconditionally. Instead create TWO fields:
  1. A gate field BEFORE the details: type "choice", options ["Yes", "No"],
     required true, with a direct question about the underlying fact
     (e.g. "Do you have any pending or closed FIR or criminal case?").
  2. The details field, with dependsOn { "fieldId": <gate id>, "equals": "Yes" }
     and required true.
- Word the gate question so that "Yes" is the answer that needs details.
- dependsOn.equals must exactly match one of the gate field's options.
- dependsOn.fieldId must be the id of a field that appears earlier in the list.

Repeated information:
- If the same information is asked in more than one place on the form (e.g. name in the
  opening sentence and again near the signature), create only ONE field for it.
- When one place asks for items together and another asks separately (e.g. "Course, Year"
  in one blank vs separate "Course" and "Year" blanks), create separate fields.

Dates:
- For the date the form is filled or signed, use id "date_of_filling", type "date",
  and labelSpoken "What date should go on the form?".`;
