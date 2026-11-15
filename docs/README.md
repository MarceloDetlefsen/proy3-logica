# Documentación de estudio — Evaluador semántico

**Propósito:** Índice central de la documentación técnica y de estudio del proyecto `proy3-logica`, con un orden de lectura recomendado para dominar la arquitectura, la lógica formal, la interfaz, el despliegue y la defensa oral.

## Orden de lectura sugerido

1. [**estado-proyecto.md**](estado-proyecto.md) — Auditoría del repositorio, mapa de requisitos del enunciado y hallazgos.
2. [**arquitectura.md**](arquitectura.md) — Flujo completo del sistema (HTTP y WASM), responsabilidades por archivo y contrato Go/TypeScript.
3. [**decisiones.md**](decisiones.md) — Decisiones de diseño, justificaciones y alternativas descartadas.
4. [**parser.md**](parser.md) — Gramática, precedencia, asociatividad, aliases ASCII y resolución de símbolos.
5. [**evaluador.md**](evaluador.md) — Semántica formal de Tarski, correspondencia con el código, códigos de error y ejemplos trabajados a mano.
6. [**explicacion.md**](explicacion.md) — Construcción del árbol de explicación: testigos, contraejemplos, comprobación completa, hijos decisivos y recorte.
7. [**interfaz.md**](interfaz.md) — Módulos de `web/src/`, estado, eventos, capa de transporte HTTP/WASM y accesibilidad.
8. [**api.md**](api.md) — Referencia de endpoints HTTP con ejemplos `curl` reales y códigos de respuesta.
9. [**exportacion-pdf.md**](exportacion-pdf.md) — Generación `.tex`, compilación con `pdflatex`, paquetes TeX y endurecimiento.
10. [**aleatorizacion.md**](aleatorizacion.md) — Generación reproducible de interpretaciones y generación de fórmulas aleatorias.
11. [**creativos.md**](creativos.md) — Inventario de aportes creativos evaluados contra la rúbrica.
12. [**rendimiento.md**](rendimiento.md) — Benchmarks con `testing.B`, resultados medidos y límites observados.
13. [**despliegue.md**](despliegue.md) — Modos local, Docker y GitHub Pages (WASM), workflows de CI/CD y pasos manuales.
14. [**defensa.md**](defensa.md) — Banco de preguntas probables por módulo, guion de demostración de 3 minutos y guía rápida de archivos.

## Documentos de referencia originales

- [**contrato-evaluador.md**](contrato-evaluador.md) — Especificación original del contrato JSON compartido.
- [**ui-checklist.md**](ui-checklist.md) — Lista de verificación manual de la interfaz gráfica.
