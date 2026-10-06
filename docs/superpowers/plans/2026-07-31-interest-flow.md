# Interest Flow (Accept/Reject + Chat) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace auto-match logic with explicit owner accept/reject flow, add incoming requests UI, badge counts, and last message in chat list.

**Architecture:** Owner sees pending "join requests" on the Matches screen; accepting creates a match and opens chat. The old DB trigger that auto-created matches on every interest insert is dropped. All state flows through three new/updated hooks (`useIncomingRequests`, updated `useMatches`, updated `useActivities`).

**Tech Stack:** React + TypeScript, Supabase (PostgREST RLS, Realtime), React Router, Tailwind CSS

---

## File Map

| Action   | File                                            | Responsibility                                      |
|----------|-------------------------------------------------|-----------------------------------------------------|
| Create   | `supabase/migrations/003_interests_status.sql`  | Add `status` col, drop old trigger, new RLS         |
| Create   | `src/hooks/useIncomingRequests.ts`              | Fetch pending requests for owner; accept/reject ops |
| Create   | `src/components/IncomingRequestCard.tsx`        | Single pending-request row: avatar, name, buttons   |
| Modify   | `src/components/ActivityCard.tsx`               | Button → "Хочу приєднатись", owner badge, dev auto-accept |
| Modify   | `src/hooks/useActivities.ts`                    | Also fetch pending counts for owned activities      |
| Modify   | `src/pages/Feed.tsx`                            | Pass `pendingCount` prop to ActivityCard            |
| Modify   | `src/pages/Matches.tsx`                         | Top section = pending requests; bottom = chats      |
| Modify   | `src/hooks/useMatches.ts`                       | Include last message in each match                  |
| Modify   | `src/components/BottomNav.tsx`                  | Badge on 💬 tab showing pending request count       |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/003_interests_status.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 003_interests_status.sql
-- Run in Supabase Dashboard → SQL Editor

-- 1. Add status column
alter table public.interests
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected'));

-- 2. Drop the old auto-match trigger (we now require owner approval)
drop trigger if exists trg_check_match on public.interests;
drop function if exists public.check_and_create_match();

-- 3. Drop old restrictive interests RLS and replace
drop policy if exists "interests_select" on public.interests;
drop policy if exists "interests_insert" on public.interests;

-- Requester sees their own interests; activity owner sees interests on their activities
create policy "interests_select" on public.interests
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.activities a
      where a.id = activity_id and a.user_id = auth.uid()
    )
  );

-- Only non-owners can send a join request
create policy "interests_insert" on public.interests
  for insert with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.activities a
      where a.id = activity_id and a.user_id = auth.uid()
    )
  );

-- Only activity owner can accept/reject
create policy "interests_update" on public.interests
  for update using (
    exists (
      select 1 from public.activities a
      where a.id = activity_id and a.user_id = auth.uid()
    )
  );

-- matches: only participants can insert (for accept flow from client)
create policy "matches_insert" on public.matches
  for insert with check (auth.uid() = user1_id or auth.uid() = user2_id);
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Paste the file contents into Supabase Dashboard → SQL Editor → Run.
Expected: no errors, `\d interests` shows `status` column.

- [ ] **Step 3: Commit**

```bash
cd ~/meetnow
git add supabase/migrations/003_interests_status.sql
git commit -m "feat(db): add interests.status, drop auto-match trigger, update RLS"
```

---

## Task 2: `useIncomingRequests` Hook

**Files:**
- Create: `src/hooks/useIncomingRequests.ts`

This hook serves the activity **owner**. It fetches all pending interests on their activities,
and provides `acceptRequest` / `rejectRequest` functions.

`acceptRequest` does two writes atomically (client-side):
1. `interests.status = 'accepted'`
2. `insert into matches (activity_id, user1_id=owner, user2_id=requester)` → returns match id

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/useIncomingRequests.ts
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface IncomingRequest {
  id: string
  activity_id: string
  user_id: string          // requester
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  activity_title: string   // activity.description (first 40 chars)
  activity_type: string
  requester_name: string
  requester_age: number
  requester_avatar_url: string | null
}

