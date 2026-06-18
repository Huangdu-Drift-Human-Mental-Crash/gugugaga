import { describe, expect, it, vi } from "vitest";
import { injectYouTubeSubtitleMenu, removeYouTubeSubtitleMenu } from "./menu";

describe("YouTube subtitle menu injection", () => {
  it("injects bilingual subtitle entries only once", () => {
    document.body.innerHTML = `
      <div class="ytp-panel">
        <div class="ytp-panel-header">Subtitles/CC</div>
        <div class="ytp-panel-menu">
          <div class="ytp-menuitem"><div class="ytp-menuitem-label">Off</div></div>
          <div class="ytp-menuitem"><div class="ytp-menuitem-label">English</div></div>
        </div>
      </div>
    `;
    const onSelect = vi.fn();

    expect(injectYouTubeSubtitleMenu(document, onSelect)).toBe(true);
    expect(injectYouTubeSubtitleMenu(document, onSelect)).toBe(false);

    const items = document.querySelectorAll("[data-brx-youtube-subtitle-menu]");
    expect(items).toHaveLength(2);
    expect(document.body).toHaveTextContent("BR: Bilingual");
    expect(document.body).toHaveTextContent("Translation only");
    expect(document.querySelector("[data-brx-youtube-subtitle-menu='dual'] .ytp-menuitem-icon")).toBeNull();
    expect(document.querySelector("[data-brx-youtube-subtitle-menu='dual']")).toHaveAttribute("role", "menuitemradio");
    expect(document.querySelector("[data-brx-youtube-subtitle-menu='dual']")).toHaveAttribute("aria-checked", "false");
    expect(document.querySelector("[data-brx-youtube-subtitle-menu='dual'] .ytp-menuitem-label")).toHaveTextContent(
      "BR: Bilingual",
    );
    expect(document.querySelector("[data-brx-youtube-subtitle-menu='dual'] .ytp-menuitem-content")).toBeNull();
  });

  it("calls the selection callback with the chosen mode", () => {
    document.body.innerHTML = `
      <div class="ytp-panel">
        <div class="ytp-panel-header">Subtitles/CC</div>
        <div class="ytp-panel-menu">
          <div class="ytp-menuitem"><div class="ytp-menuitem-label">Off</div></div>
          <div class="ytp-menuitem"><div class="ytp-menuitem-label">English</div></div>
        </div>
      </div>
    `;
    const onSelect = vi.fn();
    injectYouTubeSubtitleMenu(document, onSelect);

    document.querySelector<HTMLElement>("[data-brx-youtube-subtitle-menu='dual']")?.click();

    expect(onSelect).toHaveBeenCalledWith("dual");
    expect(document.querySelector("[data-brx-youtube-subtitle-menu='dual']")).toHaveAttribute("data-brx-selected", "true");
    expect(document.querySelector("[data-brx-youtube-subtitle-menu='dual']")).toHaveAttribute("aria-checked", "true");
    expect(document.querySelector(".ytp-panel-menu")).toHaveClass("brx-youtube-subtitle-menu-active");
    expect(document.querySelector("[data-brx-youtube-subtitle-menu='translation']")).toHaveAttribute(
      "data-brx-selected",
      "false",
    );
    expect(document.querySelector("[data-brx-youtube-subtitle-menu='translation']")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("does not inject into the Audio Track menu", () => {
    document.body.innerHTML = `
      <div class="ytp-panel">
        <div class="ytp-panel-header">Audio track</div>
        <div class="ytp-panel-menu">
          <div class="ytp-menuitem"><div class="ytp-menuitem-label">English original</div></div>
          <div class="ytp-menuitem"><div class="ytp-menuitem-label">Spanish</div></div>
        </div>
      </div>
    `;

    expect(injectYouTubeSubtitleMenu(document, vi.fn())).toBe(false);
    expect(document.querySelector("[data-brx-youtube-subtitle-menu]")).toBeNull();
  });

  it("syncs selected mode when the menu is rebuilt", () => {
    document.body.innerHTML = `
      <div class="ytp-panel">
        <div class="ytp-panel-header">Subtitles/CC</div>
        <div class="ytp-panel-menu">
          <div class="ytp-menuitem"><div class="ytp-menuitem-label">Off</div></div>
          <div class="ytp-menuitem"><div class="ytp-menuitem-label">English</div></div>
        </div>
      </div>
    `;

    injectYouTubeSubtitleMenu(document, vi.fn(), "translation");

    expect(document.querySelector("[data-brx-youtube-subtitle-menu='translation']")).toHaveAttribute(
      "data-brx-selected",
      "true",
    );
    expect(document.querySelector("[data-brx-youtube-subtitle-menu='dual']")).toHaveAttribute(
      "data-brx-selected",
      "false",
    );
    expect(document.querySelector("[data-brx-youtube-subtitle-menu='translation']")).toHaveTextContent(
      "BR: Translation only",
    );
  });

  it("removes injected entries", () => {
    document.body.innerHTML = `
      <div class="ytp-panel">
        <div class="ytp-panel-header">Subtitles/CC</div>
        <div class="ytp-panel-menu">
          <div class="ytp-menuitem"><div class="ytp-menuitem-label">Off</div></div>
          <div class="ytp-menuitem"><div class="ytp-menuitem-label">English</div></div>
        </div>
      </div>
    `;
    injectYouTubeSubtitleMenu(document, vi.fn());

    removeYouTubeSubtitleMenu(document);

    expect(document.querySelector("[data-brx-youtube-subtitle-menu]")).toBeNull();
    expect(document.querySelector(".ytp-panel-menu")).not.toHaveClass("brx-youtube-subtitle-menu-active");
  });
});
