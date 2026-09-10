import type { SpyfallPrivateState } from "./types";

export function RoleCard({ privateState }: { privateState: SpyfallPrivateState }) {
  if (privateState.isSpy) {
    return (
      <div className="rounded-xl border border-red-800 bg-red-950/60 p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-400">Your role</p>
        <p className="mt-1 text-2xl font-bold text-red-200">You are the Spy</p>
        <p className="mt-2 text-sm text-red-300">
          Figure out the location from everyone's questions without giving yourself away.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-800 bg-brand-950/40 p-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">Location</p>
      <p className="mt-1 text-2xl font-bold text-white">{privateState.location}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-brand-400">
        Your role
      </p>
      <p className="mt-1 text-lg text-slate-100">{privateState.role}</p>
    </div>
  );
}
