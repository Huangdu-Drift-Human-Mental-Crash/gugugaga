import { afterEach, describe, expect, it, vi } from "vitest";
import { sendRuntimeMessage, sendTabMessage } from "./messaging";
import type { RuntimeMessage } from "./types";

const getSettingsMessage: RuntimeMessage = { type: "BR_GET_SETTINGS" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("messaging helpers", () => {
  it("returns successful runtime responses", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn().mockResolvedValue({ value: 42 }),
      },
    });

    await expect(sendRuntimeMessage<{ value: number }>(getSettingsMessage)).resolves.toEqual({ value: 42 });
  });

  it("throws runtime failures returned by message routers", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn().mockResolvedValue({ ok: false, error: "No active tab." }),
      },
    });

    await expect(sendRuntimeMessage(getSettingsMessage)).rejects.toThrow("No active tab.");
  });

  it("throws tab failures returned by content scripts", async () => {
    vi.stubGlobal("chrome", {
      tabs: {
        sendMessage: vi.fn().mockResolvedValue({ ok: false, error: "Provider is not configured." }),
      },
    });

    await expect(sendTabMessage(7, getSettingsMessage)).rejects.toThrow("Provider is not configured.");
  });
});
