import type { TranslateBatchRequest, TranslateBatchResult } from "../../shared/types";
import { ProviderError } from "./types";

export async function translateChromeTranslator(request: TranslateBatchRequest): Promise<TranslateBatchResult> {
  throw new ProviderError(
    "Chrome Translator is an experimental browser API. This V1 build exposes the provider switch but does not rely on it for translation.",
  );
}
