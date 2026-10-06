import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  createClubPost,
  createClubPostComment,
  listClubPostComments,
  listClubPosts,
  type ClubPost,
  type ClubPostComment,
  type ClubPostSection,
} from '@/lib/clubPosts'

type SectionKey = 'feed' | 'event' | 'circle' | 'beauty' | 'business' | 'help'

type SectionDefinition = {
  key: SectionKey
  label: string
  icon: string
  eyebrow: string
  title: string
  subtitle: string
  groupTitle: string
  filters: string[]
  primaryAction: string
}

type ClubEvent = {
  id: string
  title: string
  description: string
  category: string
  address_text: string
  event_datetime: string
  cover_photo_url: string | null
  created_at: string
  organizer: { id: string; name: string | null; avatar_url: string | null } | null
}

const sections: SectionDefinition[] = [
  {
    key: 'feed',
    label: 'Стрічка',
    icon: '⌂',
    eyebrow: 'ТВОЯ СПІЛЬНОТА ПОРУЧ',
    title: 'Життя клубу',
    subtitle: 'Зустрічайся. Створюй. Підтримуй. Будь собою.',
    groupTitle: 'Життя клубу',
    filters: ['Усі', 'Події', 'Свої кола', 'Б’юті', 'Бізнес', 'Допомога'],
    primaryAction: 'Створити',
  },
  {
    key: 'event',
    label: 'Події',
    icon: '▦',
    eyebrow: 'ПОДІЇ',
    title: 'Зустрінемося?',
    subtitle: 'Знайди привід вийти з дому й людей, з якими хочеться зустрітися знову.',
    groupTitle: 'Найближчі зустрічі',
    filters: ['Усі', 'Кава та розмови', 'Творчість', 'Прогулянки', 'Спорт', 'Розвиток'],
    primaryAction: 'Створити подію',
  },
  {
    key: 'circle',
    label: 'Свої кола',
    icon: '♧',
    eyebrow: 'СВОЇ КОЛА',
    title: 'Свої люди. Надовго.',
    subtitle: 'Постійні невеликі спільноти, спільні інтереси та наступна зустріч.',
    groupTitle: 'Знайди своїх',
    filters: ['Усі', 'Книги', 'Підприємництво', 'Моє місто', 'Творчість', 'Спорт'],
    primaryAction: 'Створити коло',
  },
  {
    key: 'beauty',
    label: 'Б’юті',
    icon: '✣',
    eyebrow: 'Б’ЮТІ',
    title: 'Час подбати про себе.',
    subtitle: 'Послуги, знайомство з майстринями та особисті заявки на запис.',
    groupTitle: 'Пропозиції спільноти',
    filters: ['Усі', 'Волосся', 'Нігті', 'Брови та вії', 'Макіяж', 'Догляд', 'Стиль'],
    primaryAction: 'Додати пропозицію',
  },
  {
    key: 'business',
    label: 'Бізнес',
    icon: '▣',
    eyebrow: 'БІЗНЕС',
    title: 'Свою справу легше разом.',
    subtitle: 'Знайди партнерку, запропонуй послугу або поділися професійним досвідом.',
    groupTitle: 'Пропозиції спільноти',
    filters: ['Усі', 'Послуги', 'Співпраця', 'Вакансії', 'Наставництво'],
    primaryAction: 'Додати пропозицію',
  },
  {
    key: 'help',
    label: 'Допомога',
    icon: '♡',
    eyebrow: 'ДОПОМОГА',
    title: 'Можна попросити. Можна допомогти.',
    subtitle: 'Рекомендації, підтримка та маленькі добрі справи у твоєму місті.',
    groupTitle: 'Пропозиції спільноти',
    filters: ['Усі', 'Потрібна допомога', 'Можу допомогти', 'Рекомендації', 'Волонтерство'],
    primaryAction: 'Додати пропозицію',
  },
]

