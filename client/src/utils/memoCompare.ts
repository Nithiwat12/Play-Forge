// Small helpers for React.memo custom comparators.
//
// The server always resends a brand-new array/object on every state
// broadcast (see BaseGame.getPublicState() and RoomService.toPublicRoom -
// both rebuild their player lists with `.map()` on every call, even when
// nothing relevant actually changed). That means a plain `React.memo`
// (which only compares prop references) never skips a re-render for
// these props - every single chat message or vote update would otherwise
// force every player-list row, the role card, and the voting buttons to
// re-render along with it. These helpers build a cheap value-based
// "signature" string instead, so a memoized component only re-renders
// when something it actually displays changed. Player lists here are
// tiny (a handful of people), so the cost of building the signature is
// negligible next to the cost of a wasted render.
interface SignaturePlayer {
  userId: string;
  username?: string;
  connected?: boolean;
  hasVoted?: boolean;
  isReady?: boolean;
  isHost?: boolean;
}

export function playersSignature(players: SignaturePlayer[]): string {
  return players
    .map(
      (p) =>
        `${p.userId}:${p.username ?? ""}:${p.connected ?? ""}:${p.hasVoted ?? ""}:${p.isReady ?? ""}:${p.isHost ?? ""}`
    )
    .join("|");
}
