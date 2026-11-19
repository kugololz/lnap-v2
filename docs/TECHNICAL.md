# LNAP v2 — Documentación Técnica

> **Lenguaje Natural A Programación** · v2.0.0  
> Autor: Luis Bernardo Ballesteros Barradas · Licencia: MIT

---

## Tabla de contenidos

1. [Visión general](#1-visión-general)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Estructura del repositorio](#4-estructura-del-repositorio)
5. [Capa Electron (proceso principal)](#5-capa-electron-proceso-principal)
6. [Frontend React](#6-frontend-react)
7. [Servicio de validación (Python/FastAPI)](#7-servicio-de-validación-pythonfastapi)
8. [Flujo de generación de código](#8-flujo-de-generación-de-código)
9. [Flujo de validación](#9-flujo-de-validación)
10. [Configuración de la aplicación](#10-configuración-de-la-aplicación)
11. [Scripts de desarrollo y producción](#11-scripts-de-desarrollo-y-producción)
12. [Prompts del modelo](#12-prompts-del-modelo)
13. [Requisitos del sistema](#13-requisitos-del-sistema)
14. [Variables de configuración](#14-variables-de-configuración)

---

## 1. Visión general

LNAP v2 es una aplicación de escritorio **Electron** que permite al usuario describir un algoritmo o programa en **lenguaje natural** (español) y obtener código funcional en **C#, Lua, Python o C++** mediante un modelo de lenguaje local gestionado por [Ollama](https://ollama.com).

El código generado puede validarse de forma automática a través de un microservicio **FastAPI** que realiza análisis sintáctico y ejecución en sandbox aislado.

```
┌──────────────────────────────────────────┐
│              Electron App                │
│  ┌────────────────┐  ┌────────────────┐  │
│  │  Renderer      │  │  Main Process  │  │
│  │  (React/Vite)  │◄─►  (Node.js)    │  │
│  └────────────────┘  └───────┬────────┘  │
└──────────────────────────────┼───────────┘
                               │ HTTP
              ┌────────────────┴───────────────┐
              │                                │
   ┌──────────▼──────────┐      ┌──────────────▼──────────┐
   │  Ollama (LLM local) │      │  Validator Service       │
   │  :11434             │      │  FastAPI · :8000         │
   └─────────────────────┘      └─────────────────────────┘
```

---

## 2. Arquitectura del sistema

LNAP v2 emplea un diseño **three-tier** dentro del proceso Electron:

| Capa | Tecnología | Responsabilidad |
|------|-----------|-----------------|
| Renderer | React 18 + Vite | UI, estado de la aplicación, interacción de usuario |
| Main (IPC) | Node.js + Electron | Proxy hacia Ollama y Validator; acceso al sistema de archivos |
| Backend | Python 3 + FastAPI | Validación sintáctica y funcional por lenguaje |

La comunicación **Renderer ↔ Main** se realiza íntegramente mediante **IPC seguro** a través de `contextBridge` (sin `nodeIntegration`). El Main actúa como único cliente HTTP hacia Ollama y el Validator Service.

---

## 3. Stack tecnológico

### Frontend / Shell
| Paquete | Versión | Uso |
|---------|---------|-----|
| Electron | ^41 | Shell de escritorio |
| React | ^18.3 | UI declarativa |
| Vite | ^6 | Bundler + dev server |
| Tailwind CSS | ^3.4 | Estilos utilitarios |
| Monaco Editor | ^4.7 | Editor de código con resaltado |
| Axios | ^1.7 | HTTP client (proceso Main) |
| lucide-react | ^0.469 | Iconos |

### Backend / Validación
| Paquete | Uso |
|---------|-----|
| FastAPI | API REST del validador |
| Uvicorn | Servidor ASGI |
| Pydantic | Validación de schemas de entrada |
| `ast` (stdlib) | Análisis sintáctico Python |
| `subprocess` | Ejecución en sandbox |

### LLM
- **Ollama** corriendo localmente (no incluido en el repo)
- Modelo recomendado: `qwen2.5-coder:14b`

---

## 4. Estructura del repositorio

```
lnap-v2/
├── electron/
│   ├── main.js            # Proceso principal Electron; crea la ventana
│   ├── ipc-handlers.js    # Registra todos los handlers IPC
│   └── preload.cjs        # contextBridge: expone electronAPI al renderer
│
├── src/                   # Renderer (React)
│   ├── App.jsx            # Componente raíz; orquesta estado global
│   ├── main.jsx           # Punto de entrada React
│   ├── index.css          # Variables CSS / Tailwind base
│   ├── components/
│   │   ├── CodeEditor.jsx      # Wrapper Monaco Editor
│   │   ├── HistoryPanel.jsx    # Panel lateral + hook useHistory
│   │   ├── LanguageTabs.jsx    # Tabs C# / Lua / Python / C++
│   │   ├── NaturalInput.jsx    # Textarea para la descripción
│   │   ├── StatusBar.jsx       # Barra de estado inferior
│   │   ├── Toolbar.jsx         # Botones de acción sobre el editor
│   │   └── ValidationPanel.jsx # Panel de resultados de validación
│   ├── prompts/
│   │   ├── index.js       # Exporta LANGUAGES y LANGUAGE_LIST
│   │   ├── python.js      # System prompt + buildUserPrompt para Python
│   │   ├── csharp.js      # Ídem para C#
│   │   ├── lua.js         # Ídem para Lua
│   │   └── cpp.js         # Ídem para C++
│   └── services/
│       └── ollamaClient.js  # Abstracción de llamadas a electronAPI
│
├── validator-service/     # Microservicio Python independiente
│   ├── app.py             # Punto de entrada FastAPI
│   ├── requirements.txt   # Dependencias Python
│   ├── sandbox/
│   │   └── runner.py      # Clase Sandbox: tmpdir + subprocess aislado
│   └── validators/
│       ├── base.py             # BaseValidator + ValidationResult
│       ├── python_validator.py # ast + sandbox ejecución
│       ├── csharp_validator.py # Compilación con dotnet / csc
│       ├── lua_validator.py    # luac + lua
│       └── cpp_validator.py    # g++ compilación + ejecución
│
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## 5. Capa Electron (proceso principal)

### `electron/main.js`

Crea la `BrowserWindow` con las siguientes opciones relevantes:

```js
{
  width: 1400, height: 900,
  minWidth: 1024, minHeight: 700,
  titleBarStyle: "hiddenInset",        // Título nativo macOS con semáforos
  trafficLightPosition: { x: 16, y: 16 },
  webPreferences: {
    contextIsolation: true,            // Renderer aislado
    nodeIntegration: false,            // Sin acceso directo a Node
    sandbox: false,                    // Necesario para preload CJS
    preload: "electron/preload.cjs"
  }
}
```

En **modo desarrollo** carga `http://localhost:5173` (Vite dev server) y abre DevTools en modo desacoplado. En **producción** carga `dist/index.html`.

### `electron/preload.cjs`

Expone `window.electronAPI` al renderer con estos métodos (vía `contextBridge`):

| Método | Canal IPC | Descripción |
|--------|-----------|-------------|
| `ollamaGenerate(payload)` | `ollama:generate` | Generación síncrona |
| `ollamaGenerateStream(payload)` | `ollama:generate-stream` | Streaming token a token |
| `onOllamaStreamChunk(cb)` | `ollama:stream-chunk` (listener) | Recibir tokens en tiempo real |
| `ollamaHealthCheck()` | `ollama:health` | Estado de Ollama |
| `ollamaListModels()` | `ollama:list-models` | Modelos disponibles |
| `validateCode(payload)` | `validator:validate` | Validar código |
| `validatorHealthCheck()` | `validator:health` | Estado del Validator Service |
| `getConfig()` | `config:get` | Leer configuración |
| `setConfig(config)` | `config:set` | Guardar configuración |

### `electron/ipc-handlers.js`

Implementa todos los handlers. Puntos clave:

- **Configuración persistente**: Se guarda en `app.getPath("userData")/config.json`. Si no existe, se usa `DEFAULT_CONFIG`.
- **Streaming**: El handler `ollama:generate-stream` abre un stream HTTP con `axios` (`responseType: "stream"`), parsea las líneas JSON de la API de Ollama y reenvía cada token al renderer via `event.sender.send("ollama:stream-chunk", {...})`.
- **Validator proxy**: El handler `validator:validate` hace POST a `http://localhost:8000/validate` y reenvía la respuesta directamente al renderer.

---

## 6. Frontend React

### `src/App.jsx` — Estado global

| Estado | Tipo | Descripción |
|--------|------|-------------|
| `language` | `string` | Lenguaje activo (`"python"`, `"csharp"`, `"lua"`, `"cpp"`) |
| `naturalText` | `string` | Descripción del usuario |
| `code` | `string` | Código generado / editado |
| `isGenerating` | `boolean` | Generación en curso |
| `tokenCount` | `number` | Tokens evaluados (reportados por Ollama) |
| `generationTime` | `number` | `eval_duration` de Ollama (nanosegundos) |
| `validation` | `object \| null` | Resultado de la última validación |
| `isValidating` | `boolean` | Validación en curso |
| `ollamaHealth` | `object \| null` | Salud de Ollama |
| `validatorHealth` | `object \| null` | Salud del Validator Service |
| `currentModel` | `string` | Modelo activo en Ollama |
| `historyOpen` | `boolean` | Panel de historial visible |

Los **health checks** se ejecutan al montar el componente y cada 10 segundos mediante `setInterval`.

### Componentes

#### `LanguageTabs`
Renderiza las pestañas de los 4 lenguajes. Recibe `active` y `onChange`. Obtiene los datos de `LANGUAGE_LIST` (colores, nombres).

#### `NaturalInput`
`<textarea>` controlado para la descripción en lenguaje natural. `Ctrl+Enter` / `Cmd+Enter` dispara `onSubmit` (generación).

#### `Toolbar`
Barra de botones sobre el editor:
- **Generar** → `handleGenerate`
- **Copiar** → `navigator.clipboard.writeText`
- **Guardar** → Descarga el archivo con la extensión del lenguaje activo
- **Limpiar** → Resetea `code`, `validation`, contadores
- **Validar** → `handleValidate`

Muestra el conteo de tokens y el tiempo de generación cuando hay código.

#### `CodeEditor`
Wrapper de `@monaco-editor/react`. Props: `language` (id Monaco), `value`, `onChange`, `isStreaming`. Durante el streaming deshabilita la edición manual.

#### `ValidationPanel`
Muestra el resultado de `validation`:
- `syntaxValid` / `functionallyValid` como badges de color
- Lista de `errors` y `warnings`
- `stdout` / `stderr` colapsables
- Tiempo de ejecución (`executionTimeMs`)

#### `StatusBar`
Barra inferior con:
- Indicador `●` verde/rojo para Ollama
- Indicador `●` verde/rojo para el Validator Service
- Lenguaje activo
- Nombre del modelo cargado

#### `HistoryPanel` + `useHistory`
Panel lateral deslizante. El hook `useHistory` mantiene el historial en `localStorage` (`lnap-history`). Cada entrada guarda `{ id, language, prompt, code, timestamp }`.

### `src/services/ollamaClient.js`

Abstrae las llamadas IPC. Métodos principales:

- **`generateStream({prompt, system, onToken, onDone, onError})`**: Genera un `streamId` único, registra el listener de `onOllamaStreamChunk`, llama a `ollamaGenerateStream` y enruta los eventos.
- **`extractCodeBlock(text, language)`**: Extrae el primer bloque de código delimitado por triple backtick, filtrando por el lenguaje si se especifica.
- **`extractPartialCode(text)`**: Versión incremental para streaming: devuelve el código entre el primer ` ``` ` de apertura y el cierre (o el final del buffer si aún no cerró).

---

## 7. Servicio de validación (Python/FastAPI)

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Estado del servicio y lenguajes soportados |
| `GET` | `/languages` | Disponibilidad de toolchains por lenguaje |
| `POST` | `/validate` | Validar código |

### Schema `POST /validate`

```json
{
  "language": "python",
  "code": "print('hola')",
  "skip_functional": false
}
```

### Schema de respuesta

```json
{
  "success": true,
  "syntaxValid": true,
  "functionallyValid": true,
  "errors": [],
  "warnings": [],
  "stdout": "hola\n",
  "stderr": "",
  "executionTimeMs": 142,
  "language": "python"
}
```

### `BaseValidator` (validators/base.py)

Clase abstracta con el método `validate(code, skip_functional)` que coordina:
1. `syntax_check(code)` → `(bool, list[str])`
2. `functional_check(code)` → `(bool, stdout, stderr, list[str])` (solo si `syntax_ok` y no `skip_functional`)

### Validadores por lenguaje

| Clase | Sintaxis | Funcional | Herramienta requerida |
|-------|----------|-----------|----------------------|
| `PythonValidator` | `ast.parse()` | Sandbox + `python3` | `python3` |
| `LuaValidator` | `luac -p` | Sandbox + `lua` | `lua`, `luac` |
| `CSharpValidator` | Compilación | `dotnet run` / `csc` | `dotnet` o `csc` + `mono` |
| `CppValidator` | Compilación `g++` | Ejecución del binario | `g++` |

### `Sandbox` (sandbox/runner.py)

Context manager que:
1. Crea un directorio temporal (`/tmp/lnap_sandbox_XXXX`)
2. Permite escribir archivos con `write_file(name, content)`
3. Ejecuta comandos con `run(cmd)` via `subprocess.run` con:
   - Entorno sanitizado (solo `PATH`, `HOME`, `LANG`)
   - Timeout configurable (default 10 s)
   - `cwd` dentro del tmpdir
4. Elimina el tmpdir al salir del `with` block

Para **Python** se inyecta un stub de `input()` que provee valores predefinidos (`"42"`, `"10"`, `"hola"`, etc.) para que el código pueda ejecutarse sin interacción.

---

## 8. Flujo de generación de código

```
Usuario escribe descripción
        │
        ▼
NaturalInput.onSubmit → App.handleGenerate
        │
        ▼
ollamaClient.generateStream()
  ├─ Registra listener IPC (stream-chunk)
  └─ Llama electronAPI.ollamaGenerateStream()
              │
              ▼ (proceso Main)
        ipc-handlers: ollama:generate-stream
              │
              ▼
        axios POST http://localhost:11434/api/generate
              { model, system, prompt, stream: true }
              │
              ▼ (stream de líneas JSON)
        Por cada línea JSON con data.response:
          event.sender.send("ollama:stream-chunk", { token, fullText, done: false })
              │
              ▼ (renderer)
        onToken → ollamaClient.extractPartialCode(fullText) → setCode()
              │
        Cuando done: true:
          onDone → extractCodeBlock(fullText) → setCode()
                → addHistory({ language, prompt, code })
```

---

## 9. Flujo de validación

```
Toolbar.onValidate → App.handleValidate
        │
        ▼
electronAPI.validateCode({ language, code })
        │ (IPC: validator:validate)
        ▼ (proceso Main)
axios POST http://localhost:8000/validate
        │
        ▼ (validator-service)
VALIDATORS[language].validate(code)
  ├─ syntax_check()  → si falla, retorna inmediatamente
  └─ functional_check() → Sandbox + toolchain
        │
        ▼
ValidationResult.to_dict() → JSON response
        │
        ▼ (renderer)
setValidation(result) → ValidationPanel re-render
```

---

## 10. Configuración de la aplicación

La configuración se persiste en `{userData}/config.json`. Valores por defecto:

```json
{
  "ollama": {
    "baseUrl": "http://localhost:11434",
    "model": "qwen2.5-coder:14b",
    "temperature": 0.2,
    "topP": 0.9,
    "maxTokens": 2048,
    "timeout": 120000
  },
  "validator": {
    "baseUrl": "http://localhost:8000",
    "timeout": 30000
  }
}
```

Se puede actualizar en tiempo de ejecución con `electronAPI.setConfig(patch)` (merge superficial).

---

## 11. Scripts de desarrollo y producción

| Script | Comando | Descripción |
|--------|---------|-------------|
| `npm run dev` | `concurrently` Vite + Electron | Levanta dev server + app |
| `npm run dev:vite` | `vite` | Solo el frontend |
| `npm run dev:electron` | `wait-on tcp:5173 && electron .` | Electron con `NODE_ENV=development` |
| `npm run build` | `vite build` | Compila el renderer a `dist/` |
| `npm run start` | `electron .` | Corre la app en producción local |
| `npm run validator` | `cd validator-service && python app.py` | Levanta el servicio de validación |
| `npm run package` | `vite build && electron-builder` | Empaqueta en `release/` |

### Iniciar en desarrollo (3 terminales)

```bash
# Terminal 1 — Validator Service
npm run validator

# Terminal 2 — Aplicación Electron + Vite
npm run dev
```

### Instalar dependencias del validador

```bash
cd validator-service
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

---

## 12. Prompts del modelo

Cada archivo en `src/prompts/` exporta un objeto con:

```js
{
  system: string,                        // Instrucciones de sistema (reglas estrictas)
  buildUserPrompt: (instruction) => string  // Construye el prompt de usuario
}
```

Los prompts instruyen al modelo a responder **únicamente** con un bloque de código delimitado por triple backtick y el identificador del lenguaje. Esto es requerido por `extractCodeBlock` para aislar el código de cualquier texto explicativo.

Parámetros de generación (configurables):
- `temperature: 0.2` — baja variabilidad, respuestas más deterministas
- `top_p: 0.9`
- `num_predict: 2048` — tokens máximos de respuesta

---

## 13. Requisitos del sistema

| Componente | Requisito |
|-----------|-----------|
| Node.js | >= 18 LTS |
| Python | >= 3.11 |
| Ollama | Última versión estable, corriendo en `:11434` |
| Modelo LLM | `qwen2.5-coder:14b` (recomendado) u otro coder |
| RAM | 16 GB mínimo para el modelo 14B (32 GB recomendado) |
| **Para Python** | `python3` en PATH |
| **Para Lua** | `lua` y `luac` en PATH |
| **Para C#** | `dotnet` (SDK) o `csc` + `mono` |
| **Para C++** | `g++` en PATH |

---

## 14. Variables de configuración

No se usan variables de entorno del sistema operativo. Toda la configuración reside en el archivo `config.json` descrito en la [sección 10](#10-configuración-de-la-aplicación) y se gestiona vía IPC (`config:get` / `config:set`).

La única variable de entorno usada internamente es `NODE_ENV=development`, inyectada por el script `dev:electron` via `cross-env`.