const feedExamples = [
  ['Прогулянка без поспіху', 'Прогулятися містом, познайомитися та побачити звичні місця по-новому.', 'images/landing/poruch-walk.jpg', 'Створи таку зустріч'],
  ['Творчий вечір разом', 'Малювання, кераміка або нове хобі у невеликій компанії. Приклад зустрічі для...', 'images/landing/poruch-friends.jpg', 'Створи таку зустріч'],
  ['Кава у своєму колі', 'Невелика зустріч, на яку можна прийти самій. Знайомство, теплі розмови та час д...', 'images/landing/poruch-coffee.jpg', 'Створи таку зустріч'],
  ['Жінки, які створюють', 'Коло про власну справу: обмін досвідом, підтримка й знайомства. Це приклад...', 'images/landing/poruch-friends-city.jpg', 'Твоє майбутнє коло'],
  ['Я новенька у місті', 'Знайомства з містом і людьми, корисні рекомендації та маленькі спільні плани...', 'images/landing/poruch-walk.jpg', 'Твоє майбутнє коло'],
  ['Книжкові подруги', 'Постійне коло для тих, хто любить читати та обговорювати. Одна книга на місяць, зуст...', 'images/landing/poruch-friends.jpg', 'Твоє майбутнє коло'],
] as const

const eventExamples = feedExamples.slice(0, 3)
const circleExamples = feedExamples.slice(3, 6)

const emptyStates: Record<'beauty' | 'business' | 'help', { icon: string; title: string; text: string; note?: string }> = {
  beauty: {
    icon: '✣',
    title: 'Познайомимо клуб із твоєю майстерністю?',
    text: 'Тут з’являтимуться пропозиції учасниць. Можна почати зі своєї.',
    note: 'Кожну послугу публікує її авторка. Профілі не мають автоматичної позначки перевірки. Деталі, ціну та час візиту погоджуйте до підтвердження заявки.',
  },
  business: {
    icon: '▣',
    title: 'Розкажи про свою справу.',
    text: 'Тут з’являтимуться пропозиції учасниць. Можна почати зі своєї.',
  },
  help: {
    icon: '♡',
    title: 'Підтримка починається із запиту.',
    text: 'Тут з’являтимуться пропозиції учасниць. Можна почати зі своєї.',
  },
}

