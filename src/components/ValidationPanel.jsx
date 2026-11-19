import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Terminal,
} from "lucide-react";

export default function ValidationPanel({ validation, isValidating }) {
  if (isValidating) {
    return (
      <div className="panel p-3 flex items-center gap-2 text-sm text-text-secondary">
        <Loader2 size={16} className="animate-spin text-accent" />
        Validando código...
      </div>
    );
  }

  if (!validation) {
    return (
      <div className="panel p-3 flex items-center gap-2 text-sm text-text-secondary">
        <Terminal size={16} />
        Genera código para validarlo
      </div>
    );
  }

  const {
    syntaxValid,
    functionallyValid,
    errors = [],
    stdout = "",
    stderr = "",
  } = validation;

  const statusColor = functionallyValid
    ? "status-success"
    : syntaxValid
      ? "status-warning"
      : "status-error";

  const Icon = functionallyValid
    ? CheckCircle2
    : syntaxValid
      ? AlertCircle
      : XCircle;

  const statusText = functionallyValid
    ? "Código válido y funcional"
    : syntaxValid
      ? "Sintaxis correcta, pero falla al ejecutar"
      : "Errores de sintaxis detectados";

  return (
    <div className="panel flex flex-col max-h-60">
      <div
        className={`flex items-center gap-2 px-3 py-2 border-b border-border text-${statusColor}`}
      >
        <Icon size={16} />
        <span className="text-sm font-medium">{statusText}</span>
      </div>

      <div className="p-3 overflow-auto font-mono text-xs space-y-2">
        {errors.length > 0 && (
          <div className="text-status-error">
            <div className="font-sans font-semibold mb-1">Errores:</div>
            {errors.map((err, i) => (
              <div key={i} className="whitespace-pre-wrap">
                {err}
              </div>
            ))}
          </div>
        )}

        {stdout && (
          <div className="text-text-primary">
            <div className="font-sans font-semibold mb-1 text-text-secondary">
              Salida:
            </div>
            <pre className="whitespace-pre-wrap">{stdout}</pre>
          </div>
        )}

        {stderr && (
          <div className="text-status-warning">
            <div className="font-sans font-semibold mb-1">Stderr:</div>
            <pre className="whitespace-pre-wrap">{stderr}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
