(() => {
  const EVENT = "BRX_YOUTUBE_SUBTITLE_RESPONSE";
  const MARK = "__brxYoutubeSubtitleHookInstalled";
  if (window[MARK]) return;
  window[MARK] = true;

  function isTimedTextUrl(value) {
    if (!value) return false;
    try {
      const url = new URL(String(value), location.href);
      return url.hostname.endsWith("youtube.com") && url.pathname.includes("/api/timedtext");
    } catch {
      return String(value).includes("/api/timedtext");
    }
  }

  function urlFromFetchInput(input) {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.href;
    if (input instanceof Request) return input.url;
    return "";
  }

  function postSubtitle(url, responseText) {
    if (!url || !responseText) return;
    window.postMessage(
      {
        source: "bilingual-reader",
        type: EVENT,
        url,
        responseText,
      },
      "*",
    );
  }

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function open(method, url) {
    this.__brxSubtitleUrl = url ? String(url) : "";
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function send() {
    const url = this.__brxSubtitleUrl;
    if (isTimedTextUrl(url)) {
      this.addEventListener("load", () => {
        try {
          if (this.status >= 200 && this.status < 300 && typeof this.responseText === "string") {
            postSubtitle(url, this.responseText);
          }
        } catch {
          // Some response types throw on responseText; leave YouTube untouched.
        }
      });
    }
    return originalSend.apply(this, arguments);
  };

  const originalFetch = window.fetch;
  window.fetch = async function fetch(input, init) {
    const response = await originalFetch.apply(this, arguments);
    const url = urlFromFetchInput(input);
    if (isTimedTextUrl(url)) {
      response
        .clone()
        .text()
        .then((text) => postSubtitle(url, text))
        .catch(() => undefined);
    }
    return response;
  };
})();

