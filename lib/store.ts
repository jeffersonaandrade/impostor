import { create } from "zustand";

export interface Player {
  id: string;
  name: string;
  role?: "citizen" | "impostor";
  isHost?: boolean;
}

export interface GameState {
  roomId: string | null;
  players: Player[];
  currentPlayer: Player | null;
  gameStarted: boolean;
  secretWord: string | null;
  category: string | null;
  theme: string | null;
  setRoomId: (roomId: string | null) => void;
  setPlayers: (players: Player[]) => void;
  setCurrentPlayer: (player: Player | null) => void;
  setGameStarted: (started: boolean) => void;
  setSecretWord: (word: string | null) => void;
  setCategory: (category: string | null) => void;
  setTheme: (theme: string | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  roomId: null,
  players: [],
  currentPlayer: null,
  gameStarted: false,
  secretWord: null,
  category: null,
  theme: null,
  setRoomId: (roomId) => set({ roomId }),
  setPlayers: (players) => set({ players }),
  setCurrentPlayer: (currentPlayer) => set({ currentPlayer }),
  setGameStarted: (gameStarted) => set({ gameStarted }),
  setSecretWord: (secretWord) => set({ secretWord }),
  setCategory: (category) => set({ category }),
  setTheme: (theme) => set({ theme }),
  reset: () =>
    set({
      roomId: null,
      players: [],
      currentPlayer: null,
      gameStarted: false,
      secretWord: null,
      category: null,
      theme: null,
    }),
}));

