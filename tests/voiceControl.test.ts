import { describe, expect, it, vi } from "vitest";

import { executeVoiceControl } from "../src/native/voiceControl";

function button(symbol: string) {
  return { textContent: symbol, click: vi.fn(), disabled: false };
}

function root(...buttons: ReturnType<typeof button>[]) {
  return { querySelectorAll: () => buttons };
}

describe("voice control contract", () => {
  it("prefers an explicit Mutiny voice-control hook", () => {
    const explicit = button("custom-icon");
    const generic = button("mic");
    const explicitRoot = {
      querySelector: vi.fn((selector: string) =>
        selector === '[data-mutiny-voice-control="toggleMute"]' ? explicit : null,
      ),
      querySelectorAll: vi.fn(() => [generic]),
    };

    expect(executeVoiceControl(explicitRoot, "toggleMute")).toBe("clicked:explicit-hook");
    expect(explicit.click).toHaveBeenCalledOnce();
    expect(generic.click).not.toHaveBeenCalled();
    expect(explicitRoot.querySelector).toHaveBeenCalledWith(
      '[data-mutiny-voice-control="toggleMute"]',
    );
  });

  it.each([
    ["toggleMute", "mic"],
    ["toggleMute", "mic_off"],
    ["toggleDeafen", "headset"],
    ["toggleDeafen", "headset_off"],
    ["disconnect", "call_end"],
  ] as const)("maps %s to the hosted client's %s symbol", (action, symbol) => {
    const target = button(symbol);
    expect(executeVoiceControl(root(target), action)).toBe(`clicked:${symbol}`);
    expect(target.click).toHaveBeenCalledOnce();
  });

  it("returns not-found and does not click unrelated controls", () => {
    const camera = button("camera_video");
    expect(executeVoiceControl(root(camera), "toggleMute")).toBe("not-found");
    expect(camera.click).not.toHaveBeenCalled();
  });

  it("keeps accessible-label compatibility for hosted client variants", () => {
    const target = button("");
    const accessibleRoot = {
      querySelector: vi.fn((selector: string) =>
        selector.includes('button[title*="Disconnect"]') ? target : null,
      ),
      querySelectorAll: (): ReturnType<typeof button>[] => [],
    };
    expect(executeVoiceControl(accessibleRoot, "disconnect")).toBe(
      "clicked:accessible-label",
    );
    expect(target.click).toHaveBeenCalledOnce();
    expect(accessibleRoot.querySelector).toHaveBeenCalledWith(
      expect.stringContaining('button[title*="Disconnect"]'),
    );
  });
});
