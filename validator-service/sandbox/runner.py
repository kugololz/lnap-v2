import os
import shlex
import signal
import subprocess
import tempfile
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class ExecutionResult:
    success: bool
    stdout: str
    stderr: str
    returncode: int
    timed_out: bool
    error: Optional[str] = None


class Sandbox:
    # Limites por proceso, aplicados via `ulimit` en un sub-shell (en vez de
    # preexec_fn + resource.setrlimit, que puede causar deadlocks al forkear
    # desde un hilo -- este servicio corre validaciones en threads). Frenan
    # fugas de memoria y llenado de disco, accidentales o intencionales, en
    # codigo generado por el LLM. RLIMIT_NPROC se deja fuera a proposito: es
    # un limite por UID real (no por sub-arbol), y en una maquina donde esa
    # cuenta ya corre otros procesos, un limite bajo rompe el primer fork.
    # No sustituyen aislamiento real (contenedores/cgroups) -- eso es el
    # siguiente nivel si esto se expone publicamente.
    MAX_MEMORY_KB = 2 * 1024 * 1024  # 2GB de address space (dotnet/g++ reservan bastante)
    MAX_FILE_BLOCKS = (50 * 1024 * 1024) // 512  # 50MB por archivo escrito

    def __init__(self, timeout_seconds: int = 10):
        self.timeout_seconds = timeout_seconds
        self._tmpdir: Optional[Path] = None

    def __enter__(self):
        self._tmpdir = Path(tempfile.mkdtemp(prefix="lnap_sandbox_"))
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._tmpdir and self._tmpdir.exists():
            shutil.rmtree(self._tmpdir, ignore_errors=True)

    @property
    def dir(self) -> Path:
        if not self._tmpdir:
            raise RuntimeError("Sandbox no inicializado (usar 'with')")
        return self._tmpdir

    def write_file(self, filename: str, content: str) -> Path:
        path = self.dir / filename
        path.write_text(content, encoding="utf-8")
        return path

    def _wrap_with_ulimits(
        self,
        cmd: list[str],
        cpu_seconds: int,
        limit_memory: bool = True,
        limit_file: bool = True,
    ) -> list[str]:
        quoted = " ".join(shlex.quote(c) for c in cmd)
        # 2>/dev/null: si un limite no aplica en esta plataforma, seguir de
        # todos modos en vez de abortar el exec.
        parts = [f"ulimit -t {cpu_seconds}"]
        if limit_memory:
            parts.append(f"-v {self.MAX_MEMORY_KB}")
        if limit_file:
            parts.append(f"-f {self.MAX_FILE_BLOCKS}")
        ulimits = " ".join(parts) + " 2>/dev/null"
        return ["bash", "-c", f"{ulimits}; exec {quoted}"]

    def run(
        self,
        cmd: list[str],
        stdin: Optional[str] = None,
        timeout: Optional[int] = None,
        env: Optional[dict] = None,
        limit_memory: bool = True,
        limit_file: bool = True,
    ) -> ExecutionResult:
        """limit_memory=False: para runtimes que reservan mucho address space
        de entrada (ej. CoreCLR, que puede pedir >8GB virtuales solo para
        inicializar en maquinas con varios cores/RAM). limit_file=False: para
        runtimes cuya propia inicializacion (no el codigo del alumno) escribe
        caches internos que superan el tope de 50MB (ej. dotnet regenerando
        cache de workloads/templates en un HOME temporal nuevo cada vez). El
        limite de CPU se mantiene siempre."""

        effective_timeout = timeout or self.timeout_seconds
        # Margen sobre el timeout de pared: ulimit -t cuenta CPU-time, y un
        # build multi-hilo (dotnet) puede consumir mas CPU-time que wall-time.
        # El corte real por tiempo lo sigue haciendo el timeout de Popen.
        cpu_limit = max(effective_timeout * 4, 30)
        wrapped_cmd = self._wrap_with_ulimits(
            cmd, cpu_limit, limit_memory=limit_memory, limit_file=limit_file
        )

        run_env = {
            "PATH": os.environ.get("PATH", ""),
            "HOME": str(self.dir),
            "LANG": "en_US.UTF-8",
        }
        if env:
            run_env.update(env)

        process = None
        try:
            process = subprocess.Popen(
                wrapped_cmd,
                cwd=str(self.dir),
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=run_env,
                start_new_session=True,  # grupo propio: permite matar hijos huerfanos
            )
            stdout, stderr = process.communicate(input=stdin, timeout=effective_timeout)

            if process.returncode == 127 and "command not found" in (stderr or ""):
                return ExecutionResult(
                    success=False,
                    stdout=stdout or "",
                    stderr=f"Comando no encontrado: {cmd[0]}. ¿Está instalado y en el PATH?",
                    returncode=-1,
                    timed_out=False,
                    error="command_not_found",
                )

            return ExecutionResult(
                success=process.returncode == 0,
                stdout=stdout or "",
                stderr=stderr or "",
                returncode=process.returncode,
                timed_out=False,
            )
        except subprocess.TimeoutExpired:
            self._kill_group(process)
            try:
                stdout, stderr = process.communicate(timeout=2)
            except Exception:
                stdout, stderr = "", ""
            return ExecutionResult(
                success=False,
                stdout=stdout or "",
                stderr=f"Tiempo agotado ({effective_timeout}s). El programa posiblemente tiene un loop infinito o espera entrada.",
                returncode=-1,
                timed_out=True,
                error="timeout",
            )
        except FileNotFoundError:
            return ExecutionResult(
                success=False,
                stdout="",
                stderr=f"Comando no encontrado: {cmd[0]}. ¿Está instalado y en el PATH?",
                returncode=-1,
                timed_out=False,
                error="command_not_found",
            )
        except Exception as e:
            if process is not None:
                self._kill_group(process)
            return ExecutionResult(
                success=False,
                stdout="",
                stderr=f"Error ejecutando: {type(e).__name__}: {e}",
                returncode=-1,
                timed_out=False,
                error="execution_error",
            )

    @staticmethod
    def _kill_group(process: "subprocess.Popen") -> None:
        try:
            os.killpg(os.getpgid(process.pid), signal.SIGKILL)
        except (ProcessLookupError, PermissionError, OSError):
            try:
                process.kill()
            except Exception:
                pass
