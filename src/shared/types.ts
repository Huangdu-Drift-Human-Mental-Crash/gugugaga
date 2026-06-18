export type ProviderKind = "ai" | "official" | "web" | "browser";

export type DisplayMode = "dual" | "translation";

export type TranslationStatus = "idle" | "translating" | "translated" | "error";

export type SubtitleEngineStatus = "idle" | "loading" | "translating" | "active" | "error" | "disabled";

export interface ProviderCapabilities {
  batch: boolean;
  richText: boolean;
  aiPrompt: boolean;
  contextPreflight: boolean;
  requiresApiKey: boolean;
  experimental: boolean;
}

export interface TranslationProviderDescriptor {
  id: string;
  label: string;
  kind: ProviderKind;
  description: string;
  capabilities: ProviderCapabilities;
  defaultConfig: ProviderConfig;
}

export interface ProviderConfig {
  id: string;
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  region: string;
  experimentalEnabled: boolean;
  timeoutMs: number;
}

export interface SiteRule {
  id: string;
  matches: string[];
  excludeSelectors: string[];
  includeSelectors: string[];
  atomicSelectors?: string[];
  stayOriginalSelectors?: string[];
  extraBlockSelectors?: string[];
  extraInlineSelectors?: string[];
  navigationSelectors?: string[];
  translateNavigation?: boolean;
  minTextLength?: number;
  autoTranslate: boolean;
}

export interface ExpertProfile {
  id: string;
  name: string;
  systemPrompt: string;
  stylePrompt: string;
  glossary: string;
  contextBudget: number;
}

export interface ContextSettings {
  enabled: boolean;
  preflight: boolean;
  maxChars: number;
  maskSensitiveText: boolean;
}

export interface ExtensionSettings {
  sourceLang: string;
  targetLang: string;
  providerId: string;
  displayMode: DisplayMode;
  context: ContextSettings;
  providerConfigs: Record<string, ProviderConfig>;
  expertProfiles: ExpertProfile[];
  selectedExpertId: string;
  siteRules: SiteRule[];
}

export interface PageTextBlock {
  id: string;
  hash: string;
  text: string;
  kind: "heading" | "paragraph" | "list" | "table" | "quote";
  visibility: "visible" | "hidden";
  layout?: "block" | "inline";
  classification?: "block" | "inline" | "atomic" | "ignored" | "stay-original" | "navigation";
  richText?: {
    source: string;
    placeholders: Array<{
      token: string;
      tagName: string;
      text: string;
      attributes: Record<string, string>;
    }>;
  };
}

export interface ContextPack {
  title: string;
  site: string;
  headings: string[];
  summary: string;
  terms: Record<string, string>;
  styleGuide: string;
  rawTextSnippet: string;
  masked: boolean;
}

export interface TranslateBatchRequest {
  sourceLang: string;
  targetLang: string;
  blocks: PageTextBlock[];
  contextPack: ContextPack;
  contextPreflight: boolean;
  expertProfile: ExpertProfile;
  providerConfig: ProviderConfig;
  providerId: string;
  displayMode: DisplayMode;
}

export interface TranslationItemResult {
  id: string;
  text: string;
  error: string;
  cached: boolean;
}

export interface TranslateBatchResult {
  providerId: string;
  elapsedMs: number;
  items: TranslationItemResult[];
  rawResponseSummary: string;
}

export interface PageRuntimeStatus {
  status: TranslationStatus;
  translatedBlocks: number;
  queuedBlocks: number;
  error: string;
  providerId: string;
}

export interface SubtitleRuntimeStatus {
  status: SubtitleEngineStatus;
  translatedCues: number;
  queuedCues: number;
  error: string;
  providerId: string;
  videoId: string;
}

export type RuntimeMessage =
  | { type: "BR_GET_SETTINGS" }
  | { type: "BR_SAVE_SETTINGS"; settings: ExtensionSettings }
  | { type: "BR_LIST_PROVIDERS" }
  | { type: "BR_GRANT_PROVIDER_PERMISSION"; providerConfig: ProviderConfig }
  | { type: "BR_TRANSLATE_BATCH"; request: TranslateBatchRequest }
  | { type: "BR_CLEAR_CACHE" }
  | { type: "BR_CLEAR_PAGE_CACHE"; textHashes: string[] }
  | { type: "BR_GET_CACHE_STATS" }
  | { type: "BR_PAGE_TRANSLATE" }
  | { type: "BR_PAGE_STOP" }
  | { type: "BR_PAGE_RESTORE" }
  | { type: "BR_PAGE_CLEAR_DATA" }
  | { type: "BR_PAGE_STATUS" }
  | { type: "BR_SUBTITLE_STATUS" }
  | { type: "BR_SUBTITLE_ENABLE"; displayMode: DisplayMode }
  | { type: "BR_SUBTITLE_DISABLE" }
  | { type: "BR_OFFSCREEN_PROBE_TRANSLATOR" };

export interface CacheStats {
  entries: number;
  approxBytes: number;
}

export interface ClearPageDataResult {
  removedCacheEntries: number;
  textHashes: number;
}
