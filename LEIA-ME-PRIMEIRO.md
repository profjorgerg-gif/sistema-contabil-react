# Sistema de Escrituração Contábil — Fase 1 (React + Firebase)

Esta pasta contém a **fundação** do sistema migrado, seguindo o checklist da
Seção 4 do Manual de Operacionalização. Ainda faltam as Fases 2 a 5 (Plano de
Contas, Lançamentos, Balancete, DRE, Balanço, Relatórios, Backup etc.) — por
enquanto, o menu mostra esses módulos como "em breve".

## O que já funciona nesta fase
- Login e cadastro com e-mail/senha (Firebase Authentication)
- Aprovação de novos cadastros por um Usuário Mestre
- Permissões por tipo de usuário (Aluno / Professor / Mestre), editáveis
- Menu lateral responsivo (gaveta ☰ no celular)
- Módulo **Turmas** (cadastrar, renomear, excluir — bloqueado se houver
  usuários vinculados)
- Módulo **Empresas** (cadastrar, editar, excluir, gerador de CNPJ fictício)
- Módulo **Usuários** (trocar tipo, editar permissões, trocar turma, excluir)

## Passo a passo para colocar no ar

### 1. Criar o projeto no Firebase
1. Acesse https://console.firebase.google.com e crie um projeto novo
   (ex.: `sistema-contabil-cedup`).
2. No menu lateral, ative **Authentication** → método **E-mail/senha**.
3. Ative o **Firestore Database** → modo produção → região
   `southamerica-east1` (São Paulo).
4. Em ⚙ Configurações do projeto → role até "Seus apps" → clique no ícone
   `</>` (Web) → registre um app (não precisa marcar Hosting).
5. Copie as 6 chaves mostradas (`apiKey`, `authDomain`, `projectId`,
   `storageBucket`, `messagingSenderId`, `appId`).

### 2. Colar as chaves no projeto
Abra `src/firebaseConfig.js` e substitua os valores `"COLE_AQUI"` pelas
chaves copiadas no passo anterior.

### 3. Trocar o Código de Mestre
Abra `src/firebaseAuth.js` e troque o valor de `CODIGO_MESTRE` por um código
só seu (não compartilhe por texto/grupo aberto — o repositório é público).
Cadastre-se primeiro usando esse código, para virar Usuário Mestre
automaticamente.

### 4. Publicar as regras de segurança do Firestore
No Firebase Console → Firestore Database → aba **Regras**, cole o conteúdo
do arquivo `firestore.rules` (já vem pronto, exigindo login em qualquer
leitura/escrita) e clique em **Publicar**.

### 5. Subir o projeto no GitHub
1. Crie um repositório novo no GitHub (público, sem README pronto).
2. Envie todos os arquivos desta pasta para o repositório (pela interface
   do GitHub, arrastando os arquivos, **ou** por linha de comando com
   `git init`, `git add .`, `git commit`, `git push`).
3. Confirme que a pasta `.github/workflows` subiu corretamente.
4. Em **Settings → Pages**, defina Source como **GitHub Actions**.
5. Acompanhe a aba **Actions** até aparecer a bolinha verde.
6. O site publicado ficará em
   `seu-usuario.github.io/nome-do-repositorio/`.

### 6. Primeiro acesso
1. Abra o site publicado.
2. Clique em "Ainda não tenho conta — cadastrar".
3. Cadastre-se como Professor, preenchendo o **Código de Mestre** do
   passo 3 — você entra direto como Usuário Mestre.
4. Cadastre as turmas do período em **Turmas**.
5. A partir daí, alunos e outros professores podem se cadastrar
   normalmente (ficam pendentes até você aprovar em **Aprovações**).

## Diferenças importantes em relação à versão em HTML único
- Antes: dados só no navegador de cada aluno (`localStorage`). Agora: dados
  no Firebase, acessíveis de qualquer aparelho, por pessoa autenticada.
- Antes: contas de usuário criadas manualmente pelo professor. Agora: cada
  pessoa cria sua própria conta (com aprovação do Mestre).
- O papel "Mestre" agora é obtido por um **Código de Mestre** digitado no
  cadastro, não mais por criação manual.

## O que ainda precisa de uma decisão sua
No sistema atual (HTML único), a lista de **Empresas** é global — visível
para qualquer usuário do sistema, sem vínculo com uma turma específica.
Mantive esse mesmo comportamento aqui na Fase 1, para não mudar uma regra
de negócio sem confirmar com você. Se, agora que o sistema vira uma
plataforma com múltiplas turmas ao mesmo tempo, você preferir que cada
turma veja **só as suas próprias empresas**, me avise antes da Fase 2 —
essa mudança é mais fácil de fazer agora do que depois que os módulos de
Lançamentos já estiverem prontos.
