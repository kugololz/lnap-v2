import { Copy, Save, Trash2, Play, Check, BookOpen } from "lucide-react";
import { useState } from "react";

export default function Toolbar({
  onGenerate,
  onCopy,
  onSave,
  onClear,
  onValidate,
  onExplain,
  isGenerating,
  isExplaining,
  hasCode,
  tokenCount,
  generationTime,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-bg-secondary border-b border-border">
      <div className="flex items-center gap-1">
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="btn-primary flex items-center gap-1.5 py-1.5 px-3 text-xs"
        >
          <Play size={12} />
          {isGenerating ? "Generando..." : "Traducir"}
        </button>

        <div className="w-px h-5 bg-border mx-2" />

        <button
          onClick={handleCopy}
          disabled={!hasCode}
          className="btn-secondary flex items-center gap-1.5 py-1.5 px-2 text-xs"
          title="Copiar código"
        >
          {copied ? (
            <Check size={12} className="text-status-success" />
          ) : (
            <Copy size={12} />
          )}
          {copied ? "Copiado" : "Copiar"}
        </button>

        <button
          onClick={onSave}
          disabled={!hasCode}
          className="btn-secondary flex items-center gap-1.5 py-1.5 px-2 text-xs"
          title="Guardar como archivo"
        >
          <Save size={12} />
          Guardar
        </button>

        <button
          onClick={onValidate}
          disabled={!hasCode || isGenerating}
          className="btn-secondary flex items-center gap-1.5 py-1.5 px-2 text-xs"
          title="Validar código"
        >
          <Check size={12} />
          Validar
        </button>

        <button
          onClick={onExplain}
          disabled={!hasCode || isGenerating || isExplaining}
          className="btn-secondary flex items-center gap-1.5 py-1.5 px-2 text-xs"
          title="Explicar código completo"
        >
          <BookOpen size={12} />
          {isExplaining ? "Explicando..." : "Explicar"}
        </button>

        <button
          onClick={onClear}
          disabled={!hasCode}
          className="btn-secondary flex items-center gap-1.5 py-1.5 px-2 text-xs"
          title="Limpiar editor"
        >
          <Trash2 size={12} />
          Limpiar
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs text-text-secondary">
        {tokenCount > 0 && <span>{tokenCount} tokens</span>}
        {generationTime > 0 && (
          <span>{(generationTime / 1e9).toFixed(1)}s</span>
        )}
      </div>
    </div>
  );
}
