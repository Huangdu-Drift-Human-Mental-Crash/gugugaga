import type {
  ExpertProfile,
  ExtensionSettings,
  ProviderConfig,
  TranslationProviderDescriptor,
} from "./types";

const baseProviderConfig = (id: string): ProviderConfig => ({
  id,
  enabled: id === "openai-compatible" || id === "google-web",
  apiKey: "",
  baseUrl: "",
  model: "",
  region: "",
  experimentalEnabled: false,
  timeoutMs: 30000,
});

export const providerDescriptors: TranslationProviderDescriptor[] = [
  {
    id: "openai-compatible",
    label: "OpenAI-compatible",
    kind: "ai",
    description: "OpenAI, DeepSeek, OpenRouter, SiliconFlow, Ollama, LM Studio, or any compatible chat completions endpoint.",
    capabilities: {
      batch: true,
      richText: true,
      aiPrompt: true,
      contextPreflight: true,
      requiresApiKey: false,
      experimental: false,
    },
    defaultConfig: {
      ...baseProviderConfig("openai-compatible"),
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    },
  },
  {
    id: "gemini-native",
    label: "Gemini Native",
    kind: "ai",
    description: "Google Gemini API through the native generateContent endpoint. Supports JSON mode and future explicit context caching.",
    capabilities: {
      batch: true,
      richText: true,
      aiPrompt: true,
      contextPreflight: true,
      requiresApiKey: true,
      experimental: false,
    },
    defaultConfig: {
      ...baseProviderConfig("gemini-native"),
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-3.5-flash",
    },
  },
  {
    id: "anthropic-native",
    label: "Anthropic Native",
    kind: "ai",
    description: "Anthropic Claude Messages API. Supports future prompt caching and native Claude features.",
    capabilities: {
      batch: true,
      richText: true,
      aiPrompt: true,
      contextPreflight: true,
      requiresApiKey: true,
      experimental: false,
    },
    defaultConfig: {
      ...baseProviderConfig("anthropic-native"),
      baseUrl: "https://api.anthropic.com/v1",
      model: "claude-sonnet-4-5",
    },
  },
  {
    id: "deepl-api",
    label: "DeepL API",
    kind: "official",
    description: "Official DeepL API. Requires a user API key.",
    capabilities: {
      batch: true,
      richText: false,
      aiPrompt: false,
      contextPreflight: false,
      requiresApiKey: true,
      experimental: false,
    },
    defaultConfig: {
      ...baseProviderConfig("deepl-api"),
      baseUrl: "https://api-free.deepl.com/v2",
    },
  },
  {
    id: "microsoft-translator",
    label: "Microsoft Translator",
    kind: "official",
    description: "Official Microsoft Translator Text API. Requires key and optional region.",
    capabilities: {
      batch: true,
      richText: false,
      aiPrompt: false,
      contextPreflight: false,
      requiresApiKey: true,
      experimental: false,
    },
    defaultConfig: {
      ...baseProviderConfig("microsoft-translator"),
      baseUrl: "https://api.cognitive.microsofttranslator.com",
    },
  },
  {
    id: "google-cloud-translate",
    label: "Google Cloud Translate",
    kind: "official",
    description: "Official Google Cloud Translation API v2. Requires an API key.",
    capabilities: {
      batch: true,
      richText: false,
      aiPrompt: false,
      contextPreflight: false,
      requiresApiKey: true,
      experimental: false,
    },
    defaultConfig: {
      ...baseProviderConfig("google-cloud-translate"),
      baseUrl: "https://translation.googleapis.com/language/translate/v2",
    },
  },
  {
    id: "google-web",
    label: "Google Web",
    kind: "web",
    description: "Experimental unauthenticated Google web endpoint adapter.",
    capabilities: {
      batch: false,
      richText: false,
      aiPrompt: false,
      contextPreflight: false,
      requiresApiKey: false,
      experimental: true,
    },
    defaultConfig: {
      ...baseProviderConfig("google-web"),
      baseUrl: "https://translate.googleapis.com",
      experimentalEnabled: true,
    },
  },
  {
    id: "bing-web",
    label: "Bing Web",
    kind: "web",
    description: "Experimental Microsoft Edge/Bing web translator adapter.",
    capabilities: {
      batch: true,
      richText: false,
      aiPrompt: false,
      contextPreflight: false,
      requiresApiKey: false,
      experimental: true,
    },
    defaultConfig: {
      ...baseProviderConfig("bing-web"),
      baseUrl: "https://api-edge.cognitive.microsofttranslator.com",
      experimentalEnabled: false,
    },
  },
  {
    id: "deepl-web-experimental",
    label: "DeepL Web Experimental",
    kind: "web",
    description: "Experimental DeepL web adapter. Disabled by default because the endpoint changes frequently.",
    capabilities: {
      batch: true,
      richText: false,
      aiPrompt: false,
      contextPreflight: false,
      requiresApiKey: false,
      experimental: true,
    },
    defaultConfig: {
      ...baseProviderConfig("deepl-web-experimental"),
      baseUrl: "https://www2.deepl.com",
      experimentalEnabled: false,
    },
  },
  {
    id: "chrome-translator",
    label: "Chrome Translator",
    kind: "browser",
    description: "Experimental Chrome built-in Translator API when available.",
    capabilities: {
      batch: false,
      richText: false,
      aiPrompt: false,
      contextPreflight: false,
      requiresApiKey: false,
      experimental: true,
    },
    defaultConfig: {
      ...baseProviderConfig("chrome-translator"),
      experimentalEnabled: false,
    },
  },
];

