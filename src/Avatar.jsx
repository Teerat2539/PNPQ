// Avatars drawn with Open Peeps (openpeeps.com, CC0) via DiceBear.
// Stored on the user as { v: 2, head, face, facialHair, accessories, mask, skinColor, headContrastColor,
// clothingColor, backgroundColor }; '' means "none" for the optional parts.
import { useMemo, useState } from 'react'
import { createAvatar } from '@dicebear/core'
import * as peeps from '@dicebear/open-peeps'
import { setAvatar } from './firebase.js'
import { Group, toast, errText } from './ui.jsx'

const P = peeps.schema.properties
const list = k => P[k].items?.enum ?? P[k].default
const BGS = ['f59e0b', '0a84ff', '34c759', 'ff375f', 'af52de', '5ac8fa', 'e5e5ea', '27272a']

const PARTS = [
  { k: 'head', label: 'ทรงผม / หมวก', items: list('head') },
  { k: 'face', label: 'สีหน้า', items: list('face') },
  { k: 'facialHair', label: 'หนวดเครา', items: ['', ...list('facialHair')] },
  { k: 'accessories', label: 'แว่นตา', items: ['', ...list('accessories')] },
  { k: 'mask', label: 'หน้ากาก', items: ['', ...list('mask')] },
]
const COLORS = [
  { k: 'skinColor', label: 'สีผิว', items: list('skinColor') },
  { k: 'headContrastColor', label: 'สีผม', items: list('headContrastColor') },
  { k: 'clothingColor', label: 'สีเสื้อ', items: list('clothingColor') },
  { k: 'backgroundColor', label: 'สีพื้นหลัง', items: BGS },
]

// Members who never picked one get a stable look derived from their uid.
const fallback = seed => {
  let h = 0
  for (const c of seed || '') h = (h * 31 + c.charCodeAt(0)) >>> 0
  const pick = arr => arr[h % arr.length]
  return {
    v: 2, head: pick(list('head')), face: 'smile', facialHair: '', accessories: '', mask: '',
    skinColor: pick(list('skinColor')), headContrastColor: '2c1b18', clothingColor: pick(list('clothingColor')),
    backgroundColor: pick(BGS),
  }
}
const resolve = (avatar, seed) => (avatar?.v === 2 ? { ...fallback(seed), ...avatar } : fallback(seed))

const toUri = a => createAvatar(peeps, {
  seed: 'x',
  head: [a.head], face: [a.face],
  facialHair: a.facialHair ? [a.facialHair] : undefined, facialHairProbability: a.facialHair ? 100 : 0,
  accessories: a.accessories ? [a.accessories] : undefined, accessoriesProbability: a.accessories ? 100 : 0,
  mask: a.mask ? [a.mask] : undefined, maskProbability: a.mask ? 100 : 0,
  skinColor: [a.skinColor], headContrastColor: [a.headContrastColor], clothingColor: [a.clothingColor],
  backgroundColor: [a.backgroundColor],
}).toDataUri()

export function Avatar({ avatar, seed, size = 32, className = '' }) {
  const key = JSON.stringify(avatar ?? null) + seed
  const uri = useMemo(() => toUri(resolve(avatar, seed)), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return <img src={uri} alt="" width={size} height={size} className={`shrink-0 rounded-full ${className}`} />
}

export function AvatarEditor({ m }) {
  const saved = resolve(m.avatar, m.uid)
  const [a, setA] = useState(saved)
  const [busy, setBusy] = useState(false)
  const changed = JSON.stringify(a) !== JSON.stringify(saved)
  // Thumbnails show each choice on the current look, so they're recomputed only when the look changes.
  const thumbs = useMemo(() => Object.fromEntries(PARTS.map(p => [p.k, p.items.map(v => toUri({ ...a, [p.k]: v }))])), [a])
  const save = async () => {
    setBusy(true)
    try { await setAvatar(m.uid, a); toast('บันทึกอวตาร์แล้ว') } catch (e) { toast(errText(e)) } finally { setBusy(false) }
  }
  return (
    <Group>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <img src={toUri(a)} alt="ตัวอย่างอวตาร์" width={88} height={88} className="rounded-full" />
          <div className="flex gap-2">
            {changed && <button onClick={() => setA(saved)} className="px-3 py-2 rounded-lg bg-fill text-[15px]">คืนค่า</button>}
            <button disabled={!changed || busy} onClick={save} className="px-4 py-2 rounded-lg bg-tint text-white text-[15px] font-semibold disabled:opacity-30">บันทึก</button>
          </div>
        </div>
        {PARTS.map(p => (
          <div key={p.k} className="mt-3">
            <p className="text-[13px] text-sub mb-1.5">{p.label}</p>
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
              {p.items.map((v, i) => (
                <button key={v || 'none'} aria-label={v ? `${p.label} แบบที่ ${p.items[0] ? i + 1 : i}` : `${p.label} ไม่มี`} aria-pressed={a[p.k] === v}
                  onClick={() => setA(x => ({ ...x, [p.k]: v }))}
                  className={`relative shrink-0 rounded-full ring-offset-2 ring-offset-card ${a[p.k] === v ? 'ring-2 ring-tint' : ''}`}>
                  <img src={thumbs[p.k][i]} alt="" width={52} height={52} className="rounded-full" />
                  {!v && <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white text-[12px] font-semibold">ไม่มี</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
        {COLORS.map(c => (
          <div key={c.k} className="mt-3">
            <p className="text-[13px] text-sub mb-1.5">{c.label}</p>
            <div className="flex flex-wrap gap-2">
              {c.items.map((v, i) => (
                <button key={v} aria-label={`${c.label} ${i + 1}`} aria-pressed={a[c.k] === v} onClick={() => setA(x => ({ ...x, [c.k]: v }))}
                  className={`size-8 rounded-full ring-offset-2 ring-offset-card border border-sep/60 ${a[c.k] === v ? 'ring-2 ring-tint' : ''}`}
                  style={{ background: `#${v}` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Group>
  )
}
