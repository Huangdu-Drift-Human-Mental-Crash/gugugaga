import type { DisplayMode, TranslationItemResult } from "../shared/types";
import { restoreRichTextFragment } from "../shared/richText";
import type { ContentBlock } from "./types";

const STYLE_ID = "brx-style";
const DEFAULT_PENDING_TEXT = "正在翻译...";

export function injectContentStyles(document: Document): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .brx-translation {
      box-sizing: border-box;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      line-height: inherit;
      letter-spacing: inherit;
      text-align: inherit;
      overflow-wrap: break-word;
      word-break: normal;
      white-space: normal;
    }
    .brx-translation-block {
      display: block;
      margin: 0.18em 0 0.58em;
    }
    .brx-translation-inline {
      display: inline;
      margin-inline-start: 0.35em;
    }
    .brx-translation-heading {
      opacity: 0.78;
      margin-top: 0.12em;
      margin-bottom: 0.45em;
    }
    .brx-translation-list,
    .brx-translation-table {
      margin-top: 0.22em;
      margin-bottom: 0.35em;
    }
    .brx-translation-pending {
      min-height: 1em;
      opacity: 0.62;
      font-style: italic;
    }
    .brx-original-hidden {
      display: none !important;
    }
    .brx-status {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483647;
      max-width: min(360px, calc(100vw - 32px));
      padding: 10px 12px;
      border: 1px solid rgba(31, 41, 55, 0.18);
      border-radius: 8px;
      background: Canvas;
      color: CanvasText;
      box-shadow: 0 8px 28px rgba(0,0,0,0.18);
      font: 13px/1.4 system-ui, -apple-system, Segoe UI, sans-serif;
    }
    .brx-nav-translation {
      display: block;
      margin-top: 2px;
      opacity: 0.72;
      font-size: 0.86em;
      line-height: 1.25;
      font-weight: 400;
      color: inherit;
      text-decoration: none;
    }
    .brx-nav-translation-pending {
      opacity: 0.5;
      font-style: italic;
    }
  `;
  document.documentElement.append(style);
}

function translationSelector(id: string): string {
  return `.brx-translation[data-brx-for="${id.replace(/["\\]/g, "\\$&")}"]`;
}

function getTranslationNode(document: Document, id: string): HTMLElement | null {
  const existing = document.querySelector(translationSelector(id));
  return existing instanceof HTMLElement ? existing : null;
}

function navTranslationSelector(id: string): string {
  return `.brx-nav-translation[data-brx-for="${id.replace(/["\\]/g, "\\$&")}"]`;
}

function getNavigationTranslationNode(document: Document, id: string): HTMLElement | null {
  const existing = document.querySelector(navTranslationSelector(id));
  return existing instanceof HTMLElement ? existing : null;
}

const INLINE_DISPLAYS = new Set([
  "inline",
  "inline-block",
  "inline-flex",
  "inline-grid",
  "inline-table",
  "ruby",
  "ruby-base",
  "ruby-text",
]);

const SAFE_TEXT_STYLE_PROPERTIES = [
  "color",
  "direction",
  "font-family",
  "font-size",
  "font-style",
  "font-variant",
  "font-weight",
  "letter-spacing",
  "line-height",
  "text-align",
  "writing-mode",
];

function sourceDisplay(element: HTMLElement): string {
  return element.ownerDocument.defaultView?.getComputedStyle(element).display ?? "";
}

function isInlineTranslation(block: ContentBlock): boolean {
  if (block.layout) return block.layout === "inline";
  if (block.kind === "heading" || block.kind === "list" || block.kind === "table" || block.kind === "quote") {
    return false;
  }
  if (block.element.tagName.toLowerCase() === "a") return false;
  return INLINE_DISPLAYS.has(sourceDisplay(block.element));
}

function translationTagName(block: ContentBlock): "a" | "div" | "span" {
  if (block.element.tagName.toLowerCase() === "a") return "a";
  return isInlineTranslation(block) ? "span" : "div";
}

function translationClassName(block: ContentBlock, pending: boolean): string {
  const classes = [
    "brx-translation",
    isInlineTranslation(block) ? "brx-translation-inline" : "brx-translation-block",
    `brx-translation-${block.kind}`,
  ];
  if (pending) classes.push("brx-translation-pending");
  return classes.join(" ");
}

