import { blockHash, normalizeText, stableHash } from "../../shared/hash";
import type { SubtitleCue, SubtitleTrack, SubtitleTimedTextInput } from "./types";

const AMBIENT_SOUND_REGEX = /^\s*(?:\[[^\]]+\]|\([^)]*\)|♪+|♫+)\s*$/;
const URL_ONLY_REGEX = /^https?:\/\/\S+$/i;

interface YouTubeTimedTextSegment {
  utf8?: string;
}

interface YouTubeTimedTextEvent {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: YouTubeTimedTextSegment[];
}

interface YouTubeTimedTextJson {
  events?: YouTubeTimedTextEvent[];
}

function htmlDecode(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

function cueId(source: string, startMs: number, text: string): string {
  return `cue-${stableHash(`${source}:${startMs}:${normalizeText(text)}`)}`;
}

export function shouldTranslateSubtitleText(text: string): boolean {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (normalized.length < 2) return false;
  if (URL_ONLY_REGEX.test(normalized)) return false;
  if (AMBIENT_SOUND_REGEX.test(normalized)) return false;
  return true;
}

function createCue(input: { source: string; startMs: number; durationMs: number; text: string }): SubtitleCue | null {
  const text = normalizeText(input.text);
  if (!shouldTranslateSubtitleText(text)) return null;
  const durationMs = Math.max(0, input.durationMs);
  return {
    id: cueId(input.source, input.startMs, text),
    startMs: input.startMs,
    durationMs,
    endMs: input.startMs + durationMs,
    text,
    translation: "",
    hash: blockHash(text),
    state: "discovered",
    error: "",
  };
}

function parseJsonCues(responseText: string, source: string): SubtitleCue[] {
  let parsed: YouTubeTimedTextJson;
  try {
    parsed = JSON.parse(responseText) as YouTubeTimedTextJson;
  } catch {
    return [];
  }

  const cues: SubtitleCue[] = [];
  for (const event of parsed.events ?? []) {
    const startMs = Number(event.tStartMs ?? 0);
    const durationMs = Number(event.dDurationMs ?? 0);
    const text = (event.segs ?? []).map((segment) => segment.utf8 ?? "").join("");
    const cue = createCue({ source, startMs, durationMs, text });
    if (cue) cues.push(cue);
  }
  return cues;
}

function parseXmlCues(responseText: string, source: string): SubtitleCue[] {
  const parser = new DOMParser();
  const xml = parser.parseFromString(responseText, "text/xml");
  if (xml.querySelector("parsererror")) return [];

  const cues: SubtitleCue[] = [];
  xml.querySelectorAll("text,p").forEach((node) => {
    const startSeconds = Number(node.getAttribute("start") ?? node.getAttribute("t") ?? 0);
    const durationSeconds = Number(node.getAttribute("dur") ?? node.getAttribute("d") ?? 0);
    const usesMilliseconds = node.hasAttribute("t") || node.hasAttribute("d");
    const startMs = usesMilliseconds ? startSeconds : Math.round(startSeconds * 1000);
    const durationMs = usesMilliseconds ? durationSeconds : Math.round(durationSeconds * 1000);
    const cue = createCue({
      source,
      startMs,
      durationMs,
      text: htmlDecode(node.textContent ?? ""),
    });
    if (cue) cues.push(cue);
  });
  return cues;
}

function languageFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("lang") || parsed.searchParams.get("vss_id") || "auto";
  } catch {
    return "auto";
  }
}

function videoIdFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("v") || parsed.searchParams.get("video_id") || stableHash(url);
  } catch {
    return stableHash(url);
  }
}

export function parseYouTubeTimedText(input: SubtitleTimedTextInput, targetLang: string): SubtitleTrack | null {
  const source = input.url || "youtube";
  const jsonCues = parseJsonCues(input.responseText, source);
  const cues = jsonCues.length ? jsonCues : parseXmlCues(input.responseText, source);
  if (!cues.length) return null;
  const videoId = input.videoId || videoIdFromUrl(input.url);
  return {
    id: `yt-${stableHash(`${videoId}:${input.url}:${targetLang}`)}`,
    videoId,
    url: input.url,
    sourceLang: input.sourceLang || languageFromUrl(input.url),
    targetLang,
    cues,
  };
}

export function cueTextHashes(track: SubtitleTrack | undefined): string[] {
  return track?.cues.map((cue) => cue.hash) ?? [];
}

