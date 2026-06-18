import { blockHash, normalizeText } from "../shared/hash";
import { buildRichTextPayload } from "../shared/richText";
import type { ContentBlock, ExtractOptions } from "./types";

const BLOCK_CANDIDATE_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,blockquote,td,th,caption";
const TEXT_CONTAINER_SELECTOR = "div,span,a";
const DEFAULT_CANDIDATE_SELECTOR = `${BLOCK_CANDIDATE_SELECTOR},${TEXT_CONTAINER_SELECTOR}`;
const NAVIGATION_ROOT_SELECTOR = [
  "aside",
  "#toc",
  ".toc",
  ".vector-toc",
  ".sidebar",
  "[class*='sidebar']",
  "[class*='toc']",
  "[class*='on-this-page']",
  "[class*='table-of-contents']",
  "[class*='page-outline']",
  "[class*='content-outline']",
  "[aria-label*='contents' i]",
  "[aria-label*='on this page' i]",
  "[aria-label*='table of contents' i]",
  "[data-testid*='toc' i]",
  "[data-testid*='sidebar' i]",
  "[data-nav-id]",
  "[data-left-nav]",
  "[data-left-nav-id]",
  "[data-left-nav-container]",
  "[data-content-page-toc-rail]",
  "astro-island[component-url*='TableOfContents']",
].join(",");
const NAVIGATION_CANDIDATE_SELECTOR = [
  "a",
  "button",
  "summary",
  "button > span",
  "h2",
  "h3",
  "h4",
  "summary > span",
  "[role='button'] > span",
  "[aria-expanded] > span",
  "[role='button']",
  "[aria-expanded]",
  "[data-state]",
  ".group",
  ".section",
].join(",");
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
const CONTENT_ROOT_SELECTOR = [
  "main",
  "article",
  "[role='main']",
  "#content",
  "#main",
  "#main-content",
  "#l-container",
  ".article",
  ".entry",
  ".entry-content",
  ".post-content",
  ".page-content",
  ".main-content",
  ".content-area",
  ".site-content",
  ".col_news",
  ".col_news_box",
  ".read",
  ".wp_articlecontent",
].join(",");
const VISUALIZATION_SELECTOR = [
  "canvas",
  "svg",
  "[role='img']",
  "[data-chart]",
  "[data-graph]",
  "[data-plot]",
  "[data-mtg-bench-chart-viewport]",
  "[role='application']",
  "[class*='chart']",
  "[class*='graph']",
  "[class*='plot']",
  "[class*='axis']",
  "[class*='legend']",
  "[class*='tooltip']",
  "[class*='recharts']",
  "[class*='plotly']",
  "[class*='highcharts']",
  "[class*='echarts']",
  "[class*='apexcharts']",
];
const SKIP_SELECTOR = [
  "nav",
  "footer",
  "aside",
  ...VISUALIZATION_SELECTOR,
  "script",
  "style",
  "noscript",
  "code",
  "pre",
  "input",
  "textarea",
  "select",
  "button",
  "iframe",
  "object",
  "embed",
  "video",
  "audio",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  "[aria-hidden='true']",
  "[contenteditable='true']",
  "[type='password']",
  ".nav",
  ".navbar",
  ".navi",
  ".wp-navi",
  ".wp-menu",
  ".sub-menu",
  ".menu",
  ".site-header",
  ".main-header",
  ".header",
  ".footer",
  ".searchbox",
  ".wp-search",
  ".site-lang",
  ".breadcrumb",
  ".col_path",
  ".col_menu",
  ".clickint",
  "time",
  ".entry-footer",
  ".entry-meta",
  ".post-meta",
  ".post-info",
  ".byline",
  ".author",
  ".vcard",
  ".cat-links",
  ".tags-links",
  ".posted-on",
  ".comments-link",
  ".screen-reader-text",
  ".more-button",
  ".more-link",
  ".read-more",
  ".brx-translation",
  ".brx-nav-translation",
  ".brx-status",
  "[data-brx-state='queued']",
  "[data-brx-state='translated']",
  "[data-brx-state='pending']",
].join(",");
const ATOMIC_SELECTOR = [
  ...VISUALIZATION_SELECTOR,
  "table[data-sortable]",
  "[role='grid']",
  "[role='tree']",
  "[role='slider']",
  "[role='spinbutton']",
  "[role='tablist']",
  "[role='toolbar']",
  "[role='application']",
  ".dataTable",
  ".datatable",
  ".table-responsive",
].join(",");
const VISUALIZATION_MARKER_REGEX =
  /\b(chart|graph|plot|axis|legend|tooltip|recharts|plotly|highcharts|echarts|apexcharts|scatter|visualization)\b/;
