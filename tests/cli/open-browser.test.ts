import { describe, expect, it } from "vitest";
import { browserCommand, folderCommand } from "../../src/cli/open-browser.js";

const URL = "http://127.0.0.1:4777/?token=abc_DEF-123";

describe("browserCommand", () => {
  it("Windows usa o start do cmd, com título vazio antes da URL", () => {
    expect(browserCommand("win32", URL)).toEqual({ command: "cmd", args: ["/c", "start", "", URL] });
  });

  it("macOS usa open", () => {
    expect(browserCommand("darwin", URL)).toEqual({ command: "open", args: [URL] });
  });

  it("Linux e outros usam xdg-open", () => {
    expect(browserCommand("linux", URL)).toEqual({ command: "xdg-open", args: [URL] });
    expect(browserCommand("freebsd", URL)).toEqual({ command: "xdg-open", args: [URL] });
  });

  it("recusa URL fora do formato do app (nada além do que o próprio ui monta)", () => {
    expect(browserCommand("win32", "http://127.0.0.1:4777/?token=a&calc")).toBeUndefined();
    expect(browserCommand("linux", "https://exemplo.com")).toBeUndefined();
  });
});

describe("folderCommand", () => {
  it("Windows usa o explorer direto, sem cmd: o caminho pode ter & e espaço", () => {
    expect(folderCommand("win32", "C:\\Histórias\\Sal & Cinza")).toEqual({
      command: "explorer.exe",
      args: ["C:\\Histórias\\Sal & Cinza"],
    });
  });

  it("macOS usa open; Linux e outros usam xdg-open", () => {
    expect(folderCommand("darwin", "/h/minha historia")).toEqual({ command: "open", args: ["/h/minha historia"] });
    expect(folderCommand("linux", "/h/minha historia")).toEqual({ command: "xdg-open", args: ["/h/minha historia"] });
  });
});
