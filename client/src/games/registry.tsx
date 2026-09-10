import type { ComponentType } from "react";
import { SpyfallGame } from "./spyfall/SpyfallGame";
import type { Room } from "../types";

export interface GameComponentProps {
  room: Room;
  publicState: unknown;
  privateState: unknown;
  selfUserId?: string;
  onAction: (actionType: string, payload: unknown) => Promise<{ ok: boolean; error?: string }>;
}

// Client-side mirror of the server's GameRegistry: maps a game's slug to
// the React component that renders it. Adding a future game means adding
// one entry here plus its own games/<slug>/ folder - PlayPage and every
// other platform page stay untouched.
export const GAME_COMPONENTS: Record<string, ComponentType<GameComponentProps>> = {
  spyfall: SpyfallGame as ComponentType<GameComponentProps>,
};
