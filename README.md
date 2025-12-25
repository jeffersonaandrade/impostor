# Impostor - Jogo de Mistério

Um jogo social de dedução e mistério inspirado em Spyfall, com identidade visual "Cinema Noir" e integração com IA via Groq.

## 🚀 Tecnologias

- **Next.js 14+** (App Router)
- **TypeScript**
- **Tailwind CSS** + **Shadcn UI** (Dark Mode)
- **Firebase Firestore** (Realtime)
- **Groq API** (IA para gerar palavras secretas)
- **Zustand** (Gerenciamento de estado)

## 📋 Pré-requisitos

- Node.js 18+
- Conta Firebase (Firestore)
- API Key da Groq

## ⚙️ Configuração

1. Instale as dependências:
```bash
npm install
```

2. Crie um arquivo `.env.local` na raiz do projeto:

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

3. Configure o Firestore:
   - Crie uma coleção chamada `rooms` no Firestore
   - Configure as regras de segurança conforme necessário

4. Execute o projeto:
```bash
npm run dev
```

## 🎮 Como Jogar

1. **Home**: Crie uma nova sala ou entre com um código
2. **Lobby**: Aguarde jogadores e configure o tema (apenas o host)
3. **Jogo**: Revele sua carta e descubra se você é o Cidadão ou o Impostor
4. **Objetivo**: 
   - **Cidadão**: Descobrir quem é o impostor
   - **Impostor**: Não ser descoberto

## 🎨 Identidade Visual

- Fundo preto absoluto (`#000000`)
- Textos em branco/cinza claro
- Acentos em vermelho intenso para o Impostor
- Design minimalista e dramático

## 📝 Notas

- A Groq API é extremamente rápida, mas há um "fake loading" de 2 segundos para aumentar a tensão e criar atmosfera de mistério.

