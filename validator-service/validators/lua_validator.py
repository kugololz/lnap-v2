import shutil
from .base import BaseValidator
from sandbox.runner import Sandbox


IO_READ_STUB = """
local __lnap_values = {"42", "10", "hola", "5", "1"}
local __lnap_idx = 1
local __lnap_original_read = io.read
io.read = function(...)
    local v = __lnap_values[__lnap_idx] or "0"
    __lnap_idx = __lnap_idx + 1
    return v
end
"""


class LuaValidator(BaseValidator):
    language_id = "lua"

    def check_toolchain(self) -> bool:
        return shutil.which("lua") is not None and shutil.which("luac") is not None

    def syntax_check(self, code: str) -> tuple[bool, list[str]]:
        with Sandbox(timeout_seconds=5) as sb:
            sb.write_file("program.lua", code)
            result = sb.run(["luac", "-p", "program.lua"])

            if result.success:
                return True, []

            errors = []
            for line in result.stderr.strip().split("\n"):
                if line.strip():
                    cleaned = line.replace("luac: program.lua:", "Línea ")
                    cleaned = cleaned.replace("luac:", "").strip()
                    errors.append(cleaned)
            return False, errors or [result.stderr]

    def functional_check(self, code: str) -> tuple[bool, str, str, list[str]]:
        wrapped = IO_READ_STUB + "\n" + code

        with Sandbox(timeout_seconds=8) as sb:
            sb.write_file("program.lua", wrapped)
            result = sb.run(["lua", "program.lua"])

            errors = []
            if not result.success and result.stderr:
                errors.append(result.stderr.strip())
            elif result.timed_out:
                errors.append("Timeout: posible loop infinito")

            return result.success, result.stdout, result.stderr, errors