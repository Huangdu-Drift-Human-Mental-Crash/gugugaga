import { buildRichTextPayload, restoreRichTextFragment } from "./richText";

describe("rich text placeholders", () => {
  it("builds placeholders for safe inline elements and restores them", () => {
    document.body.innerHTML = `<p>Go to <a href="https://example.com" target="_blank">Codex</a> and use <strong>CLI</strong>.</p>`;
    const paragraph = document.querySelector("p");
    expect(paragraph).toBeInstanceOf(HTMLElement);

    const payload = buildRichTextPayload(paragraph as HTMLElement);

    expect(payload?.source).toBe("Go to __BRX_INLINE_0__ and use __BRX_INLINE_1__.");
    const fragment = restoreRichTextFragment(document, "请转到 __BRX_INLINE_0__ 并使用 __BRX_INLINE_1__。", payload!);
    expect(fragment).toBeDefined();
    const host = document.createElement("div");
    host.append(fragment!);
    expect(host.querySelector("a")).toHaveAttribute("href", "https://example.com");
    expect(host.querySelector("a")).toHaveTextContent("Codex");
    expect(host.querySelector("strong")).toHaveTextContent("CLI");
  });

  it("returns undefined when placeholders are missing", () => {
    document.body.innerHTML = `<p>Read <em>carefully</em>.</p>`;
    const payload = buildRichTextPayload(document.querySelector("p") as HTMLElement);

    expect(restoreRichTextFragment(document, "仔细阅读。", payload!)).toBeUndefined();
  });
});
