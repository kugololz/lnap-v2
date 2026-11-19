import ast
import shutil
from .base import BaseValidator
from sandbox.runner import Sandbox


INPUT_STUB = """
import builtins as __lnap_builtins
__lnap_input_values = iter(["42", "10", "hola", "5", "1", "test"])
def __lnap_stub_input(prompt=""):
    try:
        val = next(__lnap_input_values)
    except StopIteration:
        val = "0"
    print(prompt + val)
    return val
__lnap_builtins.input = __lnap_stub_input
"""


class PythonValidator(BaseValidator):
    language_id = "python"

    def check_toolchain(self) -> bool:
        return shutil.which("python3") is not None

    def syntax_check(self, code: str) -> tuple[bool, list[str]]:
        try:
            ast.parse(code)
            return True, []
        except SyntaxError as e:
            msg = f"Línea {e.lineno}: {e.msg}"
            if e.text:
                msg += f"\n    {e.text.rstrip()}"
                if e.offset:
                    msg += f"\n    {' ' * (e.offset - 1)}^"
            return False, [msg]

    def functional_check(self, code: str) -> tuple[bool, str, str, list[str]]:
        wrapped = INPUT_STUB + "\n" + code

        with Sandbox(timeout_seconds=8) as sb:
            sb.write_file("program.py", wrapped)
            result = sb.run(["python3", "program.py"])

            errors = []
            if not result.success and result.stderr:
                cleaned_stderr = result.stderr.replace(INPUT_STUB.strip(), "").strip()
                errors.append(self._parse_python_error(cleaned_stderr))
            elif result.timed_out:
                errors.append("Ejecución cancelada por timeout (posible loop infinito)")

            return result.success, result.stdout, result.stderr, errors

    def _parse_python_error(self, stderr: str) -> str:
        """Extrae la parte útil del traceback para mostrar al usuario."""
        lines = stderr.strip().split("\n")
        if lines:
            error_type = lines[-1]
            for line in reversed(lines):
                if line.strip().startswith('File "<') or 'program.py' in line:
                    return f"{error_type}\n  en {line.strip()}"
            return error_type
        return stderr