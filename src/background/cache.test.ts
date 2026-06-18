import { afterEach, describe, expect, it, vi } from "vitest";
import { clearTranslationCacheForTextHashes } from "./cache";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("translation cache", () => {
  it("clears only cache entries matching current page text hashes", async () => {
    const storage: Record<string, string> = {
      "br-cache-v1:aaa:zh-CN:bing-web:default:none:ctx0": "你好",
      "br-cache-v1:bbb:zh-CN:bing-web:default:none:ctx0": "世界",
      "br-cache-v1:ccc:zh-CN:bing-web:default:none:ctx0": "保留",
      "other:key": "keep",
    };
    const remove = vi.fn(async (keys: string[]) => {
      for (const key of keys) delete storage[key];
    });
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async () => ({ ...storage })),
          remove,
        },
      },
    });

    await expect(clearTranslationCacheForTextHashes(["aaa", "bbb"])).resolves.toBe(2);

    expect(remove).toHaveBeenCalledWith([
      "br-cache-v1:aaa:zh-CN:bing-web:default:none:ctx0",
      "br-cache-v1:bbb:zh-CN:bing-web:default:none:ctx0",
    ]);
    expect(storage["br-cache-v1:ccc:zh-CN:bing-web:default:none:ctx0"]).toBe("保留");
    expect(storage["other:key"]).toBe("keep");
  });
});
