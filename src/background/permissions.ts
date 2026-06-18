import type { ProviderConfig } from "../shared/types";

export function permissionPatternFromBaseUrl(baseUrl: string): string {
  try {
    const url = new URL(baseUrl || "https://example.com");
    return `${url.origin}/*`;
  } catch {
    return "https://*/*";
  }
}

function permissionPatternsForProvider(config: ProviderConfig): string[] {
  const origins = new Set([permissionPatternFromBaseUrl(config.baseUrl)]);
  if (config.id === "bing-web") {
    origins.add("https://edge.microsoft.com/*");
    origins.add("https://api-edge.cognitive.microsofttranslator.com/*");
  }
  if (config.id === "google-web") {
    origins.add("https://translate.googleapis.com/*");
  }
  return Array.from(origins);
}

export async function hasHostPermission(baseUrl: string): Promise<boolean> {
  if (!globalThis.chrome?.permissions) return true;
  const origins = [permissionPatternFromBaseUrl(baseUrl)];
  return chrome.permissions.contains({ origins });
}

export async function grantProviderPermission(config: ProviderConfig): Promise<boolean> {
  if (!globalThis.chrome?.permissions) return true;
  const origins = permissionPatternsForProvider(config);
  return chrome.permissions.request({ origins });
}
