import type { DisplayMode } from "../../shared/types";

export type SubtitleEngineState = "idle" | "loading" | "translating" | "active" | "error" | "disabled";

export type SubtitleCueState = "discovered" | "queued" | "pending" | "translated" | "error" | "active";

export interface SubtitleCue {
  id: string;
  startMs: number;
  durationMs: number;
  endMs: number;
  text: string;
  translation: string;
  hash: string;
  state: SubtitleCueState;
  error: string;
}

export interface SubtitleTrack {
  id: string;
  videoId: string;
  url: string;
  sourceLang: string;
  targetLang: string;
  cues: SubtitleCue[];
}

export interface SubtitleRuntimeStatus {
  status: SubtitleEngineState;
  translatedCues: number;
  queuedCues: number;
  error: string;
  providerId: string;
  videoId: string;
}

export interface SubtitleTimedTextInput {
  url: string;
  responseText: string;
  videoId?: string;
  sourceLang?: string;
}

export interface SubtitleRenderState {
  track: SubtitleTrack;
  currentTimeMs: number;
  displayMode: DisplayMode;
}

