function isBlockedProtocol(): boolean {
  return /^(chrome|edge|about|devtools):/.test(location.protocol);
}

function isCloudflareChallenge(): boolean {
  return location.pathname.includes("/cdn-cgi/challenge-platform/");
}

function isLikelyAdFrame(): boolean {
  const blockedDomains = [
    "doubleclick.net",
    "googlesyndication.com",
    "pubmatic.com",
    "rubiconproject.com",
    "taboola.com",
    "outbrain.com",
  ];
  return blockedDomains.some((domain) => location.hostname === domain || location.hostname.endsWith(`.${domain}`));
}

async function frameLooksVisible(): Promise<boolean> {
  if (window.top === window) return true;
  try {
    const frame = window.frameElement;
    if (frame instanceof HTMLElement) {
      const rect = frame.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    }
  } catch {
    return true;
  }
  return true;
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  allFrames: true,
  matchAboutBlank: true,
  async main() {
    if (isBlockedProtocol() || isCloudflareChallenge() || isLikelyAdFrame()) return;
    if (!(await frameLooksVisible())) return;
    const module = await import("../src/content/main");
    module.bootstrapContentTranslator();
  },
});
