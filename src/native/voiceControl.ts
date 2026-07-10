export type VoiceControlAction = "toggleMute" | "toggleDeafen" | "disconnect";

type ButtonLike = {
  textContent: string | null;
  disabled?: boolean;
  click(): void;
};

type RootLike = {
  querySelector?(selector: string): ButtonLike | null;
  querySelectorAll(selector: string): Iterable<ButtonLike>;
};

export function executeVoiceControl(root: RootLike, action: VoiceControlAction): string {
  const accessibleSelectors: Record<VoiceControlAction, string> = {
    toggleMute:
      'button[title*="Mute microphone"], button[title*="Unmute microphone"], button[aria-label*="ute microphone"], [data-tooltip*="ute microphone"]',
    toggleDeafen:
      'button[title*="Deafen"], button[title*="Undeafen"], button[aria-label*="eafen"], [data-tooltip*="eafen"]',
    disconnect:
      'button[title*="Disconnect"], button[title*="Leave"], button[title*="Hang up"], button[aria-label*="isconnect"], button[aria-label*="eave"]',
  };
  const accessibleControl = root.querySelector?.(accessibleSelectors[action]);
  if (accessibleControl && !accessibleControl.disabled) {
    accessibleControl.click();
    return "clicked:accessible-label";
  }

  const symbols: Record<VoiceControlAction, string[]> = {
    toggleMute: ["mic", "mic_off"],
    toggleDeafen: ["headset", "headset_off"],
    disconnect: ["call_end"],
  };

  for (const button of root.querySelectorAll("button")) {
    const symbol = button.textContent?.trim() ?? "";
    if (!button.disabled && symbols[action].includes(symbol)) {
      button.click();
      return `clicked:${symbol}`;
    }
  }
  return "not-found";
}

export function voiceControlScript(action: VoiceControlAction): string {
  return `(${executeVoiceControl.toString()})(document, ${JSON.stringify(action)})`;
}
