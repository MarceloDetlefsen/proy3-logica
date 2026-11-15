export interface HistoryPreset {
  id: string;
  title: string;
  description: string;
  language: { funcs: Record<string, number>; preds: Record<string, number> };
  interpretation: {
    domain: string[];
    funcs: Record<string, { args: string[]; value: string }[]>;
    rels: Record<string, string[][]>;
  };
  input: string;
  env: Record<string, string>;
  searchLimit?: number;
}

export const HISTORY_PRESETS: Record<string, HistoryPreset> = {
  syllogism: {
    id: "syllogism",
    title: "Silogismo de Aristóteles / Frege",
    description: "Todo humano es mortal y Sócrates es humano; luego Sócrates es mortal.",
    language: { funcs: { s: 0 }, preds: { H: 1, M: 1 } },
    interpretation: {
      domain: ["socrates", "platon"],
      funcs: { s: [{ args: [], value: "socrates" }] },
      rels: {
        H: [["socrates"], ["platon"]],
        M: [["socrates"], ["platon"]]
      }
    },
    input: "(∀x (H(x) → M(x)) ∧ H(s)) → M(s)",
    env: {}
  },
  barber: {
    id: "barber",
    title: "Paradoja del barbero (Russell)",
    description: "Contradicción lógica: ningún dominio finito puede satisfacerla.",
    language: { funcs: {}, preds: { Afeita: 2 } },
    interpretation: {
      domain: ["a", "b"],
      funcs: {},
      rels: { Afeita: [["a", "b"]] }
    },
    input: "∃b ∀x (Afeita(b,x) ↔ ¬Afeita(x,x))",
    env: {},
    searchLimit: 2
  },
  infinite_order: {
    id: "infinite_order",
    title: "Orden estricto sin máximo (requiere infinito)",
    description: "Todo elemento tiene uno mayor, sin ciclos ni saltos no transitivos: imposible en dominios finitos.",
    language: { funcs: {}, preds: { Menor: 2 } },
    interpretation: {
      domain: ["1", "2"],
      funcs: {},
      rels: { Menor: [["1", "2"]] }
    },
    input: "∀x ∃y Menor(x,y) ∧ ∀x ¬Menor(x,x) ∧ ∀x ∀y ∀z (Menor(x,y) ∧ Menor(y,z) → Menor(x,z))",
    env: {},
    searchLimit: 2
  }
};

export const GODEL_ALPHABET: Record<string, number> = {
  "0": 1,
  "S": 2,
  "+": 3,
  "=": 4,
  "(": 5,
  ")": 6,
  "¬": 7,
  "∧": 8,
  "∀": 9,
  "∃": 10,
  "x": 11,
  "y": 12
};

const CODE_TO_SYMBOL: Record<number, string> = Object.fromEntries(
  Object.entries(GODEL_ALPHABET).map(([sym, code]) => [code, sym])
);

const SMALL_PRIMES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n, 53n];

export function nextPrimeAfter(n: bigint): bigint {
  let candidate = n + 1n;
  while (true) {
    let isPrime = candidate >= 2n;
    for (let d = 2n; d * d <= candidate; d++) {
      if (candidate % d === 0n) {
        isPrime = false;
        break;
      }
    }
    if (isPrime) return candidate;
    candidate++;
  }
}

export function primeAt(index: number): bigint {
  if (index < SMALL_PRIMES.length) return SMALL_PRIMES[index];
  let p = SMALL_PRIMES[SMALL_PRIMES.length - 1];
  for (let i = SMALL_PRIMES.length; i <= index; i++) {
    p = nextPrimeAfter(p);
  }
  return p;
}

export interface GodelEncoding {
  number: bigint;
  codes: number[];
  factors: { prime: bigint; exp: number }[];
}

