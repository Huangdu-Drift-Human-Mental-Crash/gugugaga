import type { ConsistencyPlan, ConsistencyPlanRequest } from "../shared/types";
import { getProviderDescriptor } from "./providers/registry";
import { ProviderError } from "./providers/types";
import { buildConsistencyPlanOpenAICompatible } from "./providers/openaiCompatible";
import { buildConsistencyPlanAnthropicNative, buildConsistencyPlanGeminiNative } from "./providers/llmNative";

const CONSISTENCY_PLAN_TIMEOUT_MS = 15000;

function withPlanTimeoutConfig(request: ConsistencyPlanRequest): ConsistencyPlanRequest {
  const timeoutMs = request.providerConfig.timeoutMs || CONSISTENCY_PLAN_TIMEOUT_MS;
  return {
    ...request,
    providerConfig: {
      ...request.providerConfig,
      timeoutMs: Math.min(timeoutMs, CONSISTENCY_PLAN_TIMEOUT_MS),
    },
  };
}

export function canBuildConsistencyPlan(providerId: string): boolean {
  const descriptor = getProviderDescriptor(providerId);
  return Boolean(
    descriptor?.kind === "ai" &&
      (providerId === "openai-compatible" || providerId === "gemini-native" || providerId === "anthropic-native"),
  );
}

export async function buildConsistencyPlan(request: ConsistencyPlanRequest): Promise<ConsistencyPlan> {
  const descriptor = getProviderDescriptor(request.providerId);
  if (!descriptor) throw new ProviderError(`Unknown provider: ${request.providerId}`);
  if (!request.providerConfig.enabled) {
    throw new ProviderError(
      `${descriptor.label} is disabled. Enable it in Options before building Smart Context.`,
    );
  }
  if (!canBuildConsistencyPlan(request.providerId)) {
    throw new ProviderError(`${descriptor.label} does not support Smart Context consistency plans.`);
  }

  const planRequest = withPlanTimeoutConfig(request);
  if (request.providerId === "openai-compatible") return buildConsistencyPlanOpenAICompatible(planRequest);
  if (request.providerId === "gemini-native") return buildConsistencyPlanGeminiNative(planRequest);
  return buildConsistencyPlanAnthropicNative(planRequest);
}
