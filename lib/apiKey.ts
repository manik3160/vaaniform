// Expo inlines EXPO_PUBLIC_ variables at build time; Node scripts get it from --env-file=.env.
export function requireGeminiKey(): string {
  const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!key) {
    throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY. Add it to your .env file (see .env.example).');
  }
  return key;
}
