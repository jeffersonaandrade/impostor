"use server";

import { redirect } from "next/navigation";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateSecretWord } from "@/lib/groq";

export async function startGame(roomId: string, theme: string, numImpostors: number = 1) {
  try {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      throw new Error("Sala não encontrada");
    }

    const roomData = roomSnap.data();
    const players = roomData?.players || [];
    
    if (players.length < 3) {
      throw new Error("Mínimo de 3 jogadores necessário");
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

    // Criar array de papéis: N impostores e o resto cidadãos
    const roles: ("impostor" | "citizen")[] = [];
    for (let i = 0; i < numImpostors; i++) {
      roles.push("impostor");
    }
    for (let i = numImpostors; i < players.length; i++) {
      roles.push("citizen");
    }

    // Embaralhar (shuffle) o array de papéis
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }
    
    // Distribuir papéis embaralhados aos jogadores
    const playersWithRoles = players.map((player: any, index: number) => ({
      ...player,
      role: roles[index],
    }));

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
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      throw new Error("Sala não encontrada");
    }

    const roomData = roomSnap.data();
    
    // Não permitir remover se o jogo já começou
    if (roomData?.gameStarted || roomData?.status === "playing") {
      throw new Error("Não é possível remover jogadores durante o jogo");
    }

    const players = roomData?.players || [];
    
    // Filtrar o jogador a ser removido
    const updatedPlayers = players.filter((player: any) => player.id !== playerIdToRemove);

    // Se o jogador removido era o host, definir o primeiro jogador restante como host
    let hostId = roomData?.hostId;
    if (hostId === playerIdToRemove && updatedPlayers.length > 0) {
      hostId = updatedPlayers[0].id;
      // Atualizar o flag isHost nos jogadores
      updatedPlayers.forEach((player: any, index: number) => {
        player.isHost = index === 0;
      });
    }

    // Atualizar sala removendo o jogador
    await updateDoc(roomRef, {
      players: updatedPlayers,
      hostId: hostId,
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
    });

    return { success: true };
  } catch (error) {
    console.error("Erro ao resetar jogo:", error);
    throw error;
  }
}

