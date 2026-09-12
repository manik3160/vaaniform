# PLAN.md — VaaniForm (working title)

> **Voice-first, offline-capable form filling for people who can speak but cannot read the form.**
>
> Submission for **RevenueCat Shipaton 2026 — Next Gen Award** (student category).

---

## 0. READ THIS FIRST (instructions for the AI coding assistant)

You are helping a **solo developer who is new to mobile development**. He is strong in
TypeScript, React, Next.js, Node, Python and LLM pipeline work. He has **never shipped a
React Native app before**. Act accordingly:

1. **Explain before you generate.** When introducing a mobile-specific concept (Expo config,
   permissions, native modules, app lifecycle), give a 2–3 sentence explanation first.
2. **Small, runnable increments.** Never dump 400 lines across 10 files. Build one module,
   make it run, verify it on a real phone, then move on.
3. **Verify, don't assume.** Library APIs and model availability change. Before using any
   package, check the current docs / npm page. If a package named in this plan is
   deprecated or has a better replacement, say so and propose the swap.
4. **Working beats elegant.** This is an 18-day hackathon build. Prefer the boring,
   reliable path. Refactors are a luxury.
5. **Never commit secrets.** The repository is PUBLIC and open source (hackathon
   requirement). API keys go in `.env`, which is gitignored. Ship a `.env.example`.
6. **Design is explicitly out of scope for now.** Use plain, unstyled, functional UI.
   Visual design happens in Phase 5 only if time remains. Do not spend time on styling.
7. **If a phase is running late, take the documented fallback** (Section 10) rather than
   pushing the timeline. Having a complete, honest, slightly-less-ambitious submission beats
   an incomplete ambitious one.

---

## 1. Project summary

### The problem

Hundreds of millions of people can speak fluently but cannot read the forms that gate their
access to money, healthcare, education and identity — government schemes, bank KYC, school
admission, insurance claims, hospital intake. Today they either pay an intermediary or go
without.

### The product

Point the phone camera at **any paper form**. The app:

1. Reads the form's structure and works out what fields it contains.
2. Asks the user each question **out loud, in their language**, conversationally.
3. Accepts **spoken answers**, including code-mixed Hinglish ("mera naam Manik hai, DOB do hazaar chaar").
4. Fills the fields, then **reads the completed form back** field-by-field for confirmation.
5. Exports a **print-ready PDF**.
6. Works **on-device / offline** where possible — the target user is standing in a queue on patchy 3G.

Plus an **eligibility interview**: a short spoken Q&A that tells the user which schemes they
likely qualify for and exactly which documents to carry.

### What makes it not-a-wrapper

The competitive risk is being seen as "OCR + LLM + TTS," which is the most common hackathon
architecture in existence. Three things move it out of that bucket, and all three are
**mandatory, not optional**:

- **On-device Indic ASR/TTS** — nothing leaves the phone in the default path.
- **The form→schema engine** — turning an arbitrary form photo into an ordered, typed,
  dependency-aware conversational script is the real engineering, and it is ours.
- **The trust loop** — read-back confirmation before export, because a wrongly filled
  government form has real consequences.

---

## 2. Hackathon constraints (NON-NEGOTIABLE)

Source: `shipaton.com/categories/next-gen-award` and the official Devpost rules.
**Always re-check the Devpost rules page before submitting — this summary may be stale.**

### Deadline

**September 30, 2026, 11:45 PM PT.** Plan to submit on **Sep 29** with a day of buffer.

### Category: Next Gen Award (student-only)

