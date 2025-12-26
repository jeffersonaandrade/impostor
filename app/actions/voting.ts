"use server";

import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function requestVote(roomId: string, playerId: string) {
  try {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      throw new Error("Sala não encontrada");
    }

    const roomData = roomSnap.data();
    const players = roomData?.players || [];
    const deadPlayerIds = roomData?.deadPlayerIds || [];
    const voteRequests = roomData?.voteRequests || [];

    // Verificar se o jogador está vivo
    if (deadPlayerIds.includes(playerId)) {
      throw new Error("Jogadores eliminados não podem votar");
    }

    // Verificar se já pediu votação
    if (voteRequests.includes(playerId)) {
      throw new Error("Você já pediu votação");
    }

    // Adicionar à lista de pedidos
    const updatedVoteRequests = [...voteRequests, playerId];

    // Calcular jogadores vivos
    const alivePlayers = players.filter((p: any) => !deadPlayerIds.includes(p.id));
    const aliveCount = alivePlayers.length;
    const requiredVotes = Math.ceil(aliveCount / 2); // >50%

    // Se atingiu >50%, iniciar votação
    if (updatedVoteRequests.length > requiredVotes) {
      await updateDoc(roomRef, {
        status: "voting",
        voteRequests: updatedVoteRequests,
        votes: {}, // Limpar votos anteriores
      });
    } else {
      await updateDoc(roomRef, {
        voteRequests: updatedVoteRequests,
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Erro ao pedir votação:", error);
    throw error;
  }
}

export async function submitVote(roomId: string, voterId: string, targetPlayerId: string) {
  try {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      throw new Error("Sala não encontrada");
    }

    const roomData = roomSnap.data();
    
    if (roomData?.status !== "voting") {
      throw new Error("Não há votação em andamento");
    }

    const players = roomData?.players || [];
    const deadPlayerIds = roomData?.deadPlayerIds || [];
    const votes = roomData?.votes || {};

    // Verificar se o votante está vivo
    if (deadPlayerIds.includes(voterId)) {
      throw new Error("Jogadores eliminados não podem votar");
    }

    // Verificar se o alvo está vivo
    if (deadPlayerIds.includes(targetPlayerId)) {
      throw new Error("Não é possível votar em jogadores eliminados");
    }

    // Registrar voto
    const updatedVotes = {
      ...votes,
      [voterId]: targetPlayerId,
    };

    // Calcular jogadores vivos que podem votar
    const alivePlayers = players.filter((p: any) => !deadPlayerIds.includes(p.id));
    const aliveCount = alivePlayers.length;
    const votesCount = Object.keys(updatedVotes).length;

    // Se todos votaram, resolver votação
    if (votesCount >= aliveCount && aliveCount > 0) {
      await resolveVoting(roomRef, roomData, updatedVotes);
    } else {
      // Ainda faltam votos, apenas atualizar
      await updateDoc(roomRef, {
        votes: updatedVotes,
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Erro ao votar:", error);
    throw error;
  }
}

// Função auxiliar para resolver votação (reutilizada em submitVote e forceEndVoting)
async function resolveVoting(roomRef: any, roomData: any, votes: any) {
  const players = roomData?.players || [];
  const deadPlayerIds = roomData?.deadPlayerIds || [];

  // Contar votos
  const voteCounts: { [key: string]: number } = {};
  Object.values(votes).forEach((targetId: any) => {
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  });

  // Encontrar o mais votado
  let mostVotedId = "";
  let maxVotes = 0;
  Object.entries(voteCounts).forEach(([playerId, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      mostVotedId = playerId;
    }
  });

  // Se não houver votos ou empate sem vencedor claro, não eliminar ninguém
  if (!mostVotedId || maxVotes === 0) {
    await updateDoc(roomRef, {
      status: "playing",
      votes: {},
      voteRequests: [],
    });
    return;
  }

  // Encontrar o jogador mais votado
  const mostVotedPlayer = players.find((p: any) => p.id === mostVotedId);
  
  if (!mostVotedPlayer) {
    throw new Error("Jogador votado não encontrado");
  }

  // Verificar se é impostor ou cidadão
  if (mostVotedPlayer.role === "impostor") {
    // VITÓRIA DOS CIDADÃOS
    await updateDoc(roomRef, {
      status: "finished",
      winner: "citizens",
      votes,
      voteRequests: [],
    });
  } else {
    // ERRO: Votaram num inocente
    const updatedDeadPlayerIds = [...deadPlayerIds, mostVotedId];
    const wrongGuesses = (roomData?.wrongGuesses || 0) + 1;
    const maxGuesses = roomData?.maxGuesses || 1;

    if (wrongGuesses >= maxGuesses) {
      // ACABARAM AS CHANCES - VITÓRIA DOS IMPOSTORES
      await updateDoc(roomRef, {
        status: "finished",
        winner: "impostors",
        wrongGuesses,
        deadPlayerIds: updatedDeadPlayerIds,
        votes,
        voteRequests: [],
      });
    } else {
      // O JOGO CONTINUA - Mostrar mensagem de erro
      const eliminatedPlayer = players.find((p: any) => p.id === mostVotedId);
      await updateDoc(roomRef, {
        status: "playing",
        wrongGuesses,
        deadPlayerIds: updatedDeadPlayerIds,
        votes: {},
        voteRequests: [],
        lastEliminationMessage: `${eliminatedPlayer?.name || "Alguém"} era inocente! Restam ${maxGuesses - wrongGuesses} tentativa${maxGuesses - wrongGuesses > 1 ? 's' : ''}.`,
      });
    }
  }
}

export async function forceEndVoting(roomId: string, hostId: string) {
  try {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      throw new Error("Sala não encontrada");
    }

    const roomData = roomSnap.data();
    
    // Verificar se o solicitante é o Host
    if (roomData?.hostId !== hostId) {
      throw new Error("Apenas o Host pode forçar o fim da votação");
    }

    if (roomData?.status !== "voting") {
      throw new Error("Não há votação em andamento");
    }

    const votes = roomData?.votes || {};
    const votesCount = Object.keys(votes).length;

    // Se ninguém votou, bloquear a ação
    if (votesCount === 0) {
      throw new Error("Não é possível encerrar a votação sem nenhum voto. Aguarde pelo menos um jogador votar.");
    }

    // Resolver votação com os votos atuais
    await resolveVoting(roomRef, roomData, votes);

    return { success: true };
  } catch (error) {
    console.error("Erro ao forçar fim da votação:", error);
    throw error;
  }
}

