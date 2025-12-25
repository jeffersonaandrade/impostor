"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, setDoc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGameStore } from "@/lib/store";

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const [playerName, setPlayerName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { setRoomId, setCurrentPlayer } = useGameStore();

  useEffect(() => {
    // Focar no input do nickname quando a página carregar
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleJoin = async () => {
    if (!playerName.trim() || isJoining) return;

    setIsJoining(true);
    setRoomId(roomId);

    try {
      const playerId = `player_${Date.now()}`;
      localStorage.setItem(`player_${roomId}`, playerId);

      const roomRef = doc(db, "rooms", roomId);
      const roomSnap = await getDoc(roomRef);

      if (!roomSnap.exists()) {
        // Criar sala se não existir
        await setDoc(roomRef, {
          id: roomId,
          players: [{ id: playerId, name: playerName, isHost: true }],
          hostId: playerId,
          gameStarted: false,
          status: "waiting",
          usedWords: [],
          createdAt: serverTimestamp(),
        });
      } else {
        // Adicionar jogador
        const currentPlayers = roomSnap.data()?.players || [];
        const isFirstPlayer = currentPlayers.length === 0;

        await updateDoc(roomRef, {
          players: [...currentPlayers, { id: playerId, name: playerName, isHost: isFirstPlayer }],
          hostId: isFirstPlayer ? playerId : roomSnap.data()?.hostId,
        });
      }

      // Redirecionar imediatamente para o lobby após sucesso
      router.push(`/lobby/${roomId}`);
      // Forçar navegação mesmo se houver algum delay
      setTimeout(() => {
        window.location.href = `/lobby/${roomId}`;
      }, 500);
    } catch (error) {
      console.error("Erro ao entrar na sala:", error);
      setIsJoining(false);
    }
  };

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
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Código da Sala</label>
            <Input
              type="text"
              value={roomId}
              readOnly
              disabled
              className="bg-black border-gray-700 text-gray-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Seu Nickname</label>
            <Input
              ref={inputRef}
              type="text"
              placeholder="Digite seu nome"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && playerName.trim()) {
                  handleJoin();
                }
              }}
              className="bg-black border-gray-700 text-white placeholder:text-gray-500 focus:border-red-600"
            />
          </div>
          <Button
            onClick={handleJoin}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            disabled={!playerName.trim() || isJoining}
          >
            {isJoining ? "Entrando..." : "Entrar na Sala"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

