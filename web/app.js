import { $$ } from "./state.js";
import { createLanguageUI } from "./language.js";
import { createInterpretationUI } from "./interpretation.js";
import { createFormulaUI } from "./formula.js";
import { createEvaluationUI } from "./evaluation.js";

// Modules share these callbacks so each section can trigger the validation
// work that depends on it without owning another section's implementation.
const actions = {};
const interpretation = createInterpretationUI(actions);
const formula = createFormulaUI(actions);
const evaluation = createEvaluationUI(actions);

Object.assign(actions, {
  renderTables: interpretation.renderTables,
  validateInterpretation: interpretation.validate,
  analyze: formula.analyze,
  updateEvaluate: evaluation.updateButton,
});

createLanguageUI(actions);
interpretation.renderDomain();

$$(".step-link").forEach((link) => {
  link.addEventListener("click", () => {
    $$(".step-link").forEach((item) => {
      item.classList.toggle("active", item === link);
    });
  });
});
