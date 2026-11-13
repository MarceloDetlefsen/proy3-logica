# Lista de verificación de la interfaz

La aplicación sirve desde `web/` y consume la API Go existente. Inicia el
servidor con `go run .` y abre `http://localhost:8080/`. El selector de ejemplos
funciona con la API real y en modo mock (`http://localhost:8080/?mock=1`). Los
ocho fixtures incluyen árboles de explicación del evaluador semántico para el
modo mock.

## Pruebas manuales previas a la entrega

### Lenguaje

1. Agrega una constante con aridad 0 y comprueba que aparece en la lista.
2. Declara una función unaria y otra binaria; revisa sus aridades.
3. Declara un predicado unario y otro binario.
4. Escribe dos símbolos con el mismo nombre y confirma que aparece el error.
5. Escribe un nombre inválido y confirma que el error aparece junto al lenguaje.
6. Elimina una declaración y verifica que desaparece su tabla de interpretación.

### Interpretación

7. Agrega un elemento al dominio con Enter y otro con el botón.
8. Intenta agregar dos veces el mismo elemento y confirma que se rechaza.
9. Intenta agregar un elemento vacío y confirma que no se crea un chip.
10. Intenta agregar un elemento con caracteres inválidos y revisa el error del servidor.
11. Define una constante con una única salida del dominio.
12. Completa la tabla de una función unaria para cada elemento del dominio.
13. Deja una entrada de función sin completar y revisa el error en su fila.
14. Repite una tupla de función y confirma que la tabla la marca como inválida.
15. Define una relación unaria con una tupla válida.
16. Repite una tupla de relación y revisa la advertencia correspondiente.
17. Cambia el dominio y confirma que se conservan los valores que siguen disponibles.
18. Cambia la aridad de una función y confirma que la tabla se reconstruye.

### Fórmula y entorno

19. Inserta cada conectivo desde la barra y confirma que aparece en la posición del cursor.
20. Escribe una fórmula con alias ASCII y confirma que se analiza.
21. Introduce una fórmula sintácticamente inválida y activa el mensaje para seleccionar su rango.
22. Escribe una fórmula abierta con dos variables libres y confirma que aparecen dos selectores.
23. Escribe una fórmula cerrada y confirma que no aparece ningún selector de entorno.
24. Cambia el dominio después de asignar una variable y verifica que se puede elegir un valor vigente.

### Evaluación, mock y accesibilidad

25. Evalúa una fórmula verdadera y una falsa; comprueba que el resultado anterior se marca desactualizado al editar datos.
26. Evalúa un existencial verdadero y revisa el testigo.
27. Evalúa un universal falso y revisa el contraejemplo.
28. Evalúa un universal verdadero y un existencial falso; confirma el conteo completo del dominio.
29. Provoca un error en cada sección y confirma que no aparece ningún valor de verdad.
30. Carga los ocho ejemplos desde `?mock=1`, revisa descripción, resultado y árbol completo.
31. Carga los ocho ejemplos sin `mock=1` y confirma que el motor real devuelve el mismo valor y explicación.
32. Recorre todas las secciones, botones, selectores y árbol usando solo teclado.
33. Comprueba nombres accesibles, regiones de estado y lectura de errores con lector de pantalla.
34. Revisa los temas claro y oscuro a 360 px y en escritorio; confirma que no hay desbordamiento horizontal.
35. Prueba un cuantificador vacuo y otro anidado con la misma variable; confirma que aparecen sus avisos.
36. Introduce nombre inválido, aridad inválida y duplicados; confirma que cada mensaje y campo marcado queda junto a su fila.

## Contrato de la API

La UI consume `/api/language/validate`, `/api/interpretation/validate`,
`/api/analyze` y `/api/evaluate`. Los errores del analizador usan offsets en
runes, igual que las posiciones que devuelve el lexer Go.
