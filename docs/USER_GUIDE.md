# LNAP v2 — Guía de Usuario

> **Lenguaje Natural A Programación**  
> Convierte descripciones en español a código funcional en C#, Lua, Python y C++

---

## Tabla de contenidos

1. [¿Qué es LNAP v2?](#1-qué-es-lnap-v2)
2. [Requisitos previos](#2-requisitos-previos)
3. [Instalación y puesta en marcha](#3-instalación-y-puesta-en-marcha)
4. [Interfaz de la aplicación](#4-interfaz-de-la-aplicación)
5. [Cómo generar código](#5-cómo-generar-código)
6. [Cómo validar el código generado](#6-cómo-validar-el-código-generado)
7. [Historial de generaciones](#7-historial-de-generaciones)
8. [Guardar y copiar el código](#8-guardar-y-copiar-el-código)
9. [Barra de estado](#9-barra-de-estado)
10. [Preguntas frecuentes y solución de problemas](#10-preguntas-frecuentes-y-solución-de-problemas)
11. [Ejemplos de uso](#11-ejemplos-de-uso)

---

## 1. ¿Qué es LNAP v2?

LNAP v2 es una aplicación de escritorio que te permite **describir en palabras lo que quieres que haga un programa** y obtener el código fuente listo para usar, sin necesidad de escribir una sola línea de código tú mismo.

Internamente utiliza un modelo de inteligencia artificial que corre completamente en tu computadora (a través de Ollama), por lo que **no necesitas conexión a internet** y tu información nunca sale de tu equipo.

**Lenguajes disponibles:**
- 🐍 **Python** — scripts, automatización, algoritmos
- 🔵 **C#** — aplicaciones .NET, consola
- 🌙 **Lua** — scripts ligeros, embebido en videojuegos
- ⚙️ **C++** — programas de alto rendimiento, sistemas

---

## 2. Requisitos previos

Antes de usar LNAP v2 necesitas tener instalado en tu sistema:

### Obligatorio

| Software | Dónde descargarlo | Para qué |
|----------|------------------|----------|
| **Ollama** | [ollama.com](https://ollama.com) | Motor de IA local |
| **Python 3.11+** | [python.org](https://www.python.org) | Ejecutar el servicio de validación |
| **Node.js 18+** | [nodejs.org](https://nodejs.org) | Ejecutar la aplicación (solo en desarrollo) |

### Según los lenguajes que quieras validar

| Lenguaje | Herramienta adicional |
|----------|-----------------------|
| Python | `python3` (ya instalado arriba) |
| Lua | `lua` y `luac` |
| C# | .NET SDK (`dotnet`) o `mono` |
| C++ | `g++` (GCC) |

> Si no tienes la herramienta de algún lenguaje, aún puedes **generar** código en ese lenguaje — solo la **validación** estará deshabilitada para él.

### Modelo de IA

Después de instalar Ollama, descarga el modelo recomendado ejecutando en la terminal:

```bash
ollama pull qwen2.5-coder:14b
```

> Este modelo ocupa aproximadamente 9 GB de espacio en disco y requiere al menos 16 GB de RAM.

---

## 3. Instalación y puesta en marcha

### Paso 1 — Instalar dependencias de la aplicación

```bash
# En la carpeta del proyecto
npm install
```

### Paso 2 — Instalar dependencias del servicio de validación

```bash
cd validator-service
python -m venv .venv

# macOS / Linux
source .venv/bin/activate

# Windows
.venv\Scripts\activate

pip install -r requirements.txt
```

### Paso 3 — Iniciar Ollama

Asegúrate de que Ollama esté corriendo en segundo plano. Si no se inicia automáticamente:

```bash
ollama serve
```

### Paso 4 — Iniciar el servicio de validación

En una terminal (con el entorno virtual activado):

```bash
npm run validator
```

Verás un mensaje similar a:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### Paso 5 — Iniciar la aplicación

En otra terminal:

```bash
npm run dev
```

La ventana de LNAP v2 se abrirá automáticamente.

---

## 4. Interfaz de la aplicación

```
┌─────────────────────────────────────────────────────────┐
│ ⬤ ⬤ ⬤    LNAP v2  Traductor de lenguaje natural    [Historial] │  ← Barra de título
├─────────────────────────────────────────────────────────┤
│  C#  │  Lua  │  Python  │  C++  │                       │  ← Pestañas de lenguaje
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Describe tu programa aquí...              [Generar ▶]  │  ← Entrada de lenguaje natural
│                                                         │
├─────────────────────────────────────────────────────────┤
│ [Generar] [Copiar] [Guardar] [Limpiar] [Validar]  42t 1.2s│  ← Barra de herramientas
│                                                         │
│          Editor de código (Monaco)                      │  ← Editor de código
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Panel de validación (aparece tras validar)             │  ← Resultados de validación
├─────────────────────────────────────────────────────────┤
│ ● Ollama: activo  ● Validator: activo  Python  qwen2.5  │  ← Barra de estado
└─────────────────────────────────────────────────────────┘
```

### Zonas de la interfaz

| Zona | Descripción |
|------|-------------|
| **Barra de título** | Nombre de la app y botón de Historial |
| **Pestañas de lenguaje** | Seleccionan el lenguaje de destino |
| **Entrada de lenguaje natural** | Donde escribes la descripción de tu programa |
| **Barra de herramientas** | Acciones sobre el código generado + métricas |
| **Editor de código** | Muestra (y permite editar) el código generado |
| **Panel de validación** | Resultados del análisis sintáctico y de ejecución |
| **Barra de estado** | Indicadores de salud de los servicios |

---

## 5. Cómo generar código

### Paso 1 — Selecciona el lenguaje

Haz clic en la pestaña del lenguaje que deseas: **C#**, **Lua**, **Python** o **C++**.

### Paso 2 — Describe tu programa

En el cuadro de texto grande, escribe en español qué debe hacer el programa. Sé tan específico como necesites.

**Ejemplos de buenas descripciones:**

> *"Programa que pida al usuario su nombre y edad, y calcule en qué año nació."*

> *"Función que reciba una lista de números y devuelva la suma, el promedio y el máximo."*

> *"Implementa el algoritmo de ordenamiento burbuja para una lista de enteros."*

### Paso 3 — Genera el código

Tienes dos opciones:
- Haz clic en el botón **Generar ▶** en la entrada de texto
- Presiona **Ctrl+Enter** (Windows/Linux) o **Cmd+Enter** (macOS)

El código aparecerá en el editor **en tiempo real**, carácter por carácter. Una vez terminado, verás el número de tokens generados y el tiempo que tardó.

### Editar el código generado

Puedes modificar libremente el código en el editor. Los cambios se conservan hasta que generes de nuevo o limpies el editor.

---

## 6. Cómo validar el código generado

La validación comprueba dos cosas:

1. **Validez sintáctica** — ¿El código está bien escrito? ¿No hay errores de formato?
2. **Validez funcional** — ¿El código se ejecuta sin errores?

### Para validar

Haz clic en el botón **Validar** en la barra de herramientas (disponible cuando hay código en el editor).

### Interpretar los resultados

El panel de validación aparecerá debajo del editor con:

| Indicador | Significado |
|-----------|-------------|
| ✅ Sintaxis correcta | El código no tiene errores de sintaxis |
| ❌ Error de sintaxis | El código tiene errores de formato — revisa los errores listados |
| ✅ Ejecución exitosa | El programa corrió sin errores |
| ❌ Error en ejecución | El programa generó un error al ejecutarse |
| ⚠️ Advertencias | El código funciona pero hay cosas a tener en cuenta |

El panel también muestra:
- **Errores detallados** con número de línea cuando es posible
- **Salida estándar** (stdout) — lo que el programa imprimiría
- **Salida de error** (stderr) — mensajes de error del sistema
- **Tiempo de ejecución** en milisegundos

> **Nota:** La validación ejecuta el código en un entorno aislado y seguro. Para programas que piden datos al usuario con `input()` (en Python) u equivalentes, se proveen valores de prueba automáticamente.

### Requisito del servicio de validación

El panel de validación solo funciona cuando el **Validator Service** está corriendo (indicador verde en la barra de estado). Si está rojo, ejecuta `npm run validator` en una terminal.

---

## 7. Historial de generaciones

LNAP v2 guarda automáticamente cada código generado en un historial local.

### Abrir el historial

Haz clic en el botón **Historial** en la esquina superior derecha.

### Usar el historial

El panel lateral muestra todas tus generaciones anteriores con:
- El lenguaje utilizado
- La descripción original
- Un fragmento del código generado
- La fecha y hora

**Para recuperar una generación anterior:**
- Haz clic sobre ella — se cargará el lenguaje, la descripción y el código en la interfaz principal.

**Para eliminar una entrada:**
- Haz clic en el ícono de eliminar junto a la entrada.

**Para limpiar todo el historial:**
- Usa el botón **Limpiar todo** al inicio del panel.

> El historial se guarda localmente en tu navegador y persiste entre sesiones.

---

## 8. Guardar y copiar el código

### Copiar al portapapeles

Haz clic en **Copiar** en la barra de herramientas. El código se copiará y podrás pegarlo en cualquier editor.

### Guardar como archivo

Haz clic en **Guardar** en la barra de herramientas. Se descargará un archivo con el nombre `codigo` y la extensión correcta según el lenguaje:

| Lenguaje | Extensión |
|----------|-----------|
| Python | `.py` |
| C# | `.cs` |
| Lua | `.lua` |
| C++ | `.cpp` |

### Limpiar el editor

Haz clic en **Limpiar** para borrar el código, los resultados de validación y las métricas. La descripción de lenguaje natural se conserva.

---

## 9. Barra de estado

La barra inferior muestra el estado del sistema en tiempo real (se actualiza cada 10 segundos):

| Indicador | Verde | Rojo |
|-----------|-------|------|
| **● Ollama** | Conectado y listo | No disponible — la generación no funcionará |
| **● Validator** | Servicio corriendo | No disponible — la validación no funcionará |
| **Lenguaje** | Lenguaje actualmente seleccionado | — |
| **Modelo** | Nombre del modelo de IA cargado | — |

Si un indicador está en rojo, consulta la sección de [solución de problemas](#10-preguntas-frecuentes-y-solución-de-problemas).

---

## 10. Preguntas frecuentes y solución de problemas

### El indicador de Ollama está en rojo

**Causa:** Ollama no está corriendo o no está accesible en `localhost:11434`.

**Solución:**
```bash
ollama serve
```
Si ya estaba corriendo, reinícialo.

---

### El indicador del Validator está en rojo

**Causa:** El servicio de validación no está corriendo.

**Solución:**
```bash
npm run validator
```
Asegúrate de tener el entorno virtual de Python activado y las dependencias instaladas.

---

### El código tarda mucho en generarse

Esto es normal con modelos grandes como `qwen2.5-coder:14b`. El tiempo depende de:
- La potencia de tu CPU/GPU
- La longitud del código a generar
- Si Ollama usa aceleración GPU (configura Ollama con tu GPU para mayor velocidad)

---

### El código generado no es lo que esperaba

Prueba estas estrategias para obtener mejores resultados:

- **Sé más específico:** En lugar de "programa de calculadora", di "calculadora de consola que soporte suma, resta, multiplicación y división con menú de opciones en bucle".
- **Menciona restricciones:** "sin usar librerías externas", "usando solo funciones", "con manejo de errores".
- **Especifica el formato de entrada/salida:** "el usuario ingresa dos números separados por espacio".

---

### La validación falla para C# / Lua / C++

El servicio de validación necesita los compiladores instalados en tu sistema. Verifica:

```bash
# Para C++
g++ --version

# Para C#
dotnet --version

# Para Lua
lua -v
luac -v
```

Si alguno no está disponible, instálalo. La generación de código seguirá funcionando; solo la validación estará limitada.

---

### "Error en ejecución" en la validación pero el código parece correcto

Algunos programas requieren entrada del usuario interactiva. El validador provee valores de prueba automáticos, pero si tu programa tiene una lógica de menú muy específica o espera un formato particular, puede fallar en la validación aunque el código sea correcto.

Prueba ejecutar el código manualmente en tu terminal para confirmarlo.

---

### La aplicación no arranca

1. Asegúrate de haber ejecutado `npm install` previamente.
2. Verifica que Node.js 18+ esté instalado: `node --version`.
3. En modo desarrollo, el puerto 5173 debe estar libre.

---

## 11. Ejemplos de uso

### Ejemplo 1 — Python: calculadora de IMC

**Descripción:**
> "Programa que pida el peso en kg y la altura en metros, calcule el Índice de Masa Corporal y diga si el usuario tiene bajo peso, peso normal, sobrepeso u obesidad."

**Resultado esperado:** Un script Python con `input()`, cálculo de IMC y condicionales para las categorías.

---

### Ejemplo 2 — C++: ordenamiento de arreglo

**Descripción:**
> "Función que ordene un arreglo de 10 enteros usando el algoritmo de selección y luego los imprima."

**Resultado esperado:** Código C++ con función `selectionSort` y `main` que demuestra su uso.

---

### Ejemplo 3 — Lua: tabla de multiplicar

**Descripción:**
> "Script que imprima la tabla de multiplicar del 1 al 10 de forma formateada."

**Resultado esperado:** Bucles anidados en Lua con `print` formateado.

---

### Ejemplo 4 — C#: conversor de temperaturas

**Descripción:**
> "Programa de consola que convierta temperaturas entre Celsius, Fahrenheit y Kelvin según la opción que elija el usuario."

**Resultado esperado:** Aplicación de consola C# con menú `switch`, métodos de conversión y bucle `do-while`.

---

### Consejos para descripciones efectivas

| Aspecto | Ejemplo vago ❌ | Ejemplo específico ✅ |
|---------|----------------|----------------------|
| Propósito | "programa de números" | "calcular el factorial de un número ingresado por el usuario" |
| Entrada | "datos del usuario" | "el usuario ingresa su nombre y dos números enteros" |
| Salida | "mostrar resultado" | "imprimir el resultado con dos decimales y una etiqueta descriptiva" |
| Manejo de errores | (omitido) | "si el usuario ingresa texto en lugar de un número, mostrar un mensaje de error y pedir de nuevo" |
