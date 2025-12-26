"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, setDoc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { Copy, MessageCircle, Clock, X, LogOut, QrCode } from "lucide-react";
import QRCodeSVG from "react-qr-code";
import { useGameStore } from "@/lib/store";
import { startGame, removePlayer } from "@/app/actions/game";

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const [playerName, setPlayerName] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [theme, setTheme] = useState("");
  const [numImpostors, setNumImpostors] = useState(1);
  const [maxGuesses, setMaxGuesses] = useState(1);
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [gameData, setGameData] = useState<any>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [hostName, setHostName] = useState<string>("");
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  const { setRoomId, setCurrentPlayer, setTheme: setStoreTheme } = useGameStore();

  useEffect(() => {
    setRoomId(roomId);
    
    // Gerar link de convite e URL do QR Code
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/join/${roomId}`;
      setInviteLink(url);
      setQrCodeUrl(url);
    }
    
    // Verificar se já existe a sala
    const roomRef = doc(db, "rooms", roomId);
    getDoc(roomRef).then((snapshot) => {
      if (!snapshot.exists()) {
        // Criar sala se não existir
        setDoc(roomRef, {
          id: roomId,
          createdAt: serverTimestamp(),
          players: [],
          gameStarted: false,
          status: "waiting",
          usedWords: [],
        });
      }
    });

    // Obter playerId do localStorage
    const playerId = localStorage.getItem(`player_${roomId}`);
    if (playerId) {
      setCurrentPlayerId(playerId);
      // Se já tem playerId, significa que o usuário já entrou
      setHasJoined(true);
    }

    // Escutar mudanças na sala
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setGameData(data);
        const roomPlayers = data.players || [];
        setPlayers(roomPlayers);
        
        // Identificar o host
        const host = roomPlayers.find((p: any) => p.id === data.hostId);
        if (host) {
          setHostName(host.name);
        }
        
        // Verificar se o usuário atual está na lista de jogadores
        if (playerId) {
          const currentPlayer = roomPlayers.find((p: any) => p.id === playerId);
          if (currentPlayer) {
            setHasJoined(true);
            // Verificar se o usuário atual é o host
            if (playerId === data.hostId) {
              setIsHost(true);
            } else {
              setIsHost(false);
            }
          } else {
            // Sessão expirada: playerId existe no localStorage mas não está mais na sala
            console.log("Sessão expirada: jogador não encontrado na sala");
            localStorage.removeItem(`player_${roomId}`);
            router.push(`/join/${roomId}`);
            return;
          }
        }
        
        // Verificar se o jogo já começou - REDIRECIONAMENTO REATIVO
        // Isso deve acontecer IMEDIATAMENTE quando status mudar para 'playing'
        if (data.status === "playing" && roomPlayers.length > 0) {
          const currentPlayer = roomPlayers.find((p: any) => p.id === playerId);
          if (currentPlayer) {
            setCurrentPlayer(currentPlayer);
            setStoreTheme(data.theme);
            // Redirecionar imediatamente, independente do estado do botão
            router.push(`/game/${roomId}`);
            return; // Sair do listener para evitar processamento desnecessário
          }
        }
      }
    });

    return () => unsubscribe();
  }, [roomId, router, setRoomId, setCurrentPlayer, setStoreTheme]);

  const handleJoin = async () => {
    if (!playerName.trim()) return;

    const playerId = `player_${Date.now()}`;
    localStorage.setItem(`player_${roomId}`, playerId);

    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);
    
    if (!roomSnap.exists()) {
      // Criar sala
        await setDoc(roomRef, {
          id: roomId,
          players: [{ id: playerId, name: playerName, isHost: true }],
          hostId: playerId,
          gameStarted: false,
          status: "waiting",
          usedWords: [],
          createdAt: serverTimestamp(),
        });
      setIsHost(true);
    } else {
      // Adicionar jogador
      const currentPlayers = roomSnap.data()?.players || [];
      const isFirstPlayer = currentPlayers.length === 0;
      
      await updateDoc(roomRef, {
        players: [...currentPlayers, { id: playerId, name: playerName, isHost: isFirstPlayer }],
        hostId: isFirstPlayer ? playerId : roomSnap.data()?.hostId,
      });
      setIsHost(isFirstPlayer);
    }

    setHasJoined(true);
  };

  const handleStartGame = async () => {
    if (!theme.trim()) return;
    
    // Validação: não permitir mais impostores do que jogadores - 1
    const maxImpostors = players.length - 1;
    if (numImpostors > maxImpostors) {
      setToastMessage(`Máximo de ${maxImpostors} impostor${maxImpostors > 1 ? 'es' : ''} permitido${maxImpostors > 1 ? 's' : ''} para ${players.length} jogador${players.length > 1 ? 'es' : ''}`);
      setShowToast(true);
      return;
    }
    
    setIsStarting(true);
    try {
      await startGame(roomId, theme, numImpostors, maxGuesses);
      // Não resetar isStarting aqui - o useEffect vai redirecionar quando status mudar
    } catch (error: any) {
      console.error("Erro ao iniciar jogo:", error);
      setToastMessage(error.message || "Erro ao iniciar o jogo");
      setShowToast(true);
      setIsStarting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      setToastMessage("Link copiado!");
      setShowToast(true);
    } catch (error) {
      console.error("Erro ao copiar link:", error);
      setToastMessage("Erro ao copiar link");
      setShowToast(true);
    }
  };

  const handleShareWhatsApp = () => {
    if (!inviteLink) return;
    const message = encodeURIComponent(`Vem jogar Impostor comigo! 🎮\n\n${inviteLink}`);
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  const handleRemovePlayer = async (playerIdToRemove: string) => {
    if (!isHost) return;
    if (playerIdToRemove === currentPlayerId) return; // Não pode remover a si mesmo
    
    try {
      await removePlayer(roomId, playerIdToRemove);
    } catch (error: any) {
      console.error("Erro ao remover jogador:", error);
      setToastMessage(error.message || "Erro ao remover jogador");
      setShowToast(true);
    }
  };

  const handleLeaveRoom = async () => {
    if (!currentPlayerId) return;
    
    try {
      // Remover jogador do Firestore
      await removePlayer(roomId, currentPlayerId);
      
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

  if (!hasJoined) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#0a0a0a] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Entrar na Sala</CardTitle>
            <CardDescription className="text-gray-400">
              Sala: {roomId}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="text"
              placeholder="Seu nome"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleJoin();
                }
              }}
              className="bg-black border-gray-700 text-white placeholder:text-gray-500"
            />
            <Button
              onClick={handleJoin}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
              disabled={!playerName.trim()}
            >
              Entrar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Botão Sair - Canto superior direito */}
        <div className="flex justify-end">
          <Button
            onClick={handleLeaveRoom}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white hover:bg-gray-900"
            title="Sair da sala"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair da Sala
          </Button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white">Sala: {roomId}</h1>
          <p className="text-gray-400">Aguardando jogadores...</p>
        </div>

        <Card className="bg-[#0a0a0a] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Convidar Jogadores</CardTitle>
            <CardDescription className="text-gray-400">
              Compartilhe o link para outros jogadores entrarem
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="text"
                value={inviteLink}
                readOnly
                className="bg-black border-gray-700 text-white text-sm flex-1"
              />
              <Button
                onClick={handleCopyLink}
                variant="outline"
                size="icon"
                className="border-gray-700 text-white hover:bg-gray-900 hover:text-white"
                title="Copiar link"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleShareWhatsApp}
                variant="outline"
                className="flex-1 border-gray-700 text-white hover:bg-gray-900 hover:text-white"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Compartilhar no </span>WhatsApp
              </Button>
              <Button
                onClick={() => setShowQRCode(!showQRCode)}
                variant="outline"
                className="flex-1 border-gray-700 text-white hover:bg-gray-900 hover:text-white"
              >
                <QrCode className="h-4 w-4 mr-2" />
                {showQRCode ? "Ocultar" : "Mostrar"} QR Code
              </Button>
            </div>
            {/* Seção do QR Code - Expansível */}
            {showQRCode && qrCodeUrl && (
              <div className="pt-4 border-t border-gray-800">
                <div className="flex flex-col items-center space-y-3">
                  <p className="text-sm text-gray-400 text-center px-2">
                    Escaneie o QR Code para entrar na sala
                  </p>
                  <div className="bg-white p-3 sm:p-4 rounded-lg w-full max-w-[256px]">
                    <QRCodeSVG
                      value={qrCodeUrl}
                      size={256}
                      level="H"
                      style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                      viewBox="0 0 256 256"
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center max-w-xs break-all px-2">
                    {qrCodeUrl}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#0a0a0a] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">
              Jogadores conectados: {players.length}/3 (Mínimo)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 bg-black rounded border border-gray-800"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{player.name}</span>
                    {player.isHost && (
                      <span className="text-xs text-red-500 font-semibold">HOST</span>
                    )}
                  </div>
                  {/* Botão de remover - apenas host pode ver, e não pode remover a si mesmo */}
                  {isHost && player.id !== currentPlayerId && !gameData?.gameStarted && (
                    <Button
                      onClick={() => handleRemovePlayer(player.id)}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-500/10"
                      title="Remover jogador"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {isHost && (
          <Card className="bg-[#0a0a0a] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Configurar Jogo</CardTitle>
              <CardDescription className="text-gray-400">
                Digite o tema para o jogo (ex: &quot;Séries dos anos 90&quot;)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="text"
                placeholder="Tema do jogo"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && theme.trim() && players.length >= 3) {
                    handleStartGame();
                  }
                }}
                className="bg-black border-gray-700 text-white placeholder:text-gray-500"
              />
              
              {/* Seletor de Número de Impostores */}
              <div className="space-y-2">
                <label className="text-sm text-gray-400">
                  Número de Impostores
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3].map((num) => {
                    const maxImpostors = players.length - 1;
                    const isDisabled = num > maxImpostors;
                    return (
                      <Button
                        key={num}
                        onClick={() => setNumImpostors(num)}
                        variant={numImpostors === num ? "default" : "outline"}
                        className={`flex-1 ${
                          numImpostors === num
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : "border-gray-700 text-white hover:bg-gray-900 hover:text-white"
                        } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                        disabled={isDisabled}
                        title={isDisabled ? `Máximo ${maxImpostors} impostor${maxImpostors > 1 ? 'es' : ''} para ${players.length} jogador${players.length > 1 ? 'es' : ''}` : ""}
                      >
                        {num}
                      </Button>
                    );
                  })}
                </div>
                {numImpostors > players.length - 1 && (
                  <p className="text-xs text-red-500 text-center">
                    Máximo: {players.length - 1} impostor{players.length - 1 > 1 ? 'es' : ''} para {players.length} jogador{players.length > 1 ? 'es' : ''}
                  </p>
                )}
              </div>

              {/* Seletor de Chances de Erro (Vidas) */}
              <div className="space-y-2">
                <label className="text-sm text-gray-400">
                  Chances de Erro (Vidas)
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3].map((num) => (
                    <Button
                      key={num}
                      onClick={() => setMaxGuesses(num)}
                      variant={maxGuesses === num ? "default" : "outline"}
                      className={`flex-1 ${
                        maxGuesses === num
                          ? "bg-red-600 hover:bg-red-700 text-white"
                          : "border-gray-700 text-white hover:bg-gray-900 hover:text-white"
                      }`}
                    >
                      {num}
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleStartGame}
                className={`w-full bg-red-600 hover:bg-red-700 text-white ${
                  players.length < 3 || isStarting || numImpostors > players.length - 1
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
                disabled={players.length < 3 || isStarting || numImpostors > players.length - 1}
              >
                {isStarting ? "Iniciando..." : "Iniciar Jogo"}
              </Button>
              {players.length < 3 && (
                <p className="text-sm text-gray-500 text-center">
                  Mínimo de 3 jogadores para iniciar
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {!isHost && (
          <Card className="bg-[#0a0a0a] border-gray-800">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="flex items-center justify-center">
                  <Clock className="w-8 h-8 text-gray-400 animate-pulse" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-white text-lg font-semibold">
                    Você está dentro!
                  </p>
                  <p className="text-gray-400">
                    Aguardando o Host <span className="text-red-500 font-semibold">{hostName || "..."}</span> iniciar a partida...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <Toast
        message={toastMessage || "Link copiado!"}
        isVisible={showToast}
        onClose={() => {
          setShowToast(false);
          setToastMessage("");
        }}
      />
    </div>
  );
}

