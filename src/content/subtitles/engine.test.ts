import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../../shared/defaults";
import type { ExtensionSettings, RuntimeMessage, TranslateBatchRequest, TranslateBatchResult } from "../../shared/types";
import { SubtitleEngine, type RuntimeSender } from "./engine";

function setupYouTubeDom(): void {
  window.history.replaceState({}, "", "https://www.youtube.com/watch?v=abc");
  document.body.innerHTML = `
    <div id="movie_player" class="html5-video-player">
      <button class="ytp-subtitles-button" aria-pressed="false"></button>
      <video></video>
    </div>
  `;
  const video = document.querySelector("video");
  if (video) video.currentTime = 1.2;
}

function jsonTimedText(): string {
  return JSON.stringify({
    events: [
      { tStartMs: 1000, dDurationMs: 2000, segs: [{ utf8: "Hello" }] },
      { tStartMs: 3000, dDurationMs: 2000, segs: [{ utf8: "World" }] },
    ],
  });
}

describe("SubtitleEngine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setupYouTubeDom();
    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`,
      },
    });
  });

  it("translates cached timedtext after enable and renders overlay", async () => {
    const settings: ExtensionSettings = structuredClone(defaultSettings);
    settings.providerId = "openai-compatible";
    const openAiConfig = settings.providerConfigs["openai-compatible"];
    if (!openAiConfig) throw new Error("Missing OpenAI-compatible test config.");
    openAiConfig.enabled = true;
    const sendRuntimeMessage = vi.fn(async <T,>(message: RuntimeMessage): Promise<T> => {
      if (message.type === "BR_GET_SETTINGS") return settings as T;
      if (message.type === "BR_TRANSLATE_BATCH") {
        const request = message.request as TranslateBatchRequest;
        return {
          providerId: request.providerId,
          elapsedMs: 1,
          rawResponseSummary: "mock",
          items: request.blocks.map((block) => ({
            id: block.id,
            text: `zh:${block.text}`,
            error: "",
            cached: false,
          })),
        } satisfies TranslateBatchResult as T;
      }
      throw new Error(`Unexpected message: ${message.type}`);
    }) as RuntimeSender;
    const engine = new SubtitleEngine(document, { sendRuntimeMessage });
    engine.init();
    await engine.handleTimedText({
      url: "https://www.youtube.com/api/timedtext?v=abc&lang=en&fmt=json3",
      responseText: jsonTimedText(),
    });

    const status = await engine.enable("dual");
    await vi.runOnlyPendingTimersAsync();
    vi.advanceTimersByTime(150);

    expect(status.status).toBe("translating");
    expect(engine.snapshot().status).toBe("active");
    expect(engine.snapshot().translatedCues).toBe(2);
    expect(sendRuntimeMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "BR_TRANSLATE_BATCH" }));
    expect(document.querySelector(".brx-subtitle-overlay")).toHaveTextContent("zh:Hello");
  });

  it("cleans overlay and reports disabled state", async () => {
    const sendRuntimeMessage = vi.fn(async <T,>(message: RuntimeMessage): Promise<T> => {
      if (message.type === "BR_GET_SETTINGS") return structuredClone(defaultSettings) as T;
      if (message.type === "BR_TRANSLATE_BATCH") {
        const request = message.request as TranslateBatchRequest;
        return {
          providerId: request.providerId,
          elapsedMs: 1,
          rawResponseSummary: "mock",
          items: request.blocks.map((block) => ({ id: block.id, text: "译文", error: "", cached: false })),
        } satisfies TranslateBatchResult as T;
      }
      throw new Error(`Unexpected message: ${message.type}`);
    }) as RuntimeSender;
    const engine = new SubtitleEngine(document, { sendRuntimeMessage });
    engine.init();
    await engine.handleTimedText({
      url: "https://www.youtube.com/api/timedtext?v=abc&lang=en&fmt=json3",
      responseText: jsonTimedText(),
    });
    await engine.enable("dual");

    const status = engine.disable();

    expect(status.status).toBe("disabled");
    expect(document.querySelector(".brx-subtitle-overlay")).toBeNull();
    expect(document.documentElement.dataset.brxSubtitleState).toBeUndefined();
  });
});
