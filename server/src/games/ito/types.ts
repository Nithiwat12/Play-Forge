export interface ItoCard { id: string; value: number; clue: string }
export interface ItoPublic {
  mode: "TABLE" | "ONLINE"; phase: "PLAY" | "ROUND_END" | "FINISHED";
  round: number; stages: number; lives: number; deadline: number;
  topic: { title: string; low: string; high: string };
  players: { userId: string; username: string; connected: boolean; cards: { id: string; clue: string }[] }[];
  proposal: { id: string; cardId: string; userId: string; votes: string[] } | null;
  revealed: { id: string; userId: string; value: number; clue: string; missed: boolean }[];
  ready: string[]; log: string[]; summary: string | null;
}
export interface ItoPrivate { cards: ItoCard[] }
