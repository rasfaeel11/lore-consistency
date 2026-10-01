// Resultado de uma execução da CLI. Quem imprime e encerra o processo é o index.ts.
export type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export function ok(stdout: string): CliResult {
  return { exitCode: 0, stdout, stderr: "" };
}

export function fail(message: string): CliResult {
  return { exitCode: 1, stdout: "", stderr: `${message}\n` };
}
