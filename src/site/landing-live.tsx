import { useEffect, useState } from "react";
import { clubDb } from "@/lib/club-db";
import { siteUrl } from "@/lib/site-path";
import type { Entry } from "@/lib/club-types";
import { publicPhoto, dateTime } from "./club/features/shared";
import type { Story } from "./club/features/community-content";
import "./landing-live.css";
export default function LandingLive() {
  const [events, setEvents] = useState<Entry[]>([]),
    [stories, setStories] = useState<Story[]>([]),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void (async () => {
      const [e, s] = await Promise.all([
        clubDb()
          .from("svoya_entries")
          .select("*")
          .eq("status", "published")
          .eq("is_demo", false)
          .eq("kind", "event")
          .gt("starts_at", new Date().toISOString())
          .order("starts_at")
          .limit(3),
        clubDb()
          .from("svoya_stories")
          .select("*")
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);
      if (active) {
        setEvents(e.data ?? []);
        setStories(s.data ?? []);
        setError(!!e.error || !!s.error);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <section className="home-live" id="upcoming">
        <div className="home-live-heading">
          <div>
            <span className="home-kicker">З ПЛАНІВ — У ЖИТТЯ</span>
            <h2>
              Наступний привід
              <br />
              <em>зустрітися.</em>
            </h2>
          </div>
          <a
            className="home-text-link"
            href={siteUrl("/club?section=calendar")}
          >
            Уся афіша ↗
          </a>
        </div>
        {loading ? (
          <p role="status">Завантажуємо найближчі зустрічі…</p>
        ) : error ? (
          <p>
            Афіша тимчасово не завантажилась.{" "}
            <a href={siteUrl("/club?section=calendar")}>Перейти до календаря</a>
          </p>
        ) : events.length ? (
          <div className="home-live-events">
            {events.map((e) => (
              <a
                href={siteUrl(`/club?entry=${e.id}`)}
                className="home-live-event"
                key={e.id}
              >
                <span>
                  {e.format === "coffee"
                    ? "КАВА НА ЧОТИРЬОХ"
                    : e.format === "quick"
                      ? "МАЮ ГОДИНУ"
                      : "ЗУСТРІЧ КЛУБУ"}
                </span>
                <h3>{e.title}</h3>
                <p>
                  {dateTime(e.starts_at!)} · {e.city}
                </p>
                <div>
                  {e.location || "Деталі у публікації"} <b>↗</b>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="home-live-empty">
            <p>
              Нові зустрічі готуються. Перший спільний план можеш запропонувати
              ти.
            </p>
            <a
              className="home-button home-button-dark"
              href={siteUrl("/club?section=event")}
            >
              Запропонувати каву
            </a>
          </div>
        )}
      </section>
      <section className="home-live home-voices" id="club-people">
        <div className="home-live-heading">
          <div>
            <span className="home-kicker">ЗНАЙОМИМОСЯ БЛИЖЧЕ</span>
            <h2>
              За клубом —<br />
              <em>живі люди.</em>
            </h2>
          </div>
          <a className="home-text-link" href={siteUrl("/club?section=stories")}>
            Люди та історії ↗
          </a>
        </div>
        {stories.length ? (
          <div className="home-live-stories">
            {stories.slice(0, 3).map((s) => (
              <a key={s.id} href={siteUrl("/club?section=stories")}>
                <div>
                  {s.image_paths[0] ? (
                    <img
                      src={publicPhoto(s.image_paths[0])}
                      alt={s.title}
                      loading="lazy"
                    />
                  ) : (
                    <span className="home-story-type">
                      {s.kind === "host" ? "Знайомство" : "Спогади"}
                    </span>
                  )}
                </div>
                <span>
                  {s.kind === "host" ? "ОРГАНІЗАТОРКА" : "ІСТОРІЯ ЗУСТРІЧІ"} ·{" "}
                  {s.city}
                </span>
                <h3>{s.title}</h3>
                <p>
                  {s.body.slice(0, 180)}
                  {s.body.length > 180 ? "…" : ""}
                </p>
              </a>
            ))}
          </div>
        ) : (
          <div className="home-live-empty">
            <p>
              Організовуєш зустрічі? Представся учасницям. Уже зустрілися?
              Поділися історією та фото зі згоди своєї компанії.
            </p>
            <a
              className="home-text-link"
              href={siteUrl("/club?section=stories")}
            >
              Розповісти про себе ↗
            </a>
          </div>
        )}
      </section>
    </>
  );
}
