import { initializeApp, deleteApp } from 'firebase/app'
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
} from 'firebase/auth'
import {
  getFirestore, doc, collection, runTransaction, writeBatch, increment, serverTimestamp, getDoc, updateDoc, Timestamp,
} from 'firebase/firestore'
import { countDeltas, baselineFor, countedUids, TEMP_ADMIN_HOURS } from './queue.js'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
export const configured = !!config.apiKey
const app = configured ? initializeApp(config) : null
export const auth = app && getAuth(app)
export const db = app && getFirestore(app)

// Username + 4-digit PIN ride on Firebase email/password auth, so the PIN is stored hashed by
// Firebase and never in Firestore. Firebase needs >= 6 chars, hence the fixed prefix.
const toEmail = u => `${u.trim().toLowerCase()}@pongnapa.app`
const toPw = pin => `pn-${pin}`
export const validUsername = u => /^[a-z0-9._-]{3,20}$/i.test(u.trim())
export const validPin = p => /^\d{4}$/.test(p)

// usernames/{name} maps a username to its login email, so admins can rename people and reset PINs
// without a server. { retired: true } blocks an old name. Members from before the map use toEmail().
const clean = u => u.trim().toLowerCase()
const mapRef = u => doc(db, 'usernames', clean(u))

export async function login(username, pin) {
  const map = await getDoc(mapRef(username))
  if (map.data()?.retired) throw Object.assign(new Error(), { code: 'auth/invalid-credential' })
  return signInWithEmailAndPassword(auth, map.exists() ? map.data().email : toEmail(username), toPw(pin))
}

async function usernameTaken(u, members, exceptUid) {
  if (members.some(m => m.username === clean(u) && m.uid !== exceptUid)) return true
  const map = (await getDoc(mapRef(u))).data()
  return !!map && !map.retired && map.uid !== exceptUid
}
const taken = () => Object.assign(new Error(), { code: 'auth/email-already-in-use' })

// A throwaway second app creates logins so the admin stays signed in. Each login gets a unique email;
// people only ever type the username.
async function createLogin(username, pin) {
  const email = `${clean(username)}.${Date.now().toString(36)}@pongnapa.app`
  const sec = initializeApp(config, `sec-${Date.now()}`)
  try {
    const sa = getAuth(sec)
    const uid = (await createUserWithEmailAndPassword(sa, email, toPw(pin))).user.uid
    await signOut(sa)
    return { uid, email }
  } finally {
    await deleteApp(sec)
  }
}
export const logout = () => signOut(auth)

export async function changePin(oldPin, newPin) {
  const u = auth.currentUser
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, toPw(oldPin)))
  await updatePassword(u, toPw(newPin))
}

// The SDK retries forever if Firestore is missing, so give up after 10s and let the UI say why.
export const isInitialized = () => Promise.race([
  getDoc(doc(db, 'meta', 'init')).then(s => s.exists()),
  new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 10000)),
])

const userDoc = (p, members) => ({
  username: p.username.trim().toLowerCase(),
  nickname: p.nickname.trim(),
  roles: p.roles,
  isNew: true,
  totalGigs: baselineFor(p.roles, members),
  memberOrder: Math.max(0, ...members.map(m => m.memberOrder || 0)) + 1,
  isAdmin: !!p.isAdmin,
  createdAt: serverTimestamp(),
})

// First run only: creates the admin account. Firestore rules refuse this once meta/init exists.
export async function setupFirstAdmin(p) {
  const { user } = await createUserWithEmailAndPassword(auth, toEmail(p.username), toPw(p.pin))
  const b = writeBatch(db)
  b.set(doc(db, 'users', user.uid), userDoc({ ...p, isAdmin: true }, []))
  b.set(doc(db, 'meta', 'init'), { at: serverTimestamp(), by: user.uid })
  await b.commit()
}

export async function addMember(p, members) {
  if (await usernameTaken(p.username, members)) throw taken()
  const { uid, email } = await createLogin(p.username, p.pin)
  const b = writeBatch(db)
  b.set(doc(db, 'users', uid), { ...userDoc(p, members), loginEmail: email })
  b.set(mapRef(p.username), { uid, email })
  await b.commit()
}

