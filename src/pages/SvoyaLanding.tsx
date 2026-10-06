import { Link } from 'react-router-dom'

const portraits = [
  12, 44, 68, 32, 47, 65, 25, 29, 55, 18, 24, 37, 72, 41, 63, 75, 26, 17, 57, 35,
  30, 39, 46, 54, 76, 22, 45, 61, 50, 59, 67, 74, 79, 81, 84, 86, 88, 90, 91, 92,
  93, 94, 95, 96, 97, 98, 99, 13, 27, 43,
]

export default function SvoyaLanding() {
  const heroImage = `${import.meta.env.BASE_URL}images/landing/poruch-friends.jpg`

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#512838]">
      <header className="flex h-16 items-center justify-between border-b border-[#d9cbc6] px-6 md:px-10 xl:px-[4.3vw]">
        <Link to="/" className="leading-none">
          <div className="font-[Georgia] text-[28px] tracking-[0.08em]">СВОЯ</div>
          <div className="mt-1 text-[8px] uppercase tracking-[0.16em] text-[#7f5b67]">жіночий клуб</div>
        </Link>

        <nav className="hidden items-center gap-8 text-[10px] md:flex">
          <a href="#about" className="hover:text-[#9a4562]">Про нас</a>
          <a href="#together" className="hover:text-[#9a4562]">Що нас об’єднує</a>
          <a href="#join" className="hover:text-[#9a4562]">Як долучитися</a>
        </nav>

        <Link to="/club" className="rounded-full bg-[#592438] px-5 py-2 text-[10px] font-semibold text-white">
          Увійти до клубу
        </Link>
      </header>

      <main>
        <section className="grid min-h-[52vh] grid-cols-1 border-b border-[#d9cbc6] lg:grid-cols-[1.05fr_1fr]">
          <div className="flex min-h-[420px] flex-col justify-between px-6 py-10 md:px-10 xl:px-[4.3vw] xl:py-12">
            <div className="text-[8px] uppercase tracking-[0.16em] text-[#8f5367]">ЖІНКИ. ЗНАЙОМСТВА. ЖИТТЯ.</div>

            <div className="max-w-[560px]">
              <h1 className="font-[Georgia] text-[52px] font-normal leading-[0.98] tracking-[-0.05em] md:text-[72px] xl:text-[5vw]">
                Твоя людина<br />
                може бути<br />
                <span className="italic text-[#b65373]">зовсім поруч.</span>
              </h1>
              <p className="mt-10 text-[11px] leading-5 text-[#6f5660]">
                Для кави без поспіху.<br />
                Для сміливих ідей.<br />
                Для звичайного «як ти?».
              </p>
            </div>

            <div className="flex items-end justify-between gap-6">
              <div>
                <Link to="/club" className="inline-flex rounded-full bg-[#6c2c44] px-7 py-3 text-[10px] font-semibold text-white">
                  Знайти своє коло
                </Link>
                <p className="mt-3 text-[9px] text-[#8a737c]">Можна прийти самій.</p>
              </div>
              <div className="hidden h-16 w-16 rotate-[-7deg] items-center justify-center rounded-full bg-[#f2df9d] text-center text-[9px] leading-3 text-[#67492a] md:flex">
                тут можна<br />бути собою
              </div>
            </div>
          </div>

          <div className="relative min-h-[390px] overflow-hidden bg-[#e4d5cf] lg:min-h-full">
            <img src={heroImage} alt="Жінки знайомляться й розмовляють за кавою" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute right-5 top-4 text-[8px] text-white/90">01 / СВОЇ МОМЕНТИ</div>
            <div className="absolute bottom-4 left-5 flex items-center gap-2 text-[9px] text-white">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20">◉</span>
              Знайомство починається з кави
            </div>
          </div>
        </section>

        <section className="bg-[#592438] py-2 text-[#f8ecef]">
          <div className="flex min-w-max animate-[svoyaTicker_30s_linear_infinite] items-center justify-around gap-24 whitespace-nowrap text-[9px]">
            <span>Більше живого спілкування</span><span>✣</span>
            <span>Менше «якось іншим разом»</span><span>✣</span>
            <span>Більше часу для себе</span><span>✣</span>
            <span>Своє коло починається зі знайомства</span><span>✣</span>
          </div>
        </section>

        <section className="border-b border-[#d9cbc6] py-5" id="together">
          <div className="mb-4 flex items-center justify-between px-6 md:px-10 xl:px-[4.3vw]">
            <div>
              <h2 className="font-[Georgia] text-[24px] font-normal">Своє коло починається зі <span className="italic text-[#b65373]">знайомства.</span></h2>
              <p className="mt-1 text-[8px] text-[#8a737c]">Ілюстративні фото</p>
            </div>
            <button type="button" className="rounded-full border border-[#d3bec5] px-3 py-1 text-[8px]">Пауза</button>
          </div>
          <div className="overflow-hidden">
            <div className="flex w-max gap-2 px-1">
              {portraits.map((id, index) => (
                <img
                  key={id}
                  src={`https://randomuser.me/api/portraits/women/${id}.jpg`}
                  alt={`Ілюстративний портрет ${index + 1}`}
                  className="h-[54px] w-[54px] rounded-[13px] object-cover grayscale-[12%] md:h-[62px] md:w-[62px]"
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="grid min-h-[300px] grid-cols-1 gap-10 px-6 py-12 md:grid-cols-[0.2fr_1fr_0.8fr] md:px-10 xl:px-[6.3vw] xl:py-16">
          <div className="pt-2 text-[8px] uppercase tracking-[0.12em] text-[#a06177]">ЦЕ І Є «СВОЯ».</div>
          <div>
            <h2 className="max-w-[520px] font-[Georgia] text-[44px] font-normal leading-[0.95] tracking-[-0.04em] md:text-[52px]">
              Дорослій дружбі<br />теж потрібне <span className="italic text-[#b65373]">місце.</span>
            </h2>
            <p className="mt-5 max-w-[620px] text-[10px] leading-5 text-[#715c64]">
              Ми можемо жити на сусідніх вулицях і так і не зустрітися. «СВОЯ» — жіночий клуб, який допомагає зробити цей перший крок.
              <br /><br />
              Знайомитися без незручних приводів. Пробувати нове разом.
              <br />
              Знаходити підтримку для себе та своєї справи.
            </p>
          </div>
          <div className="flex items-center justify-center md:justify-end">
            <div className="max-w-[220px] border-l border-[#d0b8c0] pl-5">
              <p className="font-[Georgia] text-[19px] italic leading-5">Без потреби<br />бути ідеальною.</p>
              <div className="my-4 text-[22px] text-[#b65373]">♡</div>
              <p className="text-[8px] leading-4 text-[#8a737c]">Достатньо бути собою<br />і мати бажання зустрітися.</p>
            </div>
          </div>
        </section>

        <section id="join" className="border-t border-[#d9cbc6] px-6 py-12 text-center md:px-10">
          <p className="text-[9px] uppercase tracking-[0.18em] text-[#966276]">СВОЇ ЛЮДИ НЕ ЗАВЖДИ ЗНАХОДЯТЬСЯ САМІ.</p>
          <h2 className="mx-auto mt-4 max-w-3xl font-[Georgia] text-[42px] font-normal md:text-[56px]">Іноді достатньо сказати «привіт».</h2>
          <Link to="/club" className="mt-7 inline-flex rounded-full bg-[#592438] px-7 py-3 text-[10px] font-semibold text-white">Я з вами</Link>
        </section>
      </main>
    </div>
  )
}
