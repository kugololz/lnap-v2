import { useRef, useEffect } from "react";
import { Sparkles } from "lucide-react";

const EXAMPLES = [
  "Pide un número al usuario y dime si es par o impar",
  "Genera los primeros 10 números de Fibonacci",
  "Crea una función que reciba un arreglo y devuelva el máximo",
  "Lee una frase y cuenta cuántas vocales tiene",
];

export default function NaturalInput({ value, onChange, onSubmit, disabled }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!disabled && value.trim()) onSubmit?.();
    }
  };

  const useExample = (text) => {
    onChange(text);
    textareaRef.current?.focus();
  };

  return (
    <div className="panel p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <Sparkles size={14} className="text-accent" />
          Describe lo que quieres programar
        </div>
        <span className="text-xs text-text-secondary">
          {value.length} caracteres · ⌘+Enter para traducir
        </span>
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Ej: Crea un programa que pida dos números y muestre su suma..."
        className="
          w-full resize-none bg-bg-tertiary border border-border rounded-md
          p-3 text-sm text-text-primary placeholder:text-text-secondary/60
          focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
          min-h-[80px] font-sans
        "
      />

      {!value && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-text-secondary self-center mr-1">
            Ejemplos:
          </span>
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => useExample(ex)}
              className="
                text-xs px-2 py-1 rounded-md bg-bg-tertiary hover:bg-bg-hover
                text-text-secondary hover:text-text-primary border border-border
                transition-colors
              "
            >
              {ex.slice(0, 45)}
              {ex.length > 45 ? "..." : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