// Admin renames someone's username. Their login email stays; only the map changes.
export async function renameUsername(m, username, members) {
  if (await usernameTaken(username, members, m.uid)) throw taken()
  const old = (await getDoc(mapRef(m.username))).data()
  const email = old?.email ?? m.loginEmail ?? toEmail(m.username)
  const b = writeBatch(db)
  b.set(mapRef(m.username), { retired: true })
  b.set(mapRef(username), { uid: m.uid, email })
  b.update(doc(db, 'users', m.uid), { username: clean(username), loginEmail: email })
  await b.commit()
}

// Admin resets a forgotten PIN. A browser can't change another person's password, so we create a
// fresh login with the new PIN under the same username and move the profile and gig slots across.
export async function resetPin(m, pin, gigs) {
  const { uid, email } = await createLogin(m.username, pin)
  const { uid: _old, ...profile } = m
  const b = writeBatch(db)
  b.set(doc(db, 'users', uid), { ...profile, isAdmin: false, adminUntil: null, loginEmail: email })
  b.set(mapRef(m.username), { uid, email })
  for (const g of gigs.filter(g => g.slots.some(s => s.uid === m.uid)))
    b.update(doc(db, 'gigs', g.id), { slots: g.slots.map(({ avatar, ...s }) => (s.uid === m.uid ? { ...s, uid } : s)) })
  b.delete(doc(db, 'users', m.uid))
  await b.commit()
  return uid
}

// mode: 'full' = permanent admin, 'temp' = admin for TEMP_ADMIN_HOURS, 'none' = revoke.
// Firestore rules allow this only for permanent admins.
export const setAdmin = (uid, mode) => updateDoc(doc(db, 'users', uid), {
  isAdmin: mode === 'full',
  adminUntil: mode === 'temp' ? Timestamp.fromMillis(Date.now() + TEMP_ADMIN_HOURS * 3600e3) : null,
})

export const setRoles = (uid, roles) => updateDoc(doc(db, 'users', uid), { roles })

export const setAvatar = (uid, avatar) => updateDoc(doc(db, 'users', uid), { avatar })

// Rules allow this for your own profile, or anyone's if you are an admin.
export const setNickname = (uid, nickname) => updateDoc(doc(db, 'users', uid), { nickname: nickname.trim() })

// shortcut: removes the profile and retires the username; the Firebase Auth login itself remains
// (unusable). Delete it in Firebase Console > Authentication if you want it gone.
export async function deleteMember(m) {
  const b = writeBatch(db)
  b.delete(doc(db, 'users', m.uid))
  b.set(mapRef(m.username), { retired: true })
  await b.commit()
}

// Save a gig and move gig counts in one transaction: +1 for each newly assigned player,
// -1 for each player taken off. Old slots are re-read inside the transaction so two people
// editing at once cannot double count.
export async function saveGig(id, data, memberIds) {
  const ref = id ? doc(db, 'gigs', id) : doc(collection(db, 'gigs'))
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref)
    const oldUids = snap.exists() ? countedUids(snap.data().slots) : []
    applyDeltas(tx, countDeltas(oldUids, countedUids(data.slots)), memberIds)
    tx.set(ref, { ...data, updatedAt: serverTimestamp(), ...(snap.exists() ? {} : { createdAt: serverTimestamp() }) })
  })
}

export async function deleteGig(id, memberIds) {
  const ref = doc(db, 'gigs', id)
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref)
    if (!snap.exists()) return
    applyDeltas(tx, countDeltas(countedUids(snap.data().slots), []), memberIds)
    tx.delete(ref)
  })
}

function applyDeltas(tx, deltas, memberIds) {
  for (const [uid, d] of Object.entries(deltas)) {
    if (!memberIds.has(uid)) continue // member was removed; nothing to count
    tx.update(doc(db, 'users', uid), d > 0 ? { totalGigs: increment(d), isNew: false } : { totalGigs: increment(d) })
  }
}
