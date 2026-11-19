import { Circle } from "lucide-react";
import { LANGUAGES } from "../prompts/index.js";

export default function StatusBar({
  ollamaHealth,
  validatorHealth,
  language,
  model,
}) {
  const lang = LANGUAGES[language];

  return (
    <div className="flex items-center justify-between px-3 py-1 bg-bg-secondary border-t border-border text-xs text-text-secondary">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Circle
            size={8}
            className={
              ollamaHealth?.online
                ? "fill-status-success text-status-success"
                : "fill-status-error text-status-error"
            }
          />
          <span>
            Ollama {ollamaHealth?.online ? "conectado" : "desconectado"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Circle
            size={8}
            className={
              validatorHealth?.online
                ? "fill-status-success text-status-success"
                : "fill-status-warning text-status-warning"
            }
          />
          <span>
            Validador {validatorHealth?.online ? "activo" : "inactivo"}
          </span>
        </div>

        {model && <span className="text-text-secondary">Modelo: {model}</span>}
      </div>

      <div className="flex items-center gap-3">
        <span style={{ color: lang?.color }}>{lang?.name}</span>
        <span>UTF-8</span>
        <span>LNAP v2</span>
      </div>
    </div>
  );
}
