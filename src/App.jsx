import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot } from 'firebase/firestore'
import {
  auth, db, configured, login, logout, changePin, isInitialized, setupFirstAdmin, addMember, deleteMember,
  validUsername, validPin, setAdmin, setNickname, setRoles, renameUsername, resetPin,
} from './firebase.js'
import { ROLES, activeRoles, byFairness, candidatesFor, thaiDate, timeRange, baht, perPerson, baselineFor, adminNow, TEMP_ADMIN_HOURS } from './queue.js'
import { Card, Btn, Field, Group, LargeTitle, Sheet, Toaster, Disclosure, toast, errText } from './ui.jsx'
import GigSheet, { copyLine } from './GigSheet.jsx'
import { Avatar, AvatarEditor } from './Avatar.jsx'
import InstallApp from './InstallApp.jsx'

const Icon = ({ className = 'size-20' }) => <img src="/icon.svg" alt="" className={`${className} rounded-[22%] shadow-lg`} />
const todayIso = () => new Date().toLocaleDateString('sv-SE')
const sortGigs = gs => [...gs].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
const mapsUrl = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`

export default function App() {
  if (!configured) return <NotConfigured />
  return <><Toaster /><Root /></>
}

function Root() {
  const [authUser, setAuthUser] = useState(undefined)
  const [members, setMembers] = useState(null)
  const [gigs, setGigs] = useState(null)

  useEffect(() => onAuthStateChanged(auth, setAuthUser), [])
  useEffect(() => {
    if (!authUser) return
    const err = e => toast(errText(e))
    const u1 = onSnapshot(collection(db, 'users'), s =>
      setMembers(s.docs.map(d => ({ uid: d.id, ...d.data() })).sort((a, b) => a.memberOrder - b.memberOrder)), err)
    const u2 = onSnapshot(collection(db, 'gigs'), s => setGigs(sortGigs(s.docs.map(d => ({ id: d.id, ...d.data() })))), err)
    return () => { u1(); u2(); setMembers(null); setGigs(null) }
  }, [authUser])

  const me = members?.find(m => m.uid === authUser?.uid)
  useEffect(() => { // profile removed by admin -> sign out
    if (authUser && members && !me) { toast('บัญชีนี้ถูกลบออกจากวงแล้ว'); logout() }
  }, [authUser, members, me])

  if (authUser === undefined || (authUser && (!members || !gigs || !me))) return <Splash />
  if (!authUser) return <Login />
  return <Main me={me} members={members} gigs={gigs} />
}

const Splash = () => <div className="min-h-dvh grid place-items-center"><Icon className="size-24 animate-pulse" /></div>

function NotConfigured() {
  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <Card className="max-w-sm p-6 text-center">
        <Icon className="size-20 mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">ยังไม่ได้เชื่อม Firebase</h1>
        <p className="text-sub text-[15px]">คัดลอก <code>.env.example</code> เป็น <code>.env</code> แล้วใส่ค่าจาก Firebase Console จากนั้นรัน <code>npm run dev</code> ใหม่</p>
      </Card>
    </div>
  )
}

function Login() {
  const [init, setInit] = useState(null)
  const [f, setF] = useState({ username: '', pin: '', nickname: '', roles: [] })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => {
    isInitialized().then(setInit, () => { setInit(true); setErr('เชื่อม Firestore ไม่ได้ — ตรวจว่าสร้าง Firestore Database และ Publish Rules แล้ว') })
  }, [])
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }))
  const setup = init === false

  const ok = validUsername(f.username) && validPin(f.pin) && (!setup || (f.nickname.trim() && f.roles.length))
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('')
    try { setup ? await setupFirstAdmin(f) : await login(f.username, f.pin) }
    catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="min-h-dvh max-w-sm mx-auto px-4 flex flex-col justify-center py-10">
      <Icon className="size-24 mx-auto mb-5" />
      <h1 className="text-center text-[28px] font-bold">ป้องนภา</h1>
      <p className="text-center text-sub mb-8">{setup ? 'ตั้งค่าครั้งแรก — สร้างบัญชีแอดมิน' : 'ระบบจัดคิวงานของวง'}</p>
      <Group>
        <Field label="ชื่อผู้ใช้" autoCapitalize="none" autoComplete="username" placeholder="username" value={f.username} onChange={set('username')} />
        <Field label="PIN" type="password" inputMode="numeric" maxLength={4} autoComplete="current-password" placeholder="••••"
          value={f.pin} onChange={e => setF(v => ({ ...v, pin: e.target.value.replace(/\D/g, '') }))} />
        {setup && <Field label="ชื่อเล่น" placeholder="เช่น แป้ง" value={f.nickname} onChange={set('nickname')} />}
      </Group>
      {setup && <RolePicker value={f.roles} onChange={roles => setF(v => ({ ...v, roles }))} />}
      {err && <p role="alert" className="text-danger text-center mb-4 text-[15px]">{err}</p>}
      <Btn type="submit" disabled={!ok || busy || init === null}>{setup ? 'สร้างบัญชีแอดมิน' : 'เข้าสู่ระบบ'}</Btn>
    </form>
  )
}

function RolePicker({ value, onChange }) {
  const toggle = r => onChange(value.includes(r) ? value.filter(x => x !== r) : [...value, r])
  return (
    <section className="mb-6">
      <h3 className="px-4 pb-1.5 text-[13px] uppercase text-sub">ตำแหน่งที่เล่นได้</h3>
      <div className="flex flex-wrap gap-2">
        {ROLES.map(r => (
          <button type="button" key={r} aria-pressed={value.includes(r)} onClick={() => toggle(r)}
            className={`px-3.5 py-2 rounded-full text-[15px] ${value.includes(r) ? 'bg-tint text-white' : 'bg-card'}`}>{r}</button>
        ))}
      </div>
    </section>
  )
}

const TABS = [
  ['home', 'หน้าหลัก', 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z'],
  ['gigs', 'ตารางงาน', 'M7 2v3M17 2v3M3 8h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'],
  ['queue', 'คิว/สมาชิก', 'M16 11a4 4 0 1 0-8 0M3 21a9 9 0 0 1 18 0M12 7a3 3 0 1 0 0-.01'],
  ['settings', 'ตั้งค่า', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 19.4 9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 2z'],
]

function Main({ me: profile, members, gigs }) {
  const [tab, setTab] = useState('home')
  const [, tick] = useState(0) // re-render each 30s so a temporary admin right lapses on time
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 30000); return () => clearInterval(t) }, [])
  const me = { ...profile, isAdmin: adminNow(profile), isFullAdmin: !!profile.isAdmin }
  const [sheet, setSheet] = useState(null) // null | 'new' | gig
  // Gigs keep a name snapshot per slot; show the member's current nickname when they still exist.
  const gigsView = useMemo(() => {
    const byId = Object.fromEntries(members.map(m => [m.uid, m]))
    return gigs.map(g => ({ ...g, slots: g.slots.map(s => ({ ...s, name: byId[s.uid]?.nickname ?? s.name, avatar: byId[s.uid]?.avatar })) }))
  }, [gigs, members])
  const props = { me, members, gigs: gigsView, openGig: setSheet }
  return (
    <div className="min-h-dvh pb-[calc(env(safe-area-inset-bottom)+84px)]">
      <main className="max-w-xl mx-auto px-4 pt-[env(safe-area-inset-top)]">
        {tab === 'home' && <Home {...props} />}
        {tab === 'gigs' && <Gigs {...props} />}
        {tab === 'queue' && <Queue {...props} />}
        {tab === 'settings' && <Settings me={me} members={members} gigs={gigs} />}
      </main>
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-card/80 backdrop-blur-xl border-t border-sep/60 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-xl mx-auto grid grid-cols-4">
          {TABS.map(([k, label, d]) => (
            <button key={k} onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10px] font-medium ${tab === k ? 'text-tint' : 'text-sub'}`}>
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
              {label}
            </button>
          ))}
        </div>
      </nav>
      {sheet && <GigSheet gig={sheet === 'new' ? null : sheet} members={members} me={me} onClose={() => setSheet(null)} />}
    </div>
  )
}

