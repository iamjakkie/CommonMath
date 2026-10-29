import "mathlive/fonts.css";
import { CommonMathElement } from "./element/common-math";

export type {
  CalculationOutcome,
  CommonMathChangeDetail,
  CommonMathErrorDetail,
  CommonMathResultDetail,
  OutcomeStatus,
  ThemeName,
} from "./types/public";

/** Register the `<common-math>` element. Importing this module also registers it. */
export function defineCommonMath(): void {
  if (!customElements.get("common-math")) {
    customElements.define("common-math", CommonMathElement);
  }
}

defineCommonMath();

export { CommonMathElement };
