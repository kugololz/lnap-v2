import axios from "axios";
import fs from "fs";
import path from "path";
import { app } from "electron";

// Perfiles de red DIRECTOS (sin pasar por el gateway) para pruebas rapidas
// tuyas contra los puertos crudos de Ollama en el servidor (11434). Se activan
// con la env var OLLAMA_NETWORK=local|tailscale. Cuando se usan, el validador
// tambien cambia a tu copia local (http://localhost:8000) en vez del gateway
// -- ver isDirectDevMode().
const OLLAMA_NETWORK_PROFILES = {
  local: "http://192.168.100.36:11434", // red local de la escuela
  tailscale: "http://100.102.12.86:11434", // fuera de la escuela, via Tailscale
};
const DEFAULT_OLLAMA_NETWORK = "gateway"; // solo etiqueta guardada en config.json

// Gateway publico (nginx + Tailscale Funnel en lnapserver): lo que trae la
// app por defecto, sin configurar nada, para que funcione desde cualquier
// red (casa, escuela, etc). Ollama y el validador NO se exponen directo; todo
// pasa por aqui con la API key en el header X-LNAP-Key. Esto es un piloto de
// investigacion con pocos alumnos, por eso la key va horneada en el codigo en
// vez de en un .env separado por build -- quien descompile la app podria
// extraerla, pero el gateway ya limita que endpoints expone (solo generate,
// tags, validate, health) y aplica rate-limit por IP.
const PUBLIC_GATEWAY_URL = "https://lnapserver.tail836721.ts.net";
const PUBLIC_API_KEY =
  "0a36646dadb96314e664dc95ecad5c0857da34c619e5c340a2e068dee56cd454";

function resolveGatewayUrl() {
  return (process.env.LNAP_GATEWAY_URL || PUBLIC_GATEWAY_URL).replace(
    /\/+$/,
    "",
  );
}

function getAuthHeaders() {
  return { "X-LNAP-Key": process.env.LNAP_API_KEY || PUBLIC_API_KEY };
}

function isDirectDevMode() {
  return Boolean(
    process.env.OLLAMA_NETWORK &&
      OLLAMA_NETWORK_PROFILES[process.env.OLLAMA_NETWORK],
  );
}

function resolveOllamaBaseUrl(network) {
  // Prioridad: OLLAMA_BASE_URL (override total) > OLLAMA_NETWORK explicito
  // (bypass del gateway, para pruebas directas tuyas) > "network" guardado en
  // config.json > gateway publico (default de fabrica).
  if (process.env.OLLAMA_BASE_URL) return process.env.OLLAMA_BASE_URL;

  const envNetwork = process.env.OLLAMA_NETWORK;
  if (envNetwork && OLLAMA_NETWORK_PROFILES[envNetwork]) {
    return OLLAMA_NETWORK_PROFILES[envNetwork];
  }

  if (network && OLLAMA_NETWORK_PROFILES[network]) {
    return OLLAMA_NETWORK_PROFILES[network];
  }

  return `${resolveGatewayUrl()}/ollama`;
}

function resolveValidatorBaseUrl() {
  // Prioridad: VALIDATOR_BASE_URL (override total) > modo dev directo (tu
  // copia local) > gateway publico (default de fabrica).
  if (process.env.VALIDATOR_BASE_URL) return process.env.VALIDATOR_BASE_URL;

  if (isDirectDevMode()) return "http://localhost:8000";

  return resolveGatewayUrl();
}

const DEFAULT_CONFIG = {
  ollama: {
    network: DEFAULT_OLLAMA_NETWORK, // "local" o "tailscale"
    baseUrl: resolveOllamaBaseUrl(DEFAULT_OLLAMA_NETWORK),
    model: "qwen2.5-coder:7b",
    temperature: 0.2,
    topP: 0.9,
    maxTokens: 2048,
    timeout: 120000,
  },
  validator: {
    baseUrl: resolveValidatorBaseUrl(),
    timeout: 30000,
  },
};

const getConfigPath = () => path.join(app.getPath("userData"), "config.json");

function loadConfig() {
  try {
    const p = getConfigPath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf-8");
      const parsed = JSON.parse(raw);
      const merged = {
        ...DEFAULT_CONFIG,
        ...parsed,
        ollama: { ...DEFAULT_CONFIG.ollama, ...parsed.ollama },
        validator: { ...DEFAULT_CONFIG.validator, ...parsed.validator },
      };
      // El baseUrl siempre se resuelve segun env vars / perfil de red vigente,
      // salvo que el usuario haya guardado una baseUrl custom explicita (network: "custom").
      if (merged.ollama.network !== "custom") {
        merged.ollama.baseUrl = resolveOllamaBaseUrl(merged.ollama.network);
      }
      merged.validator.baseUrl = resolveValidatorBaseUrl();
      return merged;
    }
  } catch (err) {
    console.error("[config] Error cargando config:", err);
  }
  return DEFAULT_CONFIG;
}

function saveConfig(config) {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
    return true;
  } catch (err) {
    console.error("[config] Error guardando config:", err);
    return false;
  }
}

let currentConfig = loadConfig();

