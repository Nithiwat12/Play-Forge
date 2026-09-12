export interface MatchMetadata { id: string; numberOfRounds: number; }

export function readMatch(resultData: unknown): MatchMetadata | null {
  const match = (resultData as { match?: Partial<MatchMetadata> } | null)?.match;
  return match && typeof match.id === "string" && typeof match.numberOfRounds === "number"
    ? { id: match.id, numberOfRounds: match.numberOfRounds } : null;
}

// Legacy rounds are grouped in chronological sets; new rounds keep an explicit match id.
export function matchKey(session: { id: string; roomId: string; status?: string; history: { resultData: unknown }[] }, index: number, rounds: number): string {
  if (session.status && session.status !== "COMPLETED") return session.id;
  return readMatch(session.history[0]?.resultData)?.id ?? `${session.roomId}:legacy:${Math.floor(index / Math.max(1, rounds))}`;
}
