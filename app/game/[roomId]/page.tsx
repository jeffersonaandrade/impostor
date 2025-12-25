"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { AlertTriangle } from "lucide-react";
import { useGameStore } from "@/lib/store";
import { resetGame } from "@/app/actions/game";

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

  const isHost = currentPlayer?.isHost || false;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 pb-32">
      {!revealed ? (
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
      ) : (
        <div className="w-full max-w-md space-y-6">
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

