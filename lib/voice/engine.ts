import { FormField, Lang } from '../schema/types';
import type { LlmValue } from './parseAnswer';

export interface Transcript {
  text: string;
  confidence: number;
}

/** What an engine heard for one answer. */
export interface Heard extends Transcript {
  /** Engines that also work out the field value (e.g. cloud) fill this in; transcript-only engines leave it out. */
  understood?: LlmValue;
  /** Which backend produced this, for the debug line, e.g. "gemini-3.5-flash-lite". */
  source: string;
  /** Time from end of speech to result. */
  ms: number;
}

export interface ListenOptions {
  shouldCancel: () => boolean;
  onLevel?: (db: number) => void;
  /** Called once recording has stopped and the engine starts working out what was said. */
  onSpeechEnded?: () => void;
}

/**
 * The voice layer behind the form conversation. One interface, swappable backends:
 * CloudEngine (Gemini) today, an on-device engine in Phase 3 (see PLAN.md §5).
 */
export interface VoiceEngine {
  readonly name: string;
  readonly isOffline: boolean;
  speak(text: string, lang: Lang): Promise<void>;
  stopSpeaking(): Promise<void>;
  /** Records one answer until the speaker goes quiet. Resolves null if cancelled. */
  listen(field: FormField, lang: Lang, options: ListenOptions): Promise<Heard | null>;
}
