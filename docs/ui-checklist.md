# Lista de verificación de la interfaz

La aplicación web se sirve desde `web/` y utiliza la API Go existente.

## Interacción

- [ ] Declarar constantes (aridad 0), funciones y predicados; comprobar errores de lenguaje.
- [ ] Ingresar un dominio no vacío y completar todas las tablas de funciones y relaciones.
- [ ] Probar fórmulas abiertas y cerradas, alias ASCII y símbolos insertados desde la barra.
- [ ] Verificar asignaciones de todas las variables libres y que no se acepte evaluar mientras falten datos.
- [ ] Revisar resultados verdaderos y falsos, testigos, contraejemplos y cuantificadores totalmente revisados.
- [ ] Confirmar que toda entrada inválida muestra errores y nunca un valor de verdad.

## Accesibilidad y presentación

- [ ] Usar únicamente teclado para navegar, editar, insertar conectivos y desplegar el árbol.
- [ ] Comprobar nombres accesibles de controles, regiones de estado y mensajes de error.
- [ ] Revisar los cuatro pasos en vista clara y oscura del navegador, a 360 px y escritorio.
- [ ] Confirmar que el editor admite edición de teclado y que los errores llevan el cursor al rango afectado.

## Contrato de la API

La UI consume `/api/language/validate`, `/api/interpretation/validate`, `/api/analyze` y `/api/evaluate`. Los errores del analizador tienen offsets en runes, igual que las posiciones devueltas por el lexer Go.
