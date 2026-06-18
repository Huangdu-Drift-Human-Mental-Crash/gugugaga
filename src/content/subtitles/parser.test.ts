import { describe, expect, it } from "vitest";
import { parseYouTubeTimedText, shouldTranslateSubtitleText } from "./parser";

describe("YouTube subtitle parser", () => {
  it("parses JSON timedtext events into cues", () => {
    const track = parseYouTubeTimedText(
      {
        url: "https://www.youtube.com/api/timedtext?v=abc&lang=en&fmt=json3",
        responseText: JSON.stringify({
          events: [
            { tStartMs: 1000, dDurationMs: 2000, segs: [{ utf8: "Hello " }, { utf8: "world" }] },
            { tStartMs: 3000, dDurationMs: 1000, segs: [{ utf8: "[Music]" }] },
          ],
        }),
      },
      "zh-CN",
    );

    expect(track?.videoId).toBe("abc");
    expect(track?.sourceLang).toBe("en");
    expect(track?.targetLang).toBe("zh-CN");
    expect(track?.cues).toHaveLength(1);
    expect(track?.cues[0]).toMatchObject({
      startMs: 1000,
      durationMs: 2000,
      endMs: 3000,
      text: "Hello world",
      state: "discovered",
    });
  });

  it("parses XML transcript cues", () => {
    const track = parseYouTubeTimedText(
      {
        url: "https://www.youtube.com/api/timedtext?v=abc&lang=en",
        responseText: `<transcript><text start="1.5" dur="2">Tom &amp; Jerry</text></transcript>`,
      },
      "zh-CN",
    );

    expect(track?.cues).toHaveLength(1);
    expect(track?.cues[0]?.startMs).toBe(1500);
    expect(track?.cues[0]?.durationMs).toBe(2000);
    expect(track?.cues[0]?.text).toBe("Tom & Jerry");
  });

  it("filters empty, ambient, and URL-only cues", () => {
    expect(shouldTranslateSubtitleText("")).toBe(false);
    expect(shouldTranslateSubtitleText("[Applause]")).toBe(false);
    expect(shouldTranslateSubtitleText("https://example.com/a")).toBe(false);
    expect(shouldTranslateSubtitleText("Actual spoken words")).toBe(true);
  });
});

