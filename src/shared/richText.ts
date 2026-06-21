export interface RichTextPlaceholder {
  token: string;
  closeToken?: string;
  tagName: string;
  text: string;
  attributes: Record<string, string>;
}

export interface RichTextPayload {
  source: string;
  placeholders: RichTextPlaceholder[];
}

const ALLOWED_INLINE_TAGS = new Set([
  "a",
  "em",
  "strong",
  "b",
  "i",
  "code",
  "kbd",
  "samp",
  "mark",
  "sup",
  "sub",
  "ruby",
  "rt",
  "span",
]);
const TRANSLATABLE_INLINE_TAGS = new Set(["a", "em", "strong", "b", "i", "mark", "ruby", "rt", "span"]);

function normalizeInlineText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function safeAttributes(element: Element): Record<string, string> {
  const tag = element.tagName.toLowerCase();
  const attributes: Record<string, string> = {};
  if (tag === "a") {
    const href = element.getAttribute("href");
    if (href && /^(https?:|mailto:|\/|#)/i.test(href)) attributes.href = href;
    const target = element.getAttribute("target");
    if (target) attributes.target = target;
    attributes.rel = element.getAttribute("rel") || "noopener noreferrer";
  }
  return attributes;
}

export function buildRichTextPayload(element: HTMLElement): RichTextPayload | undefined {
  const placeholders: RichTextPlaceholder[] = [];
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let source = "";
  let node = walker.nextNode();

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement;
      if (!parent || parent === element || !ALLOWED_INLINE_TAGS.has(parent.tagName.toLowerCase())) {
        source += node.textContent ?? "";
      }
      node = walker.nextNode();
      continue;
    }

    if (node instanceof HTMLElement && node !== element && ALLOWED_INLINE_TAGS.has(node.tagName.toLowerCase())) {
      const text = normalizeInlineText(node.textContent ?? "");
      if (text) {
        const token = `__BRX_INLINE_${placeholders.length}__`;
        const tagName = node.tagName.toLowerCase();
        const closeToken = TRANSLATABLE_INLINE_TAGS.has(tagName) ? `__BRX_INLINE_${placeholders.length}_END__` : undefined;
        placeholders.push({
          token,
          ...(closeToken ? { closeToken } : {}),
          tagName,
          text,
          attributes: safeAttributes(node),
        });
        source += closeToken ? `${token}${text}${closeToken}` : token;
      }
      node = walker.nextSibling();
      continue;
    }

    node = walker.nextNode();
  }

  const normalizedSource = source.replace(/\s+/g, " ").trim();
  if (!placeholders.length || !normalizedSource) return undefined;
  return { source: normalizedSource, placeholders };
}

function appendTextWithLineBreaks(document: Document, fragment: Node, text: string): void {
  const parts = text.split(/\n/);
  parts.forEach((part, index) => {
    if (index > 0) fragment.appendChild(document.createElement("br"));
    if (part) fragment.appendChild(document.createTextNode(part));
  });
}

function createPlaceholderElement(document: Document, placeholder: RichTextPlaceholder): HTMLElement {
  const element = document.createElement(placeholder.tagName);
  element.textContent = placeholder.text;
  for (const [name, value] of Object.entries(placeholder.attributes)) {
    element.setAttribute(name, value);
  }
  return element;
}

function createWrappedPlaceholderElement(
  document: Document,
  placeholder: RichTextPlaceholder,
  translatedText: string,
): HTMLElement {
  const element = createPlaceholderElement(document, placeholder);
  element.textContent = "";
  appendTextWithLineBreaks(document, element, translatedText || placeholder.text);
  return element;
}

export function restoreRichTextFragment(document: Document, text: string, payload: RichTextPayload): DocumentFragment | undefined {
  const fragment = document.createDocumentFragment();
  const placeholders = [...payload.placeholders];
  let rest = text;

  while (rest) {
    const next = placeholders
      .map((placeholder) => ({ placeholder, index: rest.indexOf(placeholder.token) }))
      .filter((item) => item.index >= 0)
      .sort((left, right) => left.index - right.index)[0];

    if (!next) {
      appendTextWithLineBreaks(document, fragment, rest);
      break;
    }

    if (next.index > 0) appendTextWithLineBreaks(document, fragment, rest.slice(0, next.index));
    const afterOpen = rest.slice(next.index + next.placeholder.token.length);
    if (next.placeholder.closeToken) {
      const closeIndex = afterOpen.indexOf(next.placeholder.closeToken);
      if (closeIndex < 0) return undefined;
      const innerText = afterOpen.slice(0, closeIndex);
      fragment.append(createWrappedPlaceholderElement(document, next.placeholder, innerText));
      rest = afterOpen.slice(closeIndex + next.placeholder.closeToken.length);
    } else {
      fragment.append(createPlaceholderElement(document, next.placeholder));
      rest = afterOpen;
    }
    placeholders.splice(placeholders.indexOf(next.placeholder), 1);
  }

  if (placeholders.length) return undefined;
  return fragment;
}
