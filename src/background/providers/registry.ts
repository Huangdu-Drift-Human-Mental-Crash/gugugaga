import type { TranslationProviderDescriptor } from "../../shared/types";
import { providerDescriptors, visibleProviderDescriptors } from "../../shared/defaults";
import { translateChromeTranslator } from "./chromeTranslator";
import { translateDeepLApi, translateGoogleCloudApi, translateMicrosoftApi } from "./official";
import { translateOpenAICompatible } from "./openaiCompatible";
import { translateBingWeb, translateDeepLWebExperimental, translateGoogleWeb } from "./webAdapters";
import type { ProviderTranslator } from "./types";
import { ProviderError } from "./types";

const translators: Record<string, ProviderTranslator> = {
  "openai-compatible": translateOpenAICompatible,
  "deepl-api": translateDeepLApi,
  "microsoft-translator": translateMicrosoftApi,
  "google-cloud-translate": translateGoogleCloudApi,
  "google-web": translateGoogleWeb,
  "bing-web": translateBingWeb,
  "deepl-web-experimental": translateDeepLWebExperimental,
  "chrome-translator": translateChromeTranslator,
};

export function listProviderDescriptors(): TranslationProviderDescriptor[] {
  return visibleProviderDescriptors;
}

export function getProviderDescriptor(id: string): TranslationProviderDescriptor | undefined {
  return providerDescriptors.find((descriptor) => descriptor.id === id);
}

export function getProviderTranslator(id: string): ProviderTranslator {
  const translator = translators[id];
  if (!translator) throw new ProviderError(`Unknown provider: ${id}`);
  return translator;
}