const URL_ONLY_REGEX =
  /^(?:(?:https?:\/\/|www\.)[^\s<>"']+|mailto:[^\s<>"']+)(?:\s+(?:(?:https?:\/\/|www\.)[^\s<>"']+|mailto:[^\s<>"']+))*$/i;
const NAVIGATION_ACTION_REGEX =
  /^(log in|login|sign in|create account|donate|appearance|hide|show|search|edit|view history|tools|read|home|api|chatgpt|resources|api dashboard|copy page|copy link|copied|ask ai)$/i;
const SIDE_RAIL_MIN_WIDTH = 900;
const SIDE_RAIL_WIDTH = 360;
const SIDE_RAIL_MIN_TOP = 72;

export const defaultExtractOptions: ExtractOptions = {
  excludeSelectors: [],
  includeSelectors: [],
  atomicSelectors: [],
  stayOriginalSelectors: [],
  extraBlockSelectors: [],
  extraInlineSelectors: [],
  navigationSelectors: [],
  translateNavigation: true,
  minTextLength: 2,
};

function elementKind(element: HTMLElement): ContentBlock["kind"] {
  const tag = element.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) return "heading";
  if (tag === "li") return "list";
  if (tag === "td" || tag === "th" || tag === "caption") return "table";
  if (tag === "blockquote") return "quote";
  return "paragraph";
}

export function isElementVisible(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
  let current: HTMLElement | null = element;
  while (current && current !== element.ownerDocument.body.parentElement) {
    if (current.hidden || current.getAttribute("aria-hidden") === "true") return false;
    const style = current.ownerDocument.defaultView?.getComputedStyle(current);
    if (style && (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse")) {
      return false;
    }
    current = current.parentElement;
  }
  return true;
}

function shouldSkipElement(element: HTMLElement, options: ExtractOptions): boolean {
  if (element.closest(SKIP_SELECTOR)) return true;
  let current: HTMLElement | null = element;
  while (current && current !== element.ownerDocument.body.parentElement) {
    if (VISUALIZATION_MARKER_REGEX.test(classAndIdText(current))) return true;
    current = current.parentElement;
  }
  const header = element.closest("header");
  if (header && !header.closest("article")) return true;
  if (options.excludeSelectors.some((selector) => selector && element.closest(selector))) return true;
  return false;
}

function elementText(element: HTMLElement): string {
  const clone = element.cloneNode(true);
  if (clone instanceof HTMLElement) {
    clone.querySelectorAll(SKIP_SELECTOR).forEach((node) => node.remove());
    return normalizeText(clone.innerText || clone.textContent || "");
  }
  return normalizeText(element.innerText || element.textContent || "");
}

function isMeaningfulText(text: string): boolean {
  return /\p{L}/u.test(text);
}

function isUrlOnlyText(text: string): boolean {
  return URL_ONLY_REGEX.test(text.trim());
}

function isNavigationActionText(text: string): boolean {
  const normalized = text.trim();
  if (NAVIGATION_ACTION_REGEX.test(normalized)) return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  return words.length > 1 && words.every((word) => NAVIGATION_ACTION_REGEX.test(word));
}

function isGlobalNavigationElement(element: HTMLElement): boolean {
  return Boolean(
    element.closest(
      "header,[role='banner'],[data-site-header],[data-main-header],[data-global-nav],.site-header,.main-header,.header,.navbar,.topbar,[class*='top-nav'],[class*='global-nav']",
    ),
  );
}

function classAndIdText(element: HTMLElement): string {
  return `${element.id} ${typeof element.className === "string" ? element.className : ""}`.toLowerCase();
}

function selectorList(selectors: string[]): string {
  return selectors.filter(Boolean).join(",");
}

function matchesAny(element: HTMLElement, selectors: string[]): boolean {
  const list = selectorList(selectors);
  if (!list) return false;
  try {
    return Boolean(element.closest(list));
  } catch {
    return false;
  }
}

function queryAllSafe(root: ParentNode, selector: string): Element[] {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

function linkDensity(element: HTMLElement): number {
  const textLength = Math.max(elementText(element).length, 1);
  const linkTextLength = Array.from(element.querySelectorAll("a")).reduce(
    (sum, link) => sum + normalizeText(link.textContent || "").length,
    0,
  );
  return linkTextLength / textLength;
}

function rootScore(element: HTMLElement): number {
  const text = elementText(element);
  if (text.length < 20) return 0;
  let score = Math.min(text.length, 3000);
  score += element.querySelectorAll("p").length * 65;
  score += element.querySelectorAll("h1,h2,h3").length * 45;
  score += element.querySelectorAll("li,blockquote,td,th,caption").length * 20;
  const marker = classAndIdText(element);
  if (/(article|entry|content|main|post|news|read|profile|faculty|teacher|professor|publication|gsc|col_news)/.test(marker)) {
    score += 800;
  }
  if (element.matches("main,article,[role='main']")) score += 500;
  if (/(nav|navi|menu|header|footer|search|breadcrumb|aside|side)/.test(marker)) {
    score -= 1500;
  }
  score -= Math.round(linkDensity(element) * 1200);
  return score;
}

function isAtomicElement(element: HTMLElement, options: ExtractOptions): boolean {
  if (element.matches(ATOMIC_SELECTOR) || element.closest(ATOMIC_SELECTOR)) return true;
  if (matchesAny(element, options.atomicSelectors)) return true;
  let current: HTMLElement | null = element;
  while (current && current !== element.ownerDocument.body.parentElement) {
    if (VISUALIZATION_MARKER_REGEX.test(classAndIdText(current))) return true;
    current = current.parentElement;
  }
  return false;
}

function isStayOriginalElement(element: HTMLElement, options: ExtractOptions): boolean {
  return matchesAny(element, options.stayOriginalSelectors);
}

function contentRoots(document: Document, options: ExtractOptions): HTMLElement[] {
  const candidates = queryAllSafe(document, CONTENT_ROOT_SELECTOR)
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .filter((element) => !shouldSkipElement(element, options) && isElementVisible(element))
    .map((element) => ({ element, score: rootScore(element) }))
    .filter((item) => item.score >= 160)
    .sort((left, right) => right.score - left.score);

  const best = candidates[0];
  if (!best) return [];
  const strong = candidates.filter((item) => item.score >= Math.max(160, best.score * 0.45));
  return strong
    .filter(
      (item) =>
        !strong.some(
          (other) =>
            other !== item &&
            item.element.contains(other.element) &&
            other.score >= item.score * 0.55,
        ),
    )
    .sort((left, right) =>
      left.element.compareDocumentPosition(right.element) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1,
    )
    .map((item) => item.element);
}

function getRoots(document: Document, options: ExtractOptions): HTMLElement[] {
  const included = options.includeSelectors
    .flatMap((selector) => queryAllSafe(document, selector))
    .filter((match): match is HTMLElement => match instanceof HTMLElement);
  if (included.length) return included;

  const content = contentRoots(document, options);
  if (content.length) return content;

  const articles = Array.from(document.querySelectorAll("article")).filter(
    (element): element is HTMLElement => element instanceof HTMLElement,
  );
  if (articles.length) return articles;

  return document.body ? [document.body] : [];
}

function hasBlockChildren(element: HTMLElement, options: ExtractOptions): boolean {
  const extraBlock = selectorList(options.extraBlockSelectors);
  const blockSelector = extraBlock ? `${BLOCK_CANDIDATE_SELECTOR},${extraBlock}` : BLOCK_CANDIDATE_SELECTOR;
  return Boolean(element.querySelector(blockSelector));
}

function isTextContainerCandidate(element: HTMLElement, options: ExtractOptions): boolean {
  const tag = element.tagName.toLowerCase();
  if (tag !== "div" && tag !== "span" && tag !== "a") return false;
  const text = elementText(element);
  if (text.length < options.minTextLength) return false;
  if (!isMeaningfulText(text)) return false;
  if (tag === "a" && element.closest("nav,header,footer,[role='navigation'],.nav,.navbar,.menu")) return false;
  if (hasBlockChildren(element, options)) return false;
  if (tag === "div" && Array.from(element.children).some((child) => child.tagName.toLowerCase() === "div")) {
    return false;
  }
  return true;
}

function candidateSelector(options: ExtractOptions): string {
  return selectorList([
    DEFAULT_CANDIDATE_SELECTOR,
    ...options.extraBlockSelectors,
    ...options.extraInlineSelectors,
  ]);
}

function navigationCandidateSelector(options: ExtractOptions): string {
  return selectorList([NAVIGATION_CANDIDATE_SELECTOR, ...options.navigationSelectors]);
}

function isNestedNavigationLabel(element: HTMLElement): boolean {
  const parent = element.parentElement;
  if (!parent) return false;
  return parent.matches("a") && elementText(parent) === elementText(element);
}

function hasPreferredNavigationLabelChild(element: HTMLElement): boolean {
  if (!element.matches("summary,button,[role='button'],[aria-expanded]")) return false;
  const ownText = elementText(element);
  if (!ownText) return false;
  return Array.from(element.children).some(
    (child) =>
      child instanceof HTMLElement &&
      child.matches("a,span,[data-label],[class*='label'],[class*='title']") &&
      elementText(child) === ownText,
  );
}

function hasTranslatedNavigationAncestor(element: HTMLElement): boolean {
  const translatedAncestor = element.parentElement?.closest(
    "[data-brx-state='queued'],[data-brx-state='pending'],[data-brx-state='translated']",
  );
  return Boolean(
    translatedAncestor instanceof HTMLElement &&
      translatedAncestor.querySelector(".brx-nav-translation,.brx-translation"),
  );
}

function navigationRoots(document: Document, options: ExtractOptions): HTMLElement[] {
  const roots = queryAllSafe(document, NAVIGATION_ROOT_SELECTOR)
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .filter((element) => !isGlobalNavigationElement(element) && isElementVisible(element));
  const customRoots = options.navigationSelectors
    .flatMap((selector) => queryAllSafe(document, selector))
    .filter((element): element is HTMLElement => element instanceof HTMLElement);
  return [...roots, ...customRoots];
}

function sideRailCandidates(document: Document, options: ExtractOptions): HTMLElement[] {
  const view = document.defaultView;
  if (!view || view.innerWidth < SIDE_RAIL_MIN_WIDTH) return [];
  return queryAllSafe(document, navigationCandidateSelector(options))
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .filter((element) => {
      if (isGlobalNavigationElement(element) || !isElementVisible(element)) return false;
      if (element.closest("article,#mainContent,[role='main']")) return false;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || rect.top < SIDE_RAIL_MIN_TOP) return false;
      return rect.left <= SIDE_RAIL_WIDTH || rect.right >= view.innerWidth - SIDE_RAIL_WIDTH;
    });
}

function isCandidateElement(element: HTMLElement, options: ExtractOptions): boolean {
  const extraBlock = selectorList(options.extraBlockSelectors);
  const extraInline = selectorList(options.extraInlineSelectors);
  if ((extraBlock && element.matches(extraBlock)) || element.matches(BLOCK_CANDIDATE_SELECTOR)) {
    const tag = element.tagName.toLowerCase();
    if (
      (tag === "td" || tag === "th" || tag === "caption") &&
      Array.from(element.children).some((child) => child instanceof HTMLElement && child.matches(DEFAULT_CANDIDATE_SELECTOR))
    ) {
      return false;
    }
    return true;
  }
  if (extraInline && element.matches(extraInline)) return true;
  return isTextContainerCandidate(element, options);
}

function findCandidateElements(document: Document, options: ExtractOptions): HTMLElement[] {
  const roots = getRoots(document, options);
  const rawElements: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  const selector = candidateSelector(options);

  for (const root of roots) {
    const matches = root.matches(selector)
      ? [root, ...queryAllSafe(root, selector)]
      : queryAllSafe(root, selector);
    for (const match of matches) {
      if (!(match instanceof HTMLElement) || seen.has(match)) continue;
      seen.add(match);
      rawElements.push(match);
    }
  }

  return rawElements;
}

function computedDisplay(element: HTMLElement): string {
  return element.ownerDocument.defaultView?.getComputedStyle(element).display ?? "";
}

function elementLayout(element: HTMLElement, options: ExtractOptions): "block" | "inline" {
  const extraInline = selectorList(options.extraInlineSelectors);
  if (extraInline && element.matches(extraInline)) return "inline";
  const extraBlock = selectorList(options.extraBlockSelectors);
  if (extraBlock && element.matches(extraBlock)) return "block";
  if (element.matches(BLOCK_CANDIDATE_SELECTOR)) return "block";
  if (element.tagName.toLowerCase() === "a") return "block";
  return INLINE_DISPLAYS.has(computedDisplay(element)) ? "inline" : "block";
}

function elementClassification(
  element: HTMLElement,
  options: ExtractOptions,
): "block" | "inline" | "atomic" | "ignored" | "stay-original" {
  if (shouldSkipElement(element, options)) return "ignored";
  if (isStayOriginalElement(element, options)) return "stay-original";
  if (isAtomicElement(element, options)) return "atomic";
  return elementLayout(element, options) === "inline" ? "inline" : "block";
}

export function collectHeadings(document: Document): string[] {
  return Array.from(document.querySelectorAll("h1,h2,h3"))
    .filter((element): element is HTMLElement => element instanceof HTMLElement && isElementVisible(element))
    .map((element) => normalizeText(element.innerText || element.textContent || ""))
    .filter(Boolean)
    .slice(0, 24);
}

export function extractPageBlocks(document: Document, options: Partial<ExtractOptions> = {}): ContentBlock[] {
  const merged = { ...defaultExtractOptions, ...options };
  const candidates = findCandidateElements(document, merged)
    .filter((element) => isCandidateElement(element, merged))
    .filter((element, _index, all) => {
      let parent = element.parentElement;
      while (parent) {
        if (all.includes(parent)) return false;
        parent = parent.parentElement;
      }
      return true;
    });
  const seen = new Set<string>();
  const blocks: ContentBlock[] = [];

  for (const element of candidates) {
    const classification = elementClassification(element, merged);
    if (classification === "ignored" || classification === "atomic" || classification === "stay-original") {
      continue;
    }
    const text = elementText(element);
    if (text.length < merged.minTextLength) continue;
    if (isUrlOnlyText(text)) continue;
    if (!isMeaningfulText(text)) continue;
    const hash = blockHash(text);
    const duplicateKey = `${hash}:${elementKind(element)}`;
    if (seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);
    const block: ContentBlock = {
      id: `brx-${hash}-${blocks.length}`,
      hash,
      text,
      kind: elementKind(element),
      visibility: isElementVisible(element) ? "visible" : "hidden",
      layout: elementLayout(element, merged),
      classification,
      element,
    };
    const richText = buildRichTextPayload(element);
    if (richText) block.richText = richText;
    blocks.push(block);
  }

  return blocks;
}

export function extractNavigationBlocks(document: Document, options: Partial<ExtractOptions> = {}): ContentBlock[] {
  const merged = { ...defaultExtractOptions, ...options };
  if (!merged.translateNavigation) return [];
  const candidateElements = [
    ...navigationRoots(document, merged)
    .flatMap((root) =>
      root.matches(navigationCandidateSelector(merged))
        ? [root, ...queryAllSafe(root, navigationCandidateSelector(merged))]
        : queryAllSafe(root, navigationCandidateSelector(merged)),
    ),
    ...sideRailCandidates(document, merged),
  ];
  const candidateSeen = new Set<HTMLElement>();
  const candidates = candidateElements
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .filter((element) => {
      if (candidateSeen.has(element)) return false;
      candidateSeen.add(element);
      return isElementVisible(element) && !isGlobalNavigationElement(element);
    });
  const seen = new Set<string>();
  const blocks: ContentBlock[] = [];

  for (const element of candidates) {
    if (matchesAny(element, merged.excludeSelectors)) continue;
    if (
      element.closest(
        "form,[role='search'],.search,.vector-user-links,.mw-portlet-appearance,[data-page-copy-action],[data-page-copy-label],[data-anchor-id]",
      )
    ) {
      continue;
    }
    if (hasTranslatedNavigationAncestor(element)) continue;
    if (element.closest(".brx-nav-translation,.brx-translation")) continue;
    if (element.querySelector(".brx-nav-translation,.brx-translation")) continue;
    if (isNestedNavigationLabel(element)) continue;
    if (hasPreferredNavigationLabelChild(element)) continue;
    if (Array.from(element.children).some((child) => child instanceof HTMLElement && child.matches("a,button,summary,[role='button'],[aria-expanded]"))) {
      continue;
    }
    const text = elementText(element);
    if (text.length < merged.minTextLength || text.length > 80) continue;
    if (isUrlOnlyText(text) || isNavigationActionText(text)) continue;
    if (!isMeaningfulText(text)) continue;
    const hash = blockHash(`nav:${text}`);
    const duplicateKey = `${hash}:${element.getAttribute("href") ?? ""}`;
    if (seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);
    blocks.push({
      id: `brx-nav-${hash}-${blocks.length}`,
      hash,
      text,
      kind: "list",
      visibility: "visible",
      layout: "inline",
      classification: "navigation",
      element,
    });
  }

  return blocks;
}
