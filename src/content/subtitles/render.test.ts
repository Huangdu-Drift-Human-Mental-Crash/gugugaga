import { describe, expect, it } from "vitest";
import { renderSubtitleOverlay, restoreSubtitleOverlay } from "./render";
import type { SubtitleTrack } from "./types";

function track(): SubtitleTrack {
  return {
    id: "track-1",
    videoId: "abc",
    url: "https://www.youtube.com/api/timedtext?v=abc",
    sourceLang: "en",
    targetLang: "zh-CN",
    cues: [
      {
        id: "cue-1",
        startMs: 1000,
        durationMs: 2000,
        endMs: 3000,
        text: "Hello",
        translation: "你好",
        hash: "a",
        state: "translated",
        error: "",
      },
    ],
  };
}

describe("subtitle overlay rendering", () => {
  it("mounts overlay inside the YouTube player and renders dual subtitles", () => {
    document.body.innerHTML = `<div class="html5-video-player"><div class="caption-window">native</div></div>`;

    renderSubtitleOverlay({
      document,
      track: track(),
      currentTimeMs: 1200,
      displayMode: "dual",
    });

    const overlay = document.querySelector(".brx-subtitle-overlay");
    expect(overlay?.parentElement?.className).toContain("html5-video-player");
    expect(overlay).toHaveTextContent("Hello");
    expect(overlay).toHaveTextContent("你好");
    expect(document.documentElement.dataset.brxSubtitleState).toBe("active");
  });

  it("renders translation only mode", () => {
    document.body.innerHTML = `<div class="html5-video-player"></div>`;

    renderSubtitleOverlay({
      document,
      track: track(),
      currentTimeMs: 1200,
      displayMode: "translation",
    });

    const overlay = document.querySelector(".brx-subtitle-overlay");
    expect(overlay).not.toHaveTextContent("Hello");
    expect(overlay).toHaveTextContent("你好");
  });

  it("does not rewrite overlay DOM when the active subtitle has not changed", () => {
    document.body.innerHTML = `<div class="html5-video-player"></div>`;
    renderSubtitleOverlay({ document, track: track(), currentTimeMs: 1200, displayMode: "dual" });
    const overlay = document.querySelector(".brx-subtitle-overlay");
    const firstChild = overlay?.firstElementChild;

    renderSubtitleOverlay({ document, track: track(), currentTimeMs: 1300, displayMode: "dual" });

    expect(document.querySelector(".brx-subtitle-overlay")?.firstElementChild).toBe(firstChild);
  });

  it("cleans up overlay state", () => {
    document.body.innerHTML = `<div class="html5-video-player"></div>`;
    renderSubtitleOverlay({ document, track: track(), currentTimeMs: 1200, displayMode: "dual" });

    restoreSubtitleOverlay(document);

    expect(document.querySelector(".brx-subtitle-overlay")).toBeNull();
    expect(document.documentElement.dataset.brxSubtitleState).toBeUndefined();
  });
});
