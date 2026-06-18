import { maskSensitiveText } from "./sanitize";

describe("maskSensitiveText", () => {
  it("masks emails and long secrets", () => {
    const result = maskSensitiveText("Contact a@example.com with sk-abcdefghijklmnopqrstuvwxyz123456");
    expect(result.masked).toBe(true);
    expect(result.text).not.toContain("a@example.com");
    expect(result.replacements.length).toBeGreaterThanOrEqual(2);
  });
});

