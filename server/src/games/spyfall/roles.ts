import type { SpyfallLocation } from "./locations";

// Fisher-Yates shuffle - used for picking the location, the spy, and
// dealing roles so no positional bias leaks information to players.
export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Assigns one role from the location's role list to each non-spy player.
 * If there are more players than distinct roles, roles repeat (still
 * shuffled) rather than throwing - keeps the game playable with larger
 * groups against a shorter role list.
 */
export function assignRoles(location: SpyfallLocation, nonSpyUserIds: string[]): Map<string, string> {
  const assignment = new Map<string, string>();
  const pool = shuffle(location.roles);

  nonSpyUserIds.forEach((userId, index) => {
    assignment.set(userId, pool[index % pool.length]);
  });

  return assignment;
}
