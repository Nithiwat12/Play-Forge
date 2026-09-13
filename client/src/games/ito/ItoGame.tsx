import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GameComponentProps } from "../registry";
import type { ItoPublic, ItoPrivate } from "./types";
import { Button } from "../../components/common/Button";
import { Card } from "../../components/common/Card";

export function ItoGame({ room, publicState, privateState, selfUserId, onAction }: GameComponentProps) {
  const s = publicState as ItoPublic | null, mine = privateState as ItoPrivate | null;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [shown, setShown] = useState(false), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [now, setNow] = useState(Date.now());
  const lock = useRef(false); const navigate = useNavigate();
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { setShown(false); setDrafts({}); }, [s?.round]);
  if (!s || !mine) return <Card>กำลังรับข้อมูลไพ่ลับ…</Card>;
  const name = (id: string) => s.players.find(p => p.userId === id)?.username ?? id;
  const proposal = s.proposal;
  const blocked = busy || s.players.some(p => !p.connected);
  async function act(type: string, payload: unknown) {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try { const r = await onAction(`ito:${type}`, payload); if (!r.ok) setError(r.error ?? "ทำรายการไม่สำเร็จ"); }
    catch { setError("เชื่อมต่อไม่ได้ กรุณาลองใหม่"); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="mx-auto max-w-5xl space-y-5 pb-8 text-slate-100">
    <Card className="border-teal-700 bg-gradient-to-br from-teal-950 to-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs tracking-widest text-teal-300">{room.roomName} · เกมร่วมมือ 2–8 คน</p><h1 className="mt-2 text-4xl font-bold">ito <span className="text-lg font-normal text-slate-300">ใจตรงกันไหม?</span></h1><p className="mt-2 text-sm">{s.mode === "ONLINE" ? "⌨ ออนไลน์ · พิมพ์คำใบ้ ไม่ต้องใช้เสียง" : "💬 นั่งด้วยกัน · พูดคำใบ้ แล้วกดเล่นบนอุปกรณ์ของตัวเอง"}</p></div><div className="text-right"><p className="text-2xl text-rose-400">{"♥".repeat(s.lives)}{"♡".repeat(3 - s.lives)}</p><p>ด่าน {s.round}/{s.stages}</p>{s.phase !== "FINISHED" && <p className="text-sm text-slate-400">เหลือ {Math.max(0, Math.ceil((s.deadline - now) / 1000))} วินาที</p>}</div></div>
    </Card>
    <details className="rounded-xl border border-slate-700 p-4"><summary className="cursor-pointer">วิธีเล่นและกติกาเวอร์ชันนี้</summary><p className="mt-3 text-sm leading-7 text-slate-300">ทุกคนอยู่ทีมเดียวกัน ได้เลขลับ 1–100 ไม่ซ้ำกัน ใบ้ตามหัวข้อโดยไม่บอกเลขหรือใช้รหัสแทนเลข เสนอไพ่ของตัวเองที่คิดว่าต่ำที่สุด แล้วรอทุกคนยืนยันเพื่อเปิดจากน้อยไปมาก ถ้าไม่แน่ใจให้กด “รอก่อน” หัวใจร่วม 3 ดวง เปิดข้ามไพ่ต่ำกว่าเสีย 1 ดวงต่อครั้งและนำไพ่ที่ข้ามออก ผ่านด่านแล้วเพิ่มไพ่คนละ 1 ใบ ผ่านครบทุกด่านชนะด้วยกัน หมดหัวใจหรือหมดเวลาแพ้ ทั้งสองโหมดใช้คนละอุปกรณ์และบัญชี</p><p className="mt-2 text-sm text-slate-400">ออนไลน์ต้องพิมพ์คำใบ้ครบทุกใบก่อนเสนอเปิดไพ่ กรองตัวเลขอารบิกและไทย แต่ผู้เล่นยังต้องตกลงไม่บอกเลขเป็นคำหรือรหัสด้วยตนเอง เมื่อมีคนหลุดจะรอกลับมาโดยเวลาเดินต่อ</p></details>
    {error && <p role="alert" className="rounded-xl bg-red-950 p-3 text-red-200">{error}</p>}
    {s.players.some(p => !p.connected) && <p role="status" className="rounded-xl bg-amber-950 p-4 text-amber-200">รอ {s.players.filter(p => !p.connected).map(p => p.username).join(", ")} กลับเข้าห้อง ไพ่ยังอยู่และเวลาเดินต่อ</p>}
    <Card><p className="text-xs text-teal-300">หัวข้อของด่านนี้</p><h2 className="my-3 text-2xl font-semibold">{s.topic.title}</h2><div className="flex justify-between gap-6 text-sm"><span>1 · {s.topic.low}</span><span className="text-right">100 · {s.topic.high}</span></div><div className="mt-3 h-2 rounded-full bg-gradient-to-r from-cyan-400 via-teal-400 to-amber-300" /></Card>
    {s.phase === "PLAY" && <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">ไพ่ลับของคุณ</h2><Button variant="secondary" onClick={() => setShown(!shown)}>{shown ? "ซ่อนเลข" : "ดูเลขของฉัน"}</Button></div><p className="mt-2 text-xs text-slate-400">อย่าให้คนอื่นเห็นหน้าจอตอนเปิดเลข</p><div className="mt-4 space-y-4">{mine.cards.map(c => <div key={c.id} className="rounded-xl border border-teal-800 bg-teal-950/30 p-4"><p className="mb-3 text-center text-5xl font-bold text-teal-200">{shown ? c.value : "?"}</p><label className="text-sm" htmlFor={c.id}>คำใบ้ไพ่ใบนี้ {s.mode === "TABLE" && "(ไม่บังคับ)"}</label><input id={c.id} className="my-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3" maxLength={160} disabled={!!proposal || busy} value={drafts[c.id] ?? c.clue} placeholder="ยกตัวอย่างให้ตรงกับระดับของเลข" onChange={e => setDrafts({ ...drafts, [c.id]: e.target.value })} /><div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={busy || !!proposal || !(drafts[c.id] ?? c.clue).trim()} onClick={() => act("clue", { cardId: c.id, text: drafts[c.id] ?? c.clue })}>บันทึกคำใบ้</Button><Button disabled={blocked || !!proposal} onClick={() => act("propose", { cardId: c.id })}>เสนอเปิดใบนี้</Button></div>{c.clue && <p className="mt-2 text-xs text-teal-300">เผยแพร่แล้ว: {c.clue}</p>}</div>)}{!mine.cards.length && <p className="text-slate-400">เปิดไพ่ครบแล้ว ช่วยเพื่อนยืนยันไพ่ที่เหลือได้</p>}</div></Card>
      <Card><h2 className="font-semibold">คำใบ้ของทุกคน</h2><div className="mt-4 space-y-3">{s.players.map(p => <div key={p.userId} className="rounded-xl bg-slate-900 p-3"><p className="text-sm font-semibold text-teal-300">{p.username} {p.userId === selfUserId && "(คุณ)"} · {p.cards.length} ใบ</p>{p.cards.map((c, i) => <p key={c.id} className="mt-2 break-words text-sm">ใบ {i + 1}: {c.clue || (s.mode === "TABLE" ? "ฟังคำใบ้จากเพื่อน" : "กำลังคิดคำใบ้…")}</p>)}</div>)}</div></Card>
    </div>}
    {proposal && <Card className="border-amber-600 bg-amber-950/30"><h2 className="text-lg font-semibold">{name(proposal.userId)} เสนอเปิดไพ่</h2><p className="my-3 break-words">“{s.players.flatMap(p => p.cards).find(c => c.id === proposal.cardId)?.clue || "คำใบ้ที่พูดไว้"}”</p><p className="mb-3 text-sm">ยืนยัน {proposal.votes.length}/{s.players.length} คน · รอ {s.players.filter(p => !proposal.votes.includes(p.userId)).map(p => p.username).join(", ")}</p>{!proposal.votes.includes(selfUserId ?? "") ? <div className="flex gap-3"><Button disabled={blocked} onClick={() => act("vote", { proposalId: proposal.id, accept: true })}>เห็นด้วย เปิดเลย</Button><Button variant="secondary" disabled={blocked} onClick={() => act("vote", { proposalId: proposal.id, accept: false })}>รอก่อน</Button></div> : <p className="text-teal-300">คุณยืนยันแล้ว รอเพื่อนตัดสินใจ</p>}</Card>}
    <Card><h2 className="mb-3 font-semibold">ไพ่ที่เปิดแล้ว</h2><div className="flex flex-wrap gap-3">{s.revealed.map(c => <div key={c.id} className={`rounded-xl border px-4 py-3 text-center ${c.missed ? "border-rose-600 bg-rose-950/40" : "border-teal-700 bg-teal-950/40"}`}><p className="text-3xl font-bold">{c.value}</p><p className="text-xs">{name(c.userId)}</p>{c.missed && <p className="text-xs text-rose-300">ถูกข้าม</p>}</div>)}{!s.revealed.length && <p className="text-sm text-slate-400">ยังไม่มีไพ่ถูกเปิด</p>}</div></Card>
    {s.phase === "ROUND_END" && <Card><h2 className="text-xl">ผ่านด่านแล้ว!</h2><p className="my-3">ด่านถัดไปได้ไพ่คนละ {s.round + 1} ใบ · พร้อม {s.ready.length}/{s.players.length} คน</p><Button disabled={busy || s.ready.includes(selfUserId ?? "")} onClick={() => act("ready", {})}>พร้อมด่านถัดไป</Button></Card>}
    {s.phase === "FINISHED" && <Card><h2 className="text-2xl">{s.summary}</h2><div className="mt-4 flex gap-3"><Button variant="secondary" onClick={() => navigate(`/lobby/${room.roomCode}`)}>กลับล็อบบี้ / เล่นใหม่</Button></div></Card>}
    <details className="rounded-xl border border-slate-700 p-4"><summary>บันทึกด่านนี้</summary><div className="mt-3 space-y-2 text-sm text-slate-400">{s.log.map((line, i) => <p key={i}>{line}</p>)}</div></details>
  </div>;
}
