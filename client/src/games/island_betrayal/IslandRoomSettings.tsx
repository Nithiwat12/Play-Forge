import { resources, type Resource } from "./types";
export const islandDefaults = {
  cycleSeconds: 300, discussionSeconds: 30, voteSeconds: 60, escapeSeconds: 120,
  bagCapacities: [8, 12, 16, 20], dropLifetimeDays: 2, maxDays: 10, threatPerDay: .15, maxThreat: 2.5,
  movementMultiplier: 1, spawnMultiplier: 1, tieRule: "none", spyVictory: "prevent_escape", survivorEscape: "any", minimumEscape: 1,
  revealEliminatedRoles: true, spiesKnowEachOther: false,
  missions: [{ resource: "wood" as Resource, quantity: 10, location: "camp" }, { resource: "medicine" as Resource, quantity: 1, location: "village" }, { resource: "parts" as Resource, quantity: 2, location: "shipwreck" }],
};
type Settings = typeof islandDefaults;
const places = { camp: "แคมป์", forest: "ป่าโปร่ง", jungle: "ป่าดงดิบ", village: "หมู่บ้าน", plains: "ทุ่งราบ", mountain: "ภูเขา", cave: "ถ้ำ", ruins: "ซากวิหาร", volcano: "ภูเขาไฟ", shipwreck: "ซากเรือ", beach: "ชายหาด", lake: "ทะเลสาบ", workshop: "โรงงานร้าง" };
export function IslandRoomSettings({ value: v, onChange }: { value: Settings; onChange: (v: Settings) => void }) {
  const cls="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white";
  function number(key: keyof Settings,label:string,min:number,max:number,step=1){return <label className="block text-sm text-slate-300">{label}<input className={cls} type="number" required min={min} max={max} step={step} value={v[key] as number} onChange={e=>onChange({...v,[key]:Number(e.target.value)})}/></label>;}
  function select(key:keyof Settings,label:string,options:[string,string][]){return <label className="block text-sm text-slate-300">{label}<select className={cls} value={v[key] as string} onChange={e=>onChange({...v,[key]:e.target.value})}>{options.map(([id,n])=><option key={id} value={id}>{n}</option>)}</select></label>;}
  return <div className="space-y-4">
    {number("cycleSeconds","เวลากลางวันและกลางคืน (วินาทีต่อช่วง)",60,600)}
    {select("tieRule","เมื่อคะแนนโหวตเสมอ",[["none","ไม่กำจัดใคร"],["random","สุ่มจากคนที่เสมอ"],["revote","โหวตใหม่ 1 ครั้ง"]])}
    {select("spyVictory","เงื่อนไข Spy ชนะ",[["prevent_escape","ขัดขวางไม่ให้ผู้รอดชีวิตหนีสำเร็จ"],["survive_to_end","มี Spy รอดจนจบเกม"]])}
    {select("survivorEscape","เงื่อนไขผู้รอดชีวิตชนะ",[["any","มีผู้รอดชีวิตหนีได้อย่างน้อย 1 คน"],["all","ผู้รอดชีวิตที่ยังมีชีวิตต้องหนีครบทุกคน"],["minimum","กำหนดจำนวนขั้นต่ำ"]])}
    {v.survivorEscape==="minimum"&&number("minimumEscape","ผู้รอดชีวิตที่ต้องหนีขั้นต่ำ",1,14)}
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={v.revealEliminatedRoles} onChange={e=>onChange({...v,revealEliminatedRoles:e.target.checked})}/>เปิดเผยบทบาทคนที่ถูกโหวตออก</label>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={v.spiesKnowEachOther} onChange={e=>onChange({...v,spiesKnowEachOther:e.target.checked})}/>ให้ Spy รู้จัก Spy คนอื่นในทีม (เป็นข้อมูลส่วนตัว)</label>
    <details className="rounded-xl border border-slate-700 p-4"><summary className="cursor-pointer text-sm">ตั้งค่าขั้นสูง: กระเป๋า ภารกิจ และความยาก</summary><div className="mt-4 space-y-4">
      {number("discussionSeconds","เวลาพูดคุยก่อนโหวต (วินาที)",15,180)}{number("voteSeconds","เวลาโหวต (วินาที)",15,180)}{number("escapeSeconds","เวลาเดินทางขึ้นเรือ (วินาที)",30,300)}
      <div><p className="text-sm">ช่องกระเป๋าแต่ละระดับ (ต้องเพิ่มขึ้น)</p><div className="mt-2 grid grid-cols-4 gap-2">{v.bagCapacities.map((n,i)=><label key={i} className="text-xs text-slate-400">ระดับ {i+1}<input className={cls} aria-label={`ความจุกระเป๋าระดับ ${i+1}`} type="number" min={4} max={40} required value={n} onChange={e=>onChange({...v,bagCapacities:v.bagCapacities.map((x,j)=>j===i?Number(e.target.value):x)})}/></label>)}</div></div>
      {number("dropLifetimeDays","ของที่วางอยู่ได้กี่วัน",1,3)}{number("maxDays","จำนวนวันสูงสุดบนเกาะ",3,20)}{number("threatPerDay","ความยากเพิ่มต่อวัน (0.15 = 15%)",0,.4,.05)}{number("maxThreat","ตัวคูณความยากสูงสุด",1,4,.25)}{number("movementMultiplier","ตัวคูณพลังงานเดินทาง",.5,2,.25)}{number("spawnMultiplier","ตัวคูณการเกิดทรัพยากรและมอนสเตอร์",.5,2,.25)}
      <div className="space-y-3"><p className="font-medium">ภารกิจส่งทรัพยากร</p>{v.missions.map((m,i)=><div key={i} className="rounded-lg border border-slate-700 p-3"><label className="text-xs">สถานที่<select className={cls} value={m.location} onChange={e=>onChange({...v,missions:v.missions.map((x,j)=>j===i?{...x,location:e.target.value}:x)})}>{Object.entries(places).map(([id,n])=><option key={id} value={id}>{n}</option>)}</select></label><label className="text-xs">ทรัพยากร<select className={cls} value={m.resource} onChange={e=>onChange({...v,missions:v.missions.map((x,j)=>j===i?{...x,resource:e.target.value as Resource}:x)})}>{Object.entries(resources).map(([id,n])=><option key={id} value={id}>{n}</option>)}</select></label><label className="text-xs">จำนวน<input className={cls} type="number" required min={1} max={30} value={m.quantity} onChange={e=>onChange({...v,missions:v.missions.map((x,j)=>j===i?{...x,quantity:Number(e.target.value)}:x)})}/></label><button type="button" disabled={v.missions.length<=1} className="mt-2 text-xs text-red-300 disabled:opacity-40" onClick={()=>onChange({...v,missions:v.missions.filter((_,j)=>i!==j)})}>ลบภารกิจ</button></div>)}<button type="button" disabled={v.missions.length>=6} className="rounded bg-slate-800 px-3 py-2 text-sm disabled:opacity-40" onClick={()=>onChange({...v,missions:[...v.missions,{resource:"food",quantity:2,location:"camp"}]})}>เพิ่มภารกิจ (สูงสุด 6)</button></div>
    </div></details>
  </div>;
}
