export interface HistoryQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface HistoryPortrait {
  src: string;
  alt: string;
  caption: string;
  credit: string;
}

export interface HistoryChapter {
  id: string;
  number: string;
  year: string;
  title: string;
  subtitle: string;
  portraits: HistoryPortrait[];
  visualKind?: "glider";
  narrative: string[];
  keyIdea: string;
  example: string;
  projectConnection: string;
  sources: string[];
  demoKind: "euclid" | "noneuclid" | "cantor" | "syllogism" | "russell" | "hilbert" | "tarski" | "godel" | "turing" | "church" | "legacy";
  quiz: [HistoryQuizQuestion, HistoryQuizQuestion];
}

export const HISTORY_CHAPTERS: HistoryChapter[] = [
  {
    id: "euclides",
    number: "01",
    year: "~300 a. C.",
    title: "Euclides y el ideal axiomático",
    subtitle: "De definiciones mínimas a teoremas seguros",
    portraits: [
      {
        src: "assets/historia/euclides.jpg",
        alt: "Retrato pictórico de Euclides sosteniendo escritos geométricos",
        caption: "Euclides de Alejandría (~300 a. C.)",
        credit: "Jusepe de Ribera · Wikimedia Commons (Dominio público)"
      }
    ],
    narrative: [
      "En Los Elementos, Euclides organizó la geometría a partir de definiciones, nociones comunes y cinco postulados explícitos. En lugar de acumular hechos sueltos, mostró cómo deducir cientos de proposiciones mediante reglas claras.",
      "Ese método inauguró una meta que dominaría las matemáticas durante más de dos milenios: elegir pocos axiomas evidentes y derivar toda la verdad de un dominio sin dejar pasos ocultos. Sin embargo, el quinto postulado (sobre rectas paralelas) parecía mucho menos obvio que los otros cuatro."
    ],
    keyIdea: "Un sistema axiomático separa lo que se acepta de partida (axiomas) de lo que se justifica paso a paso (teoremas).",
    example: "Si la suma de los ángulos internos de un triángulo plano siempre da 180°, ese resultado depende de aceptar el quinto postulado.",
    projectConnection: "Tu lista de símbolos en Lenguaje y tus fórmulas forman el punto de partida explícito antes de evaluar cualquier afirmación.",
    sources: [
      "MacTutor History of Mathematics: Euclid of Alexandria",
      "Stanford Encyclopedia of Philosophy: Euclid's Elements"
    ],
    demoKind: "euclid",
    quiz: [
      {
        question: "¿Qué papel cumplen los postulados en Los Elementos de Euclides?",
        options: [
          "Son suposiciones explícitas desde las que se deducen teoremas",
          "Son mediciones experimentales tomadas con regla",
          "Son fórmulas que no pueden negarse sin contradicción lógica"
        ],
        correctIndex: 0,
        explanation: "Los postulados fijan las reglas básicas de partida para deducir teoremas."
      },
      {
        question: "¿Por qué generó dudas el quinto postulado?",
        options: [
          "Porque hablaba de números complejos",
          "Porque era menos evidente que los cuatro primeros y muchos intentaron deducirlo de ellos",
          "Porque contradecía la aritmética de Peano"
        ],
        correctIndex: 1,
        explanation: "Durante siglos se intentó probar el quinto postulado a partir de los otros cuatro."
      }
    ]
  },
  {
    id: "no-euclideana",
    number: "02",
    year: "1820–1829",
    title: "Geometrías no euclideanas",
    subtitle: "Cambiar un axioma cambia el universo",
    portraits: [
      {
        src: "assets/historia/gauss.jpg",
        alt: "Retrato de Carl Friedrich Gauss",
        caption: "Carl Friedrich Gauss (1777–1855)",
        credit: "C. A. Jensen · Wikimedia Commons (Dominio público)"
      },
      {
        src: "assets/historia/lobachevsky.jpg",
        alt: "Retrato de Nikolai Lobachevsky",
        caption: "Nikolai Lobachevsky (1792–1856)",
        credit: "Lev Kryukov · Wikimedia Commons (Dominio público)"
      }
    ],
    narrative: [
      "Durante siglos, matemáticos intentaron demostrar el quinto postulado por reducción al absurdo: suponían que no se cumplía esperando hallar una contradicción. En las décadas de 1820, Gauss (en privado), Lobachevsky (1829) y Bolyai (1832) descubrieron lo inesperado: no aparecía contradicción alguna.",
      "Al permitir más de una paralela por un punto exterior (geometría hiperbólica) o ninguna (esférica), surgían mundos geométricos coherentes. La verdad de un enunciado dejó de ser absoluta: dependía del modelo elegido."
    ],
    keyIdea: "Una misma fórmula puede ser verdadera en una interpretación y falsa en otra igualmente consistente.",
    example: "En un plano euclideano los ángulos de un triángulo suman 180°; sobre una esfera suman más de 180° y en un plano hiperbólico suman menos.",
    projectConnection: "El buscador de modelos del proyecto hace visible esta idea: busca un modelo donde tu fórmula sea verdadera y otro donde sea falsa.",
    sources: [
      "MacTutor History of Mathematics: Non-Euclidean geometry",
      "Stanford Encyclopedia of Philosophy: Nineteenth Century Geometry"
    ],
    demoKind: "noneuclid",
    quiz: [
      {
        question: "¿Qué demostraron Lobachevsky, Bolyai y Gauss al negar el quinto postulado?",
        options: [
          "Que las matemáticas eran inconsistentes",
          "Que existen geometrías coherentes distintas a la euclideana",
          "Que los triángulos siempre suman exactamente 180°"
        ],
        correctIndex: 1,
        explanation: "Negar el quinto postulado produce geometrías consistentes con otras propiedades."
      },
      {
        question: "¿Cómo se relaciona esto con una interpretación en lógica?",
        options: [
          "La verdad depende de la estructura o modelo que interpreta los símbolos",
          "Cada fórmula tiene un único valor fijo sin importar el dominio",
          "Solo existen modelos infinitos"
        ],
        correctIndex: 0,
        explanation: "Cambiar la interpretación cambia el valor de verdad de las mismas fórmulas."
      }
    ]
  },
  {
    id: "cantor",
    number: "03",
    year: "1874–1891",
    title: "Cantor y los tamaños del infinito",
    subtitle: "Cuando diagonalizar rompe cualquier lista",
    portraits: [
      {
        src: "assets/historia/cantor.jpg",
        alt: "Retrato fotográfico de Georg Cantor",
        caption: "Georg Cantor (1845–1918)",
        credit: "Wikimedia Commons (Dominio público)"
      }
    ],
    narrative: [
      "Georg Cantor formalizó la teoría de conjuntos y descubrió que no todos los infinitos tienen el mismo tamaño. Usando correspondencias uno a uno, probó en 1874 que los números racionales pueden emparejarse con los naturales, pero los números reales no.",
      "En 1891 presentó su famoso argumento diagonal: dada cualquier lista infinita de secuencias binarias, basta cambiar el dígito i-ésimo de la fila i para construir una secuencia nueva que no aparece en ninguna posición de la lista. Ese truco de autorreferencia reaparecería en Gödel y Turing."
    ],
    keyIdea: "La diagonalización construye un objeto nuevo garantizado para diferir de cada elemento de una lista dada.",
    example: "Si la fila 1 empieza con 0, la fila 2 tiene 1 en la columna 2 y la fila 3 tiene 0 en la columna 3, la diagonal invertida comienza 1, 0, 1 y no coincide con ninguna fila.",
    projectConnection: "Nuestro evaluador solo trabaja sobre dominios finitos |D| ≤ 100, evitando las paradojas y saltos cardinales de los conjuntos infinitos.",
    sources: [
      "Stanford Encyclopedia of Philosophy: The Early Development of Set Theory",
      "MacTutor History of Mathematics: Georg Cantor"
    ],
    demoKind: "cantor",
    quiz: [
      {
        question: "¿Qué demuestra el argumento diagonal de Cantor?",
        options: [
          "Que hay infinitos estrictamente mayores que el de los naturales",
          "Que todos los conjuntos infinitos tienen el mismo tamaño",
          "Que los números racionales no pueden listarse"
        ],
        correctIndex: 0,
        explanation: "Prueba que ninguna lista numerable puede contener todas las secuencias infinitas o los reales."
      },
      {
        question: "¿Cómo garantiza la secuencia diagonal no estar en la lista?",
        options: [
          "Es más larga que todas las filas",
          "Difiere de la fila k al menos en la posición k",
          "Usa símbolos fuera del alfabeto"
        ],
        correctIndex: 1,
        explanation: "Al invertir el elemento (k, k), es imposible que sea igual a la fila k."
      }
    ]
  },
  {
    id: "frege",
    number: "04",
    year: "1879–1903",
    title: "Frege y el lenguaje formal",
    subtitle: "Separar la forma lógica de la ambigüedad",
    portraits: [
      {
        src: "assets/historia/frege.jpg",
        alt: "Retrato de Gottlob Frege",
        caption: "Gottlob Frege (1848–1925)",
        credit: "Wikimedia Commons (Dominio público)"
      }
    ],
    narrative: [
      "En su Conceptografía (Begriffsschrift, 1879), Gottlob Frege diseñó por primera vez una notación capaz de expresar cuantificadores y predicados de múltiples argumentos con precisión mecánica. Su meta era el logicismo: reducir toda la aritmética a leyes lógicas puras.",
      "Antes de Frege, el lenguaje natural ocultaba diferencias clave entre 'todo', 'alguno' y sus alcances. Con cuantificadores explícitos, comprobar si un paso deductivo es válido dejó de depender de intuiciones verbales."
    ],
    keyIdea: "La lógica de primer orden separa claramente objetos, funciones, predicados y alcance de cuantificadores.",
    example: "El silogismo 'Todo humano es mortal; Sócrates es humano; luego Sócrates es mortal' se escribe ∀x (H(x) → M(x)) ∧ H(s) → M(s).",
    projectConnection: "El parser de este proyecto sigue directamente la tradición de Frege al distinguir términos, predicados, variables libres y alcance fuerte.",
    sources: [
      "Stanford Encyclopedia of Philosophy: Gottlob Frege",
      "Stanford Encyclopedia of Philosophy: Frege's Theorem and Foundations for Arithmetic"
    ],
    demoKind: "syllogism",
    quiz: [
      {
        question: "¿Qué aportó la Begriffsschrift (1879) de Frege?",
        options: [
          "El primer cálculo formal moderno con cuantificadores y predicados",
          "La primera computadora electrónica",
          "La geometría hiperbólica"
        ],
        correctIndex: 0,
        explanation: "Frege unificó la lógica proposicional con cuantificadores y relaciones."
      },
      {
        question: "¿Por qué importa el alcance fuerte en ∀x H(x) → M(x)?",
        options: [
          "No importa, significa lo mismo con o sin paréntesis",
          "Sin paréntesis liga solo H(x); para cuantificar toda la implicación se escribe ∀x (H(x) → M(x))",
          "Porque ∀x siempre liga hasta el final del archivo"
        ],
        correctIndex: 1,
        explanation: "El alcance fuerte restringe ∀x a la subfórmula inmediata."
      }
    ]
  },
  {
    id: "russell",
    number: "05",
    year: "1901–1913",
    title: "La paradoja de Russell",
    subtitle: "La grieta en la teoría ingenua de conjuntos",
    portraits: [
      {
        src: "assets/historia/russell.jpg",
        alt: "Retrato fotográfico de Bertrand Russell",
        caption: "Bertrand Russell (1872–1970)",
        credit: "Bassano Ltd · Wikimedia Commons (Dominio público)"
      }
    ],
    narrative: [
      "En 1901, justo cuando Frege terminaba el segundo volumen de sus Leyes Fundamentales de la Aritmética, Bertrand Russell le escribió una carta devastadora. Si cualquier propiedad define un conjunto, consideremos R: el conjunto de todos los conjuntos que no se pertenecen a sí mismos.",
      "¿Pertenece R a R? Si sí, entonces por definición no debe pertenecer; si no, entonces cumple la condición y debe pertenecer. Junto con Whitehead, Russell publicó Principia Mathematica (1910–1913) intentando reconstruir la matemática sin esa contradicción."
    ],
    keyIdea: "La autorreferencia sin restricciones convierte una regla aparentemente natural en una contradicción (P ↔ ¬P).",
    example: "En la versión del barbero: 'Existe un barbero b que afeita exactamente a quienes no se afeitan a sí mismos' — ∃b ∀x (Afeita(b, x) ↔ ¬Afeita(x, x)).",
    projectConnection: "Puedes lanzar esa fórmula exacta en el buscador de modelos y verificar que no existe ninguna interpretación finita que la satisfaga.",
    sources: [
      "Stanford Encyclopedia of Philosophy: Russell's Paradox",
      "Stanford Encyclopedia of Philosophy: Principia Mathematica"
    ],
    demoKind: "russell",
    quiz: [
      {
        question: "¿Qué ocurre al preguntar si el barbero b se afeita a sí mismo en ∃b ∀x (Afeita(b,x) ↔ ¬Afeita(x,x))?",
        options: [
          "Se afeita si y solo si no se afeita: es una contradicción",
          "Siempre es verdadero en dominios de tamaño 2",
          "Solo falla cuando el dominio tiene 1 elemento"
        ],
        correctIndex: 0,
        explanation: "Al instanciar x = b obtenemos Afeita(b, b) ↔ ¬Afeita(b, b), imposible en cualquier dominio."
      },
      {
        question: "¿Qué efecto tuvo la paradoja de Russell sobre el proyecto de Frege?",
        options: [
          "Confirmó la Ley Básica V sin cambios",
          "Mostró que permitir conjuntos definidos sin restricción llevaba a contradicción",
          "Eliminó el uso de variables en lógica"
        ],
        correctIndex: 1,
        explanation: "La Ley Básica V de Frege permitía la comprensión irrestricta y resultó inconsistente."
      }
    ]
  },
  {
    id: "hilbert",
    number: "06",
    year: "1900–1928",
    title: "El programa de Hilbert",
    subtitle: "El sueño de una matemática completa, consistente y decidible",
    portraits: [
      {
        src: "assets/historia/hilbert.jpg",
        alt: "Retrato fotográfico de David Hilbert",
        caption: "David Hilbert (1862–1943)",
        credit: "Wikimedia Commons (Dominio público)"
      }
    ],
    narrative: [
      "Para rescatar las matemáticas tras las paradojas, David Hilbert propuso en la década de 1920 un ambicioso programa formalista. Buscaba demostrar, usando métodos finitistas seguros, tres propiedades ideales para un sistema formal de las matemáticas:",
      "1) Completitud: toda afirmación verdadera puede demostrarse. 2) Consistencia: nunca se podrá deducir una contradicción como 0 = 1. 3) Decidibilidad (Entscheidungsproblem): debe existir un algoritmo mecánico que decida en tiempo finito si cualquier fórmula es demostrable o válida."
    ],
    keyIdea: "Hilbert formuló tres metas precisas —completitud, consistencia y decidibilidad— que pusieron a prueba los límites de la razón formal.",
    example: "Un sistema es consistente si no existe ninguna fórmula φ tal que se demuestren tanto φ como ¬φ.",
    projectConnection: "El evaluador implementa un procedimiento mecánico de decisión, pero solo para un problema mucho más acotado: una interpretación finita fija.",
    sources: [
      "Stanford Encyclopedia of Philosophy: Hilbert's Program",
      "MacTutor History of Mathematics: David Hilbert"
    ],
    demoKind: "hilbert",
    quiz: [
      {
        question: "¿Cuáles eran los tres pilares del programa de Hilbert?",
        options: [
          "Completitud, consistencia y decidibilidad",
          "Geometría, álgebra y cálculo",
          "Sintaxis, diseño gráfico y latencia"
        ],
        correctIndex: 0,
        explanation: "Hilbert aspiraba a un sistema completo, libre de contradicciones y mecánicamente decidible."
      },
      {
        question: "¿Qué preguntaba el Entscheidungsproblem?",
        options: [
          "Si existe un algoritmo general para decidir la validez de cualquier fórmula de primer orden",
          "Si todos los triángulos suman 180°",
          "Cómo factorizar números primos rápidamente"
        ],
        correctIndex: 0,
        explanation: "Pedía un procedimiento mecánico universal para decidir fórmulas de primer orden."
      }
    ]
  },
  {
    id: "tarski",
    number: "07",
    year: "1933–1936",
    title: "Tarski y la semántica formal",
    subtitle: "Qué significa que una fórmula sea verdadera en un modelo",
    portraits: [
      {
        src: "assets/historia/tarski.jpg",
        alt: "Retrato fotográfico de Alfred Tarski",
        caption: "Alfred Tarski (1901–1983)",
        credit: "George Bergman · Wikimedia Commons (CC BY-SA 4.0)"
      }
    ],
    narrative: [
      "¿Cómo definir con rigor matemático qué significa 'verdad' sin caer en paradojas como la del mentiroso ('esta frase es falsa')? En los años 1933–1936, Alfred Tarski distinguió entre el lenguaje objeto (las fórmulas) y el metalenguaje (donde hablamos de su verdad).",
      "Tarski definió la verdad recursivamente respecto a una estructura M y una asignación de variables s: un predicado es cierto si la tupla pertenece a su relación; ¬φ es cierta si φ no lo es; y ∀x φ es cierta si φ se cumple para todo elemento del dominio."
    ],
    keyIdea: "La verdad semántica se define de abajo hacia arriba: de términos y átomos hacia conectivos y cuantificadores en una interpretación.",
    example: "Si D = {a, b}, P = {a} y φ = ∃x P(x), la fórmula es verdadera porque al asignar x = a la subfórmula P(a) es verdadera.",
    projectConnection: "Todo internal/logic/evaluate.go es una implementación directa de la definición recursiva de satisfacción de Tarski, nodo por nodo.",
    sources: [
      "Stanford Encyclopedia of Philosophy: Tarski's Truth Definitions",
      "MacTutor History of Mathematics: Alfred Tarski"
    ],
    demoKind: "tarski",
    quiz: [
      {
        question: "¿Cómo evita Tarski la paradoja del mentiroso al definir la verdad?",
        options: [
          "Prohibiendo la negación",
          "Separando el lenguaje objeto del metalenguaje",
          "Limitando las fórmulas a un solo cuantificador"
        ],
        correctIndex: 1,
        explanation: "El predicado de verdad para un lenguaje L se formula en un metalenguaje más rico."
      },
      {
        question: "Según la semántica de Tarski, ¿cuándo es verdadero ∀x φ(x) en un modelo M?",
        options: [
          "Cuando al menos un elemento d del dominio cumple φ(d)",
          "Cuando todo elemento d del dominio D satisface φ(x) bajo x ↦ d",
          "Cuando φ no tiene variables libres"
        ],
        correctIndex: 1,
        explanation: "∀x exige satisfacción para cada elemento d ∈ D."
      }
    ]
  },
  {
    id: "godel",
    number: "08",
    year: "1929–1931",
    title: "Los teoremas de Gödel",
    subtitle: "Completitud en lógica, incompletitud en aritmética",
    portraits: [
      {
        src: "assets/historia/godel.jpg",
        alt: "Retrato fotográfico de Kurt Gödel",
        caption: "Kurt Gödel (1906–1978)",
        credit: "Wikimedia Commons (Dominio público)"
      }
    ],
    narrative: [
      "En 1929 (publicado en 1930), Kurt Gödel demostró el Teorema de Completitud para la lógica de primer orden: toda fórmula válida en todas las estructuras sí tiene demostración formal. Parecía una victoria para Hilbert.",
      "Pero en 1931 dio un giro histórico. Usando numeración de Gödel, codificó fórmulas y pruebas aritméticas como números enteros y construyó una oración G que afirma 'G no es demostrable en el sistema'. Si un sistema formal capaz de expresar aritmética es consistente (ω-consistente en 1931; suavizado a consistencia simple por Rosser en 1936), entonces G es verdadera en los naturales pero indemostrable, y el sistema no puede probar su propia consistencia."
    ],
    keyIdea: "Ningún sistema formal consistente, axiomatizable efectivamente y capaz de expresar la aritmética puede demostrar todas las verdades aritméticas ni su propia consistencia.",
    example: "Codificando cada símbolo con un número y multiplicando potencias de primos (2^c₁ · 3^c₂ · 5^c₃ …), una fórmula entera se convierte en un único entero.",
    projectConnection: "El evaluador decide verdad en modelos finitos dados; no contradice a Gödel porque no pretende axiomatizar ni decidir toda la aritmética.",
    sources: [
      "Stanford Encyclopedia of Philosophy: Kurt Gödel",
      "Stanford Encyclopedia of Philosophy: Gödel's Incompleteness Theorems"
    ],
    demoKind: "godel",
    quiz: [
      {
        question: "¿Qué diferencia hay entre el teorema de Gödel de 1929 y los de 1931?",
        options: [
          "1929 prueba completitud de la lógica de primer orden; 1931 prueba incompletitud de sistemas con aritmética",
          "Ambos dicen exactamente lo contrario sobre el mismo sistema",
          "1931 solo aplica a dominios de 2 elementos"
        ],
        correctIndex: 0,
        explanation: "La lógica de primer orden es completa (1929), pero las teorías aritméticas consistentes son incompletas (1931)."
      },
      {
        question: "¿Para qué sirve la numeración de Gödel?",
        options: [
          "Para acelerar las tablas de verdad en Python",
          "Para codificar símbolos, fórmulas y pruebas como números y permitir que la aritmética hable de sí misma",
          "Para eliminar la necesidad de primos"
        ],
        correctIndex: 1,
        explanation: "Convierte sintaxis y demostrabilidad en propiedades numéricas."
      }
    ]
  },
  {
    id: "turing",
    number: "09",
    year: "1936",
    title: "Turing y los límites de computar",
    subtitle: "Máquinas abstractas y el problema de la parada",
    portraits: [
      {
        src: "assets/historia/turing.jpg",
        alt: "Retrato fotográfico de Alan Turing",
        caption: "Alan Turing (1912–1954)",
        credit: "Elliott & Fry · Wikimedia Commons (Dominio público)"
      }
    ],
    narrative: [
      "Para responder al Entscheidungsproblem de Hilbert había que definir con precisión qué significa 'algoritmo'. En 1936, Alan Turing imaginó una máquina simple: una cinta infinita dividida en celdas, un cabezal que lee y escribe símbolos, y una tabla finita de estados.",
      "Luego aplicó una idea hermana de la diagonalización de Cantor: supongamos una máquina H que decide si cualquier programa se detiene o entra en bucle. Construimos otra máquina que hace justo lo opuesto a lo que H predice cuando se analiza a sí misma. Contradicción: no existe ningún algoritmo general para el problema de la parada, ni para la validez en lógica de primer orden."
    ],
    keyIdea: "El problema de la parada demuestra que existen problemas matemáticos bien definidos que ningún algoritmo podrá resolver jamás.",
    example: "Una máquina simple de 3 estados puede sumar números unarios ('11' + '111' → '11111') moviéndose paso a paso sobre la cinta.",
    projectConnection: "Como la validez general de primer orden es indecidible, el evaluador acota pasos (MaxEvaluationSteps = 100000) y dominios finitos.",
    sources: [
      "Stanford Encyclopedia of Philosophy: Turing Machines",
      "Stanford Encyclopedia of Philosophy: Alan Turing"
    ],
    demoKind: "turing",
    quiz: [
      {
        question: "¿Qué demostró Turing en 1936 sobre el problema de la parada?",
        options: [
          "Que ninguna máquina de Turing puede decidir en general si un programa cualquiera se detendrá",
          "Que todo programa rápido termina en menos de 10 pasos",
          "Que las cintas finitas bastan para cualquier cálculo"
        ],
        correctIndex: 0,
        explanation: "La existencia de un decisor universal de parada produce una contradicción por diagonalización."
      },
      {
        question: "¿Por qué el evaluador del proyecto no viola el teorema de Turing?",
        options: [
          "Porque usa Go en lugar de cálculo lambda",
          "Porque evalúa una interpretación finita concreta con límites de pasos, no validez universal sobre todo dominio",
          "Porque no usa cuantificadores"
        ],
        correctIndex: 1,
        explanation: "Sobre un modelo finito dado el problema sí es decidible."
      }
    ]
  },
  {
    id: "church",
    number: "10",
    year: "1936",
    title: "Alonzo Church y el cálculo lambda",
    subtitle: "Dos caminos distintos, el mismo límite",
    portraits: [
      {
        src: "assets/historia/church.svg",
        alt: "Ilustración conceptual del cálculo lambda con el operador λ y la regla de reducción beta",
        caption: "Alonzo Church (1903–1995)",
        credit: "Ilustración conceptual: cálculo lambda"
      }
    ],
    narrative: [
      "De forma independiente y apenas meses antes que Turing, Alonzo Church publicó en 1936 su propia respuesta negativa al Entscheidungsproblem. En lugar de cintas y cabezales, utilizó el cálculo lambda (λ): un formalismo mínimo basado únicamente en definir funciones anónimas y aplicarlas a argumentos.",
      "Pronto se demostró que las funciones definibles en cálculo lambda coinciden exactamente con las computables por una máquina de Turing (tesis de Church-Turing). Dos modelos de cómputo completamente distintos chocaban contra la misma barrera."
    ],
    keyIdea: "Cualquier definición razonable de algoritmo (máquinas de Turing o cálculo lambda) tiene exactamente el mismo alcance y los mismos límites.",
    example: "La expresión (λx. x + 1) 4 aplica una función anónima al argumento 4 y se reduce a 5 sin necesidad de memoria ni cinta.",
    projectConnection: "El mismo núcleo lógico escrito en Go corre tanto nativo en el servidor como compilado a WebAssembly en el navegador: distintos entornos, idéntica computabilidad.",
    sources: [
      "Stanford Encyclopedia of Philosophy: The Church-Turing Thesis",
      "Stanford Encyclopedia of Philosophy: Alonzo Church"
    ],
    demoKind: "church",
    quiz: [
      {
        question: "¿Qué formalismo creó Alonzo Church para estudiar la computabilidad?",
        options: [
          "El cálculo lambda (λ)",
          "La geometría hiperbólica",
          "Las tablas de verdad de Tarski"
        ],
        correctIndex: 0,
        explanation: "Church representó funciones y cómputo mediante abstracción y aplicación en el cálculo lambda."
      },
      {
        question: "¿Qué afirma la tesis de Church-Turing?",
        options: [
          "Que el cálculo lambda es más rápido que C",
          "Que la noción intuitiva de algoritmo coincide con lo computable por máquinas de Turing o cálculo lambda",
          "Que toda fórmula de primer orden es decidible"
        ],
        correctIndex: 1,
        explanation: "Ambos formalismos caracterizan exactamente la misma clase de funciones computables."
      }
    ]
  },
  {
    id: "legado",
    number: "11",
    year: "1936–hoy",
    title: "El legado en la computación",
    subtitle: "Sistemas simples con comportamiento impredecible",
    portraits: [],
    visualKind: "glider",
    narrative: [
      "Lejos de paralizar las matemáticas, los resultados de Gödel, Church y Turing fundaron las ciencias de la computación. De la máquina universal de Turing nació la idea del programa almacenado en memoria: una sola máquina capaz de ejecutar cualquier algoritmo.",
      "Incluso sistemas con reglas diminutas, como el Juego de la Vida de Conway (1970), pueden simular máquinas de Turing universales; por eso tampoco existe un algoritmo general que prediga si cualquier patrón inicial terminará desapareciendo o crecerá para siempre. Comprender esos límites nos enseña qué podemos automatizar y qué requiere fronteras finitas explícitas."
    ],
    keyIdea: "La indecidibilidad no impide construir herramientas útiles: exige delimitar dominios finitos, presupuestos y contratos honestos.",
    example: "Una fórmula sin contramodelo hasta tamaño N = 3 en nuestro buscador no es automáticamente válida: podría fallar en N = 4 o solo en dominios infinitos.",
    projectConnection: "Por eso este proyecto combina evaluación exacta en modelos finitos, búsqueda acotada con límites explícitos (2000/5000) y transparencia total sobre lo que no prueba.",
    sources: [
      "Stanford Encyclopedia of Philosophy: Computability and Complexity",
      "Veritasium: Math's Fundamental Flaw (referencia temática)"
    ],
    demoKind: "legacy",
    quiz: [
      {
        question: "Si nuestro buscador de modelos no halla contramodelo hasta tamaño N = 4, ¿qué podemos concluir?",
        options: [
          "Que la fórmula es válida en toda interpretación posible",
          "Que no tiene contramodelo en dominios finitos de tamaño ≤ 4 dentro del presupuesto",
          "Que la fórmula es una contradicción"
        ],
        correctIndex: 1,
        explanation: "Una búsqueda finita no demuestra validez universal (teorema de Church-Turing / Trakhtenbrot)."
      },
      {
        question: "¿Por qué sistemas con pocas reglas, como el Juego de la Vida, heredan la indecidibilidad?",
        options: [
          "Porque pueden simular una máquina de Turing universal",
          "Porque usan números irracionales",
          "Porque violan la aritmética finita"
        ],
        correctIndex: 0,
        explanation: "Al ser Turing-completos, predecir su comportamiento a largo plazo equivale al problema de la parada."
      }
    ]
  }
];
