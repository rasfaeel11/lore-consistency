# lore-pack

English · [Português](README.md)

A command-line tool (with an optional local app) for people who write stories with the help of AI. It keeps your story's world in markdown cards and builds, for each writing session, the **context pack**: only what the AI needs to know to write the next scene.

It works with any AI (Claude, Gemini, ChatGPT): the tool produces the text and you paste it. No API, no account, no payment. Your story files never leave your computer.

> The tool's messages, templates and session prompts are in Portuguese. This page explains the tool in English; the commands and file names below are the real ones.

## The problem

A long story does not fit in one AI conversation. After a few chapters you either paste everything again every session (expensive, slow, and the AI loses the thread), or you paste too little and it forgets someone's eye colour, brings back a dead character, or invents a name that already exists.

What works is discipline: a short bible, a summary of where the story stands, one card per character and place, and in each session only the cards for that scene. Doing that by hand is tiring. lore-pack does the mechanical part.

## What it does

- **`init`** creates the story folder from templates: bible, state, a name alphabet, cards, references, and the prompts for each step of a session.
- **`check`** validates the cards: required fields, duplicate ids, a name used by two cards, a card in the wrong folder.
- **`pack`** builds the session pack: bible + state + only the cards mentioned in the scene plan and in the last scene + the references for the topic + the last scene, with a token estimate.
- **`capitulo`** and **`sessao`** organise chapters and writing sessions, each session in its own folder.
- **`apply`** reads the changes the AI proposed at the end of the session, shows a diff for each one, and writes only the ones you choose.
- **`ui`** opens an app in your browser, on your computer only, with all of this as buttons and an embedded terminal for the AI.
- **Canon guard:** when a session starts, lore-pack keeps a copy of the story files and later reports any change made without your approval.

## Installation