export function encodeGodel(formula: string): GodelEncoding {
  const cleaned = formula.replace(/\s+/g, "");
  const chars = [...cleaned];
  if (chars.length === 0) {
    throw new Error("La fórmula no puede estar vacía.");
  }
  if (chars.length > 10) {
    throw new Error("Usa como máximo 10 símbolos para mantener manejable el número de Gödel.");
  }
  const codes: number[] = [];
  const factors: { prime: bigint; exp: number }[] = [];
  let total = 1n;
  for (let i = 0; i < chars.length; i++) {
    const code = GODEL_ALPHABET[chars[i]];
    if (!code) {
      throw new Error(`Símbolo no soportado en la tabla de Gödel: "${chars[i]}".`);
    }
    const prime = primeAt(i);
    codes.push(code);
    factors.push({ prime, exp: code });
    total *= prime ** BigInt(code);
  }
  return { number: total, codes, factors };
}

export function decodeGodel(value: bigint): { formula: string; codes: number[] } {
  if (value <= 1n) {
    throw new Error("El número de Gödel debe ser un entero mayor que 1.");
  }
  let remaining = value;
  const codes: number[] = [];
  const symbols: string[] = [];
  let idx = 0;
  while (remaining > 1n) {
    const prime = primeAt(idx);
    let exp = 0;
    while (remaining % prime === 0n) {
      remaining /= prime;
      exp++;
    }
    if (exp === 0) {
      throw new Error(`Falta el factor primo ${prime} en la codificación posicional.`);
    }
    const sym = CODE_TO_SYMBOL[exp];
    if (!sym) {
      throw new Error(`Exponente ${exp} fuera del alfabeto de Gödel (1–12).`);
    }
    codes.push(exp);
    symbols.push(sym);
    idx++;
  }
  return { formula: symbols.join(""), codes };
}

export function cantorDiagonalStep(rows: string[], revealedCount: number): {
  diagonal: string[];
  flipped: string[];
} {
  const count = Math.max(0, Math.min(rows.length, revealedCount));
  const diagonal: string[] = [];
  const flipped: string[] = [];
  for (let i = 0; i < count; i++) {
    const bit = rows[i]?.[i] === "1" ? "1" : "0";
    diagonal.push(bit);
    flipped.push(bit === "1" ? "0" : "1");
  }
  return { diagonal, flipped };
}

export interface TuringState {
  tape: string[];
  head: number;
  state: "SCAN_PLUS" | "SEEK_END" | "ERASE_LAST" | "HALT";
  steps: number;
}

export function createUnaryAdditionMachine(a: number, b: number): TuringState {
  const left = Array.from({ length: Math.max(1, a) }, () => "1");
  const right = Array.from({ length: Math.max(1, b) }, () => "1");
  return {
    tape: [...left, "+", ...right, "_"],
    head: 0,
    state: "SCAN_PLUS",
    steps: 0
  };
}

export function stepTuringMachine(current: TuringState): TuringState {
  if (current.state === "HALT") return current;
  const tape = [...current.tape];
  const sym = tape[current.head] ?? "_";
  let head = current.head;
  let state: TuringState["state"] = current.state;

  if (current.state === "SCAN_PLUS") {
    if (sym === "1") {
      head++;
    } else if (sym === "+") {
      tape[head] = "1";
      head++;
      state = "SEEK_END";
    } else {
      state = "HALT";
    }
  } else if (current.state === "SEEK_END") {
    if (sym === "1") {
      head++;
    } else {
      head = Math.max(0, head - 1);
      state = "ERASE_LAST";
    }
  } else if (current.state === "ERASE_LAST") {
    if (sym === "1") {
      tape[head] = "_";
    }
    state = "HALT";
  }

  return { tape, head, state, steps: current.steps + 1 };
}

export function triangleAngleSum(geometry: "euclid" | "spherical" | "hyperbolic", curvature = 24): number {
  const delta = Math.max(0, Math.min(60, Math.abs(curvature)));
  if (geometry === "spherical") return 180 + delta;
  if (geometry === "hyperbolic") return 180 - delta;
  return 180;
}