export function useIncomingRequests() {
  const { supaUser } = useAuth()
  const [requests, setRequests] = useState<IncomingRequest[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!supaUser) return
    setLoading(true)

    // Fetch pending interests on activities owned by current user
    const { data, error } = await supabase
      .from('interests')
      .select(`
        id,
        activity_id,
        user_id,
        status,
        created_at,
        activity:activities!interests_activity_id_fkey(description, type, user_id),
        requester:users!interests_user_id_fkey(name, age, avatar_url)
      `)
      .eq('status', 'pending')

    if (error || !data) { setLoading(false); return }

    // Filter to only requests on OUR activities
    const mine = data.filter(
      (r: Record<string, unknown>) =>
        (r.activity as Record<string, unknown>)?.user_id === supaUser.id
    )

    const mapped: IncomingRequest[] = mine.map((r: Record<string, unknown>) => {
      const act = r.activity as Record<string, unknown>
      const req = r.requester as Record<string, unknown>
      return {
        id: r.id as string,
        activity_id: r.activity_id as string,
        user_id: r.user_id as string,
        status: r.status as IncomingRequest['status'],
        created_at: r.created_at as string,
        activity_title: ((act?.description as string) ?? '').slice(0, 40),
        activity_type: (act?.type as string) ?? 'other',
        requester_name: (req?.name as string) ?? 'Користувач',
        requester_age: (req?.age as number) ?? 0,
        requester_avatar_url: (req?.avatar_url as string | null) ?? null,
      }
    })

    setRequests(mapped)
    setLoading(false)
  }, [supaUser])

  useEffect(() => { fetch() }, [fetch])

  async function acceptRequest(request: IncomingRequest): Promise<string | null> {
    if (!supaUser) return null

    // 1. Update status to accepted
    const { error: e1 } = await supabase
      .from('interests')
      .update({ status: 'accepted' })
      .eq('id', request.id)

    if (e1) { console.error(e1); return null }

    // 2. Create match (owner = user1, requester = user2)
    const { data: matchData, error: e2 } = await supabase
      .from('matches')
      .insert({
        activity_id: request.activity_id,
        user1_id: supaUser.id,
        user2_id: request.user_id,
      })
      .select('id')
      .single()

    if (e2) { console.error(e2); return null }

    // Remove from local list
    setRequests((prev) => prev.filter((r) => r.id !== request.id))
    return matchData?.id ?? null
  }

  async function rejectRequest(requestId: string) {
    await supabase
      .from('interests')
      .update({ status: 'rejected' })
      .eq('id', requestId)
    setRequests((prev) => prev.filter((r) => r.id !== requestId))
  }

  return { requests, loading, acceptRequest, rejectRequest, refresh: fetch }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useIncomingRequests.ts
git commit -m "feat: add useIncomingRequests hook (pending requests for activity owner)"
```

---

## Task 3: `IncomingRequestCard` Component

**Files:**
- Create: `src/components/IncomingRequestCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/IncomingRequestCard.tsx
import type { IncomingRequest } from '@/hooks/useIncomingRequests'

const EMOJI_MAP: Record<string, string> = {
  cafe: '☕', walk: '🚶', sport: '🏃', bar: '🍺',
  kino: '🎬', board: '🎲', food: '🍕', other: '💬',
  cinema: '🎬', boardgames: '🎲', eat: '🍕',
}

interface Props {
  request: IncomingRequest
  onAccept: () => void
  onReject: () => void
  accepting: boolean
}

