import { buildRichTextPayload, restoreRichTextFragment } from "./richText";

describe("rich text placeholders", () => {
  it("builds placeholders for safe inline elements and restores them", () => {
    document.body.innerHTML = `<p>Go to <a href="https://example.com" target="_blank">Codex</a> and use <strong>CLI</strong>.</p>`;
    const paragraph = document.querySelector("p");
    expect(paragraph).toBeInstanceOf(HTMLElement);

    const payload = buildRichTextPayload(paragraph as HTMLElement);

    expect(payload?.source).toBe("Go to __BRX_INLINE_0__Codex__BRX_INLINE_0_END__ and use __BRX_INLINE_1__CLI__BRX_INLINE_1_END__.");
    const fragment = restoreRichTextFragment(
      document,
      "请查看 __BRX_INLINE_0__代码助手__BRX_INLINE_0_END__ 并使用 __BRX_INLINE_1__命令行__BRX_INLINE_1_END__。",
      payload!,
    );
    expect(fragment).toBeDefined();
    const host = document.createElement("div");
    host.append(fragment!);
    expect(host.querySelector("a")).toHaveAttribute("href", "https://example.com");
    expect(host.querySelector("a")).toHaveTextContent("代码助手");
    expect(host.querySelector("strong")).toHaveTextContent("命令行");
  });

  it("returns undefined when placeholders are missing", () => {
    document.body.innerHTML = `<p>Read <em>carefully</em>.</p>`;
    const payload = buildRichTextPayload(document.querySelector("p") as HTMLElement);

    expect(restoreRichTextFragment(document, "仔细阅读。", payload!)).toBeUndefined();
  });

  it("keeps non-translatable inline elements as atomic placeholders", () => {
    document.body.innerHTML = `<p>Press <code>Enter</code>.</p>`;
    const payload = buildRichTextPayload(document.querySelector("p") as HTMLElement);

    expect(payload?.source).toBe("Press __BRX_INLINE_0__.");
    const fragment = restoreRichTextFragment(document, "按 __BRX_INLINE_0__。", payload!);
    const host = document.createElement("div");
    host.append(fragment!);
    expect(host.querySelector("code")).toHaveTextContent("Enter");
  });
});