export const visibleProviderDescriptors: TranslationProviderDescriptor[] = providerDescriptors.filter(
  (descriptor) => descriptor.id !== "chrome-translator",
);

export const defaultExperts: ExpertProfile[] = [
  {
    id: "general",
    name: "General",
    systemPrompt: "Translate faithfully while preserving meaning, tone, and paragraph boundaries.",
    stylePrompt: "Use natural, fluent target-language prose. Do not add explanations.",
    glossary: "",
    contextBudget: 6000,
  },
  {
    id: "technical",
    name: "Technical Docs",
    systemPrompt: "Translate technical documentation accurately. Preserve API names, commands, code identifiers, and version numbers.",
    stylePrompt: "Use concise terminology and keep procedural instructions clear.",
    glossary: "",
    contextBudget: 8000,
  },
  {
    id: "academic",
    name: "Academic",
    systemPrompt: "Translate academic writing with careful terminology and formal tone.",
    stylePrompt: "Keep claims precise and avoid simplifying specialized terms unless necessary.",
    glossary: "",
    contextBudget: 8000,
  },
  {
    id: "fiction",
    name: "Fiction",
    systemPrompt: "Translate narrative prose with attention to voice, mood, and character dialogue.",
    stylePrompt: "Favor readability and literary flow while preserving plot facts.",
    glossary: "",
    contextBudget: 9000,
  },
  {
    id: "forum",
    name: "Forum",
    systemPrompt: "Translate informal online discussion while preserving slang, references, and speaker intent.",
    stylePrompt: "Keep the style conversational and avoid over-polishing.",
    glossary: "",
    contextBudget: 5000,
  },
];

export const defaultSettings: ExtensionSettings = {
  sourceLang: "auto",
  targetLang: "zh-CN",
  providerId: "openai-compatible",
  displayMode: "dual",
  context: {
    enabled: true,
    preflight: false,
    maxChars: 12000,
    maskSensitiveText: true,
  },
  providerConfigs: Object.fromEntries(
    providerDescriptors.map((descriptor) => [descriptor.id, descriptor.defaultConfig]),
  ),
  expertProfiles: defaultExperts,
  selectedExpertId: "general",
  siteRules: [],
};

export function mergeSettings(input: Partial<ExtensionSettings> | undefined): ExtensionSettings {
  if (!input) return structuredClone(defaultSettings);
  const defaultProviderConfigs = defaultSettings.providerConfigs;
  return {
    ...defaultSettings,
    ...input,
    context: {
      ...defaultSettings.context,
      ...(input.context ?? {}),
    },
    providerConfigs: {
      ...defaultProviderConfigs,
      ...(input.providerConfigs ?? {}),
    },
    expertProfiles: input.expertProfiles?.length ? input.expertProfiles : defaultSettings.expertProfiles,
    siteRules: (input.siteRules ?? defaultSettings.siteRules).map((rule) => {
      const normalized = {
        ...rule,
        excludeSelectors: rule.excludeSelectors ?? [],
        includeSelectors: rule.includeSelectors ?? [],
        atomicSelectors: rule.atomicSelectors ?? [],
        stayOriginalSelectors: rule.stayOriginalSelectors ?? [],
        extraBlockSelectors: rule.extraBlockSelectors ?? [],
        extraInlineSelectors: rule.extraInlineSelectors ?? [],
        navigationSelectors: rule.navigationSelectors ?? [],
        translateNavigation: rule.translateNavigation ?? true,
      };
      return typeof rule.minTextLength === "number" ? { ...normalized, minTextLength: rule.minTextLength } : normalized;
    }),
  };
}
