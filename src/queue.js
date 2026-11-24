// Pure logic: no Firebase here, so it is testable with `npm test`.

export const ROLES = ['นักร้อง', 'กีตาร์', 'เบส', 'คีย์บอร์ด', 'กลอง', 'เครื่องเป่า']

// Fair order: fewest total gigs first, ties broken by memberOrder.
export const byFairness = (a, b) => (a.totalGigs - b.totalGigs) || (a.memberOrder - b.memberOrder)

export const TEMP_ADMIN_HOURS = 3
// Permanent admin (isAdmin) or temporary admin whose adminUntil (Firestore Timestamp) is still ahead.
export const adminNow = (m, now = Date.now()) => !!m?.isAdmin || (m?.adminUntil?.toMillis?.() ?? 0) > now

export function candidatesFor(role, members) {
  return members.filter(m => m.roles?.includes(role)).sort(byFairness)
}

// Baseline for a new member = the lowest count among current players of each of their roles.
// With several roles we take the highest of those minimums so the newcomer never jumps ahead
// of an existing player in any role. A role nobody plays yet contributes 0.
export function baselineFor(roles, members) {
  return Math.max(0, ...roles.map(r => {
    const c = members.filter(m => m.roles?.includes(r)).map(m => m.totalGigs)
    return c.length ? Math.min(...c) : 0
  }))
}

// slots: [{ role, uid|null, locked }]; skipped: Set of uids that are unavailable this gig.
// Locked slots keep their uid; open slots get the next fair candidate not already used.
export function fillSlots(slots, members, skipped = new Set()) {
  const used = new Set(slots.filter(s => s.locked && s.uid).map(s => s.uid))
  return slots.map(s => {
    if (s.locked) return s
    const pick = candidatesFor(s.role, members).find(m => !used.has(m.uid) && !skipped.has(m.uid))
    if (pick) used.add(pick.uid)
    return { ...s, uid: pick?.uid ?? null }
  })
}

// Players whose gig count moves with this gig. "Other" (custom) roles don't count toward the queue.
export const countedUids = slots => slots.filter(s => !s.custom && s.uid).map(s => s.uid)

// Roles that at least one member plays, in the standard order.
export const activeRoles = members => ROLES.filter(r => members.some(m => m.roles?.includes(r)))

// Count deltas between the saved assignment and the new one (+1 added, -1 removed).
export function countDeltas(oldUids, newUids) {
  const d = {}
  for (const u of new Set(oldUids)) d[u] = (d[u] ?? 0) - 1
  for (const u of new Set(newUids)) d[u] = (d[u] ?? 0) + 1
  return Object.fromEntries(Object.entries(d).filter(([, v]) => v))
}

const DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

// "2026-11-27" -> "ศ. 27 พ.ย.69" (Buddhist year, 2 digits). Overnight gigs belong to the start date.
export function thaiDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return `${DAYS[dow]} ${d} ${MONTHS[m - 1]}${String(y + 543).slice(-2)}`
}

export const timeRange = g => (g.end ? `${g.start}-${g.end} น.` : `${g.start} น.`)
export const baht = n => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })
export const perPerson = g => (g.slots.length ? (g.budget || 0) / g.slots.length : 0)

export function lineText(g) {
  const names = g.slots.map(s => s.name || '?').join(' ')
  return [
    `✅ ${thaiDate(g.date)}`,
    g.title,
    `สถานที่ ${g.location || '-'}`,
    `เวลาแสตนบาย ${timeRange(g)}`,
    `เครื่องเสียง : ${g.soundTeam?.trim() || '-'}`,
    `งบ ${baht(g.budget)} บาท`,
    '',
    `วง ${g.slots.length} ชิ้น${g.note?.trim() ? ` - ${g.note.trim()}` : ''}`,
    '',
    names,
  ].join('\n')
}
