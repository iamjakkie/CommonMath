import type { MathfieldElement } from "mathlive";
import { INLINE_ALIASES } from "./templates";

let audioSilenced = false;

export function configureMathfield(field: MathfieldElement): void {
  if (!audioSilenced) {
    audioSilenced = true;
    const elementClass = field.constructor as typeof MathfieldElement;
    elementClass.soundsDirectory = null;
    elementClass.keypressSound = null;
  }
  field.mathVirtualKeyboardPolicy = "manual";
  field.popoverPolicy = "off";
  field.menuItems = [];
  field.smartFence = true;
  field.smartMode = false;
  field.inlineShortcuts = {
    ...field.inlineShortcuts,
    ...INLINE_ALIASES,
  };
  field.keybindings = field.keybindings.filter((binding) => {
    const key = binding.key.toLowerCase();
    if (key.includes("escape") || key.includes("backslash") || key === "\\") return false;
    const command = JSON.stringify(binding.command).toLowerCase();
    return !(command.includes("switchmode") && command.includes("latex"));
  });
}
