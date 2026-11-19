const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  ollamaGenerate: (payload) => ipcRenderer.invoke("ollama:generate", payload),
  ollamaGenerateStream: (payload) =>
    ipcRenderer.invoke("ollama:generate-stream", payload),
  ollamaHealthCheck: () => ipcRenderer.invoke("ollama:health"),
  ollamaListModels: () => ipcRenderer.invoke("ollama:list-models"),

  onOllamaStreamChunk: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("ollama:stream-chunk", handler);
    return () => ipcRenderer.removeListener("ollama:stream-chunk", handler);
  },

  validateCode: (payload) => ipcRenderer.invoke("validator:validate", payload),
  validatorHealthCheck: () => ipcRenderer.invoke("validator:health"),

  getConfig: () => ipcRenderer.invoke("config:get"),
  setConfig: (config) => ipcRenderer.invoke("config:set", config),
});
