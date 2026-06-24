import type { DisplayMode, TranslationItemResult } from "../shared/types";
import { collectHeadings, extractNavigationBlocks, extractPageBlocks } from "./extractor";
import { isDominantTargetLanguage, isProbablyAlreadyTargetLanguage } from "./language";
import {
  clearPendingTranslations,
  injectContentStyles,
  renderPendingTranslations,
  renderNavigationPendingTranslations,
  renderNavigationTranslations,
  renderTranslations,
  restoreTranslations,
} from "./render";
import type { ContentBlock, ExtractOptions } from "./types";

export type BlockEntityStatus = "discovered" | "queued" | "pending" | "translated" | "error" | "skipped";

export type PageEngineStatus = "original" | "translating" | "translated" | "error";

export interface PageBlockEntity {
  id: string;
  block: ContentBlock;
  element: HTMLElement;
  hash: string;
  status: BlockEntityStatus;
  lastError: string;
  createdAt: number;
  updatedAt: number;
}

export interface PageEngineSnapshot {
  pageStatus: PageEngineStatus;
  totalBlocks: number;
  pendingBlocks: number;
  translatedBlocks: number;
  errorBlocks: number;
}

const MUTATION_DEBOUNCE_MS = 1200;
const PAGE_ALREADY_TARGET_REASON = "page-already-target-language";

function now(): number {
  return Date.now();
}

function statusFromElement(element: HTMLElement): BlockEntityStatus | undefined {
  const state = element.dataset.brxState;
  if (
    state === "queued" ||
    state === "pending" ||
    state === "translated" ||
    state === "error" ||
    state === "skipped"
  ) {
    return state;
  }
  return undefined;
}

function statusFromBlock(block: ContentBlock): BlockEntityStatus {
  if (
    block.classification === "atomic" ||
    block.classification === "ignored" ||
    block.classification === "stay-original"
  ) {
    return "skipped";
  }
  return "discovered";
}

function isExtensionMutationNode(node: Node): boolean {
  if (!(node instanceof HTMLElement)) return false;
  return Boolean(node.closest(".brx-translation,.brx-status") || node.matches(".brx-translation,.brx-status"));
}

export class PageEngine {
  private entities = new Map<string, PageBlockEntity>();
  private pageStatus: PageEngineStatus = "original";
  private nextBlockIndex = 0;
  private mutationObserver: MutationObserver | undefined;
  private mutationTimer: number | undefined;
  private initialized = false;
  private lastScanSkipReason = "";

