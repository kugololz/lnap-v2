import { useState, useEffect } from "react";
import { History, X, Trash2, ChevronRight } from "lucide-react";
import { LANGUAGES } from "../prompts/index.js";

const HISTORY_KEY = "lnap-history";
const MAX_HISTORY = 50;

export function useHistory() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  const add = (entry) => {
    const newEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    const updated = [newEntry, ...history].slice(0, MAX_HISTORY);
    setHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  };

  const remove = (id) => {
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  };

  const clear = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  return { history, add, remove, clear };
}

export default function HistoryPanel({
  open,
  onClose,
  history,
  onSelect,
  onRemove,
  onClear,
}) {
  if (!open) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 bg-bg-secondary border-l border-border z-40 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <History size={16} className="text-accent" />
          <span className="font-medium text-text-primary">Historial</span>
          <span className="text-xs text-text-secondary">
            ({history.length})
          </span>
        </div>
        <div className="flex items-center gap-1">
          {history.length > 0 && (
            <button
              onClick={onClear}
              className="p-1 hover:bg-bg-hover rounded text-text-secondary hover:text-status-error"
              title="Limpiar historial"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={onClose} className="p-1 hover:bg-bg-hover rounded">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {history.length === 0 ? (
          <div className="p-6 text-center text-sm text-text-secondary">
            Sin traducciones todavía.
            <br />
            Tus prompts aparecerán aquí.
          </div>
        ) : (
          <div className="py-2">
            {history.map((item) => {
              const lang = LANGUAGES[item.language];
              const date = new Date(item.timestamp);
              const timeStr = date.toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const dateStr = date.toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "short",
              });

              return (
                <div
                  key={item.id}
                  className="group relative px-3 py-2 hover:bg-bg-hover cursor-pointer border-l-2 border-transparent hover:border-accent"
                  onClick={() => onSelect(item)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: lang?.color }}
                    />
                    <span className="text-xs font-medium text-text-primary">
                      {lang?.name}
                    </span>
                    <span className="text-xs text-text-secondary ml-auto">
                      {dateStr} · {timeStr}
                    </span>
                  </div>
                  <div className="text-xs text-text-secondary line-clamp-2 pr-6">
                    {item.prompt}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                    className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-bg-tertiary rounded"
                  >
                    <X size={12} className="text-text-secondary" />
                  </button>
                  <ChevronRight
                    size={14}
                    className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 text-text-secondary"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
