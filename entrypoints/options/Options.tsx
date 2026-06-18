import { useEffect, useMemo, useState } from "react";
import { visibleProviderDescriptors as providerDescriptors } from "../../src/shared/defaults";
import { sendRuntimeMessage } from "../../src/shared/messaging";
import type { CacheStats, ExtensionSettings, ExpertProfile, ProviderConfig } from "../../src/shared/types";

export function Options() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats>({ entries: 0, approxBytes: 0 });
  const [message, setMessage] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const [nextSettings, stats] = await Promise.all([
      sendRuntimeMessage<ExtensionSettings>({ type: "BR_GET_SETTINGS" }),
      sendRuntimeMessage<CacheStats>({ type: "BR_GET_CACHE_STATS" }),
    ]);
    setSettings(nextSettings);
    setCacheStats(stats);
  }

  async function save(next: ExtensionSettings) {
    setSettings(next);
    await sendRuntimeMessage({ type: "BR_SAVE_SETTINGS", settings: next });
    setMessage("Saved.");
  }

  async function clearCache() {
    await sendRuntimeMessage({ type: "BR_CLEAR_CACHE" });
    setCacheStats(await sendRuntimeMessage<CacheStats>({ type: "BR_GET_CACHE_STATS" }));
    setMessage("Cache cleared.");
  }

  async function grant(providerConfig: ProviderConfig) {
    const result = await sendRuntimeMessage<{ granted: boolean }>({
      type: "BR_GRANT_PROVIDER_PERMISSION",
      providerConfig,
    });
    setMessage(result.granted ? "Permission granted." : "Permission not granted.");
  }

  function updateProvider(id: string, patch: Partial<ProviderConfig>) {
    if (!settings) return;
    const current = settings.providerConfigs[id];
    if (!current) return;
    void save({
      ...settings,
      providerConfigs: {
        ...settings.providerConfigs,
        [id]: { ...current, ...patch },
      },
    });
  }

  function updateExpert(id: string, patch: Partial<ExpertProfile>) {
    if (!settings) return;
    void save({
      ...settings,
      expertProfiles: settings.expertProfiles.map((expert) => (expert.id === id ? { ...expert, ...patch } : expert)),
    });
  }

  const selectedProvider = useMemo(
    () => providerDescriptors.find((provider) => provider.id === settings?.providerId),
    [settings?.providerId],
  );

  if (!settings) return <main className="options"><p>Loading...</p></main>;

  return (
    <main className="options">
      <header>
        <div>
          <h1>gugugaga Options</h1>
          <p>Configure translation providers, AI experts, privacy, and cache.</p>
        </div>
        {message && <span className="notice">{message}</span>}
      </header>

      <section>
        <h2>General</h2>
        <div className="form-grid">
          <label>
            Default provider
            <select value={settings.providerId} onChange={(event) => void save({ ...settings, providerId: event.target.value })}>
              {providerDescriptors.map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.label}</option>
              ))}
            </select>
          </label>
          <label>
            Target language
            <input value={settings.targetLang} onChange={(event) => void save({ ...settings, targetLang: event.target.value })} />
          </label>
          <label>
            Display mode
            <select
              value={settings.displayMode}
              onChange={(event) => void save({ ...settings, displayMode: event.target.value as ExtensionSettings["displayMode"] })}
            >
              <option value="dual">Dual</option>
              <option value="translation">Translation only</option>
            </select>
          </label>
        </div>
        <p className="hint">{selectedProvider?.description}</p>
      </section>

      <section>
        <h2>Smart Context</h2>
        <div className="form-grid">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.context.enabled}
              onChange={(event) => void save({ ...settings, context: { ...settings.context, enabled: event.target.checked } })}
            />
            Enable context pack
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.context.preflight}
              onChange={(event) => void save({ ...settings, context: { ...settings.context, preflight: event.target.checked } })}
            />
            LLM preflight summary
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.context.maskSensitiveText}
              onChange={(event) =>
                void save({ ...settings, context: { ...settings.context, maskSensitiveText: event.target.checked } })
              }
            />
            Mask sensitive text
          </label>
          <label>
            Context character budget
            <input
              type="number"
              min={1000}
              step={1000}
              value={settings.context.maxChars}
              onChange={(event) =>
                void save({ ...settings, context: { ...settings.context, maxChars: Number(event.target.value) } })
              }
            />
          </label>
        </div>
      </section>

      <section>
        <h2>Providers</h2>
        <div className="provider-list">
          {providerDescriptors.map((provider) => {
            const config = settings.providerConfigs[provider.id];
            if (!config) return null;
            return (
              <article className="provider" key={provider.id}>
                <div className="provider-head">
                  <div>
                    <h3>{provider.label}</h3>
                    <p>{provider.description}</p>
                  </div>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(event) => updateProvider(provider.id, { enabled: event.target.checked })}
                    />
                    Enabled
                  </label>
                </div>
                <div className="form-grid">
                  <label>
                    Base URL
                    <input value={config.baseUrl} onChange={(event) => updateProvider(provider.id, { baseUrl: event.target.value })} />
                  </label>
                  <label>
                    API key
                    <input
                      type="password"
                      value={config.apiKey}
                      onChange={(event) => updateProvider(provider.id, { apiKey: event.target.value })}
                    />
                  </label>
                  <label>
                    Model
                    <input value={config.model} onChange={(event) => updateProvider(provider.id, { model: event.target.value })} />
                  </label>
                  <label>
                    Region
                    <input value={config.region} onChange={(event) => updateProvider(provider.id, { region: event.target.value })} />
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={config.experimentalEnabled}
                      onChange={(event) => updateProvider(provider.id, { experimentalEnabled: event.target.checked })}
                    />
                    Experimental adapter
                  </label>
                  <button type="button" onClick={() => void grant(config)}>Grant host permission</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h2>AI Experts</h2>
        <div className="expert-list">
          {settings.expertProfiles.map((expert) => (
            <article className="expert" key={expert.id}>
              <h3>{expert.name}</h3>
              <label>
                System prompt
                <textarea value={expert.systemPrompt} onChange={(event) => updateExpert(expert.id, { systemPrompt: event.target.value })} />
              </label>
              <label>
                Style prompt
                <textarea value={expert.stylePrompt} onChange={(event) => updateExpert(expert.id, { stylePrompt: event.target.value })} />
              </label>
              <label>
                Glossary
                <textarea value={expert.glossary} onChange={(event) => updateExpert(expert.id, { glossary: event.target.value })} />
              </label>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>Privacy and Cache</h2>
        <p>
          Telemetry is not implemented. API keys are stored in local extension storage and are not synced.
          Web adapters are experimental and can be disabled per provider.
        </p>
        <p>Cache entries: {cacheStats.entries}. Approx size: {Math.round(cacheStats.approxBytes / 1024)} KB.</p>
        <button type="button" onClick={() => void clearCache()}>Clear translation cache</button>
      </section>
    </main>
  );
}