const sectionLabels: Record<ClubPostSection, string> = {
  circle: 'Свої кола',
  beauty: 'Б’юті',
  business: 'Бізнес',
  help: 'Допомога',
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ExampleCard({ item }: { item: readonly [string, string, string, string] }) {
  const [title, text, image, action] = item

  return (
    <article className="rounded-[11px] border border-[#e1d5d0] bg-[#fcfbf9] p-3">
      <div className="flex gap-3">
        <div className="relative h-[86px] w-[106px] shrink-0 overflow-hidden rounded-[8px]">
          <img src={`${import.meta.env.BASE_URL}${image}`} alt="" className="h-full w-full object-cover" />
          <span className="absolute left-2 top-2 rounded bg-[#f8eee8] px-2 py-1 text-[8px] text-[#8a615a]">Приклад</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-[8px] text-[#97898e]">
            <span>⌾ Чернігів</span>
            <span>Для натхнення</span>
          </div>
          <h4 className="mt-2 text-[15px] font-extrabold leading-4 text-[#403438]">{title}</h4>
          <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-[#746a6d]">{text}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[#eee5e1] pt-3 text-[9px]">
        <span className="text-[#8d6876]">{action.includes('коло') ? '♧' : '▦'} &nbsp; {action}</span>
        <span className="rounded-full border border-[#decad1] px-3 py-1.5 text-[#8d2f51]">Деталі</span>
      </div>
    </article>
  )
}

function Footer() {
  return (
    <footer className="mt-8 flex items-center justify-between border-t border-[#ded5d1] py-5 text-[9px] text-[#8d8185]">
      <span>СВОЯ — твої люди поруч.</span>
      <div className="flex items-center gap-6">
        <button type="button">Правила спільноти</button>
        <Link to="/">Про клуб</Link>
      </div>
    </footer>
  )
}

export default function SvoyaClub() {
  const { profile, supaUser } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const current = (params.get('section') || 'feed') as SectionKey
  const section = sections.some((item) => item.key === current) ? current : 'feed'
  const definition = sections.find((item) => item.key === section) ?? sections[0]

  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('Усі')
  const [events, setEvents] = useState<ClubEvent[]>([])
  const [posts, setPosts] = useState<ClubPost[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerTitle, setComposerTitle] = useState('')
  const [composerBody, setComposerBody] = useState('')
  const [composerCategory, setComposerCategory] = useState('')
  const [composerSaving, setComposerSaving] = useState(false)
  const [selectedPost, setSelectedPost] = useState<ClubPost | null>(null)
  const [comments, setComments] = useState<ClubPostComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentSaving, setCommentSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const tasks: Promise<void>[] = []

        if (section === 'feed' || section === 'event') {
          tasks.push(
            supabase
              .from('events')
              .select(`
                id, title, description, category, address_text, event_datetime,
                cover_photo_url, created_at,
                organizer:users!events_organizer_id_fkey(id, name, avatar_url)
              `)
              .eq('is_public', true)
              .eq('status', 'upcoming')
              .order('event_datetime', { ascending: true })
              .limit(section === 'event' ? 30 : 8)
              .then(({ data, error }) => {
                if (error) throw error
                if (cancelled) return
                setEvents((data ?? []).map((row: any) => ({
                  ...row,
                  organizer: normalizeRelation(row.organizer),
                })) as ClubEvent[])
              }) as unknown as Promise<void>,
          )
        } else {
          setEvents([])
        }

        const postSection = section === 'feed' || section === 'event' ? undefined : section as ClubPostSection
        if (section !== 'event') {
          tasks.push(
            listClubPosts(postSection).then((data) => {
              if (!cancelled) setPosts(data)
            }),
          )
        } else {
          setPosts([])
        }

        await Promise.all(tasks)
      } catch (error) {
        console.error('[SVOYA club load]', error)
        if (!cancelled) setLoadError('Не вдалося завантажити дані клубу. Спробуйте оновити сторінку.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [section])

  const examples = useMemo(() => {
    const source = section === 'event' ? eventExamples : section === 'circle' ? circleExamples : feedExamples
    const q = query.trim().toLocaleLowerCase('uk-UA')
    if (!q) return source
    return source.filter(([title, text]) => `${title} ${text}`.toLocaleLowerCase('uk-UA').includes(q))
  }, [query, section])

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('uk-UA')
    return posts.filter((post) => {
      const categoryOk = activeFilter === 'Усі' || post.category === activeFilter
      const queryOk = !q || [post.title, post.body, post.category, post.city ?? '', post.author?.name ?? '']
        .some((value) => value.toLocaleLowerCase('uk-UA').includes(q))
      return categoryOk && queryOk
    })
  }, [activeFilter, posts, query])

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('uk-UA')
    return events.filter((event) => {
      const queryOk = !q || [event.title, event.description, event.address_text, event.category, event.organizer?.name ?? '']
        .some((value) => value.toLocaleLowerCase('uk-UA').includes(q))
      if (!queryOk) return false
      if (activeFilter === 'Усі') return true
      const haystack = `${event.category} ${event.title} ${event.description}`.toLocaleLowerCase('uk-UA')
      const tokens: Record<string, string[]> = {
        'Кава та розмови': ['кава', 'coffee', 'cafe', 'розмов'],
        'Творчість': ['твор', 'art', 'creative', 'hobby', 'майстер'],
        'Прогулянки': ['прогуля', 'walk', 'outdoor'],
        'Спорт': ['спорт', 'sport', 'fitness', 'run', 'yoga'],
        'Розвиток': ['розвит', 'business', 'education', 'навчан'],
      }
      return (tokens[activeFilter] ?? [activeFilter.toLocaleLowerCase('uk-UA')]).some((token) => haystack.includes(token))
    })
  }, [activeFilter, events, query])

  function goSection(next: SectionKey) {
    setQuery('')
    setActiveFilter('Усі')
    setParams({ section: next })
  }

  function primaryAction() {
    if (section === 'event' || section === 'feed') {
      navigate('/create')
      return
    }
    setComposerCategory(definition.filters.find((item) => item !== 'Усі') ?? '')
    setComposerTitle('')
    setComposerBody('')
    setComposerOpen(true)
  }

  async function submitPost(event: FormEvent) {
    event.preventDefault()
    if (!supaUser || section === 'feed' || section === 'event' || composerSaving) return
    const title = composerTitle.trim()
    const body = composerBody.trim()
    const category = composerCategory.trim()
    if (title.length < 2 || body.length < 2 || !category) return

    setComposerSaving(true)
    try {
      const created = await createClubPost({
        authorId: supaUser.id,
        section,
        category,
        title,
        body,
        city: profile?.city ?? null,
      })
      setPosts((currentPosts) => [created, ...currentPosts])
      setComposerOpen(false)
      setActiveFilter('Усі')
    } catch (error) {
      console.error('[SVOYA create post]', error)
      setLoadError('Не вдалося опублікувати. Перевірте з’єднання і спробуйте ще раз.')
    } finally {
      setComposerSaving(false)
    }
  }

  async function openPost(post: ClubPost) {
    setSelectedPost(post)
    setCommentText('')
    try {
      setComments(await listClubPostComments(post.id))
    } catch (error) {
      console.error('[SVOYA comments load]', error)
      setComments([])
    }
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault()
    if (!supaUser || !selectedPost || !commentText.trim() || commentSaving) return
    setCommentSaving(true)
    try {
      const created = await createClubPostComment({
        postId: selectedPost.id,
        authorId: supaUser.id,
        body: commentText,
      })
      setComments((currentComments) => [...currentComments, created])
      setCommentText('')
    } catch (error) {
      console.error('[SVOYA comment create]', error)
    } finally {
      setCommentSaving(false)
    }
  }

  const hasLiveFeed = events.length > 0 || posts.length > 0
  const hasLiveSection = section === 'event' ? filteredEvents.length > 0 : filteredPosts.length > 0

  return (
    <div className="min-h-screen bg-[#f8f6f3] text-[#382e32] lg:pl-[230px]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[230px] flex-col bg-[#4d2634] px-4 py-5 text-[#f8edf0] lg:flex">
        <Link to="/" className="mb-7 px-2">
          <div className="font-[Georgia] text-[31px] tracking-[0.08em]">СВОЯ</div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-[#ccb7bf]">жіночий клуб</div>
        </Link>

        <p className="mb-3 px-2 text-[10px] uppercase tracking-[0.14em] text-[#c7b2ba]">Твоє місце</p>

        <nav className="space-y-1">
          {sections.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => goSection(item.key)}
              className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[12px] transition ${section === item.key ? 'bg-[#f8ecef] font-semibold text-[#4d2634]' : 'text-[#f0e4e8] hover:bg-white/7'}`}
            >
              <span className="w-4 text-center text-[15px]">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-8 border-y border-white/20 py-6">
          <div className="text-[20px]">❀</div>
          <h3 className="mt-3 font-[Georgia] text-[22px] leading-6">Можна<br />прийти самій.</h3>
          <p className="mt-3 text-[10px] leading-4 text-[#cfbcc3]">Своє коло починається з одного знайомства.</p>
          <button type="button" onClick={() => navigate('/create')} className="mt-4 text-[10px] font-semibold underline underline-offset-4">
            Запропонувати зустріч
          </button>
        </div>

        <div className="mt-auto">
          <div className="mb-4 text-[10px] text-[#d6c6cb]">♙ &nbsp; Правила спільноти</div>
          <Link to="/profile" className="flex items-center gap-3 border-t border-white/20 pt-4">
            <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-[#7b4b5c] text-[11px] font-semibold">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : (profile?.name?.charAt(0) ?? 'О')}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-semibold">{profile?.name ?? 'Олена'}</div>
              <div className="text-[9px] text-[#cdbbc1]">Мої зустрічі та профіль</div>
            </div>
          </Link>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between border-b border-[#e0d6d2] bg-[#f8f6f3]/95 px-4 backdrop-blur md:px-8 lg:px-10">
        <div className="flex items-center gap-6 text-[11px] text-[#6b5960]">
          <span>⌾ &nbsp; {profile?.city || 'Усі міста'} &nbsp;⌄</span>
          <span className="hidden uppercase tracking-[0.16em] text-[#946578] md:inline">ТУТ ТИ СЕРЕД СВОЇХ</span>
        </div>
        <Link to="/" className="font-[Georgia] text-[20px] tracking-[0.08em] lg:hidden">СВОЯ</Link>
      </header>

      <main className="mx-auto w-full max-w-[1240px] px-4 py-7 md:px-8 lg:px-10">
        {section === 'feed' ? (
          <>
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9a4562]">ТВОЯ СПІЛЬНОТА ПОРУЧ</p>
                <h1 className="mt-2 text-[34px] font-extrabold tracking-[-0.04em] text-[#352b2f]">{profile?.name || 'Олена'}, рада бачити.</h1>
                <p className="mt-1 text-[13px] text-[#8a7d81]">Зустрічайся. Створюй. Підтримуй. Будь собою.</p>
              </div>
              <button type="button" onClick={primaryAction} className="mt-4 hidden rounded-full bg-[#8d2f51] px-6 py-3 text-[11px] font-semibold text-white sm:inline-flex">＋&nbsp; Створити</button>
            </div>

            <section className="mt-7 flex items-center gap-4 rounded-[15px] border border-[#e1d0d6] bg-[#f0e2e6] p-3">
              <img src={`${import.meta.env.BASE_URL}images/landing/poruch-friends.jpg`} alt="" className="h-[62px] w-[82px] rounded-[10px] object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[#9c6578]">МОЖНА ПРИЙТИ САМІЙ</p>
                <div className="mt-1 font-[Georgia] text-[27px] leading-none text-[#5d3142]">Почнемо з <span className="italic text-[#a94d6b]">«привіт»?</span></div>
              </div>
              <button type="button" onClick={() => goSection('event')} className="rounded-full border border-[#d8bdc7] bg-[#fff9f7] px-4 py-2 text-[10px] text-[#6c4250]">Обрати зустріч</button>
            </section>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {sections.filter((item) => item.key !== 'feed').map((item) => (
                <button key={item.key} type="button" onClick={() => goSection(item.key)} className="h-10 rounded-full border border-[#d8cac6] bg-[#fbf9f7] text-[10px] text-[#5e4650] hover:border-[#b98d9d]">
                  <span className="mr-2 text-[#a13d61]">{item.icon}</span>{item.label}
                </button>
              ))}
            </div>

            <section className="mt-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-[22px] font-extrabold tracking-[-0.03em]">Життя клубу</h2>
                  <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-[#745e66]">
                    {sections.map((item) => (
                      <button key={item.key} type="button" onClick={() => goSection(item.key)} className={`rounded-full px-3 py-2 ${item.key === 'feed' ? 'bg-[#8d2f51] text-white' : ''}`}>
                        {item.key === 'feed' ? 'Усі' : item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Search query={query} setQuery={setQuery} />
              </div>

              {loadError && <ErrorNotice text={loadError} />}

              {hasLiveFeed && (
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {events.slice(0, 3).map((event) => <LiveEventCard key={event.id} event={event} onOpen={() => navigate(`/event/${event.id}`)} />)}
                  {filteredPosts.slice(0, 6).map((post) => <LivePostCard key={post.id} post={post} onOpen={() => { void openPost(post) }} />)}
                </div>
              )}

              {!hasLiveFeed && <Notice />}

              <div className="mt-6 flex items-center justify-between">
                <h3 className="text-[17px] font-extrabold">З чого можна почати</h3>
                <p className="text-[9px] text-[#9a8c91]">Приклади форматів — запис ще не відкрито</p>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {examples.map((item) => <ExampleCard key={item[0]} item={item} />)}
              </div>
            </section>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9a4562]">{definition.eyebrow}</p>
                <h1 className="mt-2 text-[34px] font-extrabold tracking-[-0.04em] text-[#352b2f]">{definition.title}</h1>
                <p className="mt-1 text-[13px] text-[#7f7377]">{definition.subtitle}</p>
              </div>
              <button type="button" onClick={primaryAction} className="mt-4 hidden rounded-full bg-[#7f2949] px-6 py-3 text-[11px] font-semibold text-white sm:inline-flex">
                ＋&nbsp; {definition.primaryAction}
              </button>
            </div>

            <section className="mt-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-[17px] font-extrabold">{definition.groupTitle}</h2>
                  <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-[#715e65]">
                    {definition.filters.map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setActiveFilter(filter)}
                        className={`rounded-full px-3 py-2 ${activeFilter === filter ? 'bg-[#8d2f51] font-semibold text-white' : ''}`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>
                <Search query={query} setQuery={setQuery} />
              </div>

              {loadError && <ErrorNotice text={loadError} />}

              {!loading && !hasLiveSection && <Notice />}

              {section === 'event' && filteredEvents.length > 0 && (
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredEvents.map((event) => <LiveEventCard key={event.id} event={event} onOpen={() => navigate(`/event/${event.id}`)} />)}
                </div>
              )}

              {section !== 'event' && filteredPosts.length > 0 && (
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredPosts.map((post) => <LivePostCard key={post.id} post={post} onOpen={() => { void openPost(post) }} />)}
                </div>
              )}

              {(section === 'event' || section === 'circle') && !hasLiveSection && !loading && (
                <>
                  <div className="mt-6 flex items-center justify-between">
                    <h3 className="text-[17px] font-extrabold">З чого можна почати</h3>
                    <p className="text-[9px] text-[#9a8c91]">Приклади форматів — запис ще не відкрито</p>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {examples.map((item) => <ExampleCard key={item[0]} item={item} />)}
                  </div>
                </>
              )}

              {(section === 'beauty' || section === 'business' || section === 'help') && !hasLiveSection && !loading && (
                <EmptyPublication section={section} onCreate={primaryAction} />
              )}

              {loading && <div className="py-14 text-center text-[11px] text-[#8c7f84]">Завантажуємо…</div>}
            </section>
          </>
        )}

        <Footer />
      </main>

      {composerOpen && section !== 'feed' && section !== 'event' && (
        <ComposerModal
          section={section}
          definition={definition}
          title={composerTitle}
          body={composerBody}
          category={composerCategory}
          city={profile?.city ?? ''}
          saving={composerSaving}
          onTitle={setComposerTitle}
          onBody={setComposerBody}
          onCategory={setComposerCategory}
          onClose={() => setComposerOpen(false)}
          onSubmit={submitPost}
        />
      )}

      {selectedPost && (
        <PostModal
          post={selectedPost}
          comments={comments}
          commentText={commentText}
          commentSaving={commentSaving}
          onCommentText={setCommentText}
          onSubmitComment={submitComment}
          onClose={() => setSelectedPost(null)}
        />
      )}
    </div>
  )
}

function Search({ query, setQuery }: { query: string; setQuery: (value: string) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9b8890]">⌕</span>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Пошук у клубі"
        className="h-10 w-[210px] rounded-full border border-[#ded2ce] bg-white/80 pl-9 pr-4 text-[10px] outline-none focus:border-[#a85c76]"
      />
    </div>
  )
}

function Notice() {
  return (
    <div className="mt-5 flex items-center justify-between gap-4 rounded-[9px] bg-[#efede8] px-4 py-3 text-[9px] text-[#71666a]">
      <div>
        <div className="font-semibold text-[#69585e]">❀ &nbsp; Ми збираємо перше коло.</div>
        <div className="mt-1 pl-5 text-[#91868a]">Реальні події та пропозиції з’являться тут після публікації учасницями.</div>
      </div>
      <span className="shrink-0 underline underline-offset-3">Додати свою</span>
    </div>
  )
}

function ErrorNotice({ text }: { text: string }) {
  return <div className="mt-5 rounded-[9px] border border-[#e2c8cf] bg-[#f6e9ed] px-4 py-3 text-[10px] text-[#7d3d54]">{text}</div>
}

function LiveEventCard({ event, onOpen }: { event: ClubEvent; onOpen: () => void }) {
  return (
    <article className="overflow-hidden rounded-[11px] border border-[#e1d5d0] bg-[#fcfbf9]">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="h-[150px] bg-[#eadfe2]">
          {event.cover_photo_url
            ? <img src={event.cover_photo_url} alt="" className="h-full w-full object-cover" />
            : <div className="grid h-full place-items-center font-[Georgia] text-[28px] text-[#8d2f51]">СВОЯ</div>}
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between gap-3 text-[8px] text-[#94858a]">
            <span>{formatDate(event.event_datetime)}</span>
            <span>{event.address_text || 'Місце уточнюється'}</span>
          </div>
          <h3 className="mt-2 text-[16px] font-extrabold">{event.title}</h3>
          <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-[#746a6d]">{event.description}</p>
          <div className="mt-4 border-t border-[#eee5e1] pt-3 text-[9px] font-semibold text-[#8d2f51]">Відкрити подію →</div>
        </div>
      </button>
    </article>
  )
}

function LivePostCard({ post, onOpen }: { post: ClubPost; onOpen: () => void }) {
  return (
    <article className="rounded-[11px] border border-[#e1d5d0] bg-[#fcfbf9] p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#eadde2] text-[12px] font-bold text-[#7f2949]">
          {post.author?.avatar_url
            ? <img src={post.author.avatar_url} alt="" className="h-full w-full object-cover" />
            : (post.author?.name?.charAt(0) ?? 'С')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[8px] text-[#9a8c91]">
            <span>{post.author?.name ?? 'Учасниця'}</span>
            <span>·</span>
            <span>{post.city || post.author?.city || 'СВОЯ'}</span>
            <span>·</span>
            <span>{formatDate(post.created_at)}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full bg-[#f2e5e9] px-2 py-1 text-[8px] font-semibold text-[#8d2f51]">{sectionLabels[post.section]}</span>
            <span className="text-[8px] text-[#8a7d81]">{post.category}</span>
          </div>
          <h3 className="mt-3 text-[16px] font-extrabold leading-5">{post.title}</h3>
          <p className="mt-2 line-clamp-3 text-[10px] leading-4 text-[#746a6d]">{post.body}</p>
        </div>
      </div>
      <button type="button" onClick={onOpen} className="mt-4 rounded-full border border-[#decad1] px-3 py-1.5 text-[9px] text-[#8d2f51]">Деталі й обговорення</button>
    </article>
  )
}

function EmptyPublication({ section, onCreate }: { section: 'beauty' | 'business' | 'help'; onCreate: () => void }) {
  const state = emptyStates[section]

  return (
    <>
      <div className="mt-4 flex min-h-[220px] flex-col items-center justify-center rounded-[8px] border border-dashed border-[#dfcbd2] px-6 py-10 text-center">
        <div className="text-[27px] text-[#9b6d7f]">{state.icon}</div>
        <h3 className="mt-4 font-[Georgia] text-[25px] font-normal text-[#744154]">{state.title}</h3>
        <p className="mt-2 max-w-[430px] text-[11px] leading-5 text-[#8f7580]">{state.text}</p>
        <button type="button" onClick={onCreate} className="mt-5 rounded-full bg-[#8d2f51] px-5 py-2.5 text-[10px] font-semibold text-white">
          ＋&nbsp; Створити публікацію
        </button>
      </div>

      {state.note && (
        <div className="mt-4 rounded-[6px] bg-[#eee6eb] px-4 py-3 text-[9px] leading-4 text-[#806e76]">
          ♢ &nbsp; {state.note}
        </div>
      )}
    </>
  )
}

function ComposerModal(props: {
  section: ClubPostSection
  definition: SectionDefinition
  title: string
  body: string
  category: string
  city: string
  saving: boolean
  onTitle: (value: string) => void
  onBody: (value: string) => void
  onCategory: (value: string) => void
  onClose: () => void
  onSubmit: (event: FormEvent) => void
}) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#261821]/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) props.onClose() }}>
      <form onSubmit={props.onSubmit} className="w-full max-w-[620px] rounded-[22px] border border-[#e1d5d0] bg-[#fffaf7] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#9a4562]">{props.definition.eyebrow}</div>
            <h2 className="mt-2 font-[Georgia] text-[34px] leading-none text-[#5d3142]">{props.definition.primaryAction}</h2>
          </div>
          <button type="button" onClick={props.onClose} className="grid h-9 w-9 place-items-center rounded-full border border-[#dfd1cd] text-[18px] text-[#795663]">×</button>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="text-[10px] font-semibold text-[#6f5e64]">
            Категорія
            <select value={props.category} onChange={(event) => props.onCategory(event.target.value)} required className="mt-1.5 h-11 w-full rounded-[11px] border border-[#ddd0cc] bg-white px-3 text-[12px] outline-none focus:border-[#9d536c]">
              <option value="">Оберіть категорію</option>
              {props.definition.filters.filter((item) => item !== 'Усі').map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <label className="text-[10px] font-semibold text-[#6f5e64]">
            Заголовок
            <input value={props.title} onChange={(event) => props.onTitle(event.target.value)} maxLength={120} required className="mt-1.5 h-11 w-full rounded-[11px] border border-[#ddd0cc] bg-white px-3 text-[12px] outline-none focus:border-[#9d536c]" placeholder="Коротко і зрозуміло" />
          </label>

          <label className="text-[10px] font-semibold text-[#6f5e64]">
            Опис
            <textarea value={props.body} onChange={(event) => props.onBody(event.target.value)} maxLength={2000} rows={6} required className="mt-1.5 w-full resize-none rounded-[11px] border border-[#ddd0cc] bg-white px-3 py-3 text-[12px] leading-5 outline-none focus:border-[#9d536c]" placeholder="Розкажіть деталі, щоб іншим було легко відгукнутися." />
          </label>

          <div className="text-[9px] text-[#94858a]">Місто: {props.city || 'не вказано у профілі'}</div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={props.onClose} className="rounded-full border border-[#decfd0] px-5 py-2.5 text-[10px] font-semibold text-[#72545f]">Скасувати</button>
          <button type="submit" disabled={props.saving || !props.category || props.title.trim().length < 2 || props.body.trim().length < 2} className="rounded-full bg-[#8d2f51] px-5 py-2.5 text-[10px] font-semibold text-white disabled:opacity-50">
            {props.saving ? 'Публікуємо…' : 'Опублікувати'}
          </button>
        </div>
      </form>
    </div>
  )
}

function PostModal(props: {
  post: ClubPost
  comments: ClubPostComment[]
  commentText: string
  commentSaving: boolean
  onCommentText: (value: string) => void
  onSubmitComment: (event: FormEvent) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-[#261821]/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) props.onClose() }}>
      <div className="flex max-h-[88vh] w-full max-w-[720px] flex-col rounded-[22px] border border-[#e1d5d0] bg-[#fffaf7] shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#eadfdb] p-6">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[#9a4562]">{sectionLabels[props.post.section]} · {props.post.category}</div>
            <h2 className="mt-2 font-[Georgia] text-[34px] leading-none text-[#5d3142]">{props.post.title}</h2>
          </div>
          <button type="button" onClick={props.onClose} className="grid h-9 w-9 place-items-center rounded-full border border-[#dfd1cd] text-[18px] text-[#795663]">×</button>
        </div>

        <div className="overflow-auto p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[#eadde2] text-[12px] font-bold text-[#7f2949]">
              {props.post.author?.avatar_url
                ? <img src={props.post.author.avatar_url} alt="" className="h-full w-full object-cover" />
                : (props.post.author?.name?.charAt(0) ?? 'С')}
            </div>
            <div>
              <div className="text-[11px] font-semibold">{props.post.author?.name ?? 'Учасниця'}</div>
              <div className="text-[9px] text-[#95878c]">{props.post.city || props.post.author?.city || 'СВОЯ'} · {formatDate(props.post.created_at)}</div>
            </div>
          </div>

          <p className="mt-5 whitespace-pre-wrap text-[12px] leading-6 text-[#5f5559]">{props.post.body}</p>

          <div className="mt-7 border-t border-[#eadfdb] pt-5">
            <h3 className="text-[14px] font-extrabold">Обговорення</h3>
            <div className="mt-3 grid gap-3">
              {props.comments.length === 0 && <div className="rounded-[10px] bg-[#f1ede9] px-4 py-4 text-[10px] text-[#8b7f83]">Поки без коментарів. Можна бути першою.</div>}
              {props.comments.map((comment) => (
                <div key={comment.id} className="rounded-[12px] border border-[#e6dad6] bg-white/75 p-3">
                  <div className="flex items-center gap-2 text-[9px] text-[#8e7f84]">
                    <strong className="text-[#58484e]">{comment.author?.name ?? 'Учасниця'}</strong>
                    <span>·</span>
                    <span>{formatDate(comment.created_at)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-[#655b5e]">{comment.body}</p>
                </div>
              ))}
            </div>

            <form onSubmit={props.onSubmitComment} className="mt-4 flex gap-2">
              <input value={props.commentText} onChange={(event) => props.onCommentText(event.target.value)} maxLength={1000} placeholder="Написати коментар…" className="h-11 min-w-0 flex-1 rounded-full border border-[#ddd0cc] bg-white px-4 text-[11px] outline-none focus:border-[#9d536c]" />
              <button type="submit" disabled={props.commentSaving || !props.commentText.trim()} className="rounded-full bg-[#8d2f51] px-5 text-[10px] font-semibold text-white disabled:opacity-50">
                {props.commentSaving ? '…' : 'Надіслати'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
