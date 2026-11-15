export interface LearnVerifiedExample {
  id: string;
  language: { funcs: Record<string, number>; preds: Record<string, number> };
  interpretation: {
    domain: string[];
    funcs: Record<string, { args: string[]; value: string }[]>;
    rels: Record<string, string[][]>;
  };
  input: string;
  env: Record<string, string>;
  expectedValue: boolean | null;
  expectedWitness?: { variable: string; value: string };
  expectedCounterexample?: { variable: string; value: string };
  expectErrors?: boolean;
}

export interface LearnLesson {
  id: string;
  tabLabel: string;
  kicker: string;
  title: string;
  lead: string;
  paragraphs: string[];
  exampleLabel: string;
  exampleCode: string;
  exampleSummary: string;
  whereText: string;
  actionButton:
    | { kind: "example"; exampleId: string; label: string }
    | { kind: "phase"; phase: "language" | "interpretation" | "formula" | "evaluation"; label: string };
  historyLink?: { hash: string; label: string };
}

export const LEARN_LESSONS: LearnLesson[] = [
  {
    id: "start",
    tabLabel: "Inicio (5 pasos)",
    kicker: "GUÍA RÁPIDA · 01",
    title: "Tu primera evaluación en 5 pasos",
    lead: "Este programa evalúa si una fórmula de lógica de primer orden es verdadera o falsa sobre un modelo finito que tú construyes.",
    paragraphs: [
      "1) Declara símbolos en Lenguaje (o deja vacío si solo usas =). 2) Agrega al menos un elemento al dominio D y llena todas las tablas en Interpretación.",
      "3) Escribe la fórmula en Fórmula y asigna cualquier variable libre en D. 4) Pulsa Evaluar fórmula en Evaluación. 5) Lee el valor de verdad junto con su testigo, contraejemplo o árbol paso a paso."
    ],
    exampleLabel: "Ejemplo mínimo",
    exampleCode: "∀x P(x) con D = {a, b} y P = {a, b}",
    exampleSummary: "Verdadero tras comprobar todos los elementos del dominio (a y b).",
    whereText: "Puedes recorrer las 4 fases a mano o cargar un caso listo para ver todas las piezas conectadas.",
    actionButton: { kind: "example", exampleId: "universal-verdadero", label: "Hacerlo con un ejemplo →" }
  },
  {
    id: "language",
    tabLabel: "1. Lenguaje",
    kicker: "FASE 01 · LENGUAJE",
    title: "Símbolos funcionales, constantes y predicados",
    lead: "Antes de escribir una fórmula, declaras qué nombres existen y cuántos argumentos recibe cada uno (su aridad).",
    paragraphs: [
      "Una constante se declara como función de aridad 0 (por ejemplo c). Una función de aridad n ≥ 1 toma n elementos de D y devuelve un elemento de D. Un predicado de aridad n ≥ 1 toma n elementos y expresa una propiedad o relación.",
      "Los nombres admiten letras, números y _ empezando por letra o _, pero no pueden coincidir con forall o exists ni repetirse entre funciones y predicados."
    ],
    exampleLabel: "Ejemplo mínimo",
    exampleCode: "c (función aridad 0), f (función aridad 1), P (predicado aridad 1)",
    exampleSummary: "Permite escribir fórmulas como P(f(c)).",
    whereText: "En Fase 01 / Lenguaje usas + Agregar función, + Agregar predicado y Limpiar todo.",
    actionButton: { kind: "phase", phase: "language", label: "Ir a 01 Lenguaje →" }
  },
  {
    id: "interpretation",
    tabLabel: "2. Interpretación",
    kicker: "FASE 02 · INTERPRETACIÓN",
    title: "Dominio finito, funciones totales y relaciones no vacías",
    lead: "La interpretación fija el universo de objetos (dominio D) y asigna significado concreto a cada símbolo declarado.",
    paragraphs: [
      "El dominio D debe ser finito y no vacío (hasta 100 elementos). Toda función n-aria debe ser total: asignar una salida en D para cada una de las |D|^n combinaciones posibles.",
      "Toda relación P^I ⊆ D^n debe tener al menos una tupla marcada (no se admiten relaciones vacías) y cada tabla soporta como máximo 10 000 filas."
    ],
    exampleLabel: "Ejemplo mínimo",
    exampleCode: "D = {1, 2}, P = {(1), (2)} o P = {(1)}",
    exampleSummary: "Si dejas P sin ninguna tupla marcada o falta una fila de función, el motor bloquea la evaluación.",
    whereText: "En Fase 02 / Interpretación agregas chips al dominio, marcas las tablas o generas un modelo aleatorio.",
    actionButton: { kind: "phase", phase: "interpretation", label: "Ir a 02 Interpretación →" }
  },
  {
    id: "formula",
    tabLabel: "3. Fórmulas y entorno",
    kicker: "FASE 03 · FÓRMULA",
    title: "Conectivos, alcance fuerte, igualdad y variables libres",
    lead: "Puedes escribir con los botones gráficos o con teclado usando símbolos Unicode o aliases ASCII (~, !, &, /\\, |, \\/, ->, =>, <->, <=>, forall, exists).",
    paragraphs: [
      "La precedencia de menor a mayor es ↔, → (asociativa a la derecha), ∨, ∧, y ¬/∀/∃. Los cuantificadores tienen alcance fuerte: ∀x P(x) → Q(x) significa (∀x P(x)) → Q(x); para cuantificar toda la implicación usa paréntesis: ∀x (P(x) → Q(x)).",
      "La igualdad = funciona sin declarar predicados (ej. x = y). Toda variable no ligada por ∀ o ∃ es una variable libre y requiere un selector de entorno fijado en D."
    ],
    exampleLabel: "Ejemplo mínimo",
    exampleCode: "P(x) con D = {a, b}, P = {(a)} y entorno x = a",
    exampleSummary: "Verdadero con x = a; Falso si cambias el entorno a x = b.",
    whereText: "En Fase 03 / Fórmula escribes en el editor, usas los botones de símbolos y asignas cada variable libre en D.",
    actionButton: { kind: "phase", phase: "formula", label: "Ir a 03 Fórmula →" }
  },
  {
    id: "result",
    tabLabel: "4. Resultado y árbol",
    kicker: "FASE 04 · EVALUACIÓN",
    title: "Verdadero, Falso, testigos, contraejemplos y errores",
    lead: "Al pulsar Evaluar fórmula, el motor valida todas las entradas y muestra el valor de verdad con su justificación exacta.",
    paragraphs: [
      "Un existencial verdadero (∃x P(x)) muestra un testigo; un universal falso (∀x P(x)) muestra un contraejemplo. Un universal verdadero o un existencial falso muestran comprobación completa sobre todo D.",
      "El árbol paso a paso recorta la vista visual en 2000 nodos y la evaluación tiene un tope de 100 000 pasos. Si hay algún error de sintaxis, tabla o entorno, el motor nunca emite valor de verdad."
    ],
    exampleLabel: "Ejemplo mínimo",
    exampleCode: "∃x P(x) con D = {1, 2}, P = {(2)}",
    exampleSummary: "Verdadero con testigo x = 2; ∀x P(x) sobre el mismo modelo es Falso con contraejemplo x = 1.",
    whereText: "En Fase 04 / Evaluación revisas requisitos pendientes, evalúas y recorres el árbol nodo por nodo.",
    actionButton: { kind: "phase", phase: "evaluation", label: "Ir a 04 Evaluación →" }
  },
  {
    id: "search_export",
    tabLabel: "5. Buscador y PDF",
    kicker: "FASE 04 · EXTRA Y EXPORTACIÓN",
    title: "Buscador de modelos, Ejemplos y exportación a PDF / .tex",
    lead: "El buscador enumera interpretaciones finitas de tamaño 1 hasta N (máximo 100) para hallar un modelo que satisfaga tu fórmula y un contramodelo que la falsee.",
    paragraphs: [
      "La búsqueda está acotada a 2000 interpretaciones, 5000 evaluaciones y 128 entradas por tabla. Que reporte «ninguno hasta tamaño N» NO demuestra validez universal: una fórmula puede fallar en dominios mayores o infinitos.",
      "Los Ejemplos cargan casos listos para estudiar. La exportación compila PDF con LaTeX en el servidor o Docker; en GitHub Pages (WebAssembly) descarga el archivo .tex."
    ],
    exampleLabel: "Ejemplo mínimo",
    exampleCode: "∀x P(x) en el buscador con N = 2",
    exampleSummary: "Encuentra modelo en tamaño 1 (D = {d0}, P = {(d0)}) y contramodelo en tamaño 2 (D = {d0, d1}, P = {(d1)}).",
    whereText: "En Fase 04 / Evaluación, debajo del resultado, está el bloque Buscar modelo y contramodelo y el botón de exportación.",
    actionButton: { kind: "phase", phase: "evaluation", label: "Ir a 04 Evaluación →" },
    historyLink: { hash: "#historia/8", label: "Para la historia y los teoremas de Gödel, ve a Historia →" }
  }
];

