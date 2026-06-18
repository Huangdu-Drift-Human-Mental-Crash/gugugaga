import { defaultSettings, mergeSettings } from "./defaults";
import type { ExtensionSettings } from "./types";

const SETTINGS_KEY = "br-settings-v1";

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return mergeSettings(result[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined);
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export function resetSettingsForTests(): ExtensionSettings {
  return structuredClone(defaultSettings);
}