  constructor(private readonly document: Document) {}

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    injectContentStyles(this.document);
    this.syncRootState();
  }

  scanBlocks(
    options: Partial<ExtractOptions> = {},
    scanOptions: { onlyNew?: boolean; targetLang?: string } = {},
  ): ContentBlock[] {
    this.init();
    this.lastScanSkipReason = "";
    const blocks = [
      ...extractPageBlocks(this.document, options),
      ...extractNavigationBlocks(this.document, options),
    ].filter((block) => block.visibility === "visible");
    const selected: ContentBlock[] = [];

    if (!scanOptions.onlyNew && scanOptions.targetLang && isDominantTargetLanguage(blocks.map((block) => block.text), scanOptions.targetLang)) {
      this.lastScanSkipReason = PAGE_ALREADY_TARGET_REASON;
      for (const block of blocks) this.markSkipped(block, PAGE_ALREADY_TARGET_REASON);
      return [];
    }

    for (const block of blocks) {
      if (scanOptions.targetLang && isProbablyAlreadyTargetLanguage(block.text, scanOptions.targetLang)) {
        this.markSkipped(block, "already-target-language");
        continue;
      }
      const id = this.ensureBlockId(block);
      const normalizedBlock: ContentBlock = { ...block, id };
      const existing = this.entities.get(id);
      const existingStatus = statusFromElement(block.element) ?? existing?.status;
      const status = existingStatus ?? statusFromBlock(normalizedBlock);

      if (scanOptions.onlyNew && existing && existing.status !== "discovered") continue;
      if (scanOptions.onlyNew && (status === "pending" || status === "translated" || status === "queued")) {
        continue;
      }

      this.entities.set(id, {
        id,
        block: normalizedBlock,
        element: normalizedBlock.element,
        hash: normalizedBlock.hash,
        status,
        lastError: existing?.lastError ?? "",
        createdAt: existing?.createdAt ?? now(),
        updatedAt: now(),
      });
      selected.push(normalizedBlock);
    }

    return selected;
  }

  collectHeadings(): string[] {
    return collectHeadings(this.document);
  }

  getLastScanSkipReason(): string {
    return this.lastScanSkipReason;
  }

  markQueued(blocks: ContentBlock[]): void {
    this.setPageStatus("translating");
    for (const block of blocks) {
      const entity = this.entities.get(block.id);
      if (!entity) continue;
      entity.status = "queued";
      entity.updatedAt = now();
      block.element.dataset.brxState = "queued";
      block.element.dataset.brxBlockId = block.id;
    }
  }

  renderPending(blocks: ContentBlock[], displayMode: DisplayMode, pendingText?: string): number {
    this.setPageStatus("translating");
    const pendingTextInput = pendingText ? { pendingText } : {};
    const rendered = renderPendingTranslations({
      document: this.document,
      blocks,
      displayMode,
      ...pendingTextInput,
    }) + renderNavigationPendingTranslations({ document: this.document, blocks, ...pendingTextInput });
    for (const block of blocks) {
      const entity = this.entities.get(block.id);
      if (!entity) continue;
      entity.status = "pending";
      entity.updatedAt = now();
    }
    return rendered;
  }

  renderResults(blocks: ContentBlock[], results: TranslationItemResult[], displayMode: DisplayMode): number {
    const rendered = renderTranslations({
      document: this.document,
      blocks,
      results,
      displayMode,
    }) + renderNavigationTranslations({ document: this.document, blocks, results });

    for (const result of results) {
      const entity = this.entities.get(result.id);
      if (!entity) continue;
      entity.status = result.error || !result.text ? "error" : "translated";
      entity.lastError = result.error;
      entity.updatedAt = now();
      entity.element.dataset.brxBlockId = entity.id;
      entity.element.dataset.brxState = entity.status;
      if (result.error) entity.element.dataset.brxError = result.error;
      else delete entity.element.dataset.brxError;
    }

    return rendered;
  }

  clearPending(blocks?: ContentBlock[]): void {
    clearPendingTranslations(this.document, blocks);
    const ids = blocks?.map((block) => block.id);
    for (const entity of this.entities.values()) {
      if (ids && !ids.includes(entity.id)) continue;
      if (entity.status === "pending" || entity.status === "queued") {
        entity.status = "discovered";
        entity.updatedAt = now();
      }
    }
    this.syncRootState();
  }

  restore(): void {
    this.stopObserving();
    restoreTranslations(this.document);
    this.entities.clear();
    this.nextBlockIndex = 0;
    this.setPageStatus("original");
  }

  setPageStatus(status: PageEngineStatus): void {
    this.pageStatus = status;
    this.syncRootState();
  }

  snapshot(): PageEngineSnapshot {
    let pendingBlocks = 0;
    let translatedBlocks = 0;
    let errorBlocks = 0;
    for (const entity of this.entities.values()) {
      if (entity.status === "pending" || entity.status === "queued") pendingBlocks += 1;
      if (entity.status === "translated") translatedBlocks += 1;
      if (entity.status === "error") errorBlocks += 1;
    }
    return {
      pageStatus: this.pageStatus,
      totalBlocks: this.entities.size,
      pendingBlocks,
      translatedBlocks,
      errorBlocks,
    };
  }

  pageTextHashes(options: Partial<ExtractOptions> = {}): string[] {
    this.init();
    return [
      ...extractPageBlocks(this.document, options),
      ...extractNavigationBlocks(this.document, options),
    ]
      .filter((block) => block.visibility === "visible")
      .map((block) => block.hash);
  }

  observeMutations(onChange: () => void, debounceMs = MUTATION_DEBOUNCE_MS): void {
    this.stopObserving();
    if (!this.document.body) return;
    this.mutationObserver = new MutationObserver((mutations) => {
      const hasRelevantAddedNode = mutations.some((mutation) =>
        Array.from(mutation.addedNodes).some((node) => !isExtensionMutationNode(node)),
      );
      if (!hasRelevantAddedNode) return;
      const view = this.document.defaultView;
      if (!view) return;
      view.clearTimeout(this.mutationTimer);
      this.mutationTimer = view.setTimeout(onChange, debounceMs);
    });
    this.mutationObserver.observe(this.document.body, { childList: true, subtree: true });
  }

  stopObserving(): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = undefined;
    const view = this.document.defaultView;
    if (view && this.mutationTimer) view.clearTimeout(this.mutationTimer);
    this.mutationTimer = undefined;
  }

  private ensureBlockId(block: ContentBlock): string {
    const existing = block.element.dataset.brxBlockId;
    if (existing) return existing;
    const id = `brx-${block.hash}-${this.nextBlockIndex}`;
    this.nextBlockIndex += 1;
    block.element.dataset.brxBlockId = id;
    block.element.dataset.brxWalked = "1";
    return id;
  }

  private markSkipped(block: ContentBlock, reason: string): void {
    const id = this.ensureBlockId(block);
    const normalizedBlock: ContentBlock = { ...block, id };
    this.entities.set(id, {
      id,
      block: normalizedBlock,
      element: normalizedBlock.element,
      hash: normalizedBlock.hash,
      status: "skipped",
      lastError: reason,
      createdAt: now(),
      updatedAt: now(),
    });
    block.element.dataset.brxState = "skipped";
    block.element.dataset.brxSkipReason = reason;
  }

  private syncRootState(): void {
    const root = this.document.documentElement;
    root.dataset.brxEngine = "ready";
    root.dataset.brxPageState = this.pageStatus;
  }
}
