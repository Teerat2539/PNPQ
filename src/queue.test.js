import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fillSlots, baselineFor, countDeltas, thaiDate, lineText, adminNow, countedUids, activeRoles } from './queue.js'

const M = [
  { uid: 'pang', nickname: 'แป้ง', roles: ['นักร้อง'], totalGigs: 9, memberOrder: 1 },
  { uid: 'kee', nickname: 'กี้', roles: ['นักร้อง', 'กีตาร์'], totalGigs: 8, memberOrder: 2 },
  { uid: 'oat', nickname: 'โอ้ต', roles: ['นักร้อง'], totalGigs: 8, memberOrder: 3 },
  { uid: 'james', nickname: 'เจมส์', roles: ['กีตาร์'], totalGigs: 5, memberOrder: 4 },
]
const slots = roles => roles.map(role => ({ role, uid: null, locked: false }))

test('fewest gigs first, tie -> memberOrder, no double booking', () => {
  const r = fillSlots(slots(['นักร้อง', 'กีตาร์', 'กีตาร์']), M)
  assert.deepEqual(r.map(s => s.uid), ['kee', 'james', null])
})

test('skip pulls next person; locked user is kept', () => {
  assert.equal(fillSlots(slots(['นักร้อง']), M, new Set(['kee']))[0].uid, 'oat')
  const r = fillSlots([{ role: 'นักร้อง', uid: 'pang', locked: true }, ...slots(['กีตาร์'])], M)
  assert.deepEqual(r.map(s => s.uid), ['pang', 'james'])
})

test('new member baseline', () => {
  assert.equal(baselineFor(['นักร้อง'], M), 8)
  assert.equal(baselineFor(['เครื่องเป่า'], M), 0)
  assert.equal(baselineFor(['นักร้อง', 'กีตาร์'], M), 8)
})

test('admin: permanent, temporary, expired', () => {
  const at = ms => ({ toMillis: () => ms })
  assert.equal(adminNow({ isAdmin: true }), true)
  assert.equal(adminNow({ isAdmin: false, adminUntil: at(2000) }, 1000), true)
  assert.equal(adminNow({ isAdmin: false, adminUntil: at(2000) }, 3000), false)
  assert.equal(adminNow({ isAdmin: false, adminUntil: null }), false)
})

test('custom "other" slots never move gig counts', () => {
  const slots = [{ role: 'กลอง', uid: 'a' }, { role: 'พิธีกร', uid: 'b', custom: true }, { role: 'เบส', uid: null }]
  assert.deepEqual(countedUids(slots), ['a'])
})

test('active roles = roles someone plays', () => {
  assert.deepEqual(activeRoles(M), ['นักร้อง', 'กีตาร์'])
})

test('count deltas', () => {
  assert.deepEqual(countDeltas(['a', 'b'], ['b', 'c']), { a: -1, c: 1 })
  assert.deepEqual(countDeltas([], ['a']), { a: 1 })
})

test('LINE text format', () => {
  assert.equal(thaiDate('2026-11-27'), 'ศ. 27 พ.ย.69')
  const g = { date: '2026-11-27', title: 'งานแต่ง', location: 'โรงแรม A', start: '23:30', end: '01:00',
    soundTeam: '', budget: 12000, note: 'ผู้จัดรีเควส พี่แป้ง', slots: [{ name: 'แป้ง' }, { name: 'กี้' }] }
  assert.equal(lineText(g), '✅ ศ. 27 พ.ย.69\nงานแต่ง\nสถานที่ โรงแรม A\nเวลาแสตนบาย 23:30-01:00 น.\nเครื่องเสียง : -\nงบ 12,000 บาท\n\nวง 2 ชิ้น - ผู้จัดรีเควส พี่แป้ง\n\nแป้ง กี้')
})
