"use server";

import { redirect } from "next/navigation";
import { doc, updateDoc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateSecretWord } from "@/lib/groq";

export async function startGame(roomId: string, theme: string, numImpostors: number = 1, maxGuesses: number = 1) {
  try {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      throw new Error("Sala não encontrada");
    }

    const roomData = roomSnap.data();
    const players = roomData?.players || [];
    
    // Validação de segurança: mínimo de 3 jogadores
    if (players.length < 3) {
      throw new Error("É necessário ter no mínimo 3 jogadores para iniciar.");
    }

    // Validação: não permitir mais impostores do que jogadores - 1
    const maxImpostors = players.length - 1;
    if (numImpostors > maxImpostors) {
      throw new Error(`Máximo de ${maxImpostors} impostor${maxImpostors > 1 ? 'es' : ''} permitido${maxImpostors > 1 ? 's' : ''} para ${players.length} jogador${players.length > 1 ? 'es' : ''}`);
    }

    if (numImpostors < 1) {
      throw new Error("Deve haver pelo menos 1 impostor");
    }

    // Rate Limiting: Verificar se passou menos de 10 segundos desde o último jogo
    const lastGameStartedAt = roomData?.lastGameStartedAt;
    if (lastGameStartedAt) {
      const lastStartTime = new Date(lastGameStartedAt).getTime();
      const now = Date.now();
      const timeDiff = (now - lastStartTime) / 1000; // diferença em segundos

      if (timeDiff < 10) {
        const remainingSeconds = Math.ceil(10 - timeDiff);
        throw new Error(`Aguarde ${remainingSeconds} segundo${remainingSeconds > 1 ? 's' : ''} para iniciar uma nova rodada.`);
      }
    }

    // Ler palavras já usadas nesta sala
    const usedWords = roomData?.usedWords || [];

    // Gerar palavra secreta usando Groq (evitando palavras já usadas)
    const { secret_word, category } = await generateSecretWord(theme, usedWords);

    // ============================================
    // LÓGICA DE ATRIBUIÇÃO DE PAPÉIS (ROLE ASSIGNMENT)
    // ============================================
    
    // 1. Criar array de papéis com tamanho exato dos jogadores (Algoritmo "Baralho de Cartas")
    const totalPlayers = players.length;
    const roles: ("impostor" | "citizen")[] = new Array(totalPlayers);
    
    // 2. Preencher com quantidade exata de impostores e resto cidadãos
    for (let i = 0; i < totalPlayers; i++) {
      roles[i] = i < numImpostors ? "impostor" : "citizen";
    }
    
    // 3. Embaralhamento Robusto (Fisher-Yates Shuffle)
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }
    
    // 4. Mapeamento 1:1 - Atribuir roles[index] para cada jogador
    let playersWithRoles = players.map((player: any, index: number) => ({
      ...player,
      role: roles[index],
    }));
    
    // 5. Validação de Segurança (Safety Check) - ANTES de salvar no Firestore
    let contagemImpostores = playersWithRoles.filter((p: any) => p.role === "impostor").length;
    
    if (contagemImpostores !== numImpostors) {
      // Correção manual: garantir que a contagem esteja correta
      console.error(`ERRO CRÍTICO: Contagem de impostores incorreta! Solicitado: ${numImpostors}, Gerado: ${contagemImpostores}`);
      
      // Forçar correção: definir os primeiros N jogadores como impostor e resto como cidadão
      const playersCorrected = players.map((player: any, index: number) => ({
        ...player,
        role: index < numImpostors ? "impostor" : "citizen",
      }));
      
      // Embaralhar novamente após correção usando Fisher-Yates
      for (let i = playersCorrected.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playersCorrected[i], playersCorrected[j]] = [playersCorrected[j], playersCorrected[i]];
      }
      
      // Re-validar após correção
      contagemImpostores = playersCorrected.filter((p: any) => p.role === "impostor").length;
      if (contagemImpostores !== numImpostors) {
        throw new Error(`Falha crítica na atribuição de papéis. Jogadores: ${totalPlayers}, Impostores solicitados: ${numImpostors}, Impostores gerados: ${contagemImpostores}`);
      }
      
      // Usar a versão corrigida
      playersWithRoles = playersCorrected;
      
      // 6. Logging
      console.log(`[ROLE ASSIGNMENT] Jogadores: ${totalPlayers}, Impostores Solicitados: ${numImpostors}, Impostores Gerados: ${contagemImpostores} (CORRIGIDO)`);
    } else {
      // 6. Logging
      console.log(`[ROLE ASSIGNMENT] Jogadores: ${totalPlayers}, Impostores Solicitados: ${numImpostors}, Impostores Gerados: ${contagemImpostores}`);
    }

    // Adicionar a nova palavra ao array de palavras usadas
    const updatedUsedWords = [...usedWords, secret_word];

    // Atualizar sala com dados do jogo
    await updateDoc(roomRef, {
      gameStarted: true,
      status: "playing",
      theme,
      secretWord: secret_word,
      category,
      numImpostors,
      maxGuesses,
      wrongGuesses: 0,
      deadPlayerIds: [],
      voteRequests: [],
      votes: {},
      winner: null,
      players: playersWithRoles,
      usedWords: updatedUsedWords,
      startedAt: new Date().toISOString(),
      lastGameStartedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erro ao iniciar jogo:", error);
    throw error;
  }

  // REDIRECT FORA DO TRY/CATCH - crítico para funcionar corretamente
  // O redirect lança um erro especial que o Next.js captura para navegação
  // Se estiver dentro do try/catch, será tratado como erro comum
  redirect(`/game/${roomId}`);
}

