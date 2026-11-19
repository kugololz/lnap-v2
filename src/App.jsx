import { useState, useEffect, useCallback, useMemo } from "react";
import { History as HistoryIcon } from "lucide-react";
import { ollamaClient } from "./services/ollamaClient.js";
import { validatorClient } from "./services/validatorClient.js";
import { LANGUAGES } from "./prompts/index.js";

import LanguageTabs from "./components/LanguageTabs.jsx";
import NaturalInput from "./components/NaturalInput.jsx";
import Toolbar from "./components/Toolbar.jsx";
import CodeEditor from "./components/CodeEditor.jsx";
import ValidationPanel from "./components/ValidationPanel.jsx";
import ExplanationPanel from "./components/ExplanationPanel.jsx";
import StatusBar from "./components/StatusBar.jsx";
import HistoryPanel, { useHistory } from "./components/HistoryPanel.jsx";

export default function App() {
  // Estado principal
  const [language, setLanguage] = useState("python");
  const [naturalText, setNaturalText] = useState("");
  const [code, setCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [generationTime, setGenerationTime] = useState(0);

  // Validación
  const [validation, setValidation] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  // Explicación del código completo (resumen en el panel + bloques como
  // hover en el editor) y de una selección puntual (solo hover, sin panel)
  const [explanation, setExplanation] = useState(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [selectionExplanation, setSelectionExplanation] = useState(null);

  // Health checks
  const [ollamaHealth, setOllamaHealth] = useState(null);
  const [validatorHealth, setValidatorHealth] = useState(null);
  const [currentModel, setCurrentModel] = useState("");

  // UI
  const [historyOpen, setHistoryOpen] = useState(false);
  const {
    history,
    add: addHistory,
    remove: removeHistory,
    clear: clearHistory,
  } = useHistory();

  // ─── Health checks periódicos ───
  useEffect(() => {
    const check = async () => {
      const [oh, vh, cfg] = await Promise.all([
        ollamaClient.healthCheck(),
        validatorClient.healthCheck(),
        validatorClient.getConfig(),
      ]);
      setOllamaHealth(oh);
      setValidatorHealth(vh);
      setCurrentModel(cfg.ollama.model);
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  // ─── Explicación del código completo ───
  const explainCode = useCallback(
    async (codeToExplain) => {
      if (!codeToExplain?.trim()) return;
      setIsExplaining(true);
      const result = await ollamaClient.explain({
        code: codeToExplain,
        languageName: LANGUAGES[language].name,
      });
      setExplanation(result);
      setIsExplaining(false);
    },
    [language],
  );

  const handleExplain = useCallback(() => {
    explainCode(code);
  }, [explainCode, code]);

  // ─── Explicación de una selección (solo se ve al pasar el mouse) ───
  const handleExplainSelection = useCallback(
    async (snippet) => {
      const result = await ollamaClient.explain({
        code: snippet,
        languageName: LANGUAGES[language].name,
      });
      if (result.success) {
        setSelectionExplanation({
          code: snippet,
          explanation: result.summary || result.blocks?.[0]?.explanation || "",
        });
      }
    },
    [language],
  );

  // Bloques que el editor debe subrayar y mostrar al pasar el mouse: los del
  // código completo + el de la última selección explicada, si hay una.
  const editorBlocks = useMemo(
    () => [
      ...(explanation?.success ? explanation.blocks : []),
      ...(selectionExplanation ? [selectionExplanation] : []),
    ],
    [explanation, selectionExplanation],
  );

  // ─── Generación con streaming ───
  const handleGenerate = useCallback(async () => {
    if (!naturalText.trim() || isGenerating) return;

    const lang = LANGUAGES[language];
    setIsGenerating(true);
    setCode("");
    setTokenCount(0);
    setGenerationTime(0);
    setValidation(null);
    setExplanation(null);
    setSelectionExplanation(null);

    let rawBuffer = "";

    await ollamaClient.generateStream({
      system: lang.prompt.system,
      prompt: lang.prompt.buildUserPrompt(naturalText),
      onToken: (token, fullText) => {
        rawBuffer = fullText;
        // Extraer código parcial en tiempo real
        const partial = ollamaClient.extractPartialCode(fullText);
        if (partial) setCode(partial);
      },
      onDone: ({ fullText, tokenCount: tc, evalDuration }) => {
        const finalCode = ollamaClient.extractCodeBlock(
          fullText,
          lang.monacoLang,
        );
        setCode(finalCode);
        setTokenCount(tc || 0);
        setGenerationTime(evalDuration || 0);
        setIsGenerating(false);

        // Guardar en historial
        addHistory({
          language,
          prompt: naturalText,
          code: finalCode,
        });

        // Explicación automática en segundo plano (no bloquea el editor)
        explainCode(finalCode);
      },
      onError: (err) => {
        setCode(`// Error: ${err}`);
        setIsGenerating(false);
      },
    });
  }, [naturalText, language, isGenerating, addHistory, explainCode]);

  // ─── Validación ───
  const handleValidate = useCallback(async () => {
    if (!code) return;
    setIsValidating(true);
    const result = await validatorClient.validate({ language, code });
    setValidation(result);
    setIsValidating(false);
  }, [code, language]);

  // ─── Acciones de toolbar ───
  const handleCopy = async () => {
    if (code) await navigator.clipboard.writeText(code);
  };

  const handleSave = async () => {
    if (!code) return;
    const lang = LANGUAGES[language];
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `codigo.${lang.extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setCode("");
    setValidation(null);
    setTokenCount(0);
    setGenerationTime(0);
    setExplanation(null);
    setSelectionExplanation(null);
  };

  const handleSelectFromHistory = (item) => {
    setLanguage(item.language);
    setNaturalText(item.prompt);
    setCode(item.code);
    setHistoryOpen(false);
    setValidation(null);
    setExplanation(null);
    setSelectionExplanation(null);
  };

  const currentLang = LANGUAGES[language];

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {/* Title bar con espacio para los semáforos de macOS */}
      <div className="h-11 flex items-center justify-between pl-24 pr-4 bg-bg-secondary border-b border-border">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-text-bright">LNAP v2</div>
          <span className="text-xs text-text-secondary">
            Traductor de lenguaje natural a código
          </span>
        </div>
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          className="btn-secondary flex items-center gap-1.5 py-1 px-2 text-xs"
        >
          <HistoryIcon size={12} />
          Historial
        </button>
      </div>

      {/* Tabs de lenguaje */}
      <LanguageTabs active={language} onChange={setLanguage} />

      {/* Contenido principal: columna vertical */}
      <div className="flex-1 flex flex-col gap-3 p-3 overflow-hidden">
        {/* Entrada natural (tamaño fijo arriba) */}
        <NaturalInput
          value={naturalText}
          onChange={setNaturalText}
          onSubmit={handleGenerate}
          disabled={isGenerating}
        />

        {/* Editor (ocupa el espacio medio) */}
        <div className="panel flex-1 flex flex-col overflow-hidden min-h-[300px]">
          <Toolbar
            onGenerate={handleGenerate}
            onCopy={handleCopy}
            onSave={handleSave}
            onClear={handleClear}
            onValidate={handleValidate}
            onExplain={handleExplain}
            isGenerating={isGenerating}
            isExplaining={isExplaining}
            hasCode={!!code}
            tokenCount={tokenCount}
            generationTime={generationTime}
          />
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              language={currentLang.monacoLang}
              value={code}
              onChange={setCode}
              isStreaming={isGenerating}
              onExplainSelection={handleExplainSelection}
              blocks={editorBlocks}
            />
          </div>
        </div>

        {/* Resumen de la explicación (el detalle por bloque se ve al pasar
            el mouse sobre el código subrayado en el editor) */}
        <ExplanationPanel explanation={explanation} isExplaining={isExplaining} />

        {/* Validación (altura automática abajo) */}
        <ValidationPanel validation={validation} isValidating={isValidating} />
      </div>

      {/* Barra de estado */}
      <StatusBar
        ollamaHealth={ollamaHealth}
        validatorHealth={validatorHealth}
        language={language}
        model={currentModel}
      />

      {/* Panel de historial */}
      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        onSelect={handleSelectFromHistory}
        onRemove={removeHistory}
        onClear={clearHistory}
      />
    </div>
  );
}
