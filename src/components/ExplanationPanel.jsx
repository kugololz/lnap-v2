import { Loader2, BookOpen, AlertCircle } from "lucide-react";

// Franja compacta con el resumen general del código. El detalle por bloque
// ya no vive aquí: se muestra al pasar el mouse sobre el código resaltado
// en el editor (ver CodeEditor.jsx), para no ocupar espacio extra en pantalla.
export default function ExplanationPanel({ explanation, isExplaining }) {
  if (isExplaining) {
    return (
      <div className="panel px-3 py-2 flex items-center gap-2 text-sm text-text-secondary">
        <Loader2 size={16} className="animate-spin text-accent" />
        Generando explicación...
      </div>
    );
  }

  if (!explanation) {
    return (
      <div className="panel px-3 py-2 flex items-center gap-2 text-sm text-text-secondary">
        <BookOpen size={16} />
        Pasa el mouse sobre el código subrayado para ver su explicación
      </div>
    );
  }

  if (!explanation.success) {
    return (
      <div className="panel px-3 py-2 flex items-center gap-2 text-sm text-status-error">
        <AlertCircle size={16} />
        {explanation.error || "No se pudo generar la explicación."}
      </div>
    );
  }

  return (
    <div className="panel px-3 py-2 flex items-start gap-2 text-sm">
      <BookOpen size={16} className="text-accent mt-0.5 shrink-0" />
      <p className="text-text-primary leading-relaxed">{explanation.summary}</p>
    </div>
  );
}
