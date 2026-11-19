import asyncio
import logging
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from validators.python_validator import PythonValidator
from validators.lua_validator import LuaValidator
from validators.csharp_validator import CSharpValidator
from validators.cpp_validator import CppValidator

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("lnap-validator")

app = FastAPI(
    title="LNAP Validator Service",
    version="2.0.0",
    description="Servicio de validación sintáctica y funcional para código generado",
)

# Orígenes permitidos por CORS, configurables por env var (igual que
# OLLAMA_NETWORK) para cuando esto se sirva desde un dominio público en vez
# de solo la app de Electron / dev server local.
_DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
_allowed_origins = [
    o.strip()
    for o in os.environ.get("VALIDATOR_ALLOWED_ORIGINS", _DEFAULT_ORIGINS).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

VALIDATORS = {
    "python": PythonValidator(),
    "lua": LuaValidator(),
    "csharp": CSharpValidator(),
    "cpp": CppValidator(),
}


class ValidateRequest(BaseModel):
    language: str = Field(..., description="Identificador del lenguaje")
    code: str = Field(..., description="Código fuente a validar")
    skip_functional: bool = Field(False, description="Si true, solo valida sintaxis")


@app.get("/health")
async def health():
    """Chequeo de salud del servicio."""
    return {
        "status": "ok",
        "languages": list(VALIDATORS.keys()),
        "version": "2.0.0",
    }


@app.get("/languages")
async def languages():
    status = {}
    for lang_id, validator in VALIDATORS.items():
        status[lang_id] = {
            "id": lang_id,
            "available": validator.check_toolchain(),
        }
    return status


@app.post("/validate")
async def validate(req: ValidateRequest):
    validator = VALIDATORS.get(req.language)
    if not validator:
        raise HTTPException(
            status_code=400,
            detail=f"Lenguaje no soportado: {req.language}. Soportados: {list(VALIDATORS.keys())}",
        )

    logger.info(f"Validando {req.language} ({len(req.code)} chars)")

    try:
        # A hilo aparte: validator.validate() usa subprocess.run bloqueante
        # (compila/ejecuta código real). Sin esto, con un solo worker de
        # uvicorn, cada validación concurrente esperaba en fila a la anterior.
        result = await asyncio.to_thread(
            validator.validate, req.code, skip_functional=req.skip_functional
        )
        return result.to_dict()
    except Exception as e:
        logger.exception("Error durante validación")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")