export default function IncomingRequestCard({ request, onAccept, onReject, accepting }: Props) {
  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-indigo-800/50">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-gray-700 flex-shrink-0 overflow-hidden">
          {request.requester_avatar_url ? (
            <img src={request.requester_avatar_url} alt="" className="w-11 h-11 object-cover" />
          ) : (
            <div className="w-11 h-11 flex items-center justify-center text-xl">👤</div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">
            {request.requester_name}, {request.requester_age}
          </p>
          <p className="text-gray-400 text-xs truncate">
            {EMOJI_MAP[request.activity_type] ?? '💬'} {request.activity_title}
          </p>
        </div>
      </div>

      <p className="text-gray-300 text-sm mt-2">
        <span className="font-semibold text-indigo-300">{request.requester_name}</span> хоче приєднатись до вашої активності
      </p>

      <div className="flex gap-2 mt-3">
        <button
          onClick={onAccept}
          disabled={accepting}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-xl transition-all active:scale-95"
        >
          {accepting ? '...' : 'Прийняти ✅'}
        </button>
        <button
          onClick={onReject}
          disabled={accepting}
          className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-sm font-semibold py-2 rounded-xl transition-all active:scale-95"
        >
          Відхилити ❌
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/IncomingRequestCard.tsx
git commit -m "feat: add IncomingRequestCard component"
```

---

## Task 4: Update `ActivityCard` — New Button, Owner Badge, Dev Auto-Accept

**Files:**
- Modify: `src/components/ActivityCard.tsx`

Changes:
1. Button label: "Написати" → "Хочу приєднатись"
2. After clicking, insert interest with status='pending' (no match creation)
3. Show "Надіслано ✓" when pending; "Відхилено" if rejected
4. Owner badge: prop `pendingCount?: number` → shows red badge if > 0
5. Dev auto-accept: in `import.meta.env.DEV`, after inserting interest, immediately
   call the accept path server-side (update status + insert match) and navigate to chat

- [ ] **Step 1: Update `ActivityCard.tsx`**

```tsx
// src/components/ActivityCard.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Activity } from '@/types'

interface Props {
  activity: Activity
  onMatch?: () => void
  pendingCount?: number   // for owner badge
}

const EMOJI_MAP: Record<string, string> = {
  cafe: '☕', walk: '🚶', sport: '🏃', bar: '🍺',
  kino: '🎬', board: '🎲', food: '🍕', other: '💬',
  cinema: '🎬', boardgames: '🎲', eat: '🍕',
}

const LABEL_MAP: Record<string, string> = {
  cafe: 'Кафе', walk: 'Прогулянка', sport: 'Спорт', bar: 'Бар',
  kino: 'Кіно', board: 'Настолки', food: 'Поїсти', other: 'Інше',
  cinema: 'Кіно', boardgames: 'Настолки', eat: 'Поїсти',
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('uk-UA', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

type InterestStatus = 'none' | 'pending' | 'rejected'

export default function ActivityCard({ activity, onMatch, pendingCount }: Props) {
  const { supaUser } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<InterestStatus>('none')
  const [loading, setLoading] = useState(false)

  const emoji = EMOJI_MAP[activity.type] ?? '💬'
  const label = LABEL_MAP[activity.type] ?? activity.type

  const avatarUrl = activity.user_avatar_url ?? (activity.author as Record<string,unknown>)?.avatar_url as string ?? null
  const userName = activity.user_name ?? (activity.author as Record<string,unknown>)?.name as string ?? 'Користувач'
  const googleVerified = activity.user_google_verified ?? (activity.author as Record<string,unknown>)?.google_verified as boolean ?? false

  const isOwn = supaUser?.id === activity.user_id

  async function handleInterest() {
    if (!supaUser || isOwn || status !== 'none') return
    setLoading(true)

    // Insert interest with pending status
    const { error } = await supabase
      .from('interests')
      .insert({ activity_id: activity.id, user_id: supaUser.id, status: 'pending' })

    if (error) {
      // Already sent? Check existing
      if (error.code === '23505') { setStatus('pending') }
      setLoading(false)
      return
    }

    // DEV mode: auto-accept to test the full flow without two accounts
    if (import.meta.env.DEV) {
      // Update to accepted
      await supabase
        .from('interests')
        .update({ status: 'accepted' })
        .eq('activity_id', activity.id)
        .eq('user_id', supaUser.id)

      // Create match (we are user2 since we're joining)
      const { data: matchData } = await supabase
        .from('matches')
        .insert({
          activity_id: activity.id,
          user1_id: activity.user_id,
          user2_id: supaUser.id,
        })
        .select('id')
        .single()

      setLoading(false)
      if (matchData?.id) {
        onMatch?.()
        navigate(`/chat/${matchData.id}`)
        return
      }
    }

    setStatus('pending')
    setLoading(false)
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-2xl flex-shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <span>{emoji}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-sm truncate">{userName}</span>
            {googleVerified && (
              <span title="Верифіковано Google" className="text-blue-400 text-xs">✓</span>
            )}
            <span className="text-gray-500 text-xs ml-auto flex-shrink-0">
              {activity.distance_km != null ? `${activity.distance_km.toFixed(1)} км` : ''}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-indigo-400 text-xs bg-indigo-400/10 px-2 py-0.5 rounded-full">
              {emoji} {label}
            </span>
            {/* Owner badge: pending join requests */}
            {isOwn && pendingCount != null && pendingCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount} запит{pendingCount === 1 ? '' : 'и'}
              </span>
            )}
          </div>

          <p className="text-gray-300 text-sm mt-2 line-clamp-2">{activity.description}</p>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-gray-500 space-y-0.5">
              <div>🕐 {formatTime(activity.when_time)}</div>
              <div>📍 {activity.location}</div>
              <div>
                👤 {activity.looking_for_gender === 'any' ? 'Будь-хто' : activity.looking_for_gender === 'male' ? 'Хлопець' : 'Дівчина'},&nbsp;
                {activity.age_min}–{activity.age_max} р.
              </div>
            </div>

            {!isOwn && (
              <button
                onClick={handleInterest}
                disabled={status !== 'none' || loading}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                  status === 'rejected'
                    ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                    : status === 'pending'
                    ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {loading
                  ? '...'
                  : status === 'pending'
                  ? 'Надіслано ✓'
                  : status === 'rejected'
                  ? 'Відхилено'
                  : 'Хочу приєднатись'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ActivityCard.tsx
git commit -m "feat: update ActivityCard with join request flow and owner badge"
```

---

## Task 5: Update `useActivities` — Add Pending Counts for Owned Activities

**Files:**
- Modify: `src/hooks/useActivities.ts`

After fetching activities, fetch pending interest counts for activities owned by current user.
Return `pendingByActivity: Record<string, number>`.

- [ ] **Step 1: Update `useActivities.ts`**

```typescript
// src/hooks/useActivities.ts
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentPosition } from '@/lib/geo'
import { useAuth } from '@/contexts/AuthContext'
import type { Activity, ActivityFilters } from '@/types'

const DEFAULT_FILTERS: ActivityFilters = {
  type: 'all',
  gender: 'all',
  age_min: 18,
  age_max: 60,
}

export function useActivities() {
  const { supaUser } = useAuth()
  const [activities, setActivities] = useState<Activity[]>([])
  const [pendingByActivity, setPendingByActivity] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ActivityFilters>(DEFAULT_FILTERS)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { lat, lng } = await getCurrentPosition()

    let query = supabase
      .rpc('activities_nearby', { user_lat: lat, user_lng: lng, radius_km: 50 })
      .eq('status', 'active')

    if (filters.type !== 'all') query = query.eq('type', filters.type)
    if (filters.gender !== 'all') query = query.eq('looking_for_gender', filters.gender)
    query = query.gte('age_min', filters.age_min).lte('age_max', filters.age_max)

    const { data, error } = await query
    if (!error && data) setActivities(data as Activity[])

    // Fetch pending counts for activities we own
    if (supaUser && data) {
      const ownedIds = (data as Activity[])
        .filter((a) => a.user_id === supaUser.id)
        .map((a) => a.id)

      if (ownedIds.length > 0) {
        const { data: counts } = await supabase
          .from('interests')
          .select('activity_id')
          .in('activity_id', ownedIds)
          .eq('status', 'pending')

        if (counts) {
          const map: Record<string, number> = {}
          counts.forEach((r: { activity_id: string }) => {
            map[r.activity_id] = (map[r.activity_id] ?? 0) + 1
          })
          setPendingByActivity(map)
        }
      }
    }

    setLoading(false)
  }, [filters, supaUser])

  useEffect(() => { fetch() }, [fetch])

  return { activities, pendingByActivity, loading, filters, setFilters, refresh: fetch }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useActivities.ts
git commit -m "feat: useActivities returns pending counts per owned activity"
```

---

## Task 6: Update `Feed.tsx` — Pass `pendingCount` to ActivityCard

**Files:**
- Modify: `src/pages/Feed.tsx`

- [ ] **Step 1: Update `Feed.tsx`**

Change the `useActivities` destructure and pass `pendingCount` to `ActivityCard`:

```tsx
// In Feed.tsx, change:
const { activities, pendingByActivity, loading, filters, setFilters, refresh } = useActivities()

// And in the ActivityCard render:
<ActivityCard
  key={item.key}
  activity={item.data as Parameters<typeof ActivityCard>[0]['activity']}
  onMatch={handleMatch}
  pendingCount={pendingByActivity[(item.data as { id: string }).id]}
/>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Feed.tsx
git commit -m "feat: pass pendingCount to ActivityCard in Feed"
```

---

## Task 7: Update `useMatches` — Include Last Message

**Files:**
- Modify: `src/hooks/useMatches.ts`

After fetching matches, fetch the last message for each match.
Add `last_message?: { text: string; created_at: string }` to `Match` type.

- [ ] **Step 1: Update `Match` type in `src/types/index.ts`**

Add to the Match interface:
```typescript
last_message?: { text: string; created_at: string }
```

- [ ] **Step 2: Update `useMatches.ts`**

```typescript
// src/hooks/useMatches.ts
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Match } from '@/types'

export function useMatches() {
  const { supaUser } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supaUser) return

    async function fetchMatches() {
      const { data } = await supabase
        .from('matches')
        .select(`
          *,
          activity:activities(description, type),
          user1:users!matches_user1_id_fkey(id, name, avatar_url, age, gender, google_verified, created_at),
          user2:users!matches_user2_id_fkey(id, name, avatar_url, age, gender, google_verified, created_at)
        `)
        .or(`user1_id.eq.${supaUser!.id},user2_id.eq.${supaUser!.id}`)
        .order('created_at', { ascending: false })

      if (!data) { setLoading(false); return }

      // Fetch last message for each match
      const matchIds = data.map((m: Record<string, unknown>) => m.id as string)
      let lastMsgMap: Record<string, { text: string; created_at: string }> = {}

      if (matchIds.length > 0) {
        const { data: msgs } = await supabase
          .from('messages')
          .select('match_id, text, created_at')
          .in('match_id', matchIds)
          .order('created_at', { ascending: false })

        if (msgs) {
          // Keep only the first (latest) per match
          msgs.forEach((msg: { match_id: string; text: string; created_at: string }) => {
            if (!lastMsgMap[msg.match_id]) {
              lastMsgMap[msg.match_id] = { text: msg.text, created_at: msg.created_at }
            }
          })
        }
      }

      const enriched = data.map((m: Record<string, unknown>) => ({
        ...m,
        other_user: m.user1_id === supaUser!.id ? m.user2 : m.user1,
        last_message: lastMsgMap[m.id as string] ?? undefined,
      }))
      setMatches(enriched as Match[])
      setLoading(false)
    }

    fetchMatches()
  }, [supaUser])

  return { matches, loading }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts src/hooks/useMatches.ts
git commit -m "feat: useMatches includes last message per chat"
```

---

## Task 8: Update `Matches.tsx` — Pending Requests Section + Last Message

**Files:**
- Modify: `src/pages/Matches.tsx`

Shows two sections:
1. **Запити** (pending incoming requests) — uses `useIncomingRequests`
2. **Чати** (accepted matches) — uses `useMatches`

- [ ] **Step 1: Rewrite `Matches.tsx`**

```tsx
// src/pages/Matches.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMatches } from '@/hooks/useMatches'
import { useIncomingRequests } from '@/hooks/useIncomingRequests'
import IncomingRequestCard from '@/components/IncomingRequestCard'
import type { Match } from '@/types'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} хв тому`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} год тому`
  return `${Math.floor(hrs / 24)} дн тому`
}

export default function Matches() {
  const { matches, loading: matchesLoading } = useMatches()
  const { requests, loading: reqLoading, acceptRequest, rejectRequest } = useIncomingRequests()
  const navigate = useNavigate()
  const [acceptingId, setAcceptingId] = useState<string | null>(null)

  async function handleAccept(request: Parameters<typeof acceptRequest>[0]) {
    setAcceptingId(request.id)
    const matchId = await acceptRequest(request)
    setAcceptingId(null)
    if (matchId) navigate(`/chat/${matchId}`)
  }

  const loading = matchesLoading || reqLoading

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24">
      <div className="sticky top-0 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-4">
        <h1 className="text-xl font-bold">💬 Мої чати</h1>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {loading && (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-2xl h-24 animate-pulse border border-gray-800" />
          ))
        )}

        {/* Incoming requests section */}
        {!loading && requests.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide px-1">
              Запити на приєднання
            </h2>
            {requests.map((req) => (
              <IncomingRequestCard
                key={req.id}
                request={req}
                accepting={acceptingId === req.id}
                onAccept={() => handleAccept(req)}
                onReject={() => rejectRequest(req.id)}
              />
            ))}
            {matches.length > 0 && (
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide px-1 pt-2">
                Чати
              </h2>
            )}
          </>
        )}

        {/* Accepted matches / chats */}
        {!loading && matches.map((match: Match) => (
          <button
            key={match.id}
            onClick={() => navigate(`/chat/${match.id}`)}
            className="w-full bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-center gap-3 text-left hover:border-indigo-700 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-gray-700 flex-shrink-0 overflow-hidden">
              {match.other_user?.avatar_url ? (
                <img src={match.other_user.avatar_url} alt="" className="w-12 h-12 object-cover" />
              ) : (
                <div className="w-12 h-12 flex items-center justify-center text-2xl">👤</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">{match.other_user?.name ?? 'Користувач'}</span>
                <span className="text-xs text-gray-500">
                  {match.last_message ? timeAgo(match.last_message.created_at) : timeAgo(match.created_at)}
                </span>
              </div>
              <p className="text-sm text-gray-400 truncate mt-0.5">
                {match.last_message?.text ?? match.activity?.description ?? 'Активність'}
              </p>
            </div>
            <span className="text-indigo-400 text-xl">›</span>
          </button>
        ))}

        {!loading && requests.length === 0 && matches.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-3">💭</div>
            <p>Поки немає запитів та чатів</p>
            <p className="text-sm mt-1">Вираз інтерес до активностей у стрічці!</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Matches.tsx
git commit -m "feat: Matches page shows incoming requests + chats with last message"
```

---

## Task 9: Update `BottomNav` — Badge on Matches Tab

**Files:**
- Modify: `src/components/BottomNav.tsx`

Add a red badge on the 💬 tab showing count of pending incoming requests.
`BottomNav` calls `useIncomingRequests` to get the count.

- [ ] **Step 1: Update `BottomNav.tsx`**

```tsx
// src/components/BottomNav.tsx
import { NavLink } from 'react-router-dom'
import { useIncomingRequests } from '@/hooks/useIncomingRequests'

export default function BottomNav() {
  const { requests } = useIncomingRequests()
  const pendingCount = requests.length

  const tabs = [
    { to: '/',        label: 'Лента',   icon: '🏠', badge: 0 },
    { to: '/create',  label: 'Додати',  icon: '➕', badge: 0 },
    { to: '/matches', label: 'Чати',    icon: '💬', badge: pendingCount },
    { to: '/profile', label: 'Профіль', icon: '👤', badge: 0 },
  ]

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-gray-950/95 backdrop-blur border-t border-gray-800 pb-safe">
      <div className="flex">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors relative ${
                isActive ? 'text-indigo-400' : 'text-gray-500'
              }`
            }
          >
            <span className="text-xl relative">
              {tab.icon}
              {tab.badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </span>
            <span className="text-xs">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BottomNav.tsx
git commit -m "feat: BottomNav badge shows pending incoming request count"
```

---

## Task 10: Smoke Test

- [ ] **Step 1: Start dev server**

```bash
cd ~/meetnow && npm run dev
```

- [ ] **Step 2: Verify activity card**
  - Open http://localhost:5173
  - Non-owned activity: button shows "Хочу приєднатись"
  - Clicking it in DEV mode: auto-accepts, navigates to chat
  - Owned activity with pending requests: shows red badge

- [ ] **Step 3: Verify Matches page**
  - `/matches` shows "Запити на приєднання" section (if any pending)
  - Accept → navigates to `/chat/<id>`
  - Reject → card disappears
  - Chats list shows last message text

- [ ] **Step 4: Verify BottomNav badge**
  - 💬 tab shows red badge with count when there are pending requests

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -p
git commit -m "fix: smoke test fixes"
```
