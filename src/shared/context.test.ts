import { buildContextPack } from "./context";

describe("buildContextPack", () => {
  it("collects visible block text and masks sensitive content", () => {
    const pack = buildContextPack({
      title: "Page",
      site: "example.com",
      headings: ["Intro"],
      maxChars: 200,
      maskSensitive: true,
      blocks: [
        { id: "1", hash: "a", text: "hello a@example.com", kind: "paragraph", visibility: "visible" },
        { id: "2", hash: "b", text: "hidden", kind: "paragraph", visibility: "hidden" },
      ],
    });
    expect(pack.rawTextSnippet).toContain("[BR_MASK_1]");
    expect(pack.rawTextSnippet).not.toContain("hidden");
  });
});

