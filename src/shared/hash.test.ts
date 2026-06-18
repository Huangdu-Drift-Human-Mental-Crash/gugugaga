import { blockHash, cacheKey, normalizeText } from "./hash";

describe("hash helpers", () => {
  it("normalizes whitespace", () => {
    expect(normalizeText(" hello\n\n world ")).toBe("hello world");
  });

  it("creates stable block hashes", () => {
    expect(blockHash("Hello   World")).toBe(blockHash("hello world"));
  });

  it("builds deterministic cache keys", () => {
    expect(
      cacheKey({
        textHash: "abc",
        targetLang: "zh-CN",
        providerId: "openai-compatible",
        providerScope: "scope",
        model: "gpt",
        expertId: "general",
        contextVersion: "ctx",
      }),
    ).toBe("br-cache-v1:abc:zh-CN:openai-compatible:scope:gpt:general:ctx");
  });
});
