// Apaga o dist/ antes do build. O tsc só escreve arquivos, nunca apaga: sem isto,
// um arquivo de nome antigo (como o dist/cli/app.js do comando que virou ui) fica lá para sempre.
import { rmSync } from "node:fs";

rmSync(new URL("../dist", import.meta.url), { recursive: true, force: true });