export function registerIpcHandlers(ipcMain) {
  ipcMain.handle(
    "ollama:generate",
    async (event, { prompt, system, options = {}, format, model: modelOverride }) => {
      const { baseUrl, model, temperature, topP, maxTokens, timeout } =
        currentConfig.ollama;

      try {
        const response = await axios.post(
          `${baseUrl}/api/generate`,
          {
            // modelOverride: para tareas mas livianas (ej. explicar codigo)
            // que no necesitan el modelo grande de generacion.
            model: modelOverride || model,
            prompt,
            system,
            stream: false,
            // "format": "json" fuerza a Ollama a devolver JSON valido (usado
            // por la explicacion de codigo, que pide un objeto estructurado).
            ...(format ? { format } : {}),
            options: {
              temperature: options.temperature ?? temperature,
              top_p: options.topP ?? topP,
              num_predict: options.maxTokens ?? maxTokens,
            },
          },
          { timeout, headers: getAuthHeaders() },
        );

        return {
          success: true,
          response: response.data.response,
          model: response.data.model,
          evalDuration: response.data.eval_duration,
          tokenCount: response.data.eval_count,
        };
      } catch (err) {
        return {
          success: false,
          error:
            err.response?.data?.error || err.message || "Error desconocido",
        };
      }
    },
  );

  ipcMain.handle(
    "ollama:generate-stream",
    async (event, { prompt, system, streamId, options = {} }) => {
      const { baseUrl, model, temperature, topP, maxTokens, timeout } =
        currentConfig.ollama;

      try {
        const response = await axios.post(
          `${baseUrl}/api/generate`,
          {
            model,
            prompt,
            system,
            stream: true,
            options: {
              temperature: options.temperature ?? temperature,
              top_p: options.topP ?? topP,
              num_predict: options.maxTokens ?? maxTokens,
            },
          },
          {
            timeout,
            responseType: "stream",
            headers: getAuthHeaders(),
          },
        );

        let fullText = "";
        let tokenCount = 0;

        return await new Promise((resolve, reject) => {
          let buffer = "";

          response.data.on("data", (chunk) => {
            buffer += chunk.toString("utf-8");
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const data = JSON.parse(line);
                if (data.response) {
                  fullText += data.response;
                  tokenCount++;
                  event.sender.send("ollama:stream-chunk", {
                    streamId,
                    token: data.response,
                    fullText,
                    done: false,
                  });
                }
                if (data.done) {
                  event.sender.send("ollama:stream-chunk", {
                    streamId,
                    fullText,
                    done: true,
                    evalDuration: data.eval_duration,
                    tokenCount: data.eval_count,
                  });
                }
              } catch (parseErr) {
                console.warn("[stream] línea no parseable:", line);
              }
            }
          });

          response.data.on("end", () => {
            resolve({
              success: true,
              response: fullText,
              tokenCount,
            });
          });

          response.data.on("error", (err) => {
            event.sender.send("ollama:stream-chunk", {
              streamId,
              error: err.message,
              done: true,
            });
            reject(err);
          });
        });
      } catch (err) {
        const errorMsg =
          err.response?.data?.error || err.message || "Error desconocido";
        event.sender.send("ollama:stream-chunk", {
          streamId,
          error: errorMsg,
          done: true,
        });
        return { success: false, error: errorMsg };
      }
    },
  );

  ipcMain.handle("ollama:health", async () => {
    try {
      const res = await axios.get(`${currentConfig.ollama.baseUrl}/api/tags`, {
        timeout: 3000,
        headers: getAuthHeaders(),
      });
      return { online: true, models: res.data.models || [] };
    } catch {
      return { online: false, models: [] };
    }
  });

  ipcMain.handle("ollama:list-models", async () => {
    try {
      const res = await axios.get(`${currentConfig.ollama.baseUrl}/api/tags`, {
        timeout: 5000,
        headers: getAuthHeaders(),
      });
      return { success: true, models: res.data.models || [] };
    } catch (err) {
      return { success: false, models: [], error: err.message };
    }
  });

  ipcMain.handle("validator:validate", async (event, { language, code }) => {
    try {
      const res = await axios.post(
        `${currentConfig.validator.baseUrl}/validate`,
        { language, code },
        { timeout: currentConfig.validator.timeout, headers: getAuthHeaders() },
      );
      return res.data;
    } catch (err) {
      return {
        success: false,
        syntaxValid: false,
        functionallyValid: false,
        errors: [
          err.response?.data?.detail ||
            err.message ||
            "Validador no disponible",
        ],
        stdout: "",
        stderr: "",
      };
    }
  });

  ipcMain.handle("validator:health", async () => {
    try {
      const res = await axios.get(`${currentConfig.validator.baseUrl}/health`, {
        timeout: 3000,
        headers: getAuthHeaders(),
      });
      return { online: true, ...res.data };
    } catch {
      return { online: false };
    }
  });

  ipcMain.handle("config:get", () => currentConfig);
  ipcMain.handle("config:set", (event, newConfig) => {
    currentConfig = {
      ...currentConfig,
      ...newConfig,
      ollama: { ...currentConfig.ollama, ...newConfig.ollama },
    };
    if (
      newConfig.ollama?.network &&
      newConfig.ollama.network !== "custom" &&
      !process.env.OLLAMA_BASE_URL &&
      !process.env.OLLAMA_NETWORK
    ) {
      currentConfig.ollama.baseUrl = resolveOllamaBaseUrl(
        newConfig.ollama.network,
      );
    }
    return saveConfig(currentConfig);
  });
}