export const LEARN_VERIFIED_EXAMPLES: Record<string, LearnVerifiedExample> = {
  closed_forall_true: {
    id: "closed_forall_true",
    language: { funcs: {}, preds: { P: 1 } },
    interpretation: { domain: ["a", "b"], funcs: {}, rels: { P: [["a"], ["b"]] } },
    input: "∀x P(x)",
    env: {},
    expectedValue: true
  },
  closed_exists_witness: {
    id: "closed_exists_witness",
    language: { funcs: {}, preds: { P: 1 } },
    interpretation: { domain: ["1", "2"], funcs: {}, rels: { P: [["2"]] } },
    input: "∃x P(x)",
    env: {},
    expectedValue: true,
    expectedWitness: { variable: "x", value: "2" }
  },
  closed_forall_counterexample: {
    id: "closed_forall_counterexample",
    language: { funcs: {}, preds: { P: 1 } },
    interpretation: { domain: ["1", "2"], funcs: {}, rels: { P: [["2"]] } },
    input: "∀x P(x)",
    env: {},
    expectedValue: false,
    expectedCounterexample: { variable: "x", value: "1" }
  },
  open_with_env_true: {
    id: "open_with_env_true",
    language: { funcs: {}, preds: { P: 1 } },
    interpretation: { domain: ["a", "b"], funcs: {}, rels: { P: [["a"]] } },
    input: "P(x)",
    env: { x: "a" },
    expectedValue: true
  },
  open_with_env_false: {
    id: "open_with_env_false",
    language: { funcs: {}, preds: { P: 1 } },
    interpretation: { domain: ["a", "b"], funcs: {}, rels: { P: [["a"]] } },
    input: "P(x)",
    env: { x: "b" },
    expectedValue: false
  },
  invalid_empty_rel_no_truth: {
    id: "invalid_empty_rel_no_truth",
    language: { funcs: {}, preds: { P: 1 } },
    interpretation: { domain: ["a"], funcs: {}, rels: { P: [] } },
    input: "∀x P(x)",
    env: {},
    expectedValue: null,
    expectErrors: true
  }
};
