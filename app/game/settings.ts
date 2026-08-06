export type Quality = "low" | "medium" | "high";

export interface GameSettings {
  quality: Quality;
  shadows: boolean;
  bloom: boolean;
  cameraSensitivity: number;
  invertY: boolean;
  gamepadEnabled: boolean;
  deadzone: number;
  vibration: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  quality: "high",
  shadows: true,
  bloom: true,
  cameraSensitivity: 0.75,
  invertY: false,
  gamepadEnabled: true,
  deadzone: 0.18,
  vibration: 0.55,
};

const KEY = "aurora-ascent-settings-v1";

export function loadSettings(): GameSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      quality: ["low", "medium", "high"].includes(raw.quality) ? raw.quality : DEFAULT_SETTINGS.quality,
      shadows: typeof raw.shadows === "boolean" ? raw.shadows : DEFAULT_SETTINGS.shadows,
      bloom: typeof raw.bloom === "boolean" ? raw.bloom : DEFAULT_SETTINGS.bloom,
      cameraSensitivity: clampNumber(raw.cameraSensitivity, .3, 1.5, DEFAULT_SETTINGS.cameraSensitivity),
      invertY: typeof raw.invertY === "boolean" ? raw.invertY : DEFAULT_SETTINGS.invertY,
      gamepadEnabled: typeof raw.gamepadEnabled === "boolean" ? raw.gamepadEnabled : DEFAULT_SETTINGS.gamepadEnabled,
      deadzone: clampNumber(raw.deadzone, .05, .5, DEFAULT_SETTINGS.deadzone),
      vibration: clampNumber(raw.vibration, 0, 1, DEFAULT_SETTINGS.vibration),
    };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(settings: GameSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* sessão ainda funciona */ }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}
