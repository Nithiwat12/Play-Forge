import type { HTMLAttributes } from "react";

export function Card({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-black/20 backdrop-blur ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
