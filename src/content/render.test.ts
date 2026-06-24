import {
  clearPendingTranslations,
  renderNavigationPendingTranslations,
  renderNavigationTranslations,
  renderPendingTranslations,
  renderTranslations,
  restoreTranslations,
} from "./render";
import type { ContentBlock } from "./types";

function blockFor(element: HTMLElement): ContentBlock {
  return {
    id: "brx-test-0",
    hash: "test",
    text: element.textContent ?? "",
    kind: "paragraph",
    visibility: "visible",
    element,
  };
}

describe("translation rendering", () => {
  it("renders a pending placeholder and replaces it with the translation", () => {
    document.body.innerHTML = "<p>Hello world.</p>";
    const paragraph = document.querySelector("p");
    expect(paragraph).toBeInstanceOf(HTMLElement);
    const block = blockFor(paragraph as HTMLElement);

    renderPendingTranslations({ document, blocks: [block], displayMode: "dual" });

    const pending = document.querySelector(".brx-translation-pending");
    expect(pending).toHaveTextContent("正在翻译...");
    expect(block.element.dataset.brxState).toBe("pending");

    const rendered = renderTranslations({
      document,
      blocks: [block],
      displayMode: "dual",
      results: [{ id: block.id, text: "你好，世界。", error: "", cached: false }],
    });

    expect(rendered).toBe(1);
    expect(document.querySelector(".brx-translation-pending")).toBeNull();
    expect(document.querySelector(".brx-translation")).toHaveTextContent("你好，世界。");
    expect(block.element.dataset.brxState).toBe("translated");
  });

  it("uses native block classes and copies safe text presentation", () => {
    document.body.innerHTML = `
      <h1 style="font-size: 32px; font-weight: 700; color: rgb(12, 34, 56); line-height: 1.2;">
        Paper Title
      </h1>
    `;
    const heading = document.querySelector("h1");
    expect(heading).toBeInstanceOf(HTMLElement);
    const block: ContentBlock = {
      ...blockFor(heading as HTMLElement),
      kind: "heading",
    };

    renderTranslations({
      document,
      blocks: [block],
      displayMode: "dual",
      results: [{ id: block.id, text: "论文标题", error: "", cached: false }],
    });

    const translation = document.querySelector(".brx-translation");
    expect(translation).toHaveClass("brx-translation-block");
    expect(translation).toHaveClass("brx-translation-heading");
    expect(translation).toHaveStyle({ fontSize: "32px", fontWeight: "700", color: "rgb(12, 34, 56)" });
  });

  it("keeps link attributes when rendering anchor translations", () => {
    document.body.innerHTML = `<a href="https://example.com/post" target="_blank">Read the note</a>`;
    const anchor = document.querySelector("a");
    expect(anchor).toBeInstanceOf(HTMLElement);
    const block: ContentBlock = {
      ...blockFor(anchor as HTMLElement),
      layout: "block",
      classification: "block",
    };

    renderTranslations({
      document,
      blocks: [block],
      displayMode: "dual",
      results: [{ id: block.id, text: "阅读通知", error: "", cached: false }],
    });

    const translation = document.querySelector(".brx-translation");
    expect(translation?.tagName.toLowerCase()).toBe("a");
    expect(translation).toHaveAttribute("href", "https://example.com/post");
    expect(translation).toHaveAttribute("target", "_blank");
    expect(translation).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("restores safe inline rich text placeholders", () => {
    document.body.innerHTML = `<p>Go to <a href="https://example.com">Codex</a> and press <code>Enter</code>.</p>`;
    const paragraph = document.querySelector("p");
    expect(paragraph).toBeInstanceOf(HTMLElement);
    const block: ContentBlock = {
      ...blockFor(paragraph as HTMLElement),
      richText: {
        source: "Go to __BRX_INLINE_0__Codex__BRX_INLINE_0_END__ and press __BRX_INLINE_1__.",
        placeholders: [
          {
            token: "__BRX_INLINE_0__",
            closeToken: "__BRX_INLINE_0_END__",
            tagName: "a",
            text: "Codex",
            attributes: { href: "https://example.com" },
          },
          { token: "__BRX_INLINE_1__", tagName: "code", text: "Enter", attributes: {} },
        ],
      },
    };

    renderTranslations({
      document,
      blocks: [block],
      displayMode: "dual",
      results: [
        {
          id: block.id,
          text: "请转到 __BRX_INLINE_0__代码助手__BRX_INLINE_0_END__ 并按 __BRX_INLINE_1__。",
          error: "",
          cached: false,
        },
      ],
    });

    const translation = document.querySelector(".brx-translation");
    expect(translation).toHaveTextContent("请转到 代码助手 并按 Enter。");
    expect(translation?.querySelector("a")).toHaveAttribute("href", "https://example.com");
    expect(translation?.querySelector("a")).toHaveTextContent("代码助手");
    expect(translation?.querySelector("code")).toHaveTextContent("Enter");
  });

  it("clears pending placeholders and restores hidden originals", () => {
    document.body.innerHTML = "<p>Hello world.</p>";
    const paragraph = document.querySelector("p") as HTMLElement;
    const block = blockFor(paragraph);

    renderPendingTranslations({ document, blocks: [block], displayMode: "translation" });
    expect(paragraph).toHaveClass("brx-original-hidden");

    clearPendingTranslations(document, [block]);

    expect(document.querySelector(".brx-translation-pending")).toBeNull();
    expect(paragraph).not.toHaveClass("brx-original-hidden");
    expect(paragraph.dataset.brxState).toBeUndefined();
  });

  it("renders compact navigation translations inside the original link", () => {
    document.body.innerHTML = `<nav><a href="#overview">Overview</a></nav>`;
    const anchor = document.querySelector("a") as HTMLElement;
    const block: ContentBlock = {
      ...blockFor(anchor),
      classification: "navigation",
      layout: "inline",
    };

    renderNavigationPendingTranslations({ document, blocks: [block] });
    expect(anchor.querySelector(".brx-nav-translation-pending")).toHaveTextContent("正在翻译...");

    renderNavigationTranslations({
      document,
      blocks: [block],
      results: [{ id: block.id, text: "概览", error: "", cached: false }],
    });

    expect(anchor.querySelector(".brx-nav-translation")).toHaveTextContent("概览");
    restoreTranslations(document);
    expect(anchor.querySelector(".brx-nav-translation")).toBeNull();
    expect(anchor.dataset.brxState).toBeUndefined();
  });

  it("unwraps generated text fragments on restore", () => {
    document.body.innerHTML = `<div><span data-brx-text-fragment="1">Loose forum text.</span></div>`;

    restoreTranslations(document);

    expect(document.querySelector("[data-brx-text-fragment]")).toBeNull();
    expect(document.body.textContent).toBe("Loose forum text.");
  });
});
