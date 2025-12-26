"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { AlertTriangle, LogOut, Users, Vote } from "lucide-react";
import { useGameStore } from "@/lib/store";
import { resetGame, removePlayer } from "@/app/actions/game";
import { requestVote, submitVote, forceEndVoting } from "@/app/actions/voting";
import Image from "next/image";

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const [revealed, setRevealed] = useState(false);
  const [gameData, setGameData] = useState<any>(null);
  const [currentPlayer, setCurrentPlayer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [selectedVoteTarget, setSelectedVoteTarget] = useState<string | null>(null);
  const [hasRequestedVote, setHasRequestedVote] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  const { setCurrentPlayer: setStorePlayer, setSecretWord, setCategory, setTheme } = useGameStore();

  useEffect(() => {
    const playerId = localStorage.getItem(`player_${roomId}`);
    if (!playerId) {
      router.push(`/lobby/${roomId}`);
      return;
    }

    const roomRef = doc(db, "rooms", roomId);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setGameData(data);
        
        // Verificar se o jogo foi resetado (status voltou para waiting ou gameStarted = false)
        if (!data.gameStarted || data.status === "waiting") {
          router.push(`/lobby/${roomId}`);
          return;
        }
        
        const player = data.players?.find((p: any) => p.id === playerId);
        if (player) {
          setCurrentPlayer(player);
          setStorePlayer(player);
          setSecretWord(data.secretWord || null);
          setCategory(data.category || null);
          setTheme(data.theme || null);
          
          // Verificar se já pediu votação
          setHasRequestedVote((data.voteRequests || []).includes(playerId));
          
          // Verificar se já votou
          setHasVoted(!!data.votes?.[playerId]);
          
          // Mostrar mensagem de eliminação se houver
          if (data.lastEliminationMessage) {
            setToastMessage(data.lastEliminationMessage);
            setShowToast(true);
          }
          
          // Verificar se o jogo terminou
          if (data.status === "finished") {
            setIsLoading(false);
          }
        } else {
          // Sessão expirada: playerId existe no localStorage mas não está mais na sala
          console.log("Sessão expirada: jogador não encontrado na sala");
          localStorage.removeItem(`player_${roomId}`);
          router.push(`/join/${roomId}`);
          return;
        }

        // Fake loading de 2 segundos para aumentar tensão
        setTimeout(() => {
          setIsLoading(false);
        }, 2000);
      }
    });

    return () => unsubscribe();
  }, [roomId, router, setStorePlayer, setSecretWord, setCategory, setTheme]);

  const handleReveal = () => {
    setRevealed(true);
  };

  const handleResetGame = async () => {
    if (isResetting) return;
    
    setIsResetting(true);
    try {
      await resetGame(roomId);
      // O listener vai redirecionar automaticamente quando o status mudar
    } catch (error: any) {
      console.error("Erro ao resetar jogo:", error);
      setToastMessage(error.message || "Erro ao resetar o jogo");
      setShowToast(true);
      setIsResetting(false);
    }
  };

  const handleLeaveRoom = async () => {
    const playerId = localStorage.getItem(`player_${roomId}`);
    if (!playerId) {
      router.push("/");
      return;
    }
    
    try {
      // Remover jogador do Firestore
      await removePlayer(roomId, playerId);
      
      // Limpar localStorage
      localStorage.removeItem(`player_${roomId}`);
      
      // Redirecionar para home
      router.push("/");
    } catch (error: any) {
      console.error("Erro ao sair da sala:", error);
      // Mesmo com erro, limpar localStorage e redirecionar
      localStorage.removeItem(`player_${roomId}`);
      router.push("/");
    }
  };

  const handleRequestVote = async () => {
    const playerId = localStorage.getItem(`player_${roomId}`);
    if (!playerId) return;
    
    try {
      await requestVote(roomId, playerId);
      setHasRequestedVote(true);
      setToastMessage("Votação solicitada!");
      setShowToast(true);
    } catch (error: any) {
      setToastMessage(error.message || "Erro ao solicitar votação");
      setShowToast(true);
    }
  };

  const handleSubmitVote = async () => {
    if (!selectedVoteTarget) return;
    
    const playerId = localStorage.getItem(`player_${roomId}`);
    if (!playerId) return;
    
    try {
      await submitVote(roomId, playerId, selectedVoteTarget);
      setHasVoted(true);
      setToastMessage("Voto registrado!");
      setShowToast(true);
    } catch (error: any) {
      setToastMessage(error.message || "Erro ao votar");
      setShowToast(true);
    }
  };

  const handleForceEndVoting = async () => {
    const playerId = localStorage.getItem(`player_${roomId}`);
    if (!playerId) return;
    
    try {
      await forceEndVoting(roomId, playerId);
      setToastMessage("Votação encerrada pelo Host");
      setShowToast(true);
    } catch (error: any) {
      setToastMessage(error.message || "Erro ao forçar fim da votação");
      setShowToast(true);
    }
  };

  const isHost = currentPlayer?.isHost || false;
  
  // Calcular jogadores vivos e eliminados
  const deadPlayerIds = gameData?.deadPlayerIds || [];
  const alivePlayers = (gameData?.players || []).filter((p: any) => !deadPlayerIds.includes(p.id));
  const deadPlayers = (gameData?.players || []).filter((p: any) => deadPlayerIds.includes(p.id));
  
  // Tentativas restantes
  const maxGuesses = gameData?.maxGuesses || 1;
  const wrongGuesses = gameData?.wrongGuesses || 0;
  const remainingGuesses = maxGuesses - wrongGuesses;
  
  // Status do jogo
  const gameStatus = gameData?.status || "playing";
  const winner = gameData?.winner;
  
  // Verificar se o jogador atual está vivo
  const playerId = localStorage.getItem(`player_${roomId}`);
  const isAlive = playerId && !deadPlayerIds.includes(playerId);
  
  // Contar votos de pedido (em tempo real do Firestore)
  const voteRequests = gameData?.voteRequests || [];
  const requiredVotes = Math.ceil(alivePlayers.length / 2);
  const voteRequestsCount = voteRequests.length;
  
  // Verificar se o jogador atual já pediu votação (em tempo real do Firestore)
  // Isso garante que a UI atualize automaticamente quando outros jogadores pedirem votação
  const hasRequestedVoteRealTime = playerId ? voteRequests.includes(playerId) : false;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        {/* Botão Sair - Canto superior direito */}
        <div className="absolute top-4 right-4">
          <Button
            onClick={handleLeaveRoom}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white hover:bg-gray-900"
            title="Sair da sala"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
        <div className="text-center space-y-4">
          <div className="animate-pulse">
            <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full mx-auto animate-spin"></div>
          </div>
          <p className="text-white text-xl font-medium animate-pulse">
            Consultando os arquivos secretos...
          </p>
          <p className="text-gray-500 text-sm">
            Identificando suspeitos...
          </p>
        </div>
      </div>
    );
  }

  if (!currentPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        {/* Botão Sair - Canto superior direito */}
        <div className="absolute top-4 right-4">
          <Button
            onClick={handleLeaveRoom}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white hover:bg-gray-900"
            title="Sair da sala"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
        <p className="text-white">Carregando...</p>
      </div>
    );
  }

  // Tela de Fim de Jogo
  if (gameStatus === "finished") {
    // Recuperar nomes dos impostores
    const players = gameData?.players || [];
    const impostors = players.filter((p: any) => p.role === "impostor");
    
    // Formatar nomes dos impostores
    let impostorsNames = "";
    const isPlural = impostors.length > 1;
    
    if (impostors.length === 1) {
      impostorsNames = impostors[0].name;
    } else if (impostors.length === 2) {
      impostorsNames = `${impostors[0].name} e ${impostors[1].name}`;
    } else {
      const names = impostors.map((p: any) => p.name);
      const last = names.pop();
      impostorsNames = `${names.join(", ")} e ${last}`;
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <div className="absolute top-4 right-4">
          <Button
            onClick={handleLeaveRoom}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white hover:bg-gray-900"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
        
        <div className="w-full max-w-2xl space-y-6">
          {winner === "citizens" ? (
            // VITÓRIA DOS CIDADÃOS
            <Card className="bg-[#0a0a0a] border-gray-300 border-2">
              <CardContent className="p-0">
                <div className="relative w-full h-64 md:h-80">
                  <Image
                    src="/citizens-win.png"
                    alt="Vitória dos Cidadãos"
                    fill
                    className="object-cover rounded-t-lg"
                    priority
                  />
                </div>
                <div className="p-8 text-center space-y-6">
                  <h2 className="text-4xl md:text-5xl font-bold text-white">
                    A JUSTIÇA PREVALECEU!
                  </h2>
                  <p className="text-gray-300 text-lg md:text-xl leading-relaxed">
                    Os cidadãos desmascararam a farsa.{" "}
                    <span className="font-bold text-white">{impostorsNames}</span>{" "}
                    {isPlural ? "não conseguiram enganar" : "não conseguiu enganar"} a todos.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            // VITÓRIA DOS IMPOSTORES
            <Card className="bg-[#0a0a0a] border-red-600 border-2">
              <CardContent className="p-0">
                <div className="relative w-full h-64 md:h-80">
                  <Image
                    src="/impostor-win.png"
                    alt="Vitória dos Impostores"
                    fill
                    className="object-cover rounded-t-lg"
                    priority
                  />
                </div>
                <div className="p-8 text-center space-y-6">
                  <h2 className="text-4xl md:text-5xl font-bold text-red-500">
                    AS SOMBRAS VENCERAM.
                  </h2>
                  <p className="text-gray-300 text-lg md:text-xl leading-relaxed">
                    A cidade dorme enganada.{" "}
                    <span className="font-bold text-white">{impostorsNames}</span>{" "}
                    {isPlural ? "desapareceram" : "desapareceu"} na neblina da noite...
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Botões de ação */}
          <div className="space-y-3">
            {isHost && (
              <Button
                onClick={handleResetGame}
                disabled={isResetting}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold text-lg py-6"
              >
                {isResetting ? "Reiniciando..." : "Jogar Novamente"}
              </Button>
            )}
            <Button
              onClick={handleLeaveRoom}
              variant="outline"
              className="w-full border-gray-700 text-gray-300 hover:bg-gray-900 hover:text-white"
            >
              Sair da Sala
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 pb-32 relative">
      {/* Botão Sair - Canto superior direito */}
      <div className="absolute top-4 right-4">
        <Button
          onClick={handleLeaveRoom}
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-white hover:bg-gray-900"
          title="Sair da sala"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>

      {/* Header com Tentativas Restantes */}
      <div className="absolute top-4 left-4 right-20">
        <Card className="bg-[#0a0a0a] border-gray-800">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" />
                <span className="text-white text-sm">
                  Tentativas Restantes: <span className={`font-bold ${remainingGuesses > 0 ? 'text-red-500' : 'text-gray-500'}`}>{remainingGuesses}</span>
                </span>
              </div>
              {deadPlayers.length > 0 && (
                <div className="text-xs text-gray-500">
                  Eliminados: {deadPlayers.map((p: any) => p.name).join(", ")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fase de Votação */}
      {gameStatus === "voting" && isAlive && (
        <div className="w-full max-w-md space-y-4 mt-20">
          <Card className="bg-[#0a0a0a] border-gray-800">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-xl font-bold text-white text-center">Votação em Andamento</h3>
              <p className="text-gray-400 text-sm text-center">
                Escolha quem você acha que é o impostor
              </p>
              <div className="space-y-2">
                {alivePlayers.map((player: any) => {
                  if (player.id === playerId) return null; // Não pode votar em si mesmo
                  return (
                    <Button
                      key={player.id}
                      onClick={() => setSelectedVoteTarget(player.id)}
                      variant={selectedVoteTarget === player.id ? "default" : "outline"}
                      className={`w-full ${
                        selectedVoteTarget === player.id
                          ? "bg-red-600 hover:bg-red-700 text-white"
                          : "border-gray-700 text-white hover:bg-gray-900"
                      }`}
                      disabled={hasVoted}
                    >
                      {player.name}
                    </Button>
                  );
                })}
              </div>
              {!hasVoted && (
                <Button
                  onClick={handleSubmitVote}
                  disabled={!selectedVoteTarget}
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                >
                  Confirmar Voto
                </Button>
              )}
              {hasVoted && (
                <p className="text-center text-gray-400 text-sm">
                  Aguardando outros jogadores votarem...
                </p>
              )}
              {/* Botão para Host forçar fim da votação */}
              {isHost && (
                <Button
                  onClick={handleForceEndVoting}
                  variant="outline"
                  className="w-full border-orange-500 text-orange-500 hover:bg-orange-500/10 hover:text-orange-400 mt-4"
                >
                  Encerrar Votação (Forçar)
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fase de Jogo Normal - Revelação de Carta */}
      {gameStatus === "playing" && !revealed && (
        <Card
          onClick={handleReveal}
          className="w-full max-w-md bg-[#0a0a0a] border-gray-800 cursor-pointer hover:border-red-600 transition-all h-96 flex items-center justify-center"
        >
          <CardContent className="text-center">
            <div className="space-y-4">
              <div className="text-6xl mb-4">🃏</div>
              <p className="text-white text-xl font-semibold">
                Clique para revelar sua carta
              </p>
              <p className="text-gray-500 text-sm">
                Sua identidade será revelada
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Após revelar carta - Mostrar informações e botão de votação */}
      {gameStatus === "playing" && revealed && (
        <div className="w-full max-w-md space-y-6 mt-20">
          {currentPlayer.role === "impostor" ? (
            <Card className="bg-red-950 border-red-800 border-2">
              <CardContent className="p-8 text-center space-y-6">
                <div className="flex justify-center">
                  <AlertTriangle className="w-24 h-24 text-red-600" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-4xl font-bold text-red-600">
                    VOCÊ É O IMPOSTOR
                  </h2>
                  <p className="text-red-200 text-lg">
                    Não deixe que descubram sua identidade
                  </p>
                </div>
                <div className="pt-4 border-t border-red-800">
                  <p className="text-red-300 text-sm">
                    Tema: <span className="font-semibold">{gameData?.theme}</span>
                  </p>
                  <p className="text-red-300 text-sm mt-2">
                    Categoria: <span className="font-semibold">{gameData?.category}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-[#0a0a0a] border-gray-800">
              <CardContent className="p-8 text-center space-y-6">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-white">
                    VOCÊ É UM CIDADÃO
                  </h2>
                  <p className="text-gray-400">
                    Descubra quem é o impostor
                  </p>
                </div>
                <div className="pt-6 border-t border-gray-800">
                  <p className="text-gray-500 text-sm mb-2">PALAVRA SECRETA</p>
                  <p className="text-4xl font-bold text-white mb-4">
                    {gameData?.secretWord}
                  </p>
                  <p className="text-gray-400 text-sm">
                    Tema: <span className="font-semibold text-white">{gameData?.theme}</span>
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    Categoria: <span className="font-semibold text-white">{gameData?.category}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Botão de Sugerir Votação - Apenas para jogadores vivos */}
          {gameStatus === "playing" && isAlive && revealed && (
            <Card className="bg-[#0a0a0a] border-gray-800">
              <CardContent className="p-4 space-y-3">
                {/* Contador de votos - sempre visível */}
                <div className="text-center mb-2">
                  <p className="text-xs text-gray-400">
                    {voteRequestsCount}/{requiredVotes} jogadores pediram votação
                  </p>
                </div>
                
                {/* Botão ou feedback baseado em tempo real */}
                {!hasRequestedVoteRealTime ? (
                  <Button
                    onClick={handleRequestVote}
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                    disabled={gameStatus !== "playing"}
                  >
                    <Vote className="h-4 w-4 mr-2" />
                    Sugerir Votação
                  </Button>
                ) : (
                  <div className="text-center space-y-2 py-2">
                    <p className="text-white font-semibold">Você já pediu votação</p>
                    <p className="text-sm text-gray-400">
                      {voteRequestsCount < requiredVotes ? (
                        <>Aguardando mais {requiredVotes - voteRequestsCount} jogador{requiredVotes - voteRequestsCount > 1 ? 'es' : ''}...</>
                      ) : (
                        <>Votação será iniciada em breve...</>
                      )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Mensagem para jogadores eliminados */}
          {!isAlive && (
            <Card className="bg-gray-900 border-gray-700">
              <CardContent className="p-4 text-center">
                <p className="text-gray-400">
                  Você foi eliminado. O jogo continua sem você.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Botão de Reset apenas para o Host */}
      {revealed && isHost && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-md px-4">
          <Button
            onClick={handleResetGame}
            disabled={isResetting}
            className="w-full bg-white hover:bg-gray-200 text-black font-semibold text-lg py-6 shadow-lg"
          >
            {isResetting ? "Encerrando..." : "Encerrar Partida / Jogar Novamente"}
          </Button>
        </div>
      )}

      <Toast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
}

