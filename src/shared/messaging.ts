import type { RuntimeMessage } from "./types";

interface RuntimeFailure {
  ok: false;
  error?: string;
}

function isRuntimeFailure(value: unknown): value is RuntimeFailure {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    (value as { ok?: unknown }).ok === false
  );
}

export async function sendRuntimeMessage<T>(message: RuntimeMessage): Promise<T> {
  const response = await chrome.runtime.sendMessage(message);
  if (isRuntimeFailure(response)) throw new Error(response.error || "Runtime request failed.");
  return response as T;
}

export async function sendTabMessage<T>(tabId: number, message: RuntimeMessage): Promise<T> {
  const response = await chrome.tabs.sendMessage(tabId, message);
  if (isRuntimeFailure(response)) throw new Error(response.error || "Tab request failed.");
  return response as T;
}
