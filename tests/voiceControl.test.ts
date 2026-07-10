import { describe, expect, it, vi } from "vitest";

import { executeVoiceControl } from "../src/native/voiceControl";

function button(symbol: string) {
  return { textContent: symbol, click: vi.fn(), disabled: false };
}

function root(...buttons: ReturnType<typeof button>[]) {
  return { querySelectorAll: () => buttons };
}

describe("voice control contract", () => {
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
      querySelector: vi.fn(() => target),
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
