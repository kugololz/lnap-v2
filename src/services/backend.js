// Detecta si corremos dentro de Electron (con IPC via preload.cjs) o en un
// navegador normal (build web hosteado en lnap.dev). En el segundo caso no
// hay proceso de Node que hable con Ollama/el validador por nosotros, así
// que el navegador le pega directo al mismo gateway público (nginx +
// Tailscale Funnel) que ya usa la app de escritorio.
export const isElectron =
  typeof window !== "undefined" && !!window.electronAPI;

// Mismo gateway/clave que electron/ipc-handlers.js (PUBLIC_GATEWAY_URL /
// PUBLIC_API_KEY) — deben mantenerse en sync manualmente si se rota la key.
const GATEWAY_URL = "https://lnapserver.tail836721.ts.net";
const API_KEY = "0a36646dadb96314e664dc95ecad5c0857da34c619e5c340a2e068dee56cd454";

export const OLLAMA_BASE_URL = `${GATEWAY_URL}/ollama`;
export const VALIDATOR_BASE_URL = GATEWAY_URL;
export const AUTH_HEADERS = { "X-LNAP-Key": API_KEY };

// Defaults que en la app de escritorio vienen de config.json (ver
// DEFAULT_CONFIG en electron/ipc-handlers.js). En modo web no hay config
// persistido, así que quedan fijos aquí — deben coincidir con esos defaults.
export const DEFAULT_MODEL = "qwen2.5-coder:7b";
export const DEFAULT_TEMPERATURE = 0.2;
export const DEFAULT_TOP_P = 0.9;
export const DEFAULT_MAX_TOKENS = 2048;
