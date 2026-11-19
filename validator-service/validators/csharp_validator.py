import shutil
import os
from pathlib import Path
from .base import BaseValidator
from sandbox.runner import Sandbox


CONSOLE_STDIN = "42\n10\nhola\n5\n1\n"

CSPROJ_TEMPLATE = """<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>disable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <RootNamespace>LnapProgram</RootNamespace>
    <AssemblyName>program</AssemblyName>
  </PropertyGroup>
</Project>
"""


class CSharpValidator(BaseValidator):
    language_id = "csharp"

    def check_toolchain(self) -> bool:
        return shutil.which("dotnet") is not None

    def syntax_check(self, code: str) -> tuple[bool, list[str]]:
        with Sandbox(timeout_seconds=60) as sb:
            sb.write_file("program.csproj", CSPROJ_TEMPLATE)
            sb.write_file("Program.cs", code)

            result = sb.run(
                ["dotnet", "build", "-v", "quiet", "--nologo"],
                timeout=45,
                env={
                    "DOTNET_CLI_TELEMETRY_OPTOUT": "1",
                    "DOTNET_NOLOGO": "1",
                    "DOTNET_SKIP_FIRST_TIME_EXPERIENCE": "1",
                    "DOTNET_gcServer": "0",
                },
                # CoreCLR reserva memoria virtual segun cores/RAM de la maquina
                # al iniciar (puede pedir >8GB solo para inicializar en un
                # servidor con varios cores) -- el ulimit -v del sandbox lo
                # tumba con "Failed to create CoreCLR" aunque el programa en
                # si no use nada de esa memoria. Ademas, con un HOME temporal
                # nuevo en cada corrida, dotnet regenera caches internos
                # (workloads/templates) que pueden superar el limite de
                # tamaño de archivo. El limite de CPU es el unico que se
                # mantiene siempre.
                limit_memory=False,
                limit_file=False,
            )

            if result.success:
                return True, []

            errors = self._parse_dotnet_errors(result.stdout + "\n" + result.stderr)
            return False, errors

    def functional_check(self, code: str) -> tuple[bool, str, str, list[str]]:
        with Sandbox(timeout_seconds=90) as sb:
            sb.write_file("program.csproj", CSPROJ_TEMPLATE)
            sb.write_file("Program.cs", code)

            env = {
                "DOTNET_CLI_TELEMETRY_OPTOUT": "1",
                "DOTNET_NOLOGO": "1",
                "DOTNET_SKIP_FIRST_TIME_EXPERIENCE": "1",
                "DOTNET_gcServer": "0",
            }

            build_result = sb.run(
                ["dotnet", "build", "-c", "Release", "-v", "quiet", "--nologo"],
                timeout=60,
                env=env,
                limit_memory=False,
                limit_file=False,
            )

            if not build_result.success:
                errors = self._parse_dotnet_errors(build_result.stdout + "\n" + build_result.stderr)
                return False, "", build_result.stderr, errors

            dll_path = sb.dir / "bin" / "Release" / "net8.0" / "program.dll"
            if not dll_path.exists():
                return False, "", "Binario no encontrado tras compilar", ["Error interno: binario ausente"]

            run_result = sb.run(
                ["dotnet", str(dll_path)],
                stdin=CONSOLE_STDIN,
                timeout=15,
                env=env,
                limit_memory=False,
                limit_file=False,
            )

            errors = []
            if run_result.timed_out:
                errors.append("Timeout al ejecutar el programa")
            elif not run_result.success and run_result.stderr:
                errors.append(run_result.stderr[:800])

            return run_result.success, run_result.stdout, run_result.stderr, errors

    def _parse_dotnet_errors(self, output: str) -> list[str]:
        """Extrae errores de compilación del output de dotnet build."""
        errors = []
        for line in output.split("\n"):
            line = line.strip()
            if "error CS" in line or "error MSB" in line:
                cleaned = line.replace("Program.cs", "Línea")
                errors.append(cleaned)
        return errors if errors else [output[:500].strip() or "Error de compilación desconocido"]