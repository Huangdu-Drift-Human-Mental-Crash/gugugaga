import { buildContextPack } from "../../shared/context";
import { sendRuntimeMessage as defaultSendRuntimeMessage } from "../../shared/messaging";
import type {
  DisplayMode,
  ExtensionSettings,
  RuntimeMessage,
  SubtitleRuntimeStatus,
  TranslateBatchRequest,
  TranslateBatchResult,
} from "../../shared/types";
import { injectYouTubeSubtitleMenu, removeYouTubeSubtitleMenu } from "./menu";
import { cueTextHashes, parseYouTubeTimedText } from "./parser";
import { renderSubtitleOverlay, restoreSubtitleOverlay } from "./render";
import type { SubtitleTimedTextInput, SubtitleTrack } from "./types";

const YOUTUBE_SUBTITLE_EVENT = "BRX_YOUTUBE_SUBTITLE_RESPONSE";
const TRANSLATE_BATCH_SIZE = 24;
const MAX_TRANSLATED_CUES_PER_TRACK = 300;
const OVERLAY_TICK_MS = 250;
const URL_CHECK_MS = 1000;
const MENU_OBSERVER_DEBOUNCE_MS = 180;

export type RuntimeSender = <T>(message: RuntimeMessage) => Promise<T>;

interface SubtitleEngineOptions {
  sendRuntimeMessage?: RuntimeSender;
}

function isYouTubeSubtitlePage(location: Location): boolean {
  const host = location.hostname;
  if (host !== "www.youtube.com" && host !== "youtube.com" && host !== "m.youtube.com") return false;
  return location.pathname === "/watch" || location.pathname.startsWith("/embed/") || location.pathname.startsWith("/shorts/");
}

function currentVideoId(location: Location): string {
  if (location.pathname.startsWith("/embed/")) return location.pathname.split("/")[2] || "";
  if (location.pathname.startsWith("/shorts/")) return location.pathname.split("/")[2] || "";
  return new URL(location.href).searchParams.get("v") || "";
}

function currentVideoElement(document: Document): HTMLVideoElement | null {
  const video = document.querySelector("video");
  return video instanceof HTMLVideoElement ? video : null;
}

function youtubePlayer(document: Document): HTMLElement | null {
  const player = document.querySelector(".html5-video-player,#movie_player");
  return player instanceof HTMLElement ? player : null;
}

function subtitleButton(document: Document): HTMLElement | null {
  const button = document.querySelector(".ytp-subtitles-button");
  return button instanceof HTMLElement ? button : null;
}

function isOurSubtitleMessage(data: unknown): data is SubtitleTimedTextInput & { source: string; type: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { source?: unknown }).source === "bilingual-reader" &&
    (data as { type?: unknown }).type === YOUTUBE_SUBTITLE_EVENT &&
    typeof (data as { url?: unknown }).url === "string" &&
    typeof (data as { responseText?: unknown }).responseText === "string"
  );
}

export class SubtitleEngine {
  private status: SubtitleRuntimeStatus = {
    status: "idle",
    translatedCues: 0,
    queuedCues: 0,
    error: "",
    providerId: "",
    videoId: "",
  };

  private initialized = false;
  private enabledMode: DisplayMode | undefined;
  private latestTrack: SubtitleTrack | undefined;
  private translating = false;
  private menuObserver: MutationObserver | undefined;
  private menuObserverTimer: number | undefined;
  private overlayTimer: number | undefined;
  private urlTimer: number | undefined;
  private lastUrl = "";
  private readonly sendRuntimeMessage: RuntimeSender;

