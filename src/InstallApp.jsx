// "Add to Home Screen". Android/desktop Chrome hand us an install prompt; iPhone Safari has no API,
// so we show the Share → Add to Home Screen steps instead.
import { useEffect, useState } from 'react'
import { Btn, Disclosure } from './ui.jsx'

let deferred = null
const listeners = new Set()
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; listeners.forEach(f => f()) })
window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach(f => f()) })

const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export default function InstallApp() {
  const [, rerender] = useState(0)
  const [help, setHelp] = useState(false)
  useEffect(() => { const f = () => rerender(n => n + 1); listeners.add(f); return () => listeners.delete(f) }, [])

  if (standalone()) return null // already opened from the home screen
  const install = async () => {
    if (!deferred) return setHelp(true)
    deferred.prompt()
    await deferred.userChoice
    deferred = null; rerender(n => n + 1)
  }
  return (
    <Disclosure icon="📲" title="บันทึกแอปนี้ลงมือถือ">
      <div className="pb-3">
        <p className="px-1 mb-2 text-[13px] text-sub">เปิดแอปจากไอคอนบนหน้าจอโฮมได้เหมือนแอปทั่วไป</p>
        <Btn kind="gold" className="w-full" onClick={install}>ติดตั้งเลย</Btn>
        {help && (
          <ol className="mt-3 px-2 text-[15px] list-decimal list-inside space-y-1">
            {isIOS() ? <>
              <li>เปิดหน้านี้ใน <b>Safari</b></li>
              <li>แตะปุ่ม <b>แชร์</b> (สี่เหลี่ยมมีลูกศรชี้ขึ้น)</li>
              <li>เลือก <b>เพิ่มไปยังหน้าจอโฮม</b> แล้วแตะ <b>เพิ่ม</b></li>
            </> : <>
              <li>เปิดหน้านี้ใน <b>Chrome</b></li>
              <li>แตะเมนู <b>⋮</b> มุมขวาบน</li>
              <li>เลือก <b>ติดตั้งแอป</b> หรือ <b>เพิ่มลงในหน้าจอหลัก</b></li>
            </>}
          </ol>
        )}
      </div>
    </Disclosure>
  )
}