function GigCard({ g, me, onOpen, showLine }) {
  const mine = g.slots.some(s => s.uid === me.uid)
  return (
    <Card className="p-4 mb-3">
      <button onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-tint">{thaiDate(g.date)} · {timeRange(g)}</p>
            <h3 className="text-[17px] font-semibold mt-0.5">{g.title}</h3>
          </div>
          {mine && <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gold/20 text-gold">งานของฉัน</span>}
        </div>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[15px]">
          <dt className="text-sub">เครื่องเสียง</dt><dd>{g.soundTeam?.trim() || '-'}</dd>
          <dt className="text-sub">งบวง</dt><dd>฿{baht(g.budget)}</dd>
          <dt className="text-sub">เฉลี่ย/คน</dt><dd className="font-semibold">฿{baht(perPerson(g))}</dd>
          {g.note && <><dt className="text-sub">หมายเหตุ</dt><dd>{g.note}</dd></>}
        </dl>
        <div className="mt-3 flex flex-wrap gap-x-2 gap-y-2">
          {g.slots.map((s, i) => (
            <div key={i} className="w-14 flex flex-col items-center text-center" title={`${s.name} · ${s.role}`}>
              <Avatar avatar={s.avatar} seed={s.uid} size={44} className={s.uid === me.uid ? 'ring-2 ring-tint ring-offset-2 ring-offset-card' : ''} />
              <span className={`mt-1 w-full truncate text-[12px] leading-tight ${s.uid === me.uid ? 'text-tint font-semibold' : ''}`}>{s.name}</span>
            </div>
          ))}
        </div>
      </button>
      <div className="mt-3 flex gap-2">
        {g.location && <a href={mapsUrl(g.location)} target="_blank" rel="noreferrer" className="flex-1 text-center rounded-xl bg-fill text-tint py-2 text-[15px] font-medium truncate px-2">📍 {g.location}</a>}
        {showLine && <button onClick={() => copyLine(g)} className="rounded-xl bg-ok/15 text-ok px-3 py-2 text-[15px] font-medium">LINE</button>}
      </div>
    </Card>
  )
}

function Home({ me, gigs, openGig }) {
  const mine = gigs.filter(g => g.slots.some(s => s.uid === me.uid))
  const month = todayIso().slice(0, 7)
  const thisMonth = mine.filter(g => g.date.startsWith(month))
  const upcoming = mine.filter(g => g.date >= todayIso())
  const monthName = new Date().toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
  return (
    <>
      <LargeTitle right={<Avatar avatar={me.avatar} seed={me.uid} size={44} className="mb-1" />}>สวัสดี, {me.nickname}</LargeTitle>
      <div className="rounded-2xl p-5 mb-6 text-white bg-gradient-to-br from-zinc-800 to-zinc-950 ring-1 ring-gold/40">
        <p className="text-[13px] text-gold font-semibold">รายได้ของฉัน · {monthName}</p>
        <p className="text-[34px] font-bold tabular-nums mt-1">฿{baht(thisMonth.reduce((t, g) => t + perPerson(g), 0))}</p>
        <p className="text-[15px] text-white/70">{thisMonth.length} งานเดือนนี้ · สะสมทั้งหมด {me.totalGigs} งาน</p>
      </div>
      <h2 className="text-[22px] font-bold mb-3">งานที่จะถึงของฉัน</h2>
      {upcoming.length ? upcoming.map(g => <GigCard key={g.id} g={g} me={me} onOpen={() => openGig(g)} />)
        : <Card className="p-6 text-center text-sub">ยังไม่มีงานที่จะถึง</Card>}
    </>
  )
}

function Gigs({ me, gigs, openGig }) {
  const [past, setPast] = useState(false)
  const t = todayIso()
  const list = past ? gigs.filter(g => g.date < t).reverse() : gigs.filter(g => g.date >= t)
  return (
    <>
      <LargeTitle right={<Btn className="mb-1 py-2" onClick={() => openGig('new')}>+ เพิ่มงาน</Btn>}>ตารางงาน</LargeTitle>
      <div className="grid grid-cols-2 p-0.5 mb-4 rounded-lg bg-fill text-[13px] font-medium">
        {[[false, 'ที่จะถึง'], [true, 'ที่ผ่านมา']].map(([v, l]) => (
          <button key={l} onClick={() => setPast(v)} className={`py-1.5 rounded-md ${past === v ? 'bg-card shadow' : ''}`}>{l}</button>
        ))}
      </div>
      {list.length ? list.map(g => <GigCard key={g.id} g={g} me={me} showLine onOpen={() => openGig(g)} />)
        : <Card className="p-6 text-center text-sub">ไม่มีงาน</Card>}
    </>
  )
}

function Queue({ me, members }) {
  const roles = activeRoles(members)
  const [picked, setPicked] = useState(null) // null = everyone
  const role = roles.includes(picked) ? picked : null
  const queue = useMemo(() => (role ? candidatesFor(role, members) : [...members].sort(byFairness)), [role, members])
  return (
    <>
      <LargeTitle>คิว</LargeTitle>
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4">
        {roles.map(r => (
          <button key={r} aria-pressed={r === role} onClick={() => setPicked(r === role ? null : r)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[15px] ${r === role ? 'bg-tint text-white' : 'bg-card'}`}>{r}</button>
        ))}
      </div>
      <Group title={role ? `ลำดับคิว ${role}` : 'สมาชิกทั้งหมด'}
        footer={`เรียงจากยอดงานสะสมน้อยสุด ถ้าเท่ากันเรียงตามลำดับสมาชิก${role ? ' · แตะตำแหน่งซ้ำเพื่อดูทั้งหมด' : ''}`}>
        {queue.length ? queue.map((m, i) => (
          <div key={m.uid} className="flex items-center gap-3 px-4 py-2.5 border-b border-sep/60 last:border-0">
            <span className={`size-6 grid place-items-center rounded-full text-[12px] font-bold ${i === 0 ? 'bg-gold text-black' : 'bg-fill'}`}>{i + 1}</span>
            <Avatar avatar={m.avatar} seed={m.uid} size={36} />
            <div className="flex-1 min-w-0">
              <p>{m.nickname}{m.uid === me.uid && <span className="text-sub"> (ฉัน)</span>}</p>
              {!role && <p className="text-[13px] text-sub truncate">{m.roles.join(', ')}</p>}
            </div>
            <span className="tabular-nums text-sub">{m.totalGigs} งาน</span>
          </div>
        )) : <p className="px-4 py-3 text-sub">ยังไม่มีสมาชิก</p>}
      </Group>
    </>
  )
}

// Admin-only member management (lives in Settings).
function MemberAdmin({ me, members, gigs }) {
  const [adding, setAdding] = useState(false)
  const [managing, setManaging] = useState(null)
  return (
    <>
      <Btn kind="plain" className="w-full mb-3 py-2.5" onClick={() => setAdding(true)}>+ เพิ่มสมาชิก</Btn>
      <Card className="overflow-hidden mb-3">
        {[...members].sort((a, b) => a.memberOrder - b.memberOrder).map(m => (
          <div key={m.uid} className="flex items-center gap-3 px-4 py-2.5 border-b border-sep/60 last:border-0">
            <Avatar avatar={m.avatar} seed={m.uid} size={36} />
            <div className="flex-1 min-w-0">
              <p className="font-medium">{m.nickname} <AdminBadge m={m} /></p>
              <p className="text-[13px] text-sub truncate">#{m.memberOrder} · @{m.username} · {m.roles.join(', ')} · {m.totalGigs} งาน</p>
            </div>
            {m.uid !== me.uid && <button onClick={() => setManaging(m.uid)} className="text-tint text-[15px]">จัดการ</button>}
          </div>
        ))}
      </Card>
      {adding && <AddMember members={members} onClose={() => setAdding(false)} />}
      {managing && members.some(m => m.uid === managing) &&
        <ManageMember m={members.find(m => m.uid === managing)} me={me} members={members} gigs={gigs} onClose={() => setManaging(null)} />}
    </>
  )
}

const untilText = m => m.adminUntil?.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

function AdminBadge({ m }) {
  if (m.isAdmin) return <span className="text-[11px] text-gold">แอดมิน</span>
  if (adminNow(m)) return <span className="text-[11px] text-gold">แอดมินชั่วคราว ถึง {untilText(m)} น.</span>
  return null
}

function ManageMember({ m, me, members, gigs, onClose }) {
  const [busy, setBusy] = useState(false)
  const run = async (fn, msg) => {
    setBusy(true)
    try { await fn(); toast(msg); onClose() } catch (e) { toast(errText(e)) } finally { setBusy(false) }
  }
  const temp = !m.isAdmin && adminNow(m)
  const canLogin = me.isFullAdmin || !m.isAdmin // temporary admins can't touch a permanent admin's login
  const remove = () => confirm(`ลบ ${m.nickname} ออกจากวง? (งานเก่ายังแสดงชื่อเดิม)`) &&
    run(() => deleteMember(m), 'ลบสมาชิกแล้ว')
  return (
    <Sheet open onClose={onClose} title={m.nickname}>
      <Card className="p-4 mb-4 flex flex-col items-center text-center">
        <Avatar avatar={m.avatar} seed={m.uid} size={72} />
        <p className="mt-2 text-[20px] font-semibold">{m.nickname}</p>
        <p className="text-sub text-[15px]">@{m.username} · {m.roles.join(', ')} · {m.totalGigs} งาน</p>
        <p className="mt-1"><AdminBadge m={m} /></p>
      </Card>
      <Disclosure title="ชื่อเล่น" value={m.nickname}><NicknameEditor m={m} /></Disclosure>
      <Disclosure title="ตำแหน่ง" value={m.roles.join(', ')}><RolesEditor m={m} /></Disclosure>
      <Disclosure title="อวตาร์"><AvatarEditor m={m} /></Disclosure>
      {canLogin ? <>
        <Disclosure title="ชื่อผู้ใช้" value={`@${m.username}`}><UsernameEditor m={m} members={members} /></Disclosure>
        {!m.isAdmin && <Disclosure title="รีเซ็ต PIN"><PinReset m={m} gigs={gigs} /></Disclosure>}
      </> : <p className="mb-3 px-4 text-[13px] text-sub">แอดมินชั่วคราวแก้ชื่อผู้ใช้/PIN ของแอดมินถาวรไม่ได้</p>}
      {me.isFullAdmin && (
        <Disclosure title="สิทธิ์แอดมิน" value={m.isAdmin ? 'แอดมิน' : temp ? 'ชั่วคราว' : 'สมาชิก'}>
          <div className="grid gap-2 mb-3">
            {!m.isAdmin && <Btn kind="gold" disabled={busy} onClick={() => run(() => setAdmin(m.uid, 'full'), `${m.nickname} เป็นแอดมินแล้ว`)}>แต่งตั้งเป็นแอดมิน (ถาวร)</Btn>}
            <Btn kind="plain" disabled={busy} onClick={() => run(() => setAdmin(m.uid, 'temp'), `มอบสิทธิ์ ${TEMP_ADMIN_HOURS} ชั่วโมงแล้ว`)}>
              {temp ? `ต่อเวลาแอดมินชั่วคราว ${TEMP_ADMIN_HOURS} ชม.` : `มอบสิทธิ์แอดมินชั่วคราว ${TEMP_ADMIN_HOURS} ชม.`}
            </Btn>
            {(m.isAdmin || temp) && <Btn kind="danger" disabled={busy} onClick={() => run(() => setAdmin(m.uid, 'none'), 'ถอนสิทธิ์แอดมินแล้ว')}>ถอนสิทธิ์แอดมิน</Btn>}
            <p className="px-1 text-[13px] text-sub">แอดมินชั่วคราวทำได้ทุกอย่างเหมือนแอดมิน ยกเว้นแต่งตั้ง/ถอนแอดมิน และหมดสิทธิ์เองใน {TEMP_ADMIN_HOURS} ชั่วโมง</p>
          </div>
        </Disclosure>
      )}
      {!m.isAdmin && <Btn kind="danger" className="w-full my-3" disabled={busy} onClick={remove}>ลบสมาชิกออกจากวง</Btn>}
    </Sheet>
  )
}

// Used by each member for themselves (Settings) and by admins for anyone (Firestore rules enforce it).
function NicknameEditor({ m }) {
  const [name, setName] = useState(m.nickname)
  const [busy, setBusy] = useState(false)
  const clean = name.trim()
  const ok = clean && clean.length <= 20 && clean !== m.nickname
  const save = async () => {
    setBusy(true)
    try { await setNickname(m.uid, clean); toast('เปลี่ยนชื่อเล่นแล้ว') } catch (e) { toast(errText(e)) } finally { setBusy(false) }
  }
  return (
    <Group footer="ชื่อที่แสดงในคิวงานและข้อความ LINE (งานเก่าจะแสดงชื่อใหม่ด้วย)">
      <div className="flex items-center gap-2 pl-4 pr-2 py-2">
        <input aria-label="ชื่อเล่น" maxLength={20} value={name} onChange={e => setName(e.target.value)}
          className="flex-1 min-w-0 bg-transparent outline-none py-1.5" />
        <button disabled={!ok || busy} onClick={save} className="px-3 py-1.5 rounded-lg bg-tint text-white text-[15px] font-semibold disabled:opacity-30">บันทึก</button>
      </div>
    </Group>
  )
}

function RolesEditor({ m }) {
  const [roles, setR] = useState(m.roles)
  const [busy, setBusy] = useState(false)
  const changed = [...roles].sort().join() !== [...m.roles].sort().join()
  const save = async () => {
    setBusy(true)
    try { await setRoles(m.uid, ROLES.filter(r => roles.includes(r))); toast('บันทึกตำแหน่งแล้ว') }
    catch (e) { toast(errText(e)) } finally { setBusy(false) }
  }
  return (
    <>
      <RolePicker value={roles} onChange={setR} />
      {changed && <Btn className="w-full -mt-3 mb-6" disabled={!roles.length || busy} onClick={save}>
        {roles.length ? 'บันทึกตำแหน่ง' : 'ต้องมีอย่างน้อย 1 ตำแหน่ง'}</Btn>}
    </>
  )
}

function UsernameEditor({ m, members }) {
  const [name, setName] = useState(m.username)
  const [busy, setBusy] = useState(false)
  const changed = name.trim().toLowerCase() !== m.username
  const save = async () => {
    setBusy(true)
    try { await renameUsername(m, name, members); toast('เปลี่ยนชื่อผู้ใช้แล้ว แจ้งชื่อใหม่ให้สมาชิกด้วย') }
    catch (e) { toast(errText(e)) } finally { setBusy(false) }
  }
  return (
    <Group footer="a-z, 0-9 ยาว 3-20 ตัว · ชื่อเดิมจะใช้ล็อกอินไม่ได้อีก">
      <div className="flex items-center gap-2 pl-4 pr-2 py-2">
        <input aria-label="ชื่อผู้ใช้" autoCapitalize="none" maxLength={20} value={name} onChange={e => setName(e.target.value)}
          className="flex-1 min-w-0 bg-transparent outline-none py-1.5" />
        <button disabled={!changed || !validUsername(name) || busy} onClick={save}
          className="px-3 py-1.5 rounded-lg bg-tint text-white text-[15px] font-semibold disabled:opacity-30">บันทึก</button>
      </div>
    </Group>
  )
}

// For a forgotten PIN. Free-plan Firebase can't change another person's password from the app, so this
// makes a fresh login with the new PIN and moves their profile, counts and gigs onto it (see resetPin).
function PinReset({ m, gigs }) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!confirm(`ตั้ง PIN ใหม่ให้ ${m.nickname}? ถ้า ${m.nickname} ล็อกอินค้างอยู่ จะถูกออกจากระบบ`)) return
    setBusy(true)
    try { await resetPin(m, pin, gigs); toast(`ตั้ง PIN ใหม่ให้ ${m.nickname} แล้ว`) }
    catch (e) { toast(errText(e)); setBusy(false) }
  }
  return (
    <Group footer="ใช้เมื่อสมาชิกลืม PIN · ยอดงาน คิว ตำแหน่ง อวตาร์ และงานทั้งหมดยังอยู่ครบ">
      <div className="flex items-center gap-2 pl-4 pr-2 py-2">
        <input aria-label="PIN ใหม่" inputMode="numeric" maxLength={4} placeholder="PIN ใหม่ 4 หลัก" value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))} className="flex-1 min-w-0 bg-transparent outline-none py-1.5" />
        <button disabled={!validPin(pin) || busy} onClick={save}
          className="px-3 py-1.5 rounded-lg bg-tint text-white text-[15px] font-semibold disabled:opacity-30">{busy ? 'กำลังตั้ง…' : 'ตั้ง PIN'}</button>
      </div>
    </Group>
  )
}

function AddMember({ members, onClose }) {
  const [f, setF] = useState({ username: '', pin: '', nickname: '', roles: [] })
  const [busy, setBusy] = useState(false)
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }))
  const ok = validUsername(f.username) && validPin(f.pin) && f.nickname.trim() && f.roles.length
  // Preview of the fairness baseline the new member will start from.
  const base = baselineFor(f.roles, members)
  const save = async () => {
    setBusy(true)
    try { await addMember(f, members); toast(`เพิ่ม ${f.nickname} แล้ว`); onClose() }
    catch (e) { toast(errText(e)) } finally { setBusy(false) }
  }
  return (
    <Sheet open onClose={onClose} title="เพิ่มสมาชิก"
      right={<button disabled={!ok || busy} onClick={save} className="text-tint font-semibold text-[17px] disabled:opacity-30">เพิ่ม</button>}>
      <Group footer="ชื่อผู้ใช้: a-z, 0-9 ยาว 3-20 ตัว · PIN 4 หลัก (สมาชิกเปลี่ยนเองได้ภายหลัง)">
        <Field label="ชื่อผู้ใช้" autoCapitalize="none" value={f.username} onChange={set('username')} />
        <Field label="PIN เริ่มต้น" inputMode="numeric" maxLength={4} value={f.pin} onChange={e => setF(v => ({ ...v, pin: e.target.value.replace(/\D/g, '') }))} />
        <Field label="ชื่อเล่น" value={f.nickname} onChange={set('nickname')} />
      </Group>
      <RolePicker value={f.roles} onChange={roles => setF(v => ({ ...v, roles }))} />
      {f.roles.length > 0 && <p className="text-center text-[15px] text-sub mb-6">ยอดงานเริ่มต้น (Baseline): <b className="text-label">{base}</b> งาน</p>}
    </Sheet>
  )
}

function Settings({ me, members, gigs }) {
  const [p, setP] = useState({ old: '', next: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const digits = k => e => setP(v => ({ ...v, [k]: e.target.value.replace(/\D/g, '') }))
  const ok = validPin(p.old) && validPin(p.next) && p.next === p.confirm
  const save = async () => {
    setBusy(true)
    try { await changePin(p.old, p.next); setP({ old: '', next: '', confirm: '' }); toast('เปลี่ยน PIN แล้ว') }
    catch (e) { toast(errText(e)) } finally { setBusy(false) }
  }
  const pin = (label, k) => <Field label={label} type="password" inputMode="numeric" maxLength={4} placeholder="••••" value={p[k]} onChange={digits(k)} />
  return (
    <>
      <LargeTitle>ตั้งค่า</LargeTitle>
      <Card className="p-4 mb-5 flex items-center gap-4">
        <Avatar avatar={me.avatar} seed={me.uid} size={56} />
        <div>
          <p className="text-[20px] font-semibold">{me.nickname}</p>
          <p className="text-sub text-[15px]">@{me.username} · {me.roles.join(', ')}{me.isAdmin ? ' · แอดมิน' : ''}</p>
        </div>
      </Card>
      <Disclosure icon="✏️" title="ชื่อเล่น" value={me.nickname}><NicknameEditor m={me} /></Disclosure>
      <Disclosure icon="🙂" title="แก้ไขอวตาร์"><AvatarEditor m={me} /></Disclosure>
      <Disclosure icon="🔒" title="เปลี่ยน PIN">
        <Group>{pin('PIN เดิม', 'old')}{pin('PIN ใหม่', 'next')}{pin('ยืนยัน PIN', 'confirm')}</Group>
        <Btn className="w-full -mt-3 mb-3" disabled={!ok || busy} onClick={save}>บันทึก PIN ใหม่</Btn>
      </Disclosure>
      {me.isAdmin && <Disclosure icon="👥" title="จัดการสมาชิก" value={`${members.length} คน`}>
        <MemberAdmin me={me} members={members} gigs={gigs} />
      </Disclosure>}
      <InstallApp />
      <Btn kind="danger" className="w-full mt-3" onClick={logout}>ออกจากระบบ</Btn>
    </>
  )
}
