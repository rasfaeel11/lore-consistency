# Como publicar no npm

Passo a passo para publicar uma versão. Quem publica é você, à mão: nenhum script do projeto roda o `npm publish`.

## Uma vez só
1. Crie uma conta em https://www.npmjs.com/signup e confirme o e-mail.
2. Ligue a autenticação em dois fatores (2FA) em Account → Two-Factor Authentication, no modo "Authorization and Publishing". Guarde os códigos de recuperação.
3. No terminal: `npm login` (abre o navegador) e depois `npm whoami`, que precisa mostrar o seu usuário.

## A cada versão
1. **Nome livre?** `npm view lore-pack` precisa responder 404 na primeira publicação. Em 2026-10-06 respondeu 404, assim como `lorepack` e `lore_pack` (o npm recusa nomes parecidos demais com um existente).
2. **Tudo commitado e passando:**
   ```
   git status
   npm ci
   npm run typecheck
   npm test
   npm run build && npm run verify:dist
   ```
   Confira também que a CI do último commit está verde nos três sistemas.
3. **Versão e changelog.** Para uma versão nova: `npm version 0.1.1 --no-git-tag-version` (atualiza o `package.json` e o `package-lock.json`), escreva a seção no `CHANGELOG.md` e faça o commit. A 0.1.0 já está pronta.
4. **Veja o que vai no pacote, sem publicar:**
   ```
   npm publish --dry-run
   ```
   A lista precisa ter `dist/`, `templates/`, `web/`, `instrucoes/`, `README.md`, `LICENSE` e `package.json`, e **não** pode ter `src/`, `tests/`, `docs/` nem `exemplos/`. O `prepublishOnly` roda o build e o `verify:dist` antes; se um deles falhar, a publicação para.
5. **Teste o pacote de verdade** numa pasta vazia, fora do repositório:
   ```
   npm pack
   mkdir ../teste-pacote && cd ../teste-pacote
   npm init -y
   npm install ../lore-consistency/lore-pack-0.1.0.tgz
   npx lore-pack init historia && npx lore-pack check historia
   ```
   Depois apague o `.tgz` do repositório.
6. **Publique:**
   ```
   npm publish
   ```
   O npm pede o código do 2FA. Se um dia o nome ganhar escopo (`@usuario/lore-pack`), a primeira publicação precisa de `npm publish --access public`.
7. **Marque a versão no git:**
   ```
   git tag v0.1.0
   git push origin main --tags
   ```
8. **Confira:** `npm view lore-pack version` e, numa pasta qualquer, `npx lore-pack@latest --version`.
9. **Na primeira publicação, atualize o README** (`README.md` e `README.en.md`): a seção "Instalação" hoje manda clonar o repositório, porque o pacote ainda não está no npm. Troque por `npm install -g lore-pack` e deixe o clone como alternativa.

## Se der errado
- Dá para tirar do ar uma versão publicada por engano nas primeiras 72 horas (`npm unpublish lore-pack@0.1.0`), mas **o mesmo número de versão não pode ser publicado de novo**. O normal é corrigir e publicar a 0.1.1.
- `npm deprecate lore-pack@0.1.0 "use a 0.1.1"` avisa quem instalar a versão ruim, sem apagar nada.
