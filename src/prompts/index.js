import { csharpPrompt } from "./csharp.js";
import { luaPrompt } from "./lua.js";
import { pythonPrompt } from "./python.js";
import { cppPrompt } from "./cpp.js";

export const LANGUAGES = {
  csharp: {
    id: "csharp",
    name: "C#",
    monacoLang: "csharp",
    extension: "cs",
    prompt: csharpPrompt,
    color: "#9b4f96",
  },
  lua: {
    id: "lua",
    name: "Lua",
    monacoLang: "lua",
    extension: "lua",
    prompt: luaPrompt,
    color: "#000080",
  },
  python: {
    id: "python",
    name: "Python",
    monacoLang: "python",
    extension: "py",
    prompt: pythonPrompt,
    color: "#3776ab",
  },
  cpp: {
    id: "cpp",
    name: "C++",
    monacoLang: "cpp",
    extension: "cpp",
    prompt: cppPrompt,
    color: "#00599c",
  },
};

export const LANGUAGE_LIST = Object.values(LANGUAGES);
