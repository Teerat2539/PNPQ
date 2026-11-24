// Small iOS-style building blocks shared by the screens.
import { useEffect, useState } from 'react'

export const Card = ({ className = '', ...p }) => <div className={`bg-card rounded-2xl ${className}`} {...p} />

export const Btn = ({ kind = 'tint', className = '', ...p }) => {
  const k = {
    tint: 'bg-tint text-white',
    plain: 'bg-fill text-tint',
    danger: 'bg-danger/15 text-danger',
    gold: 'bg-gold text-black',
  }[kind]
  return <button className={`rounded-xl px-4 py-3 font-semibold active:opacity-60 disabled:opacity-40 transition ${k} ${className}`} {...p} />
}

export const Field = ({ label, className = '', ...p }) => (
  <label className="flex items-center gap-3 px-4 py-3 border-b border-sep/60 last:border-0">
    <span className="w-28 shrink-0 text-[15px]">{label}</span>
    <input className={`flex-1 min-w-0 bg-transparent outline-none text-right text-sub focus:text-label ${className}`} {...p} />
  </label>
)

export const Group = ({ title, children, footer }) => (
  <section className="mb-6">
    {title && <h3 className="px-4 pb-1.5 text-[13px] uppercase text-sub">{title}</h3>}
    <Card className="overflow-hidden">{children}</Card>
    {footer && <p className="px-4 pt-1.5 text-[13px] text-sub">{footer}</p>}
  </section>
)

export const LargeTitle = ({ children, right }) => (
  <header className="flex items-end justify-between pt-4 pb-3">
    <h1 className="text-[34px] font-bold tracking-tight leading-tight">{children}</h1>
    {right}
  </header>
)

export function Sheet({ open, onClose, title, right, children }) {
  useEffect(() => {
    if (!open) return
    const k = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40 animate-[fade_.2s]" onClick={onClose} />
      <div className="relative w-full max-w-xl max-h-[92dvh] bg-bg rounded-t-[14px] flex flex-col animate-[up_.28s_cubic-bezier(.2,.8,.2,1)]">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-sep" />
        <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-3">
          <button onClick={onClose} className="justify-self-start text-tint text-[17px]">ยกเลิก</button>
          <h2 className="font-semibold text-[17px]">{title}</h2>
          <div className="justify-self-end">{right}</div>
        </div>
        <div className="overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),24px)]">{children}</div>
      </div>
      <style>{'@keyframes up{from{transform:translateY(100%)}}@keyframes fade{from{opacity:0}}'}</style>
    </div>
  )
}

let pushToast
export const toast = msg => pushToast?.(msg)
export function Toaster() {
  const [msg, setMsg] = useState(null)
  useEffect(() => { pushToast = m => { setMsg(m); setTimeout(() => setMsg(null), 2000) } }, [])
  return msg && (
    <div role="status" className="fixed z-[60] top-[max(env(safe-area-inset-top),16px)] inset-x-0 flex justify-center pointer-events-none">
      <div className="px-4 py-2.5 rounded-full bg-card shadow-lg text-[15px] font-medium">{msg}</div>
    </div>
  )
}

export const errText = e => ({
  'auth/invalid-credential': 'ชื่อผู้ใช้หรือ PIN ไม่ถูกต้อง',
  'auth/wrong-password': 'PIN เดิมไม่ถูกต้อง',
  'auth/email-already-in-use': 'ชื่อผู้ใช้นี้ถูกใช้แล้ว',
  'auth/too-many-requests': 'ลองผิดหลายครั้งเกินไป กรุณารอสักครู่',
  'auth/network-request-failed': 'ไม่มีอินเทอร์เน็ต',
  'permission-denied': 'ไม่มีสิทธิ์ทำรายการนี้',
}[e?.code] || e?.message || 'เกิดข้อผิดพลาด')

// iOS-style row that expands in place. Keeps Settings short until you need a section.
export function Disclosure({ title, value, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="mb-3 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-fill/60">
        {icon && <span className="text-[19px] w-6 text-center">{icon}</span>}
        <span className="flex-1 text-[17px]">{title}</span>
        {value && <span className="text-sub text-[15px] truncate max-w-[45%]">{value}</span>}
        <svg viewBox="0 0 24 24" className={`size-4 text-sub transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
      </button>
      {open && <div className="border-t border-sep/60 bg-bg/40 px-3 pt-3">{children}</div>}
    </Card>
  )
}
