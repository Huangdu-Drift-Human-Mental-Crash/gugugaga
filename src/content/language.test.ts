import { detectDominantLanguage, detectTextLanguage, isDominantTargetLanguage } from "./language";

describe("language detection", () => {
  it("detects English prose as English", () => {
    expect(detectTextLanguage("Please review the key changes and schedule below.")).toBe("en");
  });

  it("detects Chinese prose as Chinese", () => {
    expect(detectTextLanguage("韩亚航空将正式退出星空联盟。")).toBe("zh");
  });

  it("detects the dominant page language across blocks", () => {
    expect(
      detectDominantLanguage([
        "会员说 星空联盟",
        "Please be advised that Asiana Airlines will officially depart from Star Alliance.",
        "Consequently, mileage accrual and benefits will end.",
      ]),
    ).toBe("en");
    expect(isDominantTargetLanguage(["这是第一段中文正文。", "这是第二段中文正文。"], "zh-CN")).toBe(true);
  });
});
