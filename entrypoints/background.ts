import { clearTranslationCache, clearTranslationCacheForTextHashes, getCacheStats } from "../src/background/cache";
import { buildConsistencyPlan } from "../src/background/consistencyPlan";
import { grantProviderPermission } from "../src/background/permissions";
import { listProviderDescriptors } from "../src/background/providers/registry";
import { translateBatchWithCache } from "../src/background/translationService";
import { getSettings, saveSettings } from "../src/shared/storage";
import type { RuntimeMessage } from "../src/shared/types";

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function canInjectIntoTab(tab: chrome.tabs.Tab): boolean {
  if (!tab.id || !tab.url) return false;
  try {
    return /^(https?:|file:)$/.test(new URL(tab.url).protocol);
  } catch {
    return false;
  }
}

function isMissingContentReceiver(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Receiving end does not exist") || message.includes("Could not establish connection");
}

async function injectContentScript(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || !canInjectIntoTab(tab)) {
    throw new Error("This page cannot be translated by the extension.");
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content-scripts/content.js"],
  });
}

async function sendToTab(tab: chrome.tabs.Tab, message: RuntimeMessage): Promise<unknown> {
  if (!tab.id) throw new Error("No active tab.");
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    if (!isMissingContentReceiver(error)) throw error;
    await injectContentScript(tab);
    return chrome.tabs.sendMessage(tab.id, message);
  }
}

async function sendToActiveTab(message: RuntimeMessage): Promise<unknown> {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error("No active tab.");
  return sendToTab(tab, message);
}

async function handleMessage(message: RuntimeMessage): Promise<unknown> {
  switch (message.type) {
    case "BR_GET_SETTINGS":
      return getSettings();
    case "BR_SAVE_SETTINGS":
      await saveSettings(message.settings);
      return { ok: true };
    case "BR_LIST_PROVIDERS":
      return listProviderDescriptors();
    case "BR_GRANT_PROVIDER_PERMISSION":
      return { granted: await grantProviderPermission(message.providerConfig) };
    case "BR_BUILD_CONSISTENCY_PLAN":
      return buildConsistencyPlan(message.request);
    case "BR_TRANSLATE_BATCH":
      return translateBatchWithCache(message.request);
    case "BR_CLEAR_CACHE":
      await clearTranslationCache();
      return { ok: true };
    case "BR_CLEAR_PAGE_CACHE":
      return { removedCacheEntries: await clearTranslationCacheForTextHashes(message.textHashes) };
    case "BR_GET_CACHE_STATS":
      return getCacheStats();
    case "BR_PAGE_TRANSLATE":
    case "BR_PAGE_STOP":
    case "BR_PAGE_RESTORE":
    case "BR_PAGE_CLEAR_DATA":
    case "BR_PAGE_STATUS":
    case "BR_SUBTITLE_STATUS":
    case "BR_SUBTITLE_ENABLE":
    case "BR_SUBTITLE_DISABLE":
      return sendToActiveTab(message);
    case "BR_OFFSCREEN_PROBE_TRANSLATOR":
      return { available: false, reason: "Chrome Translator probe is not wired in V1." };
    default:
      return { ok: false, error: "Unknown message." };
  }
}

function installMessageRouter(): void {
  chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
    handleMessage(message)
      .then((response) => sendResponse(response))
      .catch((error) => {
        const messageText = error instanceof Error ? error.message : String(error);
        sendResponse({ ok: false, error: messageText });
      });
    return true;
  });
}

function installContextMenus(): void {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: "br-translate-page",
        title: "Translate page bilingually",
        contexts: ["page", "selection"],
      });
      chrome.contextMenus.create({
        id: "br-restore-page",
        title: "Restore original page",
        contexts: ["page"],
      });
    });
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;
    if (info.menuItemId === "br-translate-page") {
      await sendToTab(tab, { type: "BR_PAGE_TRANSLATE" }).catch(() => undefined);
    }
    if (info.menuItemId === "br-restore-page") {
      await sendToTab(tab, { type: "BR_PAGE_RESTORE" }).catch(() => undefined);
    }
  });
}

function installCommands(): void {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === "toggleTranslatePage") {
      await sendToActiveTab({ type: "BR_PAGE_TRANSLATE" }).catch(() => undefined);
    }
    if (command === "restoreOriginalPage") {
      await sendToActiveTab({ type: "BR_PAGE_RESTORE" }).catch(() => undefined);
    }
  });
}

export default defineBackground(() => {
  installMessageRouter();
  installContextMenus();
  installCommands();
});
