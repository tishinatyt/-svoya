import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { listSvoyaEntries, type SvoyaEntry, type SvoyaKind } from '@/lib/svoya'

type SectionKey = SvoyaKind | 'feed'

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

function PublishedEntryCard({ entry }: { entry: SvoyaEntry }) {
  const imageByTitle: Record<string, string> = {
    'Кава у своєму колі': 'images/landing/poruch-coffee.jpg',
    'Прогулянка без поспіху': 'images/landing/poruch-walk.jpg',
    'Творчий вечір разом': 'images/landing/poruch-friends.jpg',
    'Жінки, які створюють': 'images/landing/poruch-friends-city.jpg',
    'Я новенька у місті': 'images/landing/poruch-walk.jpg',
    'Книжкові подруги': 'images/landing/poruch-friends.jpg',
  }
  const fallback = entry.kind === 'circle' ? 'images/landing/poruch-friends-city.jpg' : 'images/landing/poruch-friends.jpg'
  const image = imageByTitle[entry.title] || fallback

  return (
    <Link to={`/club/entry/${entry.id}`} className="rounded-[11px] border border-[#e1d5d0] bg-[#fcfbf9] p-3 transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(77,38,52,0.08)]">
      <div className="flex gap-3">
        <div className="relative h-[86px] w-[106px] shrink-0 overflow-hidden rounded-[8px]">
          <img src={`${import.meta.env.BASE_URL}${image}`} alt="" className="h-full w-full object-cover" />
          <span className={`absolute left-2 top-2 rounded px-2 py-1 text-[8px] ${entry.is_demo ? 'bg-[#f8eee8] text-[#8a615a]' : 'bg-[#8d2f51] text-white'}`}>
            {entry.is_demo ? 'Приклад' : 'Нове'}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-[8px] text-[#97898e]">
            <span>⌾ {entry.city}</span>
            <span>{entry.is_demo ? 'Для натхнення' : entry.category}</span>
          </div>
          <h4 className="mt-2 text-[15px] font-extrabold leading-4 text-[#403438]">{entry.title}</h4>
          <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-[#746a6d]">{entry.description}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[#eee5e1] pt-3 text-[9px]">
        <span className="text-[#8d6876]">{entry.kind === 'circle' ? '♧' : entry.kind === 'event' ? '▦' : '◦'} &nbsp; {entry.category || 'СВОЯ'}</span>
        <span className="rounded-full border border-[#decad1] px-3 py-1.5 text-[#8d2f51]">Деталі</span>
      </div>
    </Link>
  )
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
        <button type="button" className="rounded-full border border-[#decad1] px-3 py-1.5 text-[#8d2f51]">Деталі</button>
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
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const current = (params.get('section') || 'feed') as SectionKey
  const section = sections.some((item) => item.key === current) ? current : 'feed'
  const definition = sections.find((item) => item.key === section) ?? sections[0]

  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('Усі')
  const [publishedEntries, setPublishedEntries] = useState<SvoyaEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setEntriesLoading(true)
    const kind = section === 'feed' ? undefined : section
    void listSvoyaEntries(kind)
      .then((items) => { if (!cancelled) setPublishedEntries(items) })
      .catch((error) => {
        console.error('[SVOYA entries]', error)
        if (!cancelled) setPublishedEntries([])
      })
      .finally(() => { if (!cancelled) setEntriesLoading(false) })
    return () => { cancelled = true }
  }, [section])

  const visiblePublishedEntries = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('uk-UA')
    return publishedEntries.filter((entry) => {
      const matchesFilter = activeFilter === 'Усі' || entry.category === activeFilter
      const matchesQuery = !q || `${entry.title} ${entry.description} ${entry.city} ${entry.category}`.toLocaleLowerCase('uk-UA').includes(q)
      return matchesFilter && matchesQuery
    })
  }, [publishedEntries, query, activeFilter])

  const examples = useMemo(() => {
    const source = section === 'event' ? eventExamples : section === 'circle' ? circleExamples : feedExamples
    const q = query.trim().toLocaleLowerCase('uk-UA')
    if (!q) return source
    return source.filter(([title, text]) => `${title} ${text}`.toLocaleLowerCase('uk-UA').includes(q))
  }, [query, section])

  function goSection(next: SectionKey) {
    setQuery('')
    setActiveFilter('Усі')
    setParams({ section: next })
  }

  function primaryAction() {
    const kind: SvoyaKind = section === 'feed' ? 'event' : section
    navigate(`/club/create?kind=${kind}`)
  }

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

              <Notice />

              {entriesLoading && <div className="py-6 text-center text-[10px] text-[#8f8387]">Завантажуємо публікації…</div>}

              {visiblePublishedEntries.some((entry) => !entry.is_demo) && (
                <>
                  <div className="mt-6 flex items-center justify-between">
                    <h3 className="text-[17px] font-extrabold">Нове у клубі</h3>
                    <span className="text-[9px] text-[#9a8c91]">Публікації учасниць</span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {visiblePublishedEntries.filter((entry) => !entry.is_demo).map((entry) => <PublishedEntryCard key={entry.id} entry={entry} />)}
                  </div>
                </>
              )}

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

              <Notice />

              {(section === 'event' || section === 'circle') && (
                <>
                  <div className="mt-6 flex items-center justify-between">
                    <h3 className="text-[17px] font-extrabold">З чого можна почати</h3>
                    <p className="text-[9px] text-[#9a8c91]">Приклади форматів — запис ще не відкрито</p>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {visiblePublishedEntries.filter((entry) => entry.is_demo).map((entry) => <PublishedEntryCard key={entry.id} entry={entry} />)}
                  </div>
                </>
              )}

              {(section === 'beauty' || section === 'business' || section === 'help') && (
                visiblePublishedEntries.length > 0 ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {visiblePublishedEntries.map((entry) => <PublishedEntryCard key={entry.id} entry={entry} />)}
                  </div>
                ) : (
                  <EmptyPublication section={section} onCreate={primaryAction} />
                )
              )}
            </section>
          </>
        )}

        <Footer />
      </main>
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
      <button type="button" className="shrink-0 underline underline-offset-3">Додати свою</button>
    </div>
  )
}

function EmptyPublication({ section, onCreate }: { section: 'beauty' | 'business' | 'help'; onCreate: () => void }) {
  const state = emptyStates[section]

  return (
    <>
      <div id={`empty-${section}`} className="mt-4 flex min-h-[220px] flex-col items-center justify-center rounded-[8px] border border-dashed border-[#dfcbd2] px-6 py-10 text-center">
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
