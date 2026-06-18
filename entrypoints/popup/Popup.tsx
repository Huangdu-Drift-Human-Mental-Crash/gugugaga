import { useEffect, useMemo, useState } from "react";
import { visibleProviderDescriptors as providerDescriptors } from "../../src/shared/defaults";
import { sendRuntimeMessage } from "../../src/shared/messaging";
import type {
  ClearPageDataResult,
  ExtensionSettings,
  PageRuntimeStatus,
  SubtitleRuntimeStatus,
} from "../../src/shared/types";

type LoadState = "loading" | "ready" | "error";

const languageOptions = ["zh-CN", "zh-TW", "en", "ja", "ko", "fr", "de", "es", "ru", "pt-BR"];

export function Popup() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [pageStatus, setPageStatus] = useState<PageRuntimeStatus | null>(null);
  const [subtitleStatus, setSubtitleStatus] = useState<SubtitleRuntimeStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (loadState !== "ready") return;
    let cancelled = false;
      const refresh = async () => {
        const status = await sendRuntimeMessage<PageRuntimeStatus>({ type: "BR_PAGE_STATUS" }).catch(() => null);
        if (!cancelled && status) setPageStatus(status);
        const subtitles = await sendRuntimeMessage<SubtitleRuntimeStatus>({ type: "BR_SUBTITLE_STATUS" }).catch(() => null);
        if (!cancelled && subtitles) setSubtitleStatus(subtitles);
      };
    const interval = window.setInterval(refresh, pageStatus?.status === "translating" ? 700 : 2000);
    if (pageStatus?.status === "translating") void refresh();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [loadState, pageStatus?.status]);

  async function load() {
    try {
      const nextSettings = await sendRuntimeMessage<ExtensionSettings>({ type: "BR_GET_SETTINGS" });
      setSettings(nextSettings);
      const status = await sendRuntimeMessage<PageRuntimeStatus>({ type: "BR_PAGE_STATUS" }).catch(() => null);
      setPageStatus(status);
      const subtitles = await sendRuntimeMessage<SubtitleRuntimeStatus>({ type: "BR_SUBTITLE_STATUS" }).catch(() => null);
      setSubtitleStatus(subtitles);
      setLoadState("ready");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
      setLoadState("error");
    }
  }

  async function updateSettings(next: ExtensionSettings) {
    setSettings(next);
    await sendRuntimeMessage({ type: "BR_SAVE_SETTINGS", settings: next });
  }

  async function translate() {
    setError("");
    setPageStatus((current) => ({
      status: "translating",
      translatedBlocks: 0,
      queuedBlocks: 0,
      error: "",
      providerId: current?.providerId ?? settings?.providerId ?? "",
    }));
    const status = await sendRuntimeMessage<PageRuntimeStatus>({ type: "BR_PAGE_TRANSLATE" }).catch((translateError) => {
      setError(translateError instanceof Error ? translateError.message : String(translateError));
      return null;
    });
    setPageStatus(status);
  }

  async function stop() {
    const status = await sendRuntimeMessage<PageRuntimeStatus>({ type: "BR_PAGE_STOP" }).catch(() => null);
    setPageStatus(status);
  }

  async function restore() {
    const status = await sendRuntimeMessage<PageRuntimeStatus>({ type: "BR_PAGE_RESTORE" }).catch(() => null);
    setPageStatus(status);
    const subtitles = await sendRuntimeMessage<SubtitleRuntimeStatus>({ type: "BR_SUBTITLE_STATUS" }).catch(() => null);
    setSubtitleStatus(subtitles);
  }

  async function enableSubtitles() {
    if (!settings) return;
    setError("");
    const status = await sendRuntimeMessage<SubtitleRuntimeStatus>({
      type: "BR_SUBTITLE_ENABLE",
      displayMode: settings.displayMode,
    }).catch((subtitleError) => {
      setError(subtitleError instanceof Error ? subtitleError.message : String(subtitleError));
      return null;
    });
    setSubtitleStatus(status);
  }

  async function disableSubtitles() {
    const status = await sendRuntimeMessage<SubtitleRuntimeStatus>({ type: "BR_SUBTITLE_DISABLE" }).catch(() => null);
    setSubtitleStatus(status);
  }

  async function clearPageData() {
    setError("");
    const result = await sendRuntimeMessage<ClearPageDataResult>({ type: "BR_PAGE_CLEAR_DATA" }).catch((clearError) => {
      setError(clearError instanceof Error ? clearError.message : String(clearError));
      return null;
    });
    if (result) {
      setError(`Cleared ${result.removedCacheEntries} cached entries for ${result.textHashes} page hashes.`);
      const status = await sendRuntimeMessage<PageRuntimeStatus>({ type: "BR_PAGE_STATUS" }).catch(() => null);
      setPageStatus(status);
    }
  }

  async function grantPermission() {
    if (!settings) return;
    const providerConfig = settings.providerConfigs[settings.providerId];
    if (!providerConfig) return;
    const response = await sendRuntimeMessage<{ granted: boolean }>({
      type: "BR_GRANT_PROVIDER_PERMISSION",
      providerConfig,
    });
    setError(response.granted ? "" : "Host permission was not granted.");
  }

  const selectedProvider = useMemo(
    () => providerDescriptors.find((provider) => provider.id === settings?.providerId),
    [settings?.providerId],
  );
  const isTranslating = pageStatus?.status === "translating";

  if (loadState === "loading") return <main className="popup"><p>Loading...</p></main>;
  if (loadState === "error" || !settings) return <main className="popup"><p className="error">{error}</p></main>;

  return (
    <main className="popup">
      <header>
        <h1>gugugaga</h1>
        <span className={`status status-${pageStatus?.status ?? "idle"}`}>{pageStatus?.status ?? "idle"}</span>
      </header>

      <section className="actions">
        <button
          onClick={translate}
          disabled={isTranslating}
          title="Translate this page"
          aria-label="Translate this page"
        >
          {isTranslating ? "Translating" : "Translate"}
        </button>
        <button
          onClick={stop}
          disabled={!isTranslating}
          title="Stop the current translation"
          aria-label="Stop the current translation"
        >
          Stop
        </button>
        <button onClick={restore} title="Show the original page text" aria-label="Show the original page text">
          Original
        </button>
      </section>

      <label>
        Provider
        <select
          value={settings.providerId}
          onChange={(event) => updateSettings({ ...settings, providerId: event.target.value })}
          disabled={isTranslating}
        >
          {providerDescriptors.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid">
        <label>
          Target
          <select
            value={settings.targetLang}
            onChange={(event) => updateSettings({ ...settings, targetLang: event.target.value })}
            disabled={isTranslating}
          >
            {languageOptions.map((language) => (
              <option key={language} value={language}>{language}</option>
            ))}
          </select>
        </label>
        <label>
          Display
          <select
            value={settings.displayMode}
            onChange={(event) => updateSettings({ ...settings, displayMode: event.target.value as ExtensionSettings["displayMode"] })}
            disabled={isTranslating}
          >
            <option value="dual">Dual</option>
            <option value="translation">Translation only</option>
          </select>
        </label>
      </div>

      <label className="toggle">
        <input
          type="checkbox"
          checked={settings.context.enabled}
          disabled={isTranslating}
          onChange={(event) =>
            updateSettings({ ...settings, context: { ...settings.context, enabled: event.target.checked } })
          }
        />
        Smart context
      </label>

      <label>
        Expert
        <select
          value={settings.selectedExpertId}
          onChange={(event) => updateSettings({ ...settings, selectedExpertId: event.target.value })}
          disabled={isTranslating || !selectedProvider?.capabilities.aiPrompt}
        >
          {settings.expertProfiles.map((expert) => (
            <option key={expert.id} value={expert.id}>{expert.name}</option>
          ))}
        </select>
      </label>

      <button className="secondary" onClick={grantPermission}>Grant Provider Permission</button>
      <button className="secondary" onClick={clearPageData} disabled={isTranslating}>Clear Page Data</button>
      <section className="subtitle-panel">
        <div>
          <strong>YouTube subtitles</strong>
          <span>{subtitleStatus?.status ?? "idle"}</span>
        </div>
        <div className="subtitle-actions">
          <button className="secondary" onClick={enableSubtitles} disabled={isTranslating}>Enable</button>
          <button className="secondary" onClick={disableSubtitles}>Disable</button>
        </div>
      </section>
      <button className="link" onClick={() => chrome.runtime.openOptionsPage()}>Options</button>

      {pageStatus && (
        <p className="meta">
          {isTranslating ? "Translating... " : ""}
          {pageStatus.translatedBlocks} translated, {pageStatus.queuedBlocks} queued
        </p>
      )}
      {subtitleStatus && subtitleStatus.status !== "idle" && (
        <p className="meta">
          Subtitles: {subtitleStatus.translatedCues} translated, {subtitleStatus.queuedCues} queued
        </p>
      )}
      {(error || pageStatus?.error) && <p className="error">{error || pageStatus?.error}</p>}
      {subtitleStatus?.error && <p className="error">{subtitleStatus.error}</p>}
    </main>
  );
}
