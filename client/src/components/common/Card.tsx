import type { HTMLAttributes } from "react";

export function Card({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl shadow-black/20 backdrop-blur sm:p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