function isRenderableBlock(block: ContentBlock): boolean {
  return (
    block.classification !== "atomic" &&
    block.classification !== "ignored" &&
    block.classification !== "stay-original" &&
    block.classification !== "navigation"
  );
}

function applyTextPresentation(source: HTMLElement, target: HTMLElement): void {
  target.removeAttribute("style");
  const computed = source.ownerDocument.defaultView?.getComputedStyle(source);
  if (!computed) return;
  for (const property of SAFE_TEXT_STYLE_PROPERTIES) {
    const value = computed.getPropertyValue(property);
    if (value) target.style.setProperty(property, value);
  }
}

function applyLinkAttributes(source: HTMLElement, target: HTMLElement): void {
  if (source.tagName.toLowerCase() !== "a") {
    target.removeAttribute("href");
    target.removeAttribute("target");
    target.removeAttribute("rel");
    return;
  }
  const href = source.getAttribute("href");
  if (href) target.setAttribute("href", href);
  const targetAttr = source.getAttribute("target");
  if (targetAttr) target.setAttribute("target", targetAttr);
  target.setAttribute("rel", source.getAttribute("rel") || "noopener noreferrer");
}

function setTranslationContent(target: HTMLElement, block: ContentBlock, text: string): void {
  target.textContent = "";
  if (block.richText) {
    const fragment = restoreRichTextFragment(target.ownerDocument, text, block.richText);
    if (fragment) {
      target.append(fragment);
      return;
    }
  }
  target.textContent = text;
}

function getOrCreateTranslationNode(document: Document, block: ContentBlock): { node: HTMLElement; isNew: boolean } {
  const existing = getTranslationNode(document, block.id);
  const tagName = translationTagName(block);
  if (!existing) {
    return { node: document.createElement(tagName), isNew: true };
  }
  if (existing.tagName.toLowerCase() === tagName) {
    return { node: existing, isNew: false };
  }
  const replacement = document.createElement(tagName);
  existing.replaceWith(replacement);
  return { node: replacement, isNew: false };
}

function resetOriginal(block: ContentBlock): void {
  block.element.classList.remove("brx-original-hidden");
  delete block.element.dataset.brxState;
  delete block.element.dataset.brxBlockId;
  delete block.element.dataset.brxWalked;
  delete block.element.dataset.brxError;
  delete block.element.dataset.brxSkipReason;
}

function notifyLayoutChanged(document: Document): void {
  const view = document.defaultView;
  if (!view) return;
  const notify = () => {
    view.dispatchEvent(new view.Event("resize"));
  };
  if (typeof view.requestAnimationFrame === "function") view.requestAnimationFrame(notify);
  else view.setTimeout(notify, 0);
}

export function showStatus(document: Document, text: string): void {
  let node = document.querySelector(".brx-status");
  if (!(node instanceof HTMLElement)) {
    node = document.createElement("div");
    node.className = "brx-status";
    document.documentElement.append(node);
  }
  node.textContent = text;
  window.setTimeout(() => {
    if (node?.textContent === text) node.remove();
  }, 3500);
}

export function renderPendingTranslations(input: {
  document: Document;
  blocks: ContentBlock[];
  displayMode: DisplayMode;
  pendingText?: string;
}): number {
  let rendered = 0;
  for (const block of input.blocks) {
    if (!isRenderableBlock(block)) continue;
    const { node: translation, isNew } = getOrCreateTranslationNode(input.document, block);
    translation.className = translationClassName(block, true);
    translation.dataset.brxFor = block.id;
    translation.textContent = input.pendingText ?? DEFAULT_PENDING_TEXT;
    translation.setAttribute("aria-busy", "true");
    translation.setAttribute("translate", "no");
    applyTextPresentation(block.element, translation);
    applyLinkAttributes(block.element, translation);

    block.element.dataset.brxState = "pending";
    block.element.dataset.brxBlockId = block.id;
    block.element.classList.toggle("brx-original-hidden", input.displayMode === "translation");
    if (isNew) block.element.insertAdjacentElement("afterend", translation);
    rendered += 1;
  }
  if (rendered) notifyLayoutChanged(input.document);
  return rendered;
}

