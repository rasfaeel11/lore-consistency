#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { main } from "./cli/main.js";

// O package.json fica um nível acima tanto de src/ (dev) quanto de dist/ (build).
const packageJsonUrl = new URL("../package.json", import.meta.url);
const { version } = JSON.parse(readFileSync(packageJsonUrl, "utf8")) as {
  version: string;
};

try {
  const result = main(process.argv.slice(2), version);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
} catch (error) {
  // Falha inesperada (ex.: sem permissão para escrever na pasta): mensagem curta, sem stack trace.
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Erro inesperado: ${message}\n`);
  process.exitCode = 1;
}
