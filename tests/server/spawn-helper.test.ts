import { chmodSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeExecutable } from "../../src/server/terminal.js";

// No Windows não existe permissão de execução em arquivo: o teste só faz sentido no Linux e no macOS.
const posix = process.platform !== "win32";

describe("makeExecutable (o spawn-helper do node-pty)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "lore-pack-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it.skipIf(!posix)("dá permissão de execução a um arquivo que veio sem ela", () => {
    const helper = join(tempDir, "spawn-helper");
    writeFileSync(helper, "#!/bin/sh\n");
    chmodSync(helper, 0o644);

    makeExecutable(helper);

    expect(statSync(helper).mode & 0o111).toBe(0o111);
  });

  it("arquivo que não existe não é erro", () => {
    expect(() => makeExecutable(join(tempDir, "nao-existe"))).not.toThrow();
  });
});
