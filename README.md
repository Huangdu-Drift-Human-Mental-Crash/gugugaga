# gugugaga

鸟语修正器：你在咕咕嘎嘎说什么鸟语呢？

`gugugaga` is an open-source Chrome MV3 extension for bilingual web pages,
docs, and YouTube subtitles. It is built from scratch with WXT, React, and
TypeScript.

The project borrows product lessons from mature bilingual-reading tools, but it
does not reuse their source code, brand, icons, proprietary rules, or services.

## Features

- Stateful page translation engine with DOM block lifecycle management.
- Dual-language and translation-only rendering modes.
- Rich-text preservation for safe inline HTML such as links, emphasis, code, and
  superscripts.
- Compact navigation translation for sidebars and tables of contents.
- YouTube subtitle translation with a dedicated subtitle engine and overlay.
- OpenAI-compatible provider support for OpenAI, DeepSeek, OpenRouter,
  SiliconFlow, Ollama, LM Studio, and compatible local endpoints.
- Official provider adapters for DeepL, Microsoft Translator, and Google Cloud
  Translate.
- Experimental web adapters for Google Web, Bing Web, and DeepL Web.
- AI expert prompts, smart context packs, glossary-aware prompting, and sensitive
  text masking before context generation.
- Local translation cache and current-page cache clearing.
- Privacy-first defaults: no telemetry and no sync storage for API keys.

## Install For Development

```bash
npx pnpm@11.5.2 install
npx pnpm@11.5.2 dev
```

For Chrome development:

```bash
npx pnpm@11.5.2 dev:chrome
```

## Build

```bash
npx pnpm@11.5.2 test
npx pnpm@11.5.2 compile
npx pnpm@11.5.2 build
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**,
and select:

```text
.output/chrome-mv3
```

To create a zip package locally:

```bash
npx pnpm@11.5.2 zip
```

## GitHub Actions Artifacts

The workflow in `.github/workflows/build-extension.yml` runs tests, type checks,
builds the extension, creates a WXT zip package, and asks Chrome to pack a CRX.

Artifacts include:

- `gugugaga.crx`
- `gugugaga.pem`
- WXT-generated zip package
- unpacked `gugugaga-chrome-mv3/`

The generated CRX is intended for testing and direct distribution experiments.
Chrome Web Store releases should still use the store release/signing flow.

## Provider Notes

Provider host access is optional. Pick a provider in Popup or Options, then use
the permission button to grant host permissions only when needed.

OpenAI-compatible providers can use a local `baseUrl`, for example:

```text
http://localhost:11434/v1
http://localhost:1234/v1
```

Experimental web adapters are intentionally best-effort. Web endpoints can
change without notice, so each adapter can be disabled independently.

## Current Scope

Implemented:

- Web page bilingual translation.
- Stateful page engine and dynamic page scanning.
- Rich inline HTML placeholder restoration for AI providers.
- Navigation/sidebar translation lane.
- YouTube subtitle translation V1.
- Popup and Options UI.
- Translation cache and current-page data clearing.

Not implemented yet:

- PDF reader translation.
- EPUB/ebook reader.
- Image/OCR/manga translation.
- Mobile WebView bridge.
- Full site-rule editor and debug side panel.

## Scripts

```bash
npx pnpm@11.5.2 test        # unit tests
npx pnpm@11.5.2 compile     # TypeScript check
npx pnpm@11.5.2 build       # production Chrome MV3 build
npx pnpm@11.5.2 zip         # package zip
```

## License

AGPL-3.0-or-later.
