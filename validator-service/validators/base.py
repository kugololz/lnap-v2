from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class ValidationResult:
    success: bool
    syntax_valid: bool
    functionally_valid: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    stdout: str = ""
    stderr: str = ""
    execution_time_ms: Optional[int] = None
    language: str = ""

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "syntaxValid": self.syntax_valid,
            "functionallyValid": self.functionally_valid,
            "errors": self.errors,
            "warnings": self.warnings,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "executionTimeMs": self.execution_time_ms,
            "language": self.language,
        }


class BaseValidator(ABC):
    language_id: str = ""

    @abstractmethod
    def syntax_check(self, code: str) -> tuple[bool, list[str]]:
        pass

    @abstractmethod
    def functional_check(self, code: str) -> tuple[bool, str, str, list[str]]:
        pass

    def validate(self, code: str, skip_functional: bool = False) -> ValidationResult:
        result = ValidationResult(
            success=False,
            syntax_valid=False,
            functionally_valid=False,
            language=self.language_id,
        )

        if not code or not code.strip():
            result.errors.append("Código vacío.")
            return result

        try:
            syntax_ok, syntax_errors = self.syntax_check(code)
            result.syntax_valid = syntax_ok
            if not syntax_ok:
                result.errors.extend(syntax_errors)
                return result
        except Exception as e:
            result.errors.append(f"Error en análisis sintáctico: {e}")
            return result

        if skip_functional:
            result.success = True
            return result

        try:
            func_ok, stdout, stderr, func_errors = self.functional_check(code)
            result.functionally_valid = func_ok
            result.stdout = stdout
            result.stderr = stderr
            if func_errors:
                result.errors.extend(func_errors)
            result.success = func_ok
        except Exception as e:
            result.errors.append(f"Error en verificación funcional: {e}")

        return result
    
    def check_toolchain(self) -> bool:
  
        return True