declare global {
  interface Window {
    Translator?: {
      availability?: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<string>;
    };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "BR_OFFSCREEN_PROBE_TRANSLATOR") return false;
  const translator = window.Translator;
  if (!translator?.availability) {
    sendResponse({ available: false, reason: "Translator API is not present in this Chrome build." });
    return false;
  }
  translator
    .availability({ sourceLanguage: "en", targetLanguage: "zh" })
    .then((availability) => sendResponse({ available: true, availability }))
    .catch((error) => sendResponse({ available: false, reason: error instanceof Error ? error.message : String(error) }));
  return true;
});

export {};

