import shutil
from .base import BaseValidator
from sandbox.runner import Sandbox


CIN_STUB_STDIN = "42\n10\nhola\n5\n1\n"


class CppValidator(BaseValidator):
    language_id = "cpp"

    def check_toolchain(self) -> bool:
        return shutil.which("g++") is not None or shutil.which("clang++") is not None

    def _get_compiler(self) -> str:
        return "g++" if shutil.which("g++") else "clang++"

    def syntax_check(self, code: str) -> tuple[bool, list[str]]:
        with Sandbox(timeout_seconds=10) as sb:
            sb.write_file("program.cpp", code)
            result = sb.run([
                self._get_compiler(),
                "-std=c++17",
                "-fsyntax-only",
                "program.cpp",
            ])

            if result.success:
                return True, []

            errors = self._parse_gcc_errors(result.stderr)
            return False, errors

    def functional_check(self, code: str) -> tuple[bool, str, str, list[str]]:
        with Sandbox(timeout_seconds=15) as sb:
            sb.write_file("program.cpp", code)

            # 1. Compilar
            compile_result = sb.run([
                self._get_compiler(),
                "-std=c++17",
                "-O0",
                "-o", "program",
                "program.cpp",
            ], timeout=10)

            if not compile_result.success:
                return (
                    False,
                    "",
                    compile_result.stderr,
                    self._parse_gcc_errors(compile_result.stderr),
                )

            run_result = sb.run(["./program"], stdin=CIN_STUB_STDIN, timeout=8)

            errors = []
            if run_result.timed_out:
                errors.append("Timeout al ejecutar (posible loop infinito)")
            elif not run_result.success and run_result.returncode != 0:
                errors.append(f"El programa terminó con código {run_result.returncode}")

            return run_result.success, run_result.stdout, run_result.stderr, errors

    def _parse_gcc_errors(self, stderr: str) -> list[str]:
        errors = []
        for line in stderr.split("\n"):
            line = line.strip()
            if not line:
                continue
            if "program.cpp:" in line and ("error:" in line or "warning:" in line):
                cleaned = line.replace("program.cpp:", "Línea ")
                errors.append(cleaned)
            elif "fatal error:" in line:
                errors.append(line)
        return errors if errors else [stderr[:500]]