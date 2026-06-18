import type { DisplayMode } from "../../shared/types";
import type { SubtitleCue, SubtitleTrack } from "./types";

const STYLE_ID = "brx-subtitle-style";
const OVERLAY_CLASS = "brx-subtitle-overlay";
const SOURCE_CLASS = "brx-subtitle-source";
const TARGET_CLASS = "brx-subtitle-target";

function playerContainer(document: Document): HTMLElement {
  const selectors = [
    ".html5-video-player",
    "#movie_player",
    "ytd-player",
    "#player-container",
    "#player",
  ];
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    if (node instanceof HTMLElement) return node;
  }
  return document.body ?? document.documentElement;
}

export function injectSubtitleStyles(document: Document): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    html[data-brx-subtitle-state="active"] .caption-window {
      display: none !important;
    }
    .${OVERLAY_CLASS} {
      position: absolute;
      left: 5%;
      right: 5%;
      bottom: 8%;
      z-index: 2147483646;
      display: grid;
      justify-items: center;
      gap: 4px;
      pointer-events: none;
      text-align: center;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      text-shadow: 0 1px 2px rgba(0,0,0,0.8);
    }
    .brx-subtitle-line {
      max-width: min(92vw, 1100px);
      padding: 3px 9px;
      border-radius: 4px;
      background: rgba(8, 8, 8, 0.72);
      color: white;
      line-height: 1.35;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .${SOURCE_CLASS} {
      font-size: clamp(15px, 2.1vw, 24px);
      opacity: 0.94;
    }
    .${TARGET_CLASS} {
      font-size: clamp(16px, 2.35vw, 27px);
      font-weight: 650;
    }
  `;
  document.documentElement.append(style);
}

function getOverlay(document: Document): HTMLElement | null {
  const node = document.querySelector(`.${OVERLAY_CLASS}`);
  return node instanceof HTMLElement ? node : null;
}

function ensureOverlay(document: Document): HTMLElement {
  injectSubtitleStyles(document);
  const existing = getOverlay(document);
  if (existing) return existing;
  const overlay = document.createElement("div");
  overlay.className = OVERLAY_CLASS;
  overlay.setAttribute("translate", "no");
  const parent = playerContainer(document);
  const computed = document.defaultView?.getComputedStyle(parent);
  if (computed && computed.position === "static") parent.style.position = "relative";
  parent.append(overlay);
  return overlay;
}

export function findActiveSubtitleCues(track: SubtitleTrack, currentTimeMs: number): SubtitleCue[] {
  return track.cues.filter((cue) => cue.startMs <= currentTimeMs && currentTimeMs < cue.endMs);
}

function appendLine(overlay: HTMLElement, className: string, text: string): void {
  if (!text) return;
  const line = overlay.ownerDocument.createElement("div");
  line.className = `brx-subtitle-line ${className}`;
  line.textContent = text;
  overlay.append(line);
}

export function renderSubtitleOverlay(input: {
  document: Document;
  track: SubtitleTrack;
  currentTimeMs: number;
  displayMode: DisplayMode;
}): void {
  const overlay = ensureOverlay(input.document);
  input.document.documentElement.dataset.brxSubtitleState = "active";
  const active = findActiveSubtitleCues(input.track, input.currentTimeMs);
  if (!active.length) {
    if (overlay.dataset.brxRenderedText) {
      overlay.textContent = "";
      delete overlay.dataset.brxRenderedText;
    }
    return;
  }

  const source = active.map((cue) => cue.text).join("\n");
  const target = active.map((cue) => cue.translation).filter(Boolean).join("\n");
  const renderedKey = [input.displayMode, source, target].join("\u0001");
  if (overlay.dataset.brxRenderedText === renderedKey) return;
  overlay.dataset.brxRenderedText = renderedKey;
  overlay.textContent = "";
  if (input.displayMode !== "translation") appendLine(overlay, SOURCE_CLASS, source);
  appendLine(overlay, TARGET_CLASS, target || "正在翻译...");
}

export function restoreSubtitleOverlay(document: Document): void {
  getOverlay(document)?.remove();
  delete document.documentElement.dataset.brxSubtitleState;
}