export function renderTranslations(input: {
  document: Document;
  blocks: ContentBlock[];
  results: TranslationItemResult[];
  displayMode: DisplayMode;
}): number {
  const byId = new Map(input.blocks.map((block) => [block.id, block]));
  let rendered = 0;
  for (const result of input.results) {
    const block = byId.get(result.id);
    if (!block) continue;
    if (!isRenderableBlock(block)) continue;
    if (result.error || !result.text) {
      const existing = getTranslationNode(input.document, result.id);
      existing?.remove();
      resetOriginal(block);
      continue;
    }

    const { node: translation, isNew } = getOrCreateTranslationNode(input.document, block);
    translation.className = translationClassName(block, false);
    translation.dataset.brxFor = result.id;
    setTranslationContent(translation, block, result.text);
    translation.removeAttribute("aria-busy");
    translation.setAttribute("translate", "no");
    applyTextPresentation(block.element, translation);
    applyLinkAttributes(block.element, translation);
    block.element.dataset.brxState = "translated";
    block.element.dataset.brxBlockId = result.id;
    block.element.classList.toggle("brx-original-hidden", input.displayMode === "translation");
    if (isNew) block.element.insertAdjacentElement("afterend", translation);
    rendered += 1;
  }
  if (rendered) notifyLayoutChanged(input.document);
  return rendered;
}

export function renderNavigationPendingTranslations(input: {
  document: Document;
  blocks: ContentBlock[];
  pendingText?: string;
}): number {
  let rendered = 0;
  for (const block of input.blocks) {
    if (block.classification !== "navigation") continue;
    let node = getNavigationTranslationNode(input.document, block.id);
    if (!node) {
      node = input.document.createElement("span");
      block.element.append(node);
    }
    node.className = "brx-nav-translation brx-nav-translation-pending";
    node.dataset.brxFor = block.id;
    node.textContent = input.pendingText ?? DEFAULT_PENDING_TEXT;
    node.setAttribute("aria-busy", "true");
    node.setAttribute("translate", "no");
    block.element.dataset.brxState = "pending";
    block.element.dataset.brxBlockId = block.id;
    rendered += 1;
  }
  return rendered;
}

export function renderNavigationTranslations(input: {
  document: Document;
  blocks: ContentBlock[];
  results: TranslationItemResult[];
}): number {
  const byId = new Map(input.blocks.map((block) => [block.id, block]));
  let rendered = 0;
  for (const result of input.results) {
    const block = byId.get(result.id);
    if (!block || block.classification !== "navigation") continue;
    if (result.error || !result.text) {
      getNavigationTranslationNode(input.document, result.id)?.remove();
      continue;
    }
    let node = getNavigationTranslationNode(input.document, block.id);
    if (!node) {
      node = input.document.createElement("span");
      block.element.append(node);
    }
    node.className = "brx-nav-translation";
    node.dataset.brxFor = block.id;
    node.textContent = result.text;
    node.removeAttribute("aria-busy");
    node.setAttribute("translate", "no");
    block.element.dataset.brxState = "translated";
    block.element.dataset.brxBlockId = result.id;
    rendered += 1;
  }
  return rendered;
}

export function clearPendingTranslations(document: Document, blocks?: ContentBlock[]): void {
  if (blocks?.length) {
    for (const block of blocks) {
      const existing = getTranslationNode(document, block.id);
      if (existing?.classList.contains("brx-translation-pending")) existing.remove();
      if (block.element.dataset.brxState === "pending") resetOriginal(block);
    }
    notifyLayoutChanged(document);
    return;
  }

  document.querySelectorAll(".brx-translation-pending").forEach((node) => node.remove());
  document.querySelectorAll(".brx-nav-translation-pending").forEach((node) => node.remove());
  document.querySelectorAll("[data-brx-state='pending']").forEach((node) => {
    if (node instanceof HTMLElement) {
      node.classList.remove("brx-original-hidden");
      delete node.dataset.brxState;
      delete node.dataset.brxBlockId;
    }
  });
  notifyLayoutChanged(document);
}

export function restoreTranslations(document: Document): void {
  document.querySelectorAll(".brx-translation,.brx-nav-translation,.brx-status").forEach((node) => node.remove());
  document.querySelectorAll("[data-brx-state],[data-brx-block-id],[data-brx-walked],[data-brx-error]").forEach((node) => {
    if (node instanceof HTMLElement) {
      node.classList.remove("brx-original-hidden");
      delete node.dataset.brxState;
      delete node.dataset.brxBlockId;
      delete node.dataset.brxWalked;
      delete node.dataset.brxError;
      delete node.dataset.brxSkipReason;
    }
  });
}
