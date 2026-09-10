export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-brand-500" />
    </div>
  );
}
