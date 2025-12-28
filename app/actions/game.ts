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
    let usedWords = roomData?.usedWords || [];
    
    // Deck Reset: Se já usamos muitas palavras (50+), limpar o histórico
    // Isso permite que o tema seja reutilizado sem ficar sem opções
    if (usedWords.length > 50) {
      console.log(`[DECK RESET] Limpando histórico de palavras usadas (${usedWords.length} palavras).`);
      usedWords = [];
    }

    // Gerar palavra secreta usando Groq (evitando palavras já usadas)
    // Tentar até 3 vezes para garantir que não repita
    let secret_word: string;
    let category: string;
    let attempts = 0;
    const maxAttempts = 3;
    
    do {
      const result = await generateSecretWord(theme, usedWords);
      secret_word = result.secret_word;
      category = result.category;
      attempts++;
      
      // Se a palavra já foi usada, tentar novamente
      if (usedWords.includes(secret_word)) {
        console.log(`[WORD VALIDATION] Palavra "${secret_word}" já foi usada. Tentativa ${attempts}/${maxAttempts}.`);
        if (attempts >= maxAttempts) {
          // Se esgotou tentativas, limpar histórico e tentar uma última vez
          console.log(`[WORD VALIDATION] Esgotadas tentativas. Limpando histórico e tentando novamente.`);
          usedWords = [];
          const finalResult = await generateSecretWord(theme, []);
          secret_word = finalResult.secret_word;
          category = finalResult.category;
          break;
        }
      } else {
        // Palavra válida encontrada
        break;
      }
    } while (attempts < maxAttempts);

    // ============================================
    // LÓGICA DE ATRIBUIÇÃO DE PAPÉIS (ROLE ASSIGNMENT)
    // ============================================
    
    // Ler último(s) impostor(es) da partida anterior (Smart Shuffle - Memória Recente)
    const lastImpostorIds = roomData?.lastImpostorIds || [];
    
    // 1. Criar array de papéis com tamanho exato dos jogadores (Algoritmo "Baralho de Cartas")
    const totalPlayers = players.length;
    let roles: ("impostor" | "citizen")[];
    let playersWithRoles: any[];
    let rerollAttempts = 0;
    const maxRerollAttempts = 10; // Limite de tentativas para evitar loop infinito
    
    // 2. Smart Shuffle: Reembaralhar até que nenhum impostor seja o mesmo da última partida
    do {
      roles = new Array(totalPlayers);
      
      // Preencher com quantidade exata de impostores e resto cidadãos
      for (let i = 0; i < totalPlayers; i++) {
        roles[i] = i < numImpostors ? "impostor" : "citizen";
      }
      
      // Embaralhamento Robusto (Fisher-Yates Shuffle)
      for (let i = roles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [roles[i], roles[j]] = [roles[j], roles[i]];
      }
      
      // Mapeamento 1:1 - Atribuir roles[index] para cada jogador
      playersWithRoles = players.map((player: any, index: number) => {
        const { role: _, ...playerWithoutRole } = player; // Remover role anterior se existir
        return {
          ...playerWithoutRole,
          role: roles[index],
        };
      });
      
      // Verificar se algum dos novos impostores é o mesmo da última partida
      const newImpostorIds = playersWithRoles
        .filter((p: any) => p.role === "impostor")
        .map((p: any) => p.id);
      
      // Se houver sobreposição e não for o único jogador possível, reembaralhar
      const hasOverlap = lastImpostorIds.length > 0 && 
                         newImpostorIds.some((id: string) => lastImpostorIds.includes(id)) &&
                         newImpostorIds.length < totalPlayers; // Só reroll se houver alternativas
      
      if (hasOverlap && rerollAttempts < maxRerollAttempts) {
        rerollAttempts++;
        console.log(`[SMART SHUFFLE] Reroll ${rerollAttempts}/${maxRerollAttempts}: Impostor anterior detectado. Reembaralhando...`);
      } else {
        // Sucesso: nenhum impostor repetido OU esgotamos tentativas OU é o único possível
        if (rerollAttempts > 0) {
          console.log(`[SMART SHUFFLE] Sucesso após ${rerollAttempts} reroll(s).`);
        }
        break;
      }
    } while (rerollAttempts < maxRerollAttempts);
    
    // 5. Validação de Segurança (Safety Check) - ANTES de salvar no Firestore
    let contagemImpostores = playersWithRoles.filter((p: any) => p.role === "impostor").length;
    
    if (contagemImpostores !== numImpostors) {
      // Correção manual: garantir que a contagem esteja correta
      console.error(`ERRO CRÍTICO: Contagem de impostores incorreta! Solicitado: ${numImpostors}, Gerado: ${contagemImpostores}`);
      
      // Forçar correção: criar novo array de roles e embaralhar
      const correctedRoles: ("impostor" | "citizen")[] = new Array(totalPlayers);
      for (let i = 0; i < totalPlayers; i++) {
        correctedRoles[i] = i < numImpostors ? "impostor" : "citizen";
      }
      
      // Embaralhar os roles usando Fisher-Yates
      for (let i = correctedRoles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [correctedRoles[i], correctedRoles[j]] = [correctedRoles[j], correctedRoles[i]];
      }
      
      // Atribuir roles corrigidos aos jogadores
      const playersCorrected = players.map((player: any, index: number) => {
        const { role: _, ...playerWithoutRole } = player; // Remover role anterior
        return {
          ...playerWithoutRole,
          role: correctedRoles[index], // FORÇAR atribuição do role correto
        };
      });
      
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
    
    // Extrair IDs dos novos impostores para o próximo Smart Shuffle
    const newImpostorIds = playersWithRoles
      .filter((p: any) => p.role === "impostor")
      .map((p: any) => p.id);

    // Criar ordem de fala (turnOrder) - embaralhar todos os jogadores vivos
    const turnOrder = [...playersWithRoles];
    // Embaralhar usando Fisher-Yates
    for (let i = turnOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [turnOrder[i], turnOrder[j]] = [turnOrder[j], turnOrder[i]];
    }
    
    // Smart Shuffle de Turno: Garantir que o mesmo jogador não comece consecutivamente
    const lastStarterId = roomData?.lastStarterId;
    if (lastStarterId && turnOrder.length > 1 && turnOrder[0].id === lastStarterId) {
      // Se o primeiro jogador é o mesmo da última vez, mover para o final
      const firstPlayer = turnOrder.shift();
      if (firstPlayer) {
        turnOrder.push(firstPlayer);
      }
      console.log(`[TURN ORDER] Jogador ${lastStarterId} estava no início. Movido para o final para garantir rotação.`);
    }
    
    // Salvar apenas os IDs na ordem embaralhada
    const turnOrderIds = turnOrder.map((p: any) => p.id);
    const newStarterId = turnOrderIds[0]; // ID do primeiro jogador desta rodada

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
      lastImpostorIds: newImpostorIds, // Salvar para evitar repetição na próxima partida
      turnOrder: turnOrderIds, // Ordem de fala embaralhada
      lastStarterId: newStarterId, // Salvar quem começou esta rodada para próxima partida
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
      const players = roomData?.players || [];
      
      // Encontrar o jogador a ser removido
      const playerToRemove = players.find((p: any) => p.id === playerIdToRemove);
      if (!playerToRemove) {
        throw new Error("Jogador não encontrado na sala");
      }
      
      // 1. Filtrar o jogador a ser removido
      const novosJogadores = players.filter((player: any) => player.id !== playerIdToRemove);
      
      // Verificar se o jogo está em andamento e se o jogador removido era o último impostor
      const gameStatus = roomData?.status;
      const isGameActive = gameStatus === "playing" || gameStatus === "voting";
      
      let updateData: any = {
        players: novosJogadores,
      };
      
      if (isGameActive && playerToRemove.role === "impostor") {
        // Verificar quantos impostores ainda estão vivos
        const aliveImpostors = novosJogadores.filter((p: any) => {
          const isImpostor = p.role === "impostor";
          const isDead = (roomData?.deadPlayerIds || []).includes(p.id);
          return isImpostor && !isDead;
        });
        
        // Se não há mais impostores vivos, cidadãos vencem
        if (aliveImpostors.length === 0) {
          updateData.status = "finished";
          updateData.winner = "citizens";
          updateData.deadPlayerIds = [...(roomData?.deadPlayerIds || []), playerIdToRemove];
        }
      }

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

      // Atualizar sala removendo o jogador (mesclar updateData com hostId)
      transaction.update(roomRef, {
        ...updateData,
        players: updateData.players || novosJogadores,
        hostId: hostId || roomData?.hostId,
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
    // NOTA: NÃO limpamos lastImpostorIds e usedWords aqui para manter a memória entre partidas
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
      // lastImpostorIds e usedWords são mantidos para Smart Shuffle
    });

    return { success: true };
  } catch (error) {
    console.error("Erro ao resetar jogo:", error);
    throw error;
  }
}

/**
 * Sistema de Heartbeat - Apenas registra presença (sem auto-kick)
 * @param roomId - ID da sala
 * @param playerId - ID do jogador
 */
export async function sendHeartbeat(roomId: string, playerId: string) {
  try {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      return { success: false, error: "Sala não encontrada" };
    }

    const roomData = roomSnap.data();
    const players = roomData?.players || [];
    
    // Encontrar o jogador e atualizar seu heartbeat
    const playerIndex = players.findIndex((p: any) => p.id === playerId);
    
    if (playerIndex === -1) {
      return { success: false, error: "Jogador não encontrado na sala" };
    }

    const now = Date.now();
    const updatedPlayers = [...players];
    updatedPlayers[playerIndex] = {
      ...updatedPlayers[playerIndex],
      lastHeartbeat: now,
    };

    // Apenas atualizar o heartbeat, sem remover jogadores ou abortar jogo
    await updateDoc(roomRef, {
      players: updatedPlayers,
    });

    return { success: true };
  } catch (error) {
    console.error("Erro ao enviar heartbeat:", error);
    throw error;
  }
}

