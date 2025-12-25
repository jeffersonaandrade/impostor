"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DoorClosed, Flashlight, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Efeito de lanterna caída - sombra e luz */}
      <div className="absolute bottom-20 left-1/4 transform -translate-x-1/2 opacity-30">
        <div className="relative">
          {/* Sombra da lanterna */}
          <div className="absolute top-8 left-1/2 transform -translate-x-1/2 w-32 h-8 bg-black/50 blur-xl rounded-full"></div>
          {/* Lanterna */}
          <Flashlight className="w-12 h-12 text-yellow-400 rotate-45 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
          {/* Feixe de luz fraco */}
          <div className="absolute top-6 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-yellow-400/20 blur-sm"></div>
        </div>
      </div>

      {/* Porta fechada ao fundo */}
      <div className="absolute right-1/4 top-1/2 transform -translate-y-1/2 opacity-20">
        <DoorClosed className="w-32 h-32 text-gray-600" />
      </div>

      {/* Conteúdo principal */}
      <div className="relative z-10 text-center space-y-8 max-w-md">
        <div className="space-y-4">
          <h1 className="text-9xl font-bold text-white/10">404</h1>
          <h2 className="text-4xl font-bold text-white">Página Não Encontrada</h2>
          <p className="text-gray-400 text-lg">
            A porta está fechada. A lanterna se apagou.
          </p>
          <p className="text-gray-500 text-sm">
            O que você procura não está aqui... ou talvez esteja em outro lugar.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 pt-4">
          <Button
            onClick={() => router.push("/")}
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-6 text-lg font-semibold"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Voltar para o Início
          </Button>
          
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-900 hover:text-white"
          >
            Voltar
          </Button>
        </div>

        {/* Efeito de poeira/partículas sutis */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-1 h-1 bg-white/10 rounded-full animate-pulse"></div>
          <div className="absolute top-1/2 right-1/3 w-1 h-1 bg-white/10 rounded-full animate-pulse delay-300"></div>
          <div className="absolute bottom-1/4 left-1/2 w-1 h-1 bg-white/10 rounded-full animate-pulse delay-700"></div>
        </div>
      </div>
    </div>
  );
}

