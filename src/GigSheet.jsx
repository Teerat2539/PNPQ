import { useMemo, useState } from 'react'
import { candidatesFor, fillSlots, lineText, baht, activeRoles } from './queue.js'
import { saveGig, deleteGig } from './firebase.js'
import { Sheet, Group, Field, Btn, toast, errText } from './ui.jsx'
import { Avatar } from './Avatar.jsx'

const today = () => new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD local
const OTHER = 'อื่นๆ'

export const copyLine = async g => {
  try { await navigator.clipboard.writeText(lineText(g)); toast('คัดลอกข้อความสำหรับ LINE แล้ว') }
  catch { toast('คัดลอกไม่สำเร็จ') }
}

export default function GigSheet({ gig, members, me, onClose }) {
  const [f, setF] = useState(() => ({
    date: gig?.date ?? today(), start: gig?.start ?? '18:00', end: gig?.end ?? '',
    title: gig?.title ?? '', location: gig?.location ?? '', soundTeam: gig?.soundTeam ?? '',
    budget: gig?.budget ?? '', note: gig?.note ?? '', headcount: gig?.headcount ?? gig?.slots.length ?? '',
  }))
  // Existing assignments are locked so re-opening a gig never reshuffles who is going.
  const [slots, setSlots] = useState(() =>
    gig?.slots.map(s => ({ role: s.role, uid: s.uid, locked: true, custom: !!s.custom })) ?? [])
  const [skipped, setSkipped] = useState(() => new Set())
  const [picking, setPicking] = useState(false)
  const [otherName, setOtherName] = useState(null) // string while typing an "other" role
  const [busy, setBusy] = useState(false)
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }))

  const max = Math.max(0, Math.floor(Number(f.headcount) || 0))
  const roles = activeRoles(members)
  const filled = useMemo(() => fillSlots(slots, members, skipped), [slots, members, skipped])
  const byId = useMemo(() => Object.fromEntries(members.map(m => [m.uid, m])), [members])
  const nameOf = uid => byId[uid]?.nickname ?? gig?.slots.find(s => s.uid === uid)?.name ?? '?'

  const addSlot = (role, custom = false) => {
    setSlots(s => [...s, { role, uid: null, locked: custom, custom }])
    setPicking(false); setOtherName(null)
  }
  const removeSlot = i => setSlots(s => s.filter((_, j) => j !== i))
  const lock = (i, uid) => setSlots(s => s.map((x, j) => j === i ? { ...x, uid: uid || null, locked: x.custom || !!uid } : x))
  const skip = uid => setSkipped(s => new Set(s).add(uid))
  const unskip = uid => setSkipped(s => { const n = new Set(s); n.delete(uid); return n })

  const draft = () => ({
    ...f, budget: Number(f.budget) || 0, headcount: max,
    slots: filled.map(s => ({ role: s.role, uid: s.uid, name: s.uid ? nameOf(s.uid) : '', ...(s.custom ? { custom: true } : {}) })),
  })

  const problem = (() => {
    if (!f.date || !f.start || !f.title.trim()) return 'กรอกวันที่ เวลา และชื่องาน'
    if (!max) return 'ใส่จำนวนคนที่ต้องการ'
    if (slots.length > max) return `เลือกตำแหน่งเกิน ${max} คน`
    if (!filled.length) return 'เพิ่มตำแหน่งอย่างน้อย 1 ตำแหน่ง'
    if (filled.some(s => !s.uid)) return 'ยังมีตำแหน่งที่ยังไม่มีคน'
    const u = filled.map(s => s.uid)
    if (new Set(u).size !== u.length) return 'มีชื่อซ้ำกันในงานเดียว'
  })()

  const save = async () => {
    setBusy(true)
    try {
      await saveGig(gig?.id, { ...draft(), createdBy: gig?.createdBy ?? me.uid }, new Set(members.map(m => m.uid)))
      toast('บันทึกงานแล้ว'); onClose()
    } catch (e) { toast(errText(e)) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!confirm(`ลบงาน "${gig.title}"? ยอดงานของทุกคนในงานนี้จะถูกหักออก 1`)) return
    setBusy(true)
    try { await deleteGig(gig.id, new Set(members.map(m => m.uid))); toast('ลบงานแล้ว'); onClose() }
    catch (e) { toast(errText(e)) } finally { setBusy(false) }
  }

  return (
    <Sheet open onClose={onClose} title={gig ? 'แก้ไขงาน' : 'เพิ่มงาน'}
      right={<button disabled={!!problem || busy} onClick={save} className="text-tint font-semibold text-[17px] disabled:opacity-30">บันทึก</button>}>
      <Group title="รายละเอียดงาน">
        <Field label="วันที่" type="date" value={f.date} onChange={set('date')} />
        <Field label="สแตนด์บาย" type="time" value={f.start} onChange={set('start')} />
        <Field label="ถึง (ถ้ามี)" type="time" value={f.end} onChange={set('end')} />
        <Field label="ชื่องาน" placeholder="เช่น งานแต่ง คุณเอ" value={f.title} onChange={set('title')} />
        <Field label="สถานที่" placeholder="ชื่อสถานที่" value={f.location} onChange={set('location')} />
        <Field label="เครื่องเสียง" placeholder="-" value={f.soundTeam} onChange={set('soundTeam')} />
        <Field label="งบวง (บาท)" type="number" inputMode="numeric" min="0" placeholder="0" value={f.budget} onChange={set('budget')} />
        <Field label="หมายเหตุ" placeholder="รีเควสจากลูกค้า" value={f.note} onChange={set('note')} />
      </Group>
      {f.end && f.end < f.start && <p className="-mt-4 mb-4 px-4 text-[13px] text-sub">เล่นข้ามคืน — นับเป็นงานของคืนวันที่เริ่ม</p>}

      <Group footer="ข้าม = ติดภารกิจ ไม่เพิ่มยอดและยังรักษาคิวไว้ · เลือกชื่อเอง = ล็อคตัวตามรีเควส (นับ +1 ตามปกติ) · ตำแหน่งอื่นๆ ต้องเลือกคนเองและไม่นับยอด">
        <Field label="จำนวนคน" type="number" inputMode="numeric" min="1" max="30" placeholder="เช่น 4"
          value={f.headcount} onChange={set('headcount')} />
      </Group>

      <h3 className="px-4 pb-1.5 text-[13px] uppercase text-sub">ตำแหน่ง · {slots.length}{max ? `/${max}` : ''} คน</h3>
      <div className="grid gap-3 mb-6">
        {filled.map((s, i) => (
          <div key={i} className="bg-card rounded-2xl p-3.5">
            <div className="flex items-center gap-3">
              {s.uid ? <Avatar avatar={byId[s.uid]?.avatar} seed={s.uid} size={40} />
                : <span className="size-10 rounded-full bg-fill shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-sub">{s.role}{s.custom && ' · เลือกเอง ไม่นับยอด'}</p>
                <p className={`font-semibold truncate ${s.uid ? '' : 'text-danger'}`}>
                  {s.uid ? (s.custom ? nameOf(s.uid) : `${nameOf(s.uid)} (${byId[s.uid]?.totalGigs ?? '-'})`)
                    : s.custom ? 'ยังไม่ได้เลือกคน' : 'ไม่มีคนว่าง'}
                  {s.locked && !s.custom && <span className="ml-1.5 text-[12px] text-gold">🔒 ล็อค</span>}
                </p>
              </div>
              <button aria-label={`ลบตำแหน่ง${s.role}`} onClick={() => removeSlot(i)}
                className="size-8 grid place-items-center rounded-full bg-fill text-sub text-[17px]">✕</button>
            </div>
            <div className="mt-2.5 flex gap-2">
              <select aria-label={`เลือกผู้เล่น${s.role}`} value={s.locked ? s.uid ?? '' : ''} onChange={e => lock(i, e.target.value)}
                className="flex-1 min-w-0 rounded-lg bg-fill px-3 py-2 text-[15px] outline-none">
                <option value="">{s.custom ? 'เลือกคน…' : 'อัตโนมัติ (ตามคิว)'}</option>
                {(s.custom ? members : candidatesFor(s.role, members)).map(m =>
                  <option key={m.uid} value={m.uid}>{m.nickname}{s.custom ? '' : ` (${m.totalGigs})`}</option>)}
              </select>
              {!s.locked && s.uid && (
                <button onClick={() => skip(s.uid)} className="shrink-0 text-[13px] px-2.5 rounded-lg bg-fill text-tint">ข้าม (ติดภารกิจ)</button>
              )}
            </div>
          </div>
        ))}

        {slots.length < max && !picking && (
          <button onClick={() => setPicking(true)}
            className="rounded-2xl border-2 border-dashed border-sep py-5 text-tint font-semibold text-[17px] active:opacity-60">
            ＋ เพิ่มตำแหน่ง
          </button>
        )}
        {picking && (
          <div className="bg-card rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <p className="font-semibold">เลือกตำแหน่ง</p>
              <button onClick={() => { setPicking(false); setOtherName(null) }} className="text-tint text-[15px]">ปิด</button>
            </div>
            {otherName === null ? (
              <div className="flex flex-wrap gap-2">
                {roles.map(r => <button key={r} onClick={() => addSlot(r)} className="px-3.5 py-2 rounded-full bg-fill text-[15px]">{r}</button>)}
                <button onClick={() => setOtherName('')} className="px-3.5 py-2 rounded-full bg-fill text-[15px]">{OTHER}</button>
              </div>
            ) : (
              <form className="flex gap-2" onSubmit={e => { e.preventDefault(); otherName.trim() && addSlot(otherName.trim(), true) }}>
                <input autoFocus aria-label="ชื่อตำแหน่ง" maxLength={20} placeholder="ชื่อตำแหน่ง เช่น พิธีกร" value={otherName}
                  onChange={e => setOtherName(e.target.value)} className="flex-1 min-w-0 rounded-lg bg-fill px-3 py-2 outline-none" />
                <button disabled={!otherName.trim()} className="px-4 rounded-lg bg-tint text-white font-semibold disabled:opacity-30">เพิ่ม</button>
              </form>
            )}
          </div>
        )}
        {max > 0 && slots.length >= max && <p className="text-center text-[13px] text-sub">ครบ {max} คนแล้ว</p>}
      </div>

      {skipped.size > 0 && (
        <div className="mb-6 px-1 flex flex-wrap gap-2 items-center text-[13px]">
          <span className="text-sub">ติดภารกิจ:</span>
          {[...skipped].map(u => (
            <button key={u} onClick={() => unskip(u)} className="px-2.5 py-1 rounded-full bg-card">{nameOf(u)} ✕</button>
          ))}
        </div>
      )}

      {problem && <p className="mb-4 text-center text-[13px] text-sub">{problem}</p>}
      <div className="grid gap-3 mb-4">
        <Btn kind="plain" disabled={!!problem} onClick={() => copyLine(draft())}>คัดลอกข้อความ LINE</Btn>
        {gig && me.isAdmin && <Btn kind="danger" disabled={busy} onClick={remove}>ลบงานนี้</Btn>}
      </div>
      {f.budget > 0 && filled.length > 0 && (
        <p className="text-center text-[13px] text-sub mb-2">เฉลี่ยคนละ ฿{baht(f.budget / filled.length)}</p>
      )}
    </Sheet>
  )
}
