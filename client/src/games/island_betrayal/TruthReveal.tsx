import type { IslandResult } from "./types";
export function TruthReveal({ result }: { result: IslandResult }) {
  return <section className="space-y-5">
    <h2 className="text-xl font-semibold text-white">ความจริงบนเกาะ</h2>
    <p className="text-slate-300">{result.summary}</p>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-400"><tr><th className="p-3">ผู้เล่น</th><th className="p-3">ผลลัพธ์</th><th className="p-3">เป้าหมายลับ</th><th className="p-3">สำเร็จ</th></tr></thead><tbody>{result.details.players.map(p => <tr key={p.userId} className="border-t border-slate-800"><td className="p-3 font-medium">{p.username}</td><td className="p-3 whitespace-nowrap">{p.escaped ? "🚤 หนีสำเร็จ" : p.alive ? "🏝️ อยู่บนเกาะ" : "☠️ เสียชีวิต"}</td><td className="p-3 min-w-48">{p.objective}</td><td className="p-3">{p.completed ? "✓" : "—"}</td></tr>)}</tbody></table></div>
    <details className="rounded-xl border border-slate-700 p-4" open><summary className="cursor-pointer font-semibold">เปิดเผยเหตุการณ์และแอ็กชันลับทั้งหมด</summary><ol className="mt-4 max-h-96 space-y-2 overflow-y-auto text-sm text-slate-300">{result.details.timeline.map(l => <li key={l.id}><span className="mr-3 text-amber-400">วันที่ {l.day}</span>{l.text}</li>)}</ol></details>
  </section>;
}