export async function removePlayer(roomId: string, playerIdToRemove: string) {
  try {
    const roomRef = doc(db, "rooms", roomId);
    
    // Usar transaction para garantir consistência
    await runTransaction(db, async (transaction) => {
      const roomSnap = await transaction.get(roomRef);

      if (!roomSnap.exists()) {
        throw new Error("Sala não encontrada");
      }

      const roomData = roomSnap.data();
      
      // Não permitir remover se o jogo já começou
      if (roomData?.gameStarted || roomData?.status === "playing") {
        throw new Error("Não é possível remover jogadores durante o jogo");
      }

      const players = roomData?.players || [];
      
      // 1. Filtrar o jogador a ser removido
      const novosJogadores = players.filter((player: any) => player.id !== playerIdToRemove);

      // 2. Verificação de Sala Vazia (CRÍTICO)
      if (novosJogadores.length === 0) {
        // Sala vazia: deletar o documento inteiro
        transaction.delete(roomRef);
        console.log(`[CLEANUP] Sala ${roomId} deletada automaticamente (sem jogadores)`);
        return; // Não fazer update
      }

      // 3. Caso Sobrem Jogadores: atualizar normalmente
      let hostId = roomData?.hostId;
      
      // Se o jogador removido era o Host, passar liderança para o primeiro jogador restante
      if (hostId === playerIdToRemove) {
        hostId = novosJogadores[0].id;
        // Atualizar o flag isHost nos jogadores
        novosJogadores.forEach((player: any, index: number) => {
          player.isHost = index === 0;
        });
      }

      // Atualizar sala removendo o jogador
      transaction.update(roomRef, {
        players: novosJogadores,
        hostId: hostId,
      });
    });

    return { success: true };
  } catch (error) {
    console.error("Erro ao remover jogador:", error);
    throw error;
  }
}

export async function resetGame(roomId: string) {
  try {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      throw new Error("Sala não encontrada");
    }

    const roomData = roomSnap.data();
    const players = roomData?.players || [];

    // Remover roles dos jogadores, mas manter os jogadores na sala
    const playersWithoutRoles = players.map((player: any) => {
      const { role, ...playerWithoutRole } = player;
      return playerWithoutRole;
    });

    // Resetar o jogo: limpar dados do jogo e voltar para waiting
    await updateDoc(roomRef, {
      gameStarted: false,
      status: "waiting",
      theme: null,
      secretWord: null,
      category: null,
      players: playersWithoutRoles,
      startedAt: null,
      // Limpar campos de votação e jogo
      deadPlayerIds: [],
      wrongGuesses: 0,
      voteRequests: [],
      votes: {},
      winner: null,
      lastEliminationMessage: null,
      numImpostors: null,
      maxGuesses: null,
    });

    return { success: true };
  } catch (error) {
    console.error("Erro ao resetar jogo:", error);
    throw error;
  }
}

