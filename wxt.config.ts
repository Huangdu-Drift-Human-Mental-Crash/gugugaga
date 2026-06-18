import { defineConfig } from "wxt";
import { fileURLToPath } from "node:url";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: ".",
  vite: () => ({
    resolve: {
      alias: {
        "~": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  }),
  manifest: {
    name: "gugugaga",
    short_name: "gugugaga",
    description: "鸟语修正器：你在咕咕嘎嘎说什么鸟语呢？",
    version: "0.1.0",
    permissions: ["storage", "activeTab", "scripting", "contextMenus", "offscreen"],
    optional_host_permissions: ["http://*/*", "https://*/*"],
    action: {
      default_title: "gugugaga",
    },
    commands: {
      toggleTranslatePage: {
        suggested_key: {
          default: "Alt+B",
        },
        description: "Toggle bilingual translation on the current page",
      },
      restoreOriginalPage: {
        suggested_key: {
          default: "Alt+R",
        },
        description: "Restore the original page",
      },
    },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    web_accessible_resources: [
      {
        resources: ["youtube-subtitle-hook.js"],
        matches: ["https://www.youtube.com/*", "https://youtube.com/*", "https://m.youtube.com/*"],
      },
    ],
  },
});
