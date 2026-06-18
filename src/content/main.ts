import { providerDescriptors } from "../shared/defaults";
import { buildContextPack } from "../shared/context";
import { sendRuntimeMessage } from "../shared/messaging";
import type {
  ExtensionSettings,
  PageRuntimeStatus,
  RuntimeMessage,
  SiteRule,
  TranslateBatchRequest,
  TranslateBatchResult,
  ClearPageDataResult,
} from "../shared/types";
import { PageEngine } from "./pageEngine";
import { showStatus } from "./render";
import { SubtitleEngine } from "./subtitles/engine";
import type { ExtractOptions } from "./types";

const BATCH_SIZE = 12;

class PageTranslator {
  private status: PageRuntimeStatus = {
    status: "idle",
    translatedBlocks: 0,
    queuedBlocks: 0,
    error: "",
    providerId: "",
  };

  private stopped = false;
  private currentRun: Promise<void> | undefined;
  private initialized = false;
  private postTranslateTimers: number[] = [];
  private readonly engine: PageEngine;
  private readonly subtitleEngine: SubtitleEngine;

  constructor(private readonly document: Document) {
    this.engine = new PageEngine(document);
    this.subtitleEngine = new SubtitleEngine(document);
  }

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.engine.init();
    this.subtitleEngine.init();
    chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
      this.handleMessage(message)
        .then((response) => sendResponse(response))
        .catch((error) => {
          const messageText = error instanceof Error ? error.message : String(error);
          sendResponse({ ok: false, error: messageText });
        });
      return true;
    });
  }

  private async handleMessage(message: RuntimeMessage): Promise<unknown> {
    switch (message.type) {
      case "BR_PAGE_TRANSLATE":
        this.startTranslation();
        return this.status;
      case "BR_PAGE_STOP":
        this.stop();
        return this.status;
      case "BR_PAGE_RESTORE":
        this.restore();
        return this.status;
      case "BR_PAGE_CLEAR_DATA":
        return this.clearPageData();
      case "BR_PAGE_STATUS":
        return this.status;
      case "BR_SUBTITLE_STATUS":
        return this.subtitleEngine.snapshot();
      case "BR_SUBTITLE_ENABLE":
        return this.subtitleEngine.enable(message.displayMode);
      case "BR_SUBTITLE_DISABLE":
        return this.subtitleEngine.disable();
      default:
        return undefined;
    }
  }

  private startTranslation(onlyNew = false): PageRuntimeStatus {
    if (this.status.status === "translating") return this.status;
    if (!onlyNew) this.clearPostTranslateRescans();
    this.stopped = false;
    this.status = {
      status: "translating",
      translatedBlocks: onlyNew ? this.status.translatedBlocks : 0,
      queuedBlocks: 0,
      error: "",
      providerId: this.status.providerId,
    };
    this.currentRun = this.translatePage(onlyNew)
      .catch((error) => {
        this.status = {
          ...this.status,
          status: "error",
          queuedBlocks: 0,
          error: error instanceof Error ? error.message : String(error),
        };
        this.engine.clearPending();
        this.engine.setPageStatus("error");
        showStatus(this.document, `Translation failed: ${this.status.error}`);
      })
      .finally(() => {
        this.currentRun = undefined;
      });
    return this.status;
  }

  private async waitForBody(): Promise<void> {
    if (this.document.body) return;
    await new Promise<void>((resolve) => {
      const done = () => {
        if (this.document.body) {
          this.document.removeEventListener("DOMContentLoaded", done);
          resolve();
        }
      };
      this.document.addEventListener("DOMContentLoaded", done);
      done();
    });
  }

  async translatePage(onlyNew = false): Promise<void> {
    await this.waitForBody();
    if (this.stopped) return;
    this.engine.stopObserving();
    const settings = await sendRuntimeMessage<ExtensionSettings>({ type: "BR_GET_SETTINGS" });
    if (this.stopped) return;
    const providerConfig = settings.providerConfigs[settings.providerId];
    const expertProfile =
      settings.expertProfiles.find((expert) => expert.id === settings.selectedExpertId) ?? settings.expertProfiles[0];
    if (!providerConfig || !expertProfile) throw new Error("Provider or expert profile is not configured.");

    const blocks = this.engine.scanBlocks(
      this.currentExtractOptions(settings),
      { onlyNew, targetLang: settings.targetLang },
    );
    if (this.stopped) return;
    if (!blocks.length) {
      this.status = {
        status: onlyNew ? "translated" : "idle",
        translatedBlocks: onlyNew ? this.status.translatedBlocks : 0,
        queuedBlocks: 0,
        error: "",
        providerId: settings.providerId,
      };
      this.engine.setPageStatus(onlyNew ? "translated" : "original");
      if (onlyNew) this.observeMutations();
      else showStatus(this.document, "No translatable text found.");
      return;
    }

    this.status = {
      status: "translating",
      translatedBlocks: onlyNew ? this.status.translatedBlocks : 0,
      queuedBlocks: blocks.length,
      error: "",
      providerId: settings.providerId,
    };
    showStatus(this.document, `Translating ${blocks.length} blocks with ${settings.providerId}...`);
    this.engine.markQueued(blocks);
    this.engine.renderPending(blocks, settings.displayMode);

    const contextBlocks = settings.context.enabled ? blocks : [];
    const contextPack = buildContextPack({
      title: this.document.title,
      site: location.hostname,
      headings: this.engine.collectHeadings(),
      blocks: contextBlocks,
      maxChars: settings.context.maxChars,
      maskSensitive: settings.context.maskSensitiveText,
    });

    try {
      for (let index = 0; index < blocks.length && !this.stopped; index += BATCH_SIZE) {
        const batch = blocks.slice(index, index + BATCH_SIZE);
        const request: TranslateBatchRequest = {
          sourceLang: settings.sourceLang,
          targetLang: settings.targetLang,
          blocks: batch.map(({ element: _element, ...block }) => block),
          contextPack,
          contextPreflight: settings.context.enabled && settings.context.preflight,
          expertProfile,
          providerConfig,
          providerId: settings.providerId,
          displayMode: settings.displayMode,
        };
        const result = await sendRuntimeMessage<TranslateBatchResult>({ type: "BR_TRANSLATE_BATCH", request });
        if (this.stopped) break;
        const rendered = this.engine.renderResults(batch, result.items, settings.displayMode);
        this.status.translatedBlocks += rendered;
        this.status.queuedBlocks = Math.max(0, this.status.queuedBlocks - batch.length);
        const firstError = result.items.find((item) => item.error)?.error;
        if (firstError) this.status.error = firstError;
      }
    } catch (error) {
      this.status.error = error instanceof Error ? error.message : String(error);
    } finally {
      if (this.stopped || this.status.error) this.engine.clearPending();
    }

    if (this.stopped) {
      this.status = {
        ...this.status,
        status: "idle",
        queuedBlocks: 0,
      };
      this.engine.setPageStatus("original");
      return;
    }

    this.status.status = this.status.error ? "error" : "translated";
    this.engine.setPageStatus(this.status.error ? "error" : "translated");
    showStatus(
      this.document,
      this.status.error
        ? `Translated ${this.status.translatedBlocks} blocks with errors: ${this.status.error}`
        : `Translated ${this.status.translatedBlocks} blocks.`,
    );
    if (!this.stopped) {
      this.observeMutations();
      if (!onlyNew) this.schedulePostTranslateRescans();
    }
  }

  stop(): void {
    this.stopped = true;
    this.clearPostTranslateRescans();
    this.status = {
      ...this.status,
      status: "idle",
      queuedBlocks: 0,
      error: "",
    };
    this.engine.clearPending();
    this.engine.setPageStatus("original");
    showStatus(this.document, "Translation stopped.");
  }

  restore(): void {
    this.stopped = true;
    this.clearPostTranslateRescans();
    this.subtitleEngine.restore();
    this.engine.restore();
    this.status = {
      status: "idle",
      translatedBlocks: 0,
      queuedBlocks: 0,
      error: "",
      providerId: "",
    };
  }

  private async clearPageData(): Promise<ClearPageDataResult> {
    const settings = await sendRuntimeMessage<ExtensionSettings>({ type: "BR_GET_SETTINGS" });
    const textHashes = [
      ...this.engine.pageTextHashes(this.currentExtractOptions(settings)),
      ...this.subtitleEngine.currentTextHashes(),
    ];
    const response = await sendRuntimeMessage<{ removedCacheEntries: number }>({
      type: "BR_CLEAR_PAGE_CACHE",
      textHashes,
    });
    this.restore();
    showStatus(this.document, `Cleared ${response.removedCacheEntries} cached translations for this page.`);
    return {
      removedCacheEntries: response.removedCacheEntries,
      textHashes: new Set(textHashes).size,
    };
  }

  private observeMutations(): void {
    this.engine.observeMutations(() => {
      if (this.status.status === "translated") this.startTranslation(true);
    });
  }

  private schedulePostTranslateRescans(): void {
    const view = this.document.defaultView;
    if (!view) return;
    this.clearPostTranslateRescans();
    for (const delayMs of [700, 2200]) {
      const timerId = view.setTimeout(() => {
        this.postTranslateTimers = this.postTranslateTimers.filter((id) => id !== timerId);
        if (!this.stopped && this.status.status === "translated") this.startTranslation(true);
      }, delayMs);
      this.postTranslateTimers.push(timerId);
    }
  }

  private clearPostTranslateRescans(): void {
    const view = this.document.defaultView;
    if (!view) {
      this.postTranslateTimers = [];
      return;
    }
    for (const timerId of this.postTranslateTimers) view.clearTimeout(timerId);
    this.postTranslateTimers = [];
  }

  private currentRules(settings: ExtensionSettings): SiteRule[] {
    const url = location.href;
    return settings.siteRules
      .filter((rule) => rule.matches.some((pattern) => url.includes(pattern)))
      .map((rule) => ({
        ...rule,
        excludeSelectors: rule.excludeSelectors ?? [],
        includeSelectors: rule.includeSelectors ?? [],
        atomicSelectors: rule.atomicSelectors ?? [],
        stayOriginalSelectors: rule.stayOriginalSelectors ?? [],
        extraBlockSelectors: rule.extraBlockSelectors ?? [],
        extraInlineSelectors: rule.extraInlineSelectors ?? [],
        navigationSelectors: rule.navigationSelectors ?? [],
        translateNavigation: rule.translateNavigation ?? true,
      }));
  }

  private currentExtractOptions(settings: ExtensionSettings): Partial<ExtractOptions> {
    const rules = this.currentRules(settings);
    return {
      excludeSelectors: rules.flatMap((rule) => rule.excludeSelectors),
      includeSelectors: rules.flatMap((rule) => rule.includeSelectors),
      atomicSelectors: rules.flatMap((rule) => rule.atomicSelectors ?? []),
      stayOriginalSelectors: rules.flatMap((rule) => rule.stayOriginalSelectors ?? []),
      extraBlockSelectors: rules.flatMap((rule) => rule.extraBlockSelectors ?? []),
      extraInlineSelectors: rules.flatMap((rule) => rule.extraInlineSelectors ?? []),
      navigationSelectors: rules.flatMap((rule) => rule.navigationSelectors ?? []),
      translateNavigation: rules.every((rule) => rule.translateNavigation !== false),
      minTextLength: rules.find((rule) => typeof rule.minTextLength === "number")?.minTextLength ?? 2,
    };
  }
}

let singleton: PageTranslator | undefined;

export function bootstrapContentTranslator(): void {
  singleton ??= new PageTranslator(document);
  singleton.init();
}

export function providerSummaryForDebug(): string {
  return providerDescriptors.map((provider) => provider.id).join(",");
}
