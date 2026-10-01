import { fileURLToPath } from "node:url";

// src/cli/ (dev) e dist/cli/ (build) ficam dois níveis abaixo da raiz do pacote.
export const TEMPLATES_DIR = fileURLToPath(new URL("../../templates", import.meta.url));

// Página do app (HTML, CSS e JS do navegador). Fica na raiz do pacote, como templates/.
export const WEB_DIR = fileURLToPath(new URL("../../web", import.meta.url));
