import { isElectron, VALIDATOR_BASE_URL, AUTH_HEADERS, DEFAULT_MODEL } from "./backend.js";

export const validatorClient = {
  async validate({ language, code }) {
    if (isElectron) {
      return await window.electronAPI.validateCode({ language, code });
    }
    try {
      const res = await fetch(`${VALIDATOR_BASE_URL}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
        body: JSON.stringify({ language, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          syntaxValid: false,
          functionallyValid: false,
          errors: [data?.detail || `Error del validador (${res.status})`],
          stdout: "",
          stderr: "",
        };
      }
      return data;
    } catch (err) {
      return {
        success: false,
        syntaxValid: false,
        functionallyValid: false,
        errors: [err.message || "Validador no disponible"],
        stdout: "",
        stderr: "",
      };
    }
  },

  async healthCheck() {
    if (isElectron) return await window.electronAPI.validatorHealthCheck();
    try {
      const res = await fetch(`${VALIDATOR_BASE_URL}/health`, { headers: AUTH_HEADERS });
      if (!res.ok) return { online: false };
      const data = await res.json();
      return { online: true, ...data };
    } catch {
      return { online: false };
    }
  },

  async getConfig() {
    if (isElectron) return await window.electronAPI.getConfig();
    // En modo web no hay config.json persistido; reflejamos el modelo fijo
    // que usa el gateway (ver backend.js).
    return { ollama: { model: DEFAULT_MODEL }, validator: {} };
  },
};
