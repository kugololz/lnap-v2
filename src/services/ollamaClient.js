import { explainPrompt } from "../prompts/explain.js";
import {
  isElectron,
  OLLAMA_BASE_URL,
  AUTH_HEADERS,
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  DEFAULT_TOP_P,
  DEFAULT_MAX_TOKENS,
} from "./backend.js";

let streamCounter = 0;

// Explicar codigo es una tarea mas simple que generarlo, asi que usamos un
// modelo mucho mas chico y rapido (~3x mas rapido en este servidor). Su
// ventana de contexto es de solo 4096 tokens (vs 32768 del modelo grande),
// asi que para codigo largo caemos de vuelta al modelo grande para no
// arriesgar que se corte el prompt.
const EXPLAIN_MODEL_FAST = "qwen2.5-coder:1.5b";
const EXPLAIN_FAST_MODEL_MAX_CHARS = 3000;

// Los modelos locales pequeños no siempre agrupan bien los bloques (a veces
// separan un "if" de su cuerpo en dos bloques). Si dos bloques quedan
// contiguos en el código original (solo espacios/saltos de línea entre
// ellos), los fusionamos en uno solo - mejora garantizada sin depender de
// que el modelo siga instrucciones de formato al pie de la letra.
function mergeAdjacentBlocks(code, blocks) {
  let cursor = 0;
  const located = [];

  for (const b of blocks) {
    if (typeof b?.code !== "string" || !b.code) continue;
    const idx = code.indexOf(b.code, cursor);
    if (idx === -1) {
      located.push({ ...b, start: -1, end: -1 });
      continue;
    }
    located.push({ ...b, start: idx, end: idx + b.code.length });
    cursor = idx + b.code.length;
  }

  const merged = [];
  for (const block of located) {
    const prev = merged[merged.length - 1];
    const gap = prev && prev.start >= 0 && block.start >= 0
      ? code.slice(prev.end, block.start)
      : null;
    // Fusionar solo si entre ambos bloques no hay nada mas que espacios (el
    // segundo es literalmente el siguiente renglon) Y esos espacios no
    // incluyen una linea en blanco completa: una linea en blanco suele
    // marcar el limite entre dos secciones distintas (ej. fin de una
    // funcion e inicio de la siguiente), y ahi NO se debe fusionar aunque
    // el modelo se haya saltado explicar algo en medio.
    const isAdjacent =
      gap !== null && /^\s*$/.test(gap) && !/\n[ \t]*\n/.test(gap);

    if (isAdjacent) {
      prev.code = code.slice(prev.start, block.end);
      prev.end = block.end;
      prev.explanation = `${prev.explanation} ${block.explanation}`;
    } else {
      merged.push({ ...block });
    }
  }

  return merged.map(({ code: c, explanation }) => ({ code: c, explanation }));
}

// ─── Llamada directa al gateway, para cuando no hay Electron de por medio ───
async function webGenerate({ prompt, system, options = {}, format, model }) {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        prompt,
        system,
        stream: false,
        ...(format ? { format } : {}),
        options: {
          temperature: options.temperature ?? DEFAULT_TEMPERATURE,
          top_p: options.topP ?? DEFAULT_TOP_P,
          num_predict: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data?.error || `Error del servidor (${res.status})` };
    }
    return {
      success: true,
      response: data.response,
      model: data.model,
      evalDuration: data.eval_duration,
      tokenCount: data.eval_count,
    };
  } catch (err) {
    return { success: false, error: err.message || "Error desconocido" };
  }
}

async function webGenerateStream({ prompt, system, onToken, onDone, onError, options = {} }) {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        prompt,
        system,
        stream: true,
        options: {
          temperature: options.temperature ?? DEFAULT_TEMPERATURE,
          top_p: options.topP ?? DEFAULT_TOP_P,
          num_predict: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        },
      }),
    });

    if (!res.ok || !res.body) {
      const msg = `Error del servidor (${res.status})`;
      onError?.(msg);
      return { success: false, error: msg };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    let tokenCount = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.response) {
            fullText += data.response;
            tokenCount++;
            onToken?.(data.response, fullText);
          }
          if (data.done) {
            onDone?.({
              fullText,
              tokenCount: data.eval_count,
              evalDuration: data.eval_duration,
            });
          }
        } catch {
          console.warn("[stream] línea no parseable:", line);
        }
      }
    }

    return { success: true, response: fullText, tokenCount };
  } catch (err) {
    onError?.(err.message);
    return { success: false, error: err.message || "Error desconocido" };
  }
}

