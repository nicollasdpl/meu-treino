# Meu Treino 2.0

Esta é a versão 2.0 do app **Meu Treino**, um PWA para registrar e acompanhar treinos estilo Hevy. O aplicativo funciona totalmente offline usando IndexedDB (via Dexie.js) e pode sincronizar dados opcionalmente com Firebase (Google Auth, Firestore e Storage) quando `ENABLE_FIREBASE=true`.

## Funcionalidades principais

* **PWA Instalável**: `manifest.json` e `sw.js` permitem instalar o aplicativo no iOS/Android/desktop. Após o primeiro carregamento ele continua funcionando sem internet.
* **Offline‐first**: sessões de treino, hábitos e metadados de fotos são salvos localmente em IndexedDB. Ao voltar a ficar online (e logado, se Firebase ativado) o app sincroniza automaticamente com Firestore, resolvendo conflitos pela versão mais completa.
* **Calendário e Resumo**: na Home você marca/desmarca dias de treino, visualiza o resumo do mês (dias treinados, último treino, duração média e streak) e inicia o treino do dia.
* **Treino**: para cada exercício há três séries visíveis (com peso, repetições, RIR e botão de conclusão). Ao concluir uma série inicia-se automaticamente um descanso com vibração e beep; a tonelagem (kg×reps) e o 1RM estimado são calculados em tempo real. Um ícone 🏆 indica quando você bateu um recorde de peso, repetições, 1RM ou volume.
* **Evolução**: através das abas Resumo, Gráficos, PRs e Tonelagem você acompanha o progresso mensal, gráficos de carga máxima, 1RM estimado, volume semanal e sua consistência de treinos. O Top 3 de exercícios por progresso também é exibido.
* **Perfil e Hábitos**: quando logado, a foto e nome do Google aparecem. Hábitos diários (acordar, café da manhã, creatina, almoço, pré-treino, beber 2.5 L de água e dormir > 7h) são salvos automaticamente e exibem streaks. É possível ajustar nome, peso, meta e cor do tema.
* **Progressão automática e deload**: o app sugere aumentar a carga quando a soma de repetições nas três séries for ≥ 34 e o RIR médio ≥ 1 (superiores +2 kg, pernas +5 kg). Se o RIR for < 1 por duas sessões ou houver queda de repetições > 15%, uma semana de deload (–20%) é sugerida.

## Como rodar localmente

1. Instale um servidor HTTP simples (opcional se abrir `index.html` diretamente). Ex.:

   ```bash
   python3 -m http.server 8000
   ```

2. Abra `http://localhost:8000` no navegador. O Service Worker será registrado e o app funcionará offline após o primeiro carregamento.

3. (Opcional) Ative o Firebase definindo `ENABLE_FIREBASE=true` no início de `firebase.js`. Você precisará hospedar em `https` e ter um projeto Firebase configurado.

## Como publicar no GitHub Pages

1. Copie todos os arquivos desta pasta para a raiz da branch `main` do seu repositório `nicollasdpl/meu-treino`.
2. Commit e push. Exemplo de mensagem: `Meu Treino 2.0 PWA offline-first`.
3. No repositório GitHub, acesse **Settings → Pages** e selecione **Branch: main** e **Folder: /(root)**. Salve.
4. Acesse a URL `https://nicollasdpl.github.io/meu-treino/`. Se modificar os arquivos, atualize o `?v=` nos `<script>` e o `CACHE_NAME` no `sw.js` para garantir que o Service Worker seja recarregado.

## Ativando o Firebase (opcional)

1. Edite `firebase.js` e defina `ENABLE_FIREBASE = true`.
2. Certifique-se de que a configuração (`firebaseConfig`) corresponde ao seu projeto Firebase.
3. Para usar a sincronização, faça login com Google quando solicitado. As sessões são salvas em `users/{uid}/sessoes/{data}` e os hábitos em `users/{uid}/habitos/{data}`.
4. Fotos de evolução são compactadas no cliente e enviadas para `users/{uid}/evolucao/{YYYY-MM}/{id}.jpg` no Storage, com metadados gravados em Firestore.

## Migração de dados antigos

Se você possui dados em `localStorage` da versão anterior, o script de inicialização migra automaticamente para IndexedDB na primeira execução. Os registros são convertidos para o novo formato (`sets` com peso, reps, rir e done).

## Créditos e licença

Este projeto foi criado para fins educacionais e pessoais. Sinta-se livre para modificar e adaptar conforme necessário.