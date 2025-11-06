# Backups de versões anteriores

Esta pasta contém snapshots dos arquivos principais antes da atualização de perfil e autenticação feita em `Atualiza perfil e autenticação Firebase`.

- `pre-auth-update/` guarda `app.js`, `firebase.js`, `index.html` e `style.css` exatamente como estavam no commit anterior (`17191bd^`).
- Use estes arquivos caso precise restaurar manualmente o comportamento antigo sem a integração de login.

Para reverter rapidamente via Git, também é possível rodar `git checkout 17191bd^ -- <arquivo>` ou criar um branch novo a partir daquele commit.
