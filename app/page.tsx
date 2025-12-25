"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");

  const handleCreateRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push(`/lobby/${newRoomId}`);
  };

  const handleJoinRoom = () => {
    if (roomCode.trim()) {
      router.push(`/lobby/${roomCode.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-bold text-white tracking-tight">
            IMPOSTOR
          </h1>
          <p className="text-gray-400 text-lg">
            Um jogo de mistério e dedução
          </p>
        </div>

        <Card className="bg-[#0a0a0a] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-2xl">Entrar no Jogo</CardTitle>
            <CardDescription className="text-gray-400">
              Crie uma nova sala ou entre com um código
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleCreateRoom}
              className="w-full bg-red-600 hover:bg-red-700 text-white text-lg h-12 font-semibold"
              size="lg"
            >
              Criar Sala
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#0a0a0a] px-2 text-gray-500">ou</span>
              </div>
            </div>

            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Digite o código da sala"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleJoinRoom();
                  }
                }}
                className="bg-black border-gray-700 text-white placeholder:text-gray-500 focus:border-red-600"
              />
              <Button
                onClick={handleJoinRoom}
                variant="outline"
                className="w-full border-gray-700 text-white hover:bg-gray-900 hover:text-white"
                disabled={!roomCode.trim()}
              >
                Entrar na Sala
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

