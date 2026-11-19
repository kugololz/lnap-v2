import Editor from "@monaco-editor/react";
import { useEffect, useRef } from "react";

const EXPLAINABLE_LANGUAGES = ["python", "lua", "csharp", "cpp"];

// Colores que rotan por bloque para que sea facil distinguir donde termina
// uno y empieza el siguiente (ver clases .lnap-explain-hint-N en index.css).
const EXPLAIN_HINT_COLOR_COUNT = 6;

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Convierte el fragmento en un patron que tolera pequeñas diferencias de
// espacios/saltos de linea entre lo que devuelve la IA y el codigo real.
function toFuzzyPattern(snippet) {
  return snippet
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegExp)
    .join("\\s+");
}

// Ubica un fragmento de codigo dentro del modelo de Monaco: primero exacto,
// y si la IA no lo copió al pie de la letra, con un match tolerante a
// espacios/indentación.
function locateRange(model, snippet) {
  if (!snippet?.trim()) return null;

  let matches = model.findMatches(snippet, false, false, true, null, true);

  if (matches.length === 0) {
    const pattern = toFuzzyPattern(snippet);
    if (pattern) {
      matches = model.findMatches(pattern, false, true, false, null, true);
    }
  }

  return matches.length > 0 ? matches[0].range : null;
}

export default function CodeEditor({
  language,
  value,
  onChange,
  readOnly = false,
  isStreaming = false,
  onExplainSelection,
  blocks = [],
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef(null);
  const explainRangesRef = useRef([]);
  const onExplainSelectionRef = useRef(onExplainSelection);

  useEffect(() => {
    onExplainSelectionRef.current = onExplainSelection;
  }, [onExplainSelection]);

  const handleMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    monaco.editor.defineTheme("lnap-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#1e1e1e",
        "editor.foreground": "#cccccc",
        "editorLineNumber.foreground": "#858585",
        "editorLineNumber.activeForeground": "#cccccc",
        "editor.selectionBackground": "#264f78",
        "editor.lineHighlightBackground": "#2d2d30",
        "editorCursor.foreground": "#0098ff",
        "editorIndentGuide.background": "#2d2d30",
      },
    });
    monaco.editor.setTheme("lnap-dark");

    editor.addAction({
      id: "lnap-explain-selection",
      label: "Explicar esta selección con IA",
      contextMenuGroupId: "1_lnap",
      contextMenuOrder: 0,
      run: (ed) => {
        const selection = ed.getSelection();
        const text = selection ? ed.getModel()?.getValueInRange(selection) : "";
        if (text?.trim()) onExplainSelectionRef.current?.(text.trim());
      },
    });

    // Un solo hover provider por lenguaje (se registra una vez), que siempre
    // lee la lista de bloques vigente desde la ref -- así no hay que
    // registrar/desregistrar cada vez que cambia la explicación.
    EXPLAINABLE_LANGUAGES.forEach((langId) => {
      monaco.languages.registerHoverProvider(langId, {
        provideHover: (model, position) => {
          if (model !== editorRef.current?.getModel()) return null;
          const hit = explainRangesRef.current.find((r) =>
            monaco.Range.containsPosition(r.range, position),
          );
          if (!hit) return null;
          return {
            range: hit.range,
            contents: [{ value: hit.explanation, isTrusted: true }],
          };
        },
      });
    });
  };

  useEffect(() => {
    if (isStreaming && editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        const lineCount = model.getLineCount();
        editorRef.current.revealLine(lineCount);
      }
    }
  }, [value, isStreaming]);

  // Ubica cada bloque explicado en el editor y lo marca con un subrayado
  // sutil; el texto de la explicación se muestra al pasar el mouse (hover
  // provider registrado en handleMount), sin ocupar espacio extra en pantalla.
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;

    if (decorationsRef.current) {
      decorationsRef.current.clear();
      decorationsRef.current = null;
    }
    explainRangesRef.current = [];

    if (!blocks.length) return;

    const located = blocks
      .map((b) => ({ range: locateRange(model, b.code), explanation: b.explanation }))
      .filter((b) => b.range !== null);

    explainRangesRef.current = located;

    if (located.length > 0) {
      decorationsRef.current = editor.createDecorationsCollection(
        located.map(({ range }, i) => ({
          range,
          options: {
            className: `lnap-explain-hint lnap-explain-hint-${i % EXPLAIN_HINT_COLOR_COUNT}`,
            hoverMessage: null,
          },
        })),
      );
    }
  }, [blocks, value]);

  return (
    <div className="h-full w-full bg-bg-primary">
      <Editor
        height="100%"
        language={language}
        value={value}
        onChange={(v) => onChange?.(v ?? "")}
        onMount={handleMount}
        options={{
          readOnly: readOnly || isStreaming,
          // Sin esto, el tooltip de hover queda recortado por los
          // contenedores padres con overflow-hidden del layout de la app.
          fixedOverflowWidgets: true,
          fontSize: 14,
          fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          lineNumbers: "on",
          padding: { top: 12, bottom: 12 },
          smoothScrolling: true,
          cursorBlinking: "smooth",
          renderLineHighlight: "line",
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
        }}
      />
    </div>
  );
}