  constructor(private readonly document: Document, options: SubtitleEngineOptions = {}) {
    this.sendRuntimeMessage = options.sendRuntimeMessage ?? defaultSendRuntimeMessage;
  }

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    if (!isYouTubeSubtitlePage(this.document.location)) return;
    this.lastUrl = this.document.location.href;
    this.status.videoId = currentVideoId(this.document.location);
    this.injectPageHook();
    this.installMessageListener();
    this.installMenuObserver();
    this.installClickListener();
    this.installUrlWatcher();
    this.injectMenu();
  }

  snapshot(): SubtitleRuntimeStatus {
    return { ...this.status };
  }

  async enable(displayMode: DisplayMode): Promise<SubtitleRuntimeStatus> {
    if (!isYouTubeSubtitlePage(this.document.location)) {
      this.status = { ...this.status, status: "disabled", error: "This page is not a YouTube video." };
      return this.snapshot();
    }
    this.enabledMode = displayMode;
    this.status = {
      ...this.status,
      status: this.latestTrack ? "translating" : "loading",
      error: "",
      videoId: currentVideoId(this.document.location),
    };
    this.ensureNativeSubtitlesEnabled();
    if (this.latestTrack) void this.translateLatestTrack();
    return this.snapshot();
  }

  disable(): SubtitleRuntimeStatus {
    this.enabledMode = undefined;
    this.translating = false;
    this.stopOverlayLoop();
    restoreSubtitleOverlay(this.document);
    this.status = {
      ...this.status,
      status: "disabled",
      queuedCues: 0,
      error: "",
      videoId: currentVideoId(this.document.location),
    };
    this.injectMenu();
    return this.snapshot();
  }

  restore(): void {
    this.disable();
    this.latestTrack = undefined;
    removeYouTubeSubtitleMenu(this.document);
  }

  currentTextHashes(): string[] {
    return cueTextHashes(this.latestTrack);
  }

  async handleTimedText(input: SubtitleTimedTextInput): Promise<void> {
    const settings = await this.sendRuntimeMessage<ExtensionSettings>({ type: "BR_GET_SETTINGS" });
    const track = parseYouTubeTimedText(
      {
        ...input,
        videoId: input.videoId || currentVideoId(this.document.location),
      },
      settings.targetLang,
    );
    if (!track) return;
    this.latestTrack = track;
    this.status = {
      ...this.status,
      videoId: track.videoId,
      providerId: settings.providerId,
    };
    if (this.enabledMode) await this.translateLatestTrack(settings);
  }

  private injectPageHook(): void {
    if (this.document.getElementById("brx-youtube-subtitle-hook")) return;
    const script = this.document.createElement("script");
    script.id = "brx-youtube-subtitle-hook";
    script.src = chrome.runtime.getURL("youtube-subtitle-hook.js");
    script.async = false;
    script.onload = () => script.remove();
    (this.document.head || this.document.documentElement).append(script);
  }

  private installMessageListener(): void {
    this.document.defaultView?.addEventListener("message", (event) => {
      if (event.source !== this.document.defaultView) return;
      if (!isOurSubtitleMessage(event.data)) return;
      void this.handleTimedText({
        url: event.data.url,
        responseText: event.data.responseText,
      });
    });
  }

  private installMenuObserver(): void {
    if (!this.document.body) {
      this.document.addEventListener("DOMContentLoaded", () => this.installMenuObserver(), { once: true });
      return;
    }
    this.menuObserver?.disconnect();
    this.menuObserver = new MutationObserver((mutations) => {
      const hasMenuMutation = mutations.some((mutation) =>
        Array.from(mutation.addedNodes).some(
          (node) =>
            node instanceof HTMLElement &&
            (node.matches(".ytp-panel,.ytp-popup,.ytp-settings-menu,.ytp-panel-menu") ||
              Boolean(node.querySelector(".ytp-panel,.ytp-popup,.ytp-settings-menu,.ytp-panel-menu"))),
        ),
      );
      if (!hasMenuMutation) return;
      const view = this.document.defaultView;
      if (!view) return;
      view.clearTimeout(this.menuObserverTimer);
      this.menuObserverTimer = view.setTimeout(() => this.injectMenu(), MENU_OBSERVER_DEBOUNCE_MS);
    });
    this.menuObserver.observe(this.document.body, { childList: true, subtree: true });
  }

  private installClickListener(): void {
    this.document.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.closest("[data-brx-youtube-subtitle-menu]")) return;
        const menuItem = target.closest(".ytp-menuitem,[role='menuitem']");
        if (!(menuItem instanceof HTMLElement)) return;
        if (/^\s*off\s*$/i.test(menuItem.innerText)) this.disable();
      },
      true,
    );
  }

  private installUrlWatcher(): void {
    const view = this.document.defaultView;
    if (!view) return;
    this.urlTimer = view.setInterval(() => {
      if (this.document.location.href === this.lastUrl) return;
      this.lastUrl = this.document.location.href;
      this.latestTrack = undefined;
      restoreSubtitleOverlay(this.document);
      this.status = {
        ...this.status,
        status: this.enabledMode ? "loading" : "idle",
        translatedCues: 0,
        queuedCues: 0,
        error: "",
        videoId: currentVideoId(this.document.location),
      };
      if (this.enabledMode) this.ensureNativeSubtitlesEnabled();
    }, URL_CHECK_MS);
  }

  private injectMenu(): void {
    injectYouTubeSubtitleMenu(
      this.document,
      (mode) => {
        void this.enable(mode);
      },
      this.enabledMode,
    );
  }

  private ensureNativeSubtitlesEnabled(): void {
    const button = subtitleButton(this.document);
    if (button && button.getAttribute("aria-pressed") !== "true") {
      button.click();
      return;
    }
    const player = youtubePlayer(this.document) as (HTMLElement & { toggleSubtitles?: () => void }) | null;
    if (player?.toggleSubtitles && button?.getAttribute("aria-pressed") !== "true") player.toggleSubtitles();
  }

  private async translateLatestTrack(settings?: ExtensionSettings): Promise<void> {
    if (!this.latestTrack || !this.enabledMode || this.translating) return;
    this.translating = true;
    const activeSettings = settings ?? (await this.sendRuntimeMessage<ExtensionSettings>({ type: "BR_GET_SETTINGS" }));
    const providerConfig = activeSettings.providerConfigs[activeSettings.providerId];
    const expertProfile =
      activeSettings.expertProfiles.find((expert) => expert.id === activeSettings.selectedExpertId) ??
      activeSettings.expertProfiles[0];
    if (!providerConfig || !expertProfile) {
      this.status = { ...this.status, status: "error", error: "Provider or expert profile is not configured." };
      this.translating = false;
      return;
    }

    const track = this.latestTrack;
    const untranslated = track.cues
      .filter((cue) => !cue.translation && !cue.error)
      .slice(0, MAX_TRANSLATED_CUES_PER_TRACK);
    this.status = {
      status: "translating",
      translatedCues: track.cues.filter((cue) => cue.translation).length,
      queuedCues: untranslated.length,
      error: "",
      providerId: activeSettings.providerId,
      videoId: track.videoId,
    };
    untranslated.forEach((cue) => {
      cue.state = "queued";
    });
    this.startOverlayLoop();

    const blocks = track.cues.map((cue) => ({
      id: cue.id,
      hash: cue.hash,
      text: cue.text,
      kind: "paragraph" as const,
      visibility: "visible" as const,
      layout: "block" as const,
      classification: "block" as const,
    }));
    const contextPack = buildContextPack({
      title: this.document.title,
      site: "youtube.com",
      headings: [this.document.title].filter(Boolean),
      blocks,
      maxChars: activeSettings.context.maxChars,
      maskSensitive: activeSettings.context.maskSensitiveText,
    });

    try {
      for (let index = 0; index < untranslated.length && this.enabledMode; index += TRANSLATE_BATCH_SIZE) {
        const batch = untranslated.slice(index, index + TRANSLATE_BATCH_SIZE);
        batch.forEach((cue) => {
          cue.state = "pending";
        });
        const request: TranslateBatchRequest = {
          sourceLang: track.sourceLang || activeSettings.sourceLang,
          targetLang: activeSettings.targetLang,
          blocks: blocks.filter((block) => batch.some((cue) => cue.id === block.id)),
          contextPack,
          contextPreflight: false,
          expertProfile,
          providerConfig,
          providerId: activeSettings.providerId,
          displayMode: this.enabledMode,
        };
        const result = await this.sendRuntimeMessage<TranslateBatchResult>({ type: "BR_TRANSLATE_BATCH", request });
        this.applyTranslationResult(track, result);
        this.status.translatedCues = track.cues.filter((cue) => cue.translation).length;
        this.status.queuedCues = Math.max(0, this.status.queuedCues - batch.length);
      }
      this.status.status = this.enabledMode ? "active" : "disabled";
    } catch (error) {
      this.status = {
        ...this.status,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.translating = false;
      if (this.enabledMode) this.startOverlayLoop();
    }
  }

  private applyTranslationResult(track: SubtitleTrack, result: TranslateBatchResult): void {
    const byId = new Map(track.cues.map((cue) => [cue.id, cue]));
    for (const item of result.items) {
      const cue = byId.get(item.id);
      if (!cue) continue;
      if (item.error || !item.text) {
        cue.state = "error";
        cue.error = item.error || "Subtitle translation omitted this cue.";
        this.status.error ||= cue.error;
        continue;
      }
      cue.translation = item.text;
      cue.error = "";
      cue.state = "translated";
    }
  }

  private startOverlayLoop(): void {
    if (!this.latestTrack || !this.enabledMode) return;
    const view = this.document.defaultView;
    if (!view) return;
    if (this.overlayTimer) return;
    const tick = () => {
      if (!this.latestTrack || !this.enabledMode) return;
      const video = currentVideoElement(this.document);
      const currentTimeMs = Math.round((video?.currentTime ?? 0) * 1000);
      renderSubtitleOverlay({
        document: this.document,
        track: this.latestTrack,
        currentTimeMs,
        displayMode: this.enabledMode,
      });
    };
    tick();
    this.overlayTimer = view.setInterval(tick, OVERLAY_TICK_MS);
  }

  private stopOverlayLoop(): void {
    const view = this.document.defaultView;
    if (view && this.overlayTimer) view.clearInterval(this.overlayTimer);
    this.overlayTimer = undefined;
  }
}
