import { LANGUAGE_LIST } from "../prompts/index.js";

export default function LanguageTabs({ active, onChange }) {
  return (
    <div className="flex border-b border-border bg-bg-secondary">
      {LANGUAGE_LIST.map((lang) => {
        const isActive = active === lang.id;
        return (
          <button
            key={lang.id}
            onClick={() => onChange(lang.id)}
            className={`
              relative px-5 py-3 text-sm font-medium transition-colors
              ${
                isActive
                  ? "text-text-bright bg-bg-primary"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }
            `}
          >
            <span
              className="inline-block w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: lang.color }}
            />
            {lang.name}
            {isActive && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: lang.color }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