export const ollamaClient = {
  async generate({ prompt, system, options = {}, format, model }) {
    if (isElectron) {
      return await window.electronAPI.ollamaGenerate({ prompt, system, options, format, model });
    }
    return await webGenerate({ prompt, system, options, format, model });
  },

  /**
   * @param {Object} params
   * @param {string} params.prompt
   * @param {string} params.system
   * @param {Function} params.onToken
   * @param {Function} [params.onDone]
   * @param {Function} [params.onError]
   * @param {Object} [params.options]
   * @returns {Promise<{success, response, tokenCount}>}
   */
  async generateStream({
    prompt,
    system,
    onToken,
    onDone,
    onError,
    options = {},
  }) {
    if (!isElectron) {
      return await webGenerateStream({ prompt, system, onToken, onDone, onError, options });
    }

    const streamId = `stream-${++streamCounter}-${Date.now()}`;

    const unsubscribe = window.electronAPI.onOllamaStreamChunk((data) => {
      if (data.streamId !== streamId) return;

      if (data.error) {
        onError?.(data.error);
        unsubscribe();
        return;
      }

      if (data.token) {
        onToken?.(data.token, data.fullText);
      }

      if (data.done) {
        onDone?.({
          fullText: data.fullText,
          tokenCount: data.tokenCount,
          evalDuration: data.evalDuration,
        });
        unsubscribe();
      }
    });

    try {
      const result = await window.electronAPI.ollamaGenerateStream({
        prompt,
        system,
        streamId,
        options,
      });
      return result;
    } catch (err) {
      unsubscribe();
      onError?.(err.message);
      return { success: false, error: err.message };
    }
  },

  /**
   * Pide a la IA una explicación estructurada de un fragmento de código
   * (el código completo generado, o solo una selección del usuario).
   * @param {Object} params
   * @param {string} params.code
   * @param {string} params.languageName - nombre legible del lenguaje (ej. "Python")
   * @returns {Promise<{success: boolean, summary?: string, blocks?: Array<{code:string, explanation:string}>, error?: string}>}
   */
  async explain({ code, languageName }) {
    if (!code?.trim()) return { success: false, error: "Sin código para explicar" };

    const model =
      code.length > EXPLAIN_FAST_MODEL_MAX_CHARS ? undefined : EXPLAIN_MODEL_FAST;

    const result = await ollamaClient.generate({
      prompt: explainPrompt.buildUserPrompt(code, languageName),
      system: explainPrompt.system,
      format: "json",
      model,
      options: { temperature: 0.1, maxTokens: 1200 },
    });

    if (!result.success) return { success: false, error: result.error };

    try {
      const parsed = JSON.parse(result.response);
      const rawBlocks = Array.isArray(parsed.blocks)
        ? parsed.blocks.filter((b) => b?.code && b?.explanation)
        : [];
      return {
        success: true,
        summary: typeof parsed.summary === "string" ? parsed.summary : "",
        blocks: mergeAdjacentBlocks(code, rawBlocks),
      };
    } catch {
      return {
        success: false,
        error: "La IA no devolvió un formato de explicación válido.",
      };
    }
  },

  async healthCheck() {
    if (isElectron) return await window.electronAPI.ollamaHealthCheck();
    try {
      const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { headers: AUTH_HEADERS });
      if (!res.ok) return { online: false, models: [] };
      const data = await res.json();
      return { online: true, models: data.models || [] };
    } catch {
      return { online: false, models: [] };
    }
  },

  async listModels() {
    if (isElectron) return await window.electronAPI.ollamaListModels();
    try {
      const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { headers: AUTH_HEADERS });
      if (!res.ok) return { success: false, models: [], error: `HTTP ${res.status}` };
      const data = await res.json();
      return { success: true, models: data.models || [] };
    } catch (err) {
      return { success: false, models: [], error: err.message };
    }
  },

  extractCodeBlock(text, language = null) {
    if (!text) return "";

    if (language) {
      const langPattern = new RegExp(
        `\`\`\`(?:${language}|${language.toLowerCase()})\\s*\\n([\\s\\S]*?)\`\`\``,
        "i",
      );
      const match = text.match(langPattern);
      if (match) return match[1].trim();
    }

    const anyBlock = text.match(/```(?:\w+)?\s*\n?([\s\S]*?)```/);
    if (anyBlock) return anyBlock[1].trim();

    return text.trim();
  },

  extractPartialCode(text) {
    if (!text) return "";

    const openMatch = text.match(/```(?:\w+)?\s*\n?/);
    if (!openMatch) return "";

    const afterOpen = text.substring(openMatch.index + openMatch[0].length);
    const closeIdx = afterOpen.indexOf("```");

    if (closeIdx === -1) {
      return afterOpen;
    }
    return afterOpen.substring(0, closeIdx).trim();
  },
};