Requires [Node.js](https://nodejs.org) 24 or newer.

```
npm install -g lore-pack
lore-pack --help
```

To run from source:

```
git clone https://github.com/rasfaeel11/lore-consistency.git
cd lore-consistency
npm install
npm run relink
```

The app's embedded terminal uses the optional `node-pty` package, which ships prebuilt binaries for Windows and macOS. On Linux it has to compile (Python, make and a C++ compiler); if it does not, installation still finishes, the terminal shows as disabled, and everything else works.

## 5-minute tutorial

**1. Create the story folder.**

```
lore-pack init my-story
cd my-story
```

Open `biblia.md` and write the premise and the rules of the world. The folder's `COMO-USAR.md` explains each file.

**2. Create the first card.** Copy `modelos/ficha-modelo.md` to `fichas/personagens/ana-ferreira.md` and fill in the header:

```yaml
---
id: ana-ferreira
tipo: personagem
nome: Ana Ferreira
aliases: [Aninha]
status: viva
aparece_em: []
---
```

Then validate:

```
lore-pack check
```

**3. Create the chapter and the session.** Write what happens in the next scene in `plano.md`, naming characters and places ("Ana Ferreira arrives at the harbour...").

```
lore-pack capitulo novo "The arrival"
lore-pack sessao nova --capitulo cap-01 --plano plano.md
```

lore-pack tells you which cards went into the pack and why, and how many tokens it has. The pack is saved to `sessoes/<id>/pacote.md`.

**4. Write with the AI.** Paste `pacote.md` into a new conversation, in any AI. With Claude Code, the command printed by `sessao nova` opens the AI already reading the pack.

**5. Close the session.** Paste the `prompts-de-sessao/04-fechar-sessao.md` prompt into the AI and save its answer to `sessoes/<id>/fechamento.md`. Then:

```
lore-pack apply <id>                  # shows each proposed change, with a diff
lore-pack apply <id> --aplicar 1,3    # writes only the ones you chose
lore-pack sessao fechar <id>
```

Prefer a window to a terminal? Run `lore-pack ui` inside the story folder.

**Want to see a filled-in folder?** The repository includes [`exemplos/varmonte`](exemplos/varmonte): a small invented world with six cards, one reference, two chapters and one closed session, built with the commands above. With the repository cloned:

```
lore-pack check exemplos/varmonte
lore-pack sessao listar exemplos/varmonte
lore-pack ui exemplos/varmonte
```

The example is not part of the npm package, and it does not include the `CLAUDE.md`, `AGENTS.md` and `.claude/settings.json` files that `init` creates in your own folder.

## The flow of a session

```
sessao nova ──► pacote.md ──► you and the AI write ──► prompt 04 ──► fechamento.md
     │                                                                    │
     └─ snapshot of the files (guard)               apply: you choose ◄───┘
                                                         │
                               estado.md, alfabeto.md and cards updated
                                                         │
                                                   sessao fechar
```

1. `sessao nova` creates `sessoes/<id>/` with the plan (`sessao.md`) and the pack (`pacote.md`), and takes a snapshot of the protected files.
2. The AI writes the scenes in `sessoes/<id>/rascunho.md`. You correct and approve.
3. At the end, prompt 04 asks the AI for the changes to the files. Its answer ends with a `lore-pack-mudancas` block, a JSON list of operations (`estado_adicionar`, `estado_substituir`, `ficha_criar`, `ficha_adicionar`, `ficha_substituir`, `alfabeto_adicionar`).
4. `apply` shows each operation with a diff. Nothing is written without `--aplicar`. What was applied is recorded in `aplicado.json`, so running it again repeats nothing.
5. `sessao fechar` marks the session as closed. It refuses if a protected file was changed behind your back.

## How it works

```
                 ┌────────────────────────────────────────────┐
                 │ src/core/  (pure functions)                │
                 │ cards, validation, mentions, pack,         │
                 │ sessions, guard, closing changes           │
                 └───────▲───────────────────────▲────────────┘
                         │                       │
        ┌────────────────┴───────┐   ┌───────────┴─────────────────────┐
        │ src/cli/               │   │ src/server/                     │
        │ reads and writes files │◄──│ node:http + ws, 127.0.0.1 only  │
        │ commands.ts: the single│   │ embedded terminal (node-pty)    │
        │ list of commands       │   └───────────▲─────────────────────┘
        └────────────▲───────────┘               │
                     │                  ┌────────┴──────────┐
              lore-pack <command>       │ web/  (the page)  │
                                        │ plain HTML/CSS/JS │
                                        └───────────────────┘
```

- **`src/core/`** only has functions that take data and return data. No disk, no printing, no network. This is what the tests exercise most closely.
- **`src/cli/`** is the edge: it reads files, calls the core and prints. Every command lives in one list (`commands.ts`), which produces both `--help` and the dispatch.
- **`src/server/`** is the other edge: the app's server, which reuses the core and the CLI functions. The page in `web/` is plain HTML, CSS and JavaScript, with no build step.
- **Embedded terminal:** the app opens whichever command-line AI you configure in `lore-pack.config.json` (the default is `claude`), inside the page, in the story folder. With `"comando": "nenhum"` you are left with the copy-the-pack button.

The card and reference formats are described in [`CLAUDE.md`](CLAUDE.md), and the project's decisions, with their reasons, in [`docs/DECISOES.md`](docs/DECISOES.md) (both in Portuguese).

## Security

The app runs a server on your computer and can start a terminal program. What it does so that this is not an open door:

- It listens on `127.0.0.1` only. It is never exposed to the network.
- Every run of `lore-pack ui` generates a new token. The API requires it in the `X-Lore-Pack-Token` header; the page and the WebSocket, in the URL. Without the token nothing answers.
- It checks `Host` and `Origin` on every request, so a site open in your browser cannot talk to the app. `POST` requests must be `Content-Type: application/json`.
- It serves a closed list of files: no path coming from the browser becomes a path on disk.
- The terminal WebSocket requires the app's own `Origin` and the token, accepts messages up to 64 KB, and at most 4 terminals can be open.
- The terminal command comes only from `lore-pack.config.json`. The browser only says "open a terminal for session X".
- In `apply`, the browser only says which session and which numbers from the list. The operations are read, on the server, from `fechamento.md`, and each file path is computed: it never comes from the AI's JSON.

**The canon guard detects after the fact; it does not block.** If the AI rewrites a card, you find out and can revert, but the write already happened. The `.claude/settings.json` created by `init` forbids Claude Code from editing the protected files, but it only applies to Claude Code and does not catch a script the AI runs on its own. Gemini and ChatGPT ignore that file. Keep the story folder in git.

## Limitations

- The token count is an estimate: characters ÷ 3. Each AI counts differently.
- Mentions are matched as whole words, ignoring case and accents. It finds "Ana" in the plan; it does not understand "the cartographer".
- `apply` only changes `estado.md`, `alfabeto.md` and cards. It does not touch the bible, the chapters or the references, and it deletes nothing.
- The embedded terminal depends on `node-pty`. Without a prebuilt binary on Linux it is disabled, and "copy the pack" keeps working.
- The tool's messages and templates are in Portuguese.
- Tested on Windows, and by CI on Ubuntu and macOS.

## Roadmap

The current version is 0.1.0. Postponed ideas are in [`docs/V2.md`](docs/V2.md). The most likely ones:

- order the cards in the pack by relevance;
- check new names against `alfabeto.md`;
- create chapters from the app;
- update the session prompts of an existing folder;
- a terminal on Linux without compiling.

Out of scope, on purpose: calling an AI API, user accounts, online hosting, cloud sync, and a text editor of its own.

## Development

```
npm install
npm run typecheck
npm test
npm run build && npm run verify:dist
```

Strict TypeScript, Vitest, and few dependencies: `yaml`, `zod`, `ws` and xterm (plus the optional `node-pty`). Version history is in [`CHANGELOG.md`](CHANGELOG.md).

## License

[MIT](LICENSE).
