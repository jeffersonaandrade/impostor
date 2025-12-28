# 🎭 IMPOSTOR - Jogo de Mistério e Dedução

Um jogo social multiplayer inspirado em **Spyfall** e **Among Us**, com identidade visual **Cinema Noir / Mistério**. Os jogadores devem descobrir quem é o impostor através de dedução e votação, enquanto o impostor tenta passar despercebido.

![Impostor Noir](https://img.shields.io/badge/Theme-Cinema%20Noir-black?style=for-the-badge&color=000000&labelColor=red)

---

## 📖 Índice

- [Sobre o Jogo](#-sobre-o-jogo)
- [Stack Tecnológica](#-stack-tecnológica)
- [Regras do Jogo](#-regras-do-jogo)
- [Funcionalidades](#-funcionalidades)
- [Configuração](#-configuração)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Como Jogar](#-como-jogar)
- [Sistema de IA](#-sistema-de-ia)
- [Segurança e Validações](#-segurança-e-validações)

---

## 🎯 Sobre o Jogo

**IMPOSTOR** é um jogo de dedução social onde os jogadores são divididos em dois grupos:

- **Cidadãos**: Conhecem a palavra secreta e devem descobrir quem é o impostor
- **Impostores**: Não conhecem a palavra secreta e devem enganar os outros jogadores

O jogo utiliza **IA (Groq API)** para gerar palavras secretas dinâmicas baseadas em temas personalizados, garantindo variedade e imprevisibilidade em cada partida.

---

## 🛠 Stack Tecnológica

### **Frontend**
- **Next.js 14.2+** (App Router, Server Actions)
- **React 18.3** (Hooks, Context)
- **TypeScript 5.3** (Tipagem estática)
- **Tailwind CSS 3.4** (Estilização utility-first)
- **Shadcn UI** (Componentes reutilizáveis, Dark Mode)

### **Backend & Banco de Dados**
- **Firebase Firestore** (Banco de dados em tempo real)
- **Server Actions** (Next.js - Lógica server-side)

### **IA & APIs**
- **Groq SDK 0.5** (API de IA para geração de palavras)
- **Modelo**: `llama-3.3-70b-versatile` (Temperature: 0.6)

### **Gerenciamento de Estado**
- **Zustand 4.5** (State management global)
- **Firestore Real-time Listeners** (Sincronização em tempo real)

### **Bibliotecas Auxiliares**
- **Lucide React** (Ícones)
- **React QR Code** (Geração de QR Codes para convites)
- **Class Variance Authority** (Variantes de componentes)

### **Ferramentas de Desenvolvimento**
- **ESLint** (Linting)
- **PostCSS** (Processamento CSS)
- **Autoprefixer** (Compatibilidade CSS)

---

## 📜 Regras do Jogo

### **Configuração Inicial**

1. **Mínimo de Jogadores**: 3 jogadores são necessários para iniciar uma partida
2. **Número de Impostores**: Configurável pelo Host (1, 2 ou 3)
   - Máximo: `Número de Jogadores - 1` (sempre deve sobrar pelo menos 1 cidadão)
3. **Chances de Erro (Vidas)**: Configurável pelo Host (1, 2 ou 3)
   - Representa quantas vezes os cidadãos podem errar antes de perderem

### **Fase 1: Revelação de Papéis**

- Ao iniciar o jogo, cada jogador recebe uma carta que revela seu papel:
  - **Cidadão**: Vê a **palavra secreta**, o **tema** e a **categoria**
  - **Impostor**: Vê apenas o **tema** e a **categoria** (não vê a palavra secreta)
- A carta é revelada ao clicar nela (efeito suspense)

### **Fase 2: Jogo Normal (Playing)**

- Os jogadores conversam e fazem perguntas para descobrir o impostor
- **Cidadãos** devem fazer perguntas que apenas quem conhece a palavra secreta saberia responder
- **Impostores** devem tentar responder sem revelar que não conhecem a palavra

### **Fase 3: Solicitação de Votação**

- Qualquer jogador **vivo** pode solicitar uma votação clicando em "Sugerir Votação"
- Quando **mais de 50% dos jogadores vivos** solicitam votação, a fase de votação é iniciada automaticamente
- Jogadores eliminados não podem solicitar votação

### **Fase 4: Votação (Voting)**

- Durante a votação, cada jogador **vivo** deve escolher um suspeito
- Jogadores **não podem votar em si mesmos**
- Jogadores **eliminados** não podem votar nem ser votados
- O **Host** pode forçar o fim da votação a qualquer momento (mesmo se eliminado)
- A votação é resolvida quando:
  - Todos os jogadores vivos votaram, OU
  - O Host força o fim da votação (requer pelo menos 1 voto)

### **Fase 5: Resolução da Votação**

#### **Cenário 1: Impostor Eliminado**
- Se o jogador mais votado for um **Impostor**:
  - O impostor é eliminado
  - Se **todos os impostores** foram eliminados → **Cidadãos vencem!**
  - Se ainda há impostores vivos → O jogo continua com a mensagem: *"Vocês eliminaram um Impostor! Mas cuidado, ainda restam X na cidade."*

#### **Cenário 2: Cidadão Eliminado (Erro)**
- Se o jogador mais votado for um **Cidadão**:
  - O cidadão é eliminado
  - As **chances de erro** diminuem em 1
  - Se as chances chegarem a **0** → **Impostores vencem!**
  - Se ainda há chances → O jogo continua com a mensagem: *"Fulano era inocente! Restam X tentativas."*

### **Condições de Vitória**

#### **Cidadãos Vencem:**
- Todos os impostores são eliminados através da votação

#### **Impostores Vencem:**
- Os cidadãos esgotam todas as chances de erro (vidas)
- Isso acontece quando eliminam cidadãos inocentes `maxGuesses` vezes

### **Jogadores Eliminados**

- Jogadores eliminados **não podem**:
  - Solicitar votação
  - Votar
  - Ser votados
- Jogadores eliminados **podem**:
  - Assistir o jogo continuar
  - Ver quem foi eliminado

### **Controles do Host**

O **Host** (criador da sala) possui controles especiais:

- **Configurar Jogo**: Definir tema, número de impostores e chances de erro
- **Remover Jogadores**: Pode remover jogadores da sala (apenas no lobby, antes do jogo começar)
- **Forçar Fim da Votação**: Pode encerrar a votação a qualquer momento (mesmo se eliminado)
- **Jogar Novamente**: Pode reiniciar a partida após o fim do jogo

### **Sistema de Memória (Smart Shuffle)**

O jogo implementa um sistema inteligente para evitar repetições:

- **Impostores**: O mesmo jogador não será impostor consecutivamente (a menos que seja o único possível)
- **Palavras**: Palavras já usadas são evitadas automaticamente
- **Deck Reset**: Após 50 palavras usadas, o histórico é limpo para permitir reutilização do tema

---

## ✨ Funcionalidades

### **Sistema de Salas**

- **Criação de Sala**: Geração automática de código único (6 caracteres alfanuméricos)
- **Entrada por Código**: Digite o código da sala para entrar
- **Links de Convite**: Compartilhe links diretos (`/join/[roomId]`)
- **QR Code**: Gere QR Code para entrada rápida em jogos presenciais
- **Compartilhamento WhatsApp**: Botão para compartilhar link via WhatsApp

### **Lobby**

- **Lista de Jogadores em Tempo Real**: Veja quem está na sala
- **Validação de Sessão**: Sistema detecta se o jogador ainda está na sala
- **Indicador de Host**: Visual claro de quem é o host
- **Contador de Jogadores**: Mostra quantos jogadores estão conectados e o mínimo necessário
- **Configuração de Jogo**: Host pode configurar tema, impostores e vidas

### **Sistema de Votação**

- **Solicitação Democrática**: Mais de 50% dos jogadores vivos devem solicitar
- **Interface Intuitiva**: Lista de suspeitos com seleção visual
- **Feedback em Tempo Real**: Contador de votos e status da votação
- **Resolução Automática**: Sistema resolve votação automaticamente quando todos votam
- **Controle do Host**: Host pode forçar fim da votação

### **Tela de Fim de Jogo**

- **Imagens Temáticas**: Diferentes imagens para vitória dos cidadãos e impostores
- **Mensagens Dinâmicas**: Textos gramaticalmente corretos baseados no número de impostores
- **Reinício Rápido**: Botão para jogar novamente (Host)
- **Sair da Sala**: Opção para sair após o jogo

### **UX/UI**

- **Loading Fake**: Animação de 2 segundos para aumentar tensão ("Consultando os arquivos secretos...")
- **Design Responsivo**: Funciona bem em desktop e mobile
- **Tema Noir**: Fundo preto absoluto, textos brancos/cinza, acentos vermelhos
- **Background Image**: Imagem de fundo temática com opacidade e grayscale
- **Toast Notifications**: Feedback visual para ações do usuário
- **Animações Suaves**: Transições e efeitos visuais

### **Segurança e Validações**

- **Rate Limiting**: Cooldown de 10 segundos entre partidas (anti-spam de IA)
- **Validação de Mínimo**: Não permite iniciar com menos de 3 jogadores
- **Validação de Impostores**: Não permite mais impostores do que jogadores - 1
- **Limpeza Automática**: Salas vazias são deletadas automaticamente
- **Transferência de Host**: Se o host sair, o primeiro jogador restante vira host
- **Sessão Persistente**: localStorage mantém sessão do jogador
- **Validação de Reentrada**: Sistema detecta se jogador foi removido e redireciona

### **Sistema de IA (Groq)**

- **Geração Dinâmica**: Palavras secretas geradas por IA baseadas no tema
- **Evitação de Repetição**: Sistema evita palavras já usadas
- **Validação Múltipla**: Tenta até 3 vezes para garantir palavra única
- **Deck Reset**: Limpa histórico após 50 palavras para permitir reutilização
- **Modelo Avançado**: Usa `llama-3.3-70b-versatile` com temperature 0.6

---

## ⚙️ Configuração

### **Pré-requisitos**

- Node.js 18+ 
- Conta Firebase (Firestore)
- API Key da Groq ([groq.com](https://groq.com))

### **Instalação**

1. **Clone o repositório:**
```bash
git clone https://github.com/jeffersonaandrade/impostor.git
cd impostor
```

2. **Instale as dependências:**
```bash
npm install
```

3. **Configure as variáveis de ambiente:**

Crie um arquivo `.env.local` na raiz do projeto:

```env
# Groq API
GROQ_API_KEY=sua_chave_groq_aqui

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=sua_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu_projeto_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=seu_app_id
```

4. **Configure o Firestore:**

- Crie um projeto no [Firebase Console](https://console.firebase.google.com)
- Ative o Firestore Database
- Configure as regras de segurança (exemplo abaixo)
- Copie as credenciais para o `.env.local`

**Regras de Segurança do Firestore (Exemplo):**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      // Permitir leitura e escrita para todos (ajuste conforme necessário)
      allow read, write: if true;
    }
  }
}
```

5. **Execute o projeto:**

```bash
# Desenvolvimento
npm run dev

# Build de produção
npm run build

# Iniciar produção
npm start
```

O projeto estará disponível em `http://localhost:3000`

---

## 📁 Estrutura do Projeto

```
impostor/
├── app/                          # Next.js App Router
│   ├── actions/                  # Server Actions
│   │   ├── game.ts              # Lógica de jogo (start, reset, remove player)
│   │   └── voting.ts            # Lógica de votação
│   ├── game/[roomId]/           # Página do jogo
│   │   └── page.tsx
│   ├── join/[roomId]/           # Página de entrada por link
│   │   └── page.tsx
│   ├── lobby/[roomId]/          # Página do lobby
│   │   └── page.tsx
│   ├── layout.tsx               # Layout raiz
│   ├── page.tsx                 # Home page
│   ├── not-found.tsx            # Página 404
│   └── globals.css               # Estilos globais
├── components/
│   └── ui/                       # Componentes Shadcn UI
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       └── toast.tsx
├── lib/
│   ├── firebase.ts               # Configuração Firebase
│   ├── groq.ts                   # Cliente Groq e geração de palavras
│   ├── store.ts                  # Zustand store
│   └── utils.ts                  # Funções utilitárias
├── public/
│   ├── background.png           # Imagem de fundo
│   ├── citizens-win.png        # Imagem vitória cidadãos
│   └── impostor-win.png        # Imagem vitória impostores
├── .env.local                   # Variáveis de ambiente (não commitado)
├── package.json
├── tailwind.config.ts           # Configuração Tailwind
├── tsconfig.json                # Configuração TypeScript
└── README.md                    # Este arquivo
```

---

## 🎮 Como Jogar

### **Para o Host (Criador da Sala)**

1. Acesse a página inicial
2. Clique em **"Criar Sala"**
3. Você será redirecionado para o Lobby
4. Compartilhe o link ou QR Code com outros jogadores
5. Aguarde pelo menos 3 jogadores entrarem
6. Configure:
   - **Tema do Jogo**: Ex: "Séries dos anos 90", "Filmes de terror", etc.
   - **Número de Impostores**: 1, 2 ou 3 (máximo: jogadores - 1)
   - **Chances de Erro (Vidas)**: 1, 2 ou 3
7. Clique em **"Iniciar Jogo"**
8. Durante o jogo, você pode:
   - Forçar fim da votação (botão laranja)
   - Reiniciar a partida após o fim do jogo

### **Para os Jogadores**

1. Receba o link de convite ou escaneie o QR Code
2. Digite seu **nickname** na tela de entrada
3. Aguarde no Lobby até o Host iniciar o jogo
4. Quando o jogo começar:
   - Clique na carta para revelar seu papel
   - Se for **Cidadão**: Você verá a palavra secreta
   - Se for **Impostor**: Você verá apenas o tema
5. Durante o jogo:
   - Faça perguntas e converse com outros jogadores
   - Clique em **"Sugerir Votação"** quando achar que descobriu o impostor
6. Quando a votação começar:
   - Escolha quem você acha que é o impostor
   - Confirme seu voto
   - Aguarde a resolução

### **Dicas de Jogo**

- **Para Cidadãos:**
  - Faça perguntas específicas sobre a palavra secreta
  - Observe quem hesita ou evita responder diretamente
  - Trabalhe em equipe para descobrir o impostor

- **Para Impostores:**
  - Tente responder de forma vaga mas convincente
  - Observe as respostas dos outros para se adaptar
  - Não seja muito específico nem muito genérico

---

## 🤖 Sistema de IA

O jogo utiliza a **Groq API** com o modelo `llama-3.3-70b-versatile` para gerar palavras secretas dinâmicas.

### **Como Funciona**

1. O Host define um **tema** (ex: "Séries dos anos 90")
2. O sistema envia o tema para a Groq API
3. A IA retorna uma palavra secreta e categoria relacionadas ao tema
4. O sistema valida que a palavra não foi usada anteriormente
5. Se repetir, tenta novamente (até 3 tentativas)

### **Configurações da IA**

- **Modelo**: `llama-3.3-70b-versatile`
- **Temperature**: `0.6` (balance entre criatividade e precisão)
- **Max Tokens**: `200`
- **Response Format**: `JSON` (`{ "secret_word": "...", "category": "..." }`)

### **Sistema de Memória**

- **Palavras Usadas**: Array mantido no Firestore por sala
- **Validação**: Verifica se palavra já foi usada antes de aceitar
- **Deck Reset**: Após 50 palavras, limpa o histórico para permitir reutilização

---

## 🔒 Segurança e Validações

### **Validações de Jogo**

- ✅ Mínimo de 3 jogadores para iniciar
- ✅ Máximo de impostores = jogadores - 1
- ✅ Rate limiting de 10 segundos entre partidas
- ✅ Validação de sessão (jogador removido = redirecionamento)
- ✅ Validação de votação (jogadores vivos apenas)
- ✅ Validação de host (apenas host pode forçar ações)

### **Limpeza Automática**

- Salas vazias são deletadas automaticamente
- Histórico de palavras é limpo após 50 palavras
- Sessões expiradas são detectadas e limpas

### **Transações Atômicas**

- Operações críticas usam Firestore Transactions
- Garante consistência em operações concorrentes
- Previne race conditions

---

## 🎨 Identidade Visual

### **Tema: Cinema Noir / Mistério**

- **Fundo**: Preto absoluto (`#000000`) com imagem de fundo temática
- **Textos**: Branco (`#FFFFFF`) e cinza claro (`#E5E5E5`)
- **Acentos**: Vermelho intenso (`#DC2626`) para elementos do impostor
- **Bordas**: Cinza escuro (`#1F1F1F`) para cards e inputs
- **Fontes**: Sans-serif modernas (sistema padrão)

### **Elementos Visuais**

- Background image com opacidade e grayscale
- Cards com bordas sutis
- Animações de loading e transições suaves
- Ícones Lucide React para ações
- QR Code branco sobre fundo preto

---

## 📝 Notas Técnicas

### **Performance**

- **Groq API**: Respostas quase instantâneas (< 1 segundo)
- **Fake Loading**: 2 segundos de animação para UX
- **Real-time Updates**: Firestore listeners para sincronização instantânea
- **Server Actions**: Lógica server-side para segurança

### **Compatibilidade**

- **Navegadores**: Chrome, Firefox, Safari, Edge (versões recentes)
- **Dispositivos**: Desktop, Tablet, Mobile (responsivo)
- **PWA**: Pode ser instalado como Progressive Web App

### **Limitações Conhecidas**

- Rate limiting de 10 segundos entre partidas (proteção anti-spam)
- Máximo de 50 palavras antes do deck reset
- Requer conexão com internet (Firestore + Groq)

---

## 🚀 Deploy

### **Netlify / Vercel**

1. Conecte seu repositório
2. Configure as variáveis de ambiente
3. Deploy automático a cada push

### **Variáveis de Ambiente no Deploy**

Certifique-se de configurar todas as variáveis do `.env.local` no painel do seu provedor de deploy.

---

## 📄 Licença

Este projeto é de código aberto. Sinta-se livre para usar, modificar e distribuir.

---

## 👥 Contribuições

Contribuições são bem-vindas! Sinta-se livre para abrir issues ou pull requests.

---

## 🎯 Roadmap Futuro

- [ ] Sistema de salas privadas com senha
- [ ] Histórico de partidas
- [ ] Estatísticas de jogadores
- [ ] Temas personalizados de palavras
- [ ] Modo espectador
- [ ] Chat em tempo real
- [ ] Timer para rodadas

---

**Desenvolvido com ❤️ usando Next.js, Firebase e Groq AI**
