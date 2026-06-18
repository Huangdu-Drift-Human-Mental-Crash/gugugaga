import type { TranslateBatchRequest, TranslateBatchResult } from "../../shared/types";

export type ProviderTranslator = (request: TranslateBatchRequest) => Promise<TranslateBatchResult>;

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

export function failedProviderResult(request: TranslateBatchRequest, error: unknown): TranslateBatchResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    providerId: request.providerId,
    elapsedMs: 0,
    rawResponseSummary: message,
    items: request.blocks.map((block) => ({
      id: block.id,
      text: "",
      error: message,
      cached: false,
    })),
  };
}