| Requirement | Detail |
|---|---|
| Eligibility | Active student, 13+, with an academic email domain recognised by [JetBrains/swot](https://github.com/jetbrains/swot) |
| **Store release** | **NOT required** — no Apple/Google paid developer account needed |
| Demo video | **Required** — must show the app actually working |
| Source code | **Required** — public, open-source repository |
| License file | **Required** — an open source license must be present in the repo |
| Description | Clear statement of what was built, what it does, and why it matters |

### Prizes

1st: $20,000 + Times Square billboard + NYC trip + Shippy trophy + 9to5Mac/9to5Google spotlight.
2nd: $10,000. 3rd: $5,000.

### ACTION ITEM — DO THIS TODAY, BEFORE ANY CODE

Check that the student's academic email domain (`iiitsonepat.ac.in`) is recognised by the
swot checker on the Next Gen page. **If it is not recognised, everything else is wasted
effort.** Swot accepts community pull requests to add domains, but that takes lead time —
so this must be resolved on day 0.

### Judging signal (derived from 2025 winners)

The judges are ~30 indie developers and founders, **mostly non-Indian**, watching a large
number of videos back to back. Winners in 2025 consistently had:

- A hard technical capability that is **visible in a video without narration**
- **Offline / on-device / privacy-first** operation (this recurs again and again)
- A **specific human origin story**, not a market-size pitch
- Repos that look like an engineer built them

Design every decision against that list.

---

## 3. Success criteria

**Minimum viable submission (must have by Sep 27):**
- [ ] Photograph a form → fields extracted correctly
- [ ] App asks each question aloud
- [ ] User answers by voice → field fills correctly
- [ ] Read-back confirmation loop works
- [ ] PDF exports
- [ ] Works in Hindi and English
- [ ] Public repo + MIT LICENSE + README
- [ ] Demo video uploaded

**Target submission (aim for this):**
- [ ] Everything above, plus:
- [ ] On-device ASR and TTS working with the phone in **airplane mode**
- [ ] Handles code-mixed Hinglish answers
- [ ] Eligibility interview with document checklist
- [ ] README with architecture diagram and an honest "what doesn't work yet" section

---

## 4. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **React Native + Expo** (managed workflow) | Maps onto existing React/TS skills; Expo is a Shipaton sponsor; avoids native build setup |
| Language | TypeScript | Already known |
| Camera | `expo-camera` | Form capture |
| Audio | `expo-audio` (or `expo-av` if that's still current — **verify**) | Recording answers, playing TTS |
| On-device inference | `onnxruntime-react-native` | Running quantized ASR/TTS models locally |
| Local storage | `expo-sqlite` | Sessions, saved forms. **No backend, no accounts, no login.** |
| PDF export | HTML → PDF (`expo-print`) | Simplest reliable path |
| Cloud LLM | Claude or GPT multimodal API | Form→schema extraction and answer parsing |
| Cloud ASR/TTS (fallback) | Whisper API / ElevenLabs | Phase 2 path and permanent fallback |

**No backend server.** Everything runs on the device or calls an API directly. This removes
deployment, auth and hosting from an 18-day timeline entirely.

### Models for the on-device phase

- **ASR:** AI4Bharat **IndicConformer** — Conformer-Large, ~120M params per language,
  hybrid CTC-RNNT decoder, MIT licensed. Export to ONNX, quantize to int8.
  There is also a 600M multilingual variant covering 22 languages — likely **too large for
  mobile**; start with the per-language 120M Hindi model.
- **TTS:** a VITS-style Hindi model exported to ONNX. Community exports fine-tuned on
  AI4Bharat IndicVoices exist that run offline on Android CPU in real time — **search GitHub
  and Hugging Face for the current best option before committing.** AI4Bharat's Indic
  Parler-TTS is ~0.9B params and is almost certainly too large for on-device; do not start there.

> **Assistant note:** these model recommendations are from research, not from having run
> them. Before Phase 3, spend 30 minutes verifying model size, license and ONNX
> export feasibility. If on-device TTS proves unworkable, on-device ASR alone with cloud TTS
> is still a strong story — take it.

---

## 5. Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Expo App (RN)                     │
│                                                      │
│  ┌────────────┐   ┌──────────────┐  ┌─────────────┐ │
│  │  Capture   │──▶│ Schema Engine │─▶│ Voice Loop  │ │
│  │ (camera)   │   │  (LLM vision) │  │ (ASR/TTS)   │ │
│  └────────────┘   └──────────────┘  └──────┬──────┘ │
│                                             │        │
│                   ┌─────────────────────────▼─────┐ │
│                   │   Read-back Confirmation      │ │
│                   └─────────────┬─────────────────┘ │
│                                 ▼                    │
│                   ┌───────────────────────────────┐ │
│                   │      PDF Export (expo-print)  │ │
│                   └───────────────────────────────┘ │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ Voice adapter — SAME interface, two backends:  │ │
│  │   • OnDeviceEngine (ONNX)   ← default          │ │
│  │   • CloudEngine (API)       ← fallback         │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Critical design decision:** the voice layer is an **adapter with one interface and two
implementations**. Phase 2 builds the cloud one. Phase 3 builds the on-device one and swaps
it behind the same interface. If Phase 3 fails, the app still works. This is what makes the
timeline survivable.

```ts
interface VoiceEngine {
  speak(text: string, lang: Lang): Promise<void>;
  listen(): Promise<{ text: string; confidence: number }>;
  isOffline: boolean;
}
```

---

## 6. Core data model

```ts
type Lang = "hi" | "en";

type FieldType = "text" | "number" | "date" | "choice" | "checkbox" | "name" | "address";

interface FormField {
  id: string;                 // stable slug, e.g. "date_of_birth"
  label: string;              // as printed on the form: "Date of Birth"
  labelSpoken?: string;       // natural spoken phrasing, e.g. "What is your date of birth?"
  type: FieldType;
  options?: string[];         // for "choice"
  required: boolean;
  dependsOn?: {               // conditional field
    fieldId: string;
    equals: string;
  };
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;         // regex as string
  };
  pageRegion?: {              // optional: where it sits on the form image
    x: number; y: number; width: number; height: number;
  };
}

interface FormSchema {
  id: string;
  title: string;              // best guess at the form's name
  sourceImageUri: string;
  detectedLanguage: Lang;
  fields: FormField[];
  createdAt: string;
}

interface FilledForm {
  schemaId: string;
  answers: Record<string, string>;   // fieldId -> value
  confirmed: boolean;
  completedAt?: string;
}
```

---

## 7. Module specifications

### M1 — Capture (`/lib/capture`)

Responsibilities: camera permission, take photo, basic quality check (is it too dark? too
blurry? is the form cut off?), let user retake.

Keep it simple. A single "retake" affordance is enough. Do not build perspective correction
or edge detection — nice to have, not required.

### M2 — Schema Engine (`/lib/schema`) ⭐ THE CORE

**This is the most important module. Build it first, while attention is freshest.**

Input: form image URI. Output: `FormSchema`.

Implementation: send the image to a multimodal LLM with a strict JSON-output prompt.
**Do not hand-roll OCR + layout analysis** — that is a research project, not a hackathon task.

Starting prompt (iterate on this against real forms):

```
You are extracting the structure of a paper form so that a voice assistant can
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
- labelSpoken must be a complete, natural question, not a restatement of the label.
```

**Test data:** photograph **4 real forms** on day 0 and keep them in `/fixtures`. Every
change to this module is validated against all four. Expect to iterate on the prompt, not
the architecture.

**Known hard cases to handle:** checkboxes, grid/table sections, forms printed in Hindi
script, multi-page forms (treat each page as a separate capture for now).

### M3 — Voice Loop (`/lib/voice`)

The conversation driver. Given a `FormSchema`, walk the fields:

```
for each field (skipping ones whose dependsOn is unmet):
  1. speak(field.labelSpoken)
  2. answer = listen()
  3. parsed = parseAnswer(answer.text, field)
  4. if parse fails or confidence is low:
        speak a clarification, retry (max 2 retries, then allow typed input)
  5. store answer, show it on screen immediately
```

**`parseAnswer` is where Hinglish gets handled.** Users say things like "do hazaar chaar"
for 2004, or mix scripts mid-sentence. Approach:
- Try cheap deterministic parsing first (regex for dates/numbers).
- Fall back to an LLM call: *"The user was asked '{label}' (type: {type}) and said
  '{transcript}'. Return ONLY the normalized value, or NULL if unclear."*

Always show the parsed value on screen as it fills — this is what makes the demo video work.

**Always provide a typed-input escape hatch** on every field. Voice will fail sometimes;
a user trapped in a failing voice loop is a broken product, and a judge will notice.

### M4 — On-device Engines (`/lib/voice/ondevice`)

Implements `VoiceEngine` using `onnxruntime-react-native`.

Steps:
1. Obtain the model, export to ONNX, quantize to int8 (do this in Python, offline, once).
2. Bundle the model file with the app or download on first launch (bundling is simpler).
3. Wire up audio: record 16kHz mono PCM → feed to ASR session → decode output.
4. TTS: text → phonemes/tokens → model → PCM → play.
5. Measure latency on a real mid-range Android phone. Note the number in the README.

**Document the export process in `/models/README.md`** — this is exactly the kind of detail
that makes a repo look like an engineer built it.

### M5 — Eligibility, Read-back, Export (`/lib/eligibility`, `/lib/export`)

**Eligibility interview:** a fixed set of ~6 spoken questions (age, state, occupation,
income bracket, land ownership, household size) → matched against a **hardcoded list of 5–6
real schemes** in `/data/schemes.json`, each with eligibility rules and a required-documents
list. Do not attempt to cover every scheme. Six well-researched ones is more credible than
sixty scraped ones.

**Read-back:** after all fields are answered, speak each `label: value` pair in sequence.
User confirms each ("haan/yes") or corrects it (re-asks that one field). Only after full
confirmation does export unlock.

**Export:** build an HTML document that visually approximates the original form layout, then
`expo-print` → PDF → share sheet.

---

## 8. Build timeline (18 days: Sep 12 → Sep 29, submit Sep 29, buffer Sep 30)

### Phase 0 — Day 0 (Sep 12–13): De-risk
- [ ] **Verify academic email domain on the swot checker.** Blocking. Do this first.
- [ ] Register on Devpost for Shipaton 2026.
- [ ] Create the public GitHub repo with MIT LICENSE on day one (build-in-public evidence).
- [ ] `npx create-expo-app` → get it running on a real phone via Expo Go.
- [ ] Throwaway spike: one screen, one button that takes a photo, one button that speaks a
      sentence aloud. **If this takes more than 1.5 days, raise the alarm — the timeline
      assumption is wrong and scope must be cut.**
- [ ] Photograph 4 real forms → `/fixtures`.

### Phase 1 — Days 1–3 (Sep 14–16): Schema engine
- [ ] M2 working against all 4 fixture forms
- [ ] JSON output validated with zod (or equivalent)
- [ ] A debug screen that shows the extracted schema as a list

### Phase 2 — Days 4–7 (Sep 17–20): Cloud voice loop ⚠️ INSURANCE POLICY
- [ ] `VoiceEngine` interface + `CloudEngine` implementation
- [ ] M3 conversation driver end to end
- [ ] `parseAnswer` with Hinglish handling
- [ ] Typed-input fallback on every field
- [ ] **By end of Sep 20 there must be a demoable end-to-end flow.** If there isn't, stop
      adding features and fix that before anything else.

### Phase 3 — Days 8–11 (Sep 21–24): On-device swap
- [ ] ONNX export + quantization (Python, offline)
- [ ] `OnDeviceEngine` implementing the same interface
- [ ] Airplane-mode test — this is the money shot for the demo video
- [ ] **Hard stop Sep 24.** If it isn't solid, ship the hybrid and say so honestly.

### Phase 4 — Days 12–14 (Sep 25–27): Eligibility + trust + export
- [ ] Eligibility interview + `schemes.json`
- [ ] Read-back confirmation loop
- [ ] PDF export

### Phase 5 — Days 15–17 (Sep 28–29): Ship
- [ ] README (see Section 9)
- [ ] Architecture diagram
- [ ] Demo video (see Section 9)
- [ ] Devpost submission
- [ ] Only now, if time remains: visual design

### Day 18 (Sep 30): Buffer. Do not plan work here.

---

## 9. Repository and submission requirements

### Repo structure

```
/app                  — Expo screens and navigation
/lib
  /capture            — M1
  /schema             — M2 (prompt, parsing, validation)
  /voice              — M3 (driver) + VoiceEngine interface
    /cloud            — CloudEngine
    /ondevice         — OnDeviceEngine (ONNX)
  /eligibility        — M5
  /export             — PDF generation
/data
  schemes.json        — curated scheme + document data
/fixtures             — the 4 test form images
/models
  README.md           — how the ONNX models were exported and quantized
/docs
  architecture.png
  demo.gif
README.md
LICENSE               — MIT (REQUIRED by the hackathon)
.env.example          — REQUIRED, with no real keys
.gitignore            — MUST include .env
```

### README structure (this is scored — most entrants will neglect it)

1. **Demo GIF at the very top**, before any prose.
2. One-paragraph statement of the problem and who it's for.
3. Architecture diagram.
4. How it works — the four stages.
5. On-device models: which ones, how exported, measured latency on named hardware.
6. **"What doesn't work yet"** — an honest, specific list. This reads as engineering
   maturity and almost nobody else will write it.
7. Setup instructions that actually work from a clean clone.
8. License.

### Demo video

- **First 8 seconds show the app working.** No logo, no title card, no problem statement.
  Hands, a real form, a phone, a field filling on screen.
- Then one line of on-screen text stating why it matters.
- **Include the airplane-mode shot** — put the phone in airplane mode on camera and keep
  the conversation going. To this panel, that single shot is worth more than a minute of talking.
- **English subtitles on everything.** Most judges do not speak Hindi and will not guess.
- Keep it under 3 minutes. Under 2 is better.

### Security

The repo is public. Therefore:
- `.env` in `.gitignore`, always
- `.env.example` with placeholder keys committed
- Never hardcode a key in source, not even temporarily
- If a key is ever committed by accident: rotate it immediately, do not just delete the commit

---

## 10. Risks and documented fallbacks

| Risk | Likelihood | Fallback |
|---|---|---|
| Academic email domain not recognised by swot | Medium | Resolve on day 0; submit a swot PR or use another eligible academic address |
| React Native learning curve eats the timeline | **High** | Cut the eligibility module (Phase 4) entirely; it's the most droppable piece |
| On-device ONNX export fails or is too slow | **High** | Ship hybrid: on-device ASR + cloud TTS, or fully cloud with on-device documented as future work. Say so honestly in the video |
| Schema extraction unreliable on complex forms | Medium | Narrow the demo to 3–4 form types that work well; state the limitation openly |
| Hinglish ASR accuracy is poor | Medium | Typed-input fallback already required on every field; lean on it and show it as a deliberate design choice |
| Exam/coursework collision | High | Phases 4 and 5 compress; Phase 2 is the true minimum viable submission |

**Rule: never let a fallback go unmentioned in the video or README.** Judges reward honesty
about limits and punish overclaiming.

---

## 11. Explicitly out of scope

Do not build any of these, even if they seem easy:

- User accounts, login, authentication
- Any backend server
- Cloud sync or multi-device support
- More than two languages (Hindi + English only)
- Form submission to any actual government portal
- Perspective correction / document edge detection
- Visual design system, animations, theming (Phase 5 only, if time remains)
- More than ~6 schemes in the eligibility data
- Multi-page form stitching (treat pages as separate captures)

---

## 12. Open questions to resolve during the build

1. Does `expo-audio` or `expo-av` support raw 16kHz PCM capture in the managed workflow, or
   is a config plugin / dev build needed? **Resolve on day 0** — this determines whether
   Phase 3 is even possible in managed Expo.
2. Which specific Hindi TTS ONNX export is smallest and most reliable? Search before Phase 3.
3. Can `onnxruntime-react-native` run in Expo Go, or does it require a development build?
   (Likely a dev build — plan for `expo prebuild` / EAS.)
4. What is the actual on-device latency on a mid-range Android device? Measure and publish it.

---

## 13. The one-line pitch (use this everywhere)

> *Point your phone at any form and just talk to it. Works offline, in your language.*
