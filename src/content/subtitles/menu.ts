import type { DisplayMode } from "../../shared/types";

export const YOUTUBE_SUBTITLE_MENU_MARK = "brxYoutubeSubtitleMenu";

const STYLE_ID = "brx-youtube-subtitle-menu-style";

const MENU_CONTAINER_SELECTOR = [
  ".ytp-panel-menu",
  "ytd-menu-popup-renderer",
  "tp-yt-paper-listbox",
].join(",");

const MENU_ITEM_SELECTOR = [
  ".ytp-menuitem",
  "ytd-menu-service-item-renderer",
  "tp-yt-paper-item",
  "[role='menuitem']",
].join(",");

function nodeText(node: Element | Document | null): string {
  if (!node) return "";
  if (node instanceof HTMLElement && node.innerText) return node.innerText;
  return node.textContent ?? "";
}

function panelScope(container: HTMLElement): HTMLElement {
  const scope = container.closest(".ytp-panel,.ytp-popup,.ytp-settings-menu");
  return scope instanceof HTMLElement ? scope : container.parentElement ?? container;
}

function injectMenuStyles(document: Document): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .brx-youtube-subtitle-menu-active
      > .ytp-menuitem[role="menuitemradio"][aria-checked="true"]:not(.brx-youtube-subtitle-menu-item)
      .ytp-menuitem-label {
      background-image: none !important;
    }
    .brx-youtube-subtitle-menu-active
      > .ytp-menuitem[role="menuitemradio"][aria-checked="true"]:not(.brx-youtube-subtitle-menu-item)
      .ytp-menuitem-label::before {
      opacity: 0 !important;
    }
  `;
  document.documentElement.append(style);
}

function isSubtitlesPanel(container: HTMLElement): boolean {
  const scope = panelScope(container);
  const headerText = nodeText(scope.querySelector(".ytp-panel-header,[class*='panel-header']"));
  if (/Audio track|音轨|音訊|音声トラック/i.test(headerText)) return false;
  if (/Subtitles\/CC|Subtitles|字幕|CC/i.test(headerText)) return true;
  const text = nodeText(scope);
  if (/Audio track|音轨|音訊|音声トラック/i.test(text)) return false;
  return /Subtitles\/CC|Subtitles|字幕|CC/i.test(text) && /Off|auto-generated|Auto-translate|自动|关闭/i.test(text);
}

function setSelectedState(item: HTMLElement, selected: boolean): void {
  item.classList.toggle("brx-youtube-subtitle-selected", selected);
  item.dataset.brxSelected = selected ? "true" : "false";
  item.setAttribute("aria-checked", selected ? "true" : "false");
}

function syncSelectedState(document: Document, selectedMode?: DisplayMode): void {
  document.querySelectorAll<HTMLElement>("[data-brx-youtube-subtitle-menu]").forEach((item) => {
    setSelectedState(item, item.dataset[YOUTUBE_SUBTITLE_MENU_MARK] === selectedMode);
  });
  document.querySelectorAll<HTMLElement>(MENU_CONTAINER_SELECTOR).forEach((container) => {
    if (container.querySelector("[data-brx-youtube-subtitle-menu]")) {
      container.classList.toggle("brx-youtube-subtitle-menu-active", Boolean(selectedMode));
    }
  });
}

function createMenuItem(
  document: Document,
  mode: DisplayMode,
  selectedMode: DisplayMode | undefined,
  onSelect: (mode: DisplayMode) => void,
): HTMLElement {
  const item = document.createElement("div");
  item.className = "ytp-menuitem brx-youtube-subtitle-menu-item";
  item.dataset[YOUTUBE_SUBTITLE_MENU_MARK] = mode;
  item.setAttribute("role", "menuitemradio");
  item.setAttribute("aria-checked", "false");
  item.setAttribute("tabindex", "0");
  item.setAttribute("translate", "no");
  item.setAttribute("aria-label", `Bilingual Reader ${mode === "dual" ? "Bilingual" : "Translation only"}`);
  const label = document.createElement("div");
  label.className = "ytp-menuitem-label";
  label.textContent = mode === "dual" ? "BR: Bilingual" : "BR: Translation only";
  item.append(label);
  setSelectedState(item, selectedMode === mode);
  const activate = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    syncSelectedState(document, mode);
    onSelect(mode);
  };
  item.addEventListener("click", activate);
  item.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.key === "Enter" || event.key === " ") activate(event);
  });
  return item;
}

function insertionContainer(document: Document): HTMLElement | null {
  const containers = Array.from(document.querySelectorAll(MENU_CONTAINER_SELECTOR)).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );
  return containers.find((container) => (container.offsetParent !== null || container.childElementCount > 0) && isSubtitlesPanel(container)) ?? null;
}

export function injectYouTubeSubtitleMenu(
  document: Document,
  onSelect: (mode: DisplayMode) => void,
  selectedMode?: DisplayMode,
): boolean {
  const container = insertionContainer(document);
  if (!container) return false;
  injectMenuStyles(document);
  if (container.querySelector("[data-brx-youtube-subtitle-menu]")) {
    syncSelectedState(document, selectedMode);
    return false;
  }

  const firstItem = container.querySelector(MENU_ITEM_SELECTOR);
  const dual = createMenuItem(document, "dual", selectedMode, onSelect);
  const translation = createMenuItem(document, "translation", selectedMode, onSelect);
  if (firstItem?.parentElement === container) {
    container.insertBefore(translation, firstItem.nextSibling);
    container.insertBefore(dual, translation);
  } else {
    container.append(dual, translation);
  }
  syncSelectedState(document, selectedMode);
  return true;
}

export function removeYouTubeSubtitleMenu(document: Document): void {
  document.querySelectorAll("[data-brx-youtube-subtitle-menu]").forEach((node) => node.remove());
  document.querySelectorAll<HTMLElement>(MENU_CONTAINER_SELECTOR).forEach((container) => {
    container.classList.remove("brx-youtube-subtitle-menu-active");
  });
}
