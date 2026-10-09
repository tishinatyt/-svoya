import { containsFilter } from "@/lib/club-queries";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { clubDb } from "@/lib/club-db";
import type { Profile } from "@/lib/club-types";
import { MemberAvatar, ProfileGallery } from "../profile-photos";
import {
  action,
  EmptyState,
  ErrorState,
  FeatureHeader,
  publicPhoto,
  useTask,
} from "./shared";
import type { Benefit, Story } from "./community-content";
import { MemberTitleBadge, MemberTitleGuide } from './member-titles';
import MemberTitleEditor from './member-title-editor';
type Report = {
  id: string;
  entry_id: string | null;
  target_user_id: string | null;
  reason: string;
  status: string;
  resolution: string;
};
export default function Moderation({ onChange }: { onChange: () => void }) {
  const [tab, setTab] = useState("profiles"),
    [profiles, setProfiles] = useState<Profile[]>([]),
    [reports, setReports] = useState<Report[]>([]),
    [stories, setStories] = useState<Story[]>([]),
    [benefits, setBenefits] = useState<Benefit[]>([]),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [search, setSearch] = useState(""),
    [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [profileCount, setProfileCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const { busy, run } = useTask();
  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => { void (async () => {
      try {
      const db = clubDb();
      let profileQuery = db.from("svoya_profiles").select("*", { count: "exact" });
      if (tab === 'titles') profileQuery = profileQuery.eq('membership_status', 'approved');
      if (search.trim()) profileQuery = profileQuery.or(containsFilter(["name", "city"], search));
      else if (tab !== 'titles') profileQuery = profileQuery.eq("membership_status", "pending");
      const rows = await Promise.all([
        profileQuery.order("created_at").order("id").range(page * 50, page * 50 + 49),
        db
          .from("svoya_reports")
          .select("*")
          .eq("status", "open")
          .order("created_at"),
        db
          .from("svoya_stories")
          .select("*")
          .eq("status", "pending")
          .order("created_at"),
        db
          .from("svoya_benefits")
          .select("*")
          .eq("status", "pending")
          .order("created_at"),
        db.from("svoya_profiles").select("id", { count: "exact", head: true }).eq("membership_status", "pending"),
      ]);
      if (!active) return;
      setProfileCount(rows[0].count ?? 0);
      setPendingCount(rows[4].count ?? 0);
      if (page > 0 && page * 50 >= (rows[0].count ?? 0)) setPage(Math.max(0, Math.ceil((rows[0].count ?? 0) / 50) - 1));
      setError(rows.some((r) => r.error));
      setProfiles(rows[0].data ?? []);
      setReports(rows[1].data ?? []);
      setStories(rows[2].data ?? []);
      setBenefits(rows[3].data ?? []);
      setLoading(false);
      } catch { if (active) { setError(true); setLoading(false); } }
    })(); }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [revision, search, page, tab]);
  const review = (type: string, id: string, status: string, note = "") =>
    void run(async () => {
      await action(`review_${type}`, { id, status, note });
      toast.success("Рішення збережено.");
      setRevision((x) => x + 1);
      onChange();
    });
  return (
    <>
      <FeatureHeader
        eyebrow="КОМАНДА КЛУБУ"
        title="Довіра починається з уваги."
      >
        Перевіряй анкети, звернення, партнерські умови та згоду на публікацію
        фото. Рішення зберігаються в журналі модерації.
      </FeatureHeader>
      <div className="sv-segmented">
        {[
          [
            "profiles",
            `Анкети · ${pendingCount}`,
          ],
          ["titles", "Титули"],
          ["reports", `Звернення · ${reports.length}`],
          ["stories", `Історії · ${stories.length}`],
          ["benefits", `Привілеї · ${benefits.length}`],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => {setTab(id);setPage(0);}}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'titles' && <MemberTitleGuide />}
      {(tab === "profiles" || tab === 'titles') && <>
              <label className="sv-admin-search">
                Знайти анкету
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  placeholder={tab === 'titles' ? 'Ім’я або місто. Усі схвалені учасниці.' : "Ім’я або місто. Без пошуку — нові анкети."}
                />
              </label>
        <div className="sv-inline-actions" aria-label="Сторінки анкет">
          <span>Знайдено: {profileCount}</span>
          <button className="sv-outline" disabled={loading || page === 0} onClick={() => setPage(p => p - 1)}>Попередні</button>
          <span>Сторінка {page + 1}</span>
          <button className="sv-outline" disabled={loading || (page + 1) * 50 >= profileCount} onClick={() => setPage(p => p + 1)}>Наступні</button>
        </div>
      </>}
      {error ? (
        <ErrorState retry={() => setRevision((x) => x + 1)} />
      ) : loading ? (
        <p role="status">Завантажуємо чергу…</p>
      ) : (
        <div className="sv-feature-stack">
          {(tab === "profiles" || tab === 'titles') && (
            <>

              {profiles.map((p) => (
                  <article key={p.id} className="sv-feature-box">
                    <div className="sv-list-row">
                      <MemberAvatar profile={p} />
                      <div>
                        <h3>
                          {p.name} · {p.city}
                        </h3>
                        <MemberTitleBadge profile={p} />
                        <p>{p.bio}</p>
                        <small>
                          {p.membership_status === "approved"
                            ? "Схвалена"
                            : p.membership_status === "suspended"
                              ? "Доступ призупинено"
                              : "Нова анкета"}
                        </small>
                      </div>
                    </div>
                    <p>{p.interests.join(" · ")}</p>
                    <button
                      className="sv-text-button"
                      onClick={() =>
                        setExpanded(expanded === p.id ? null : p.id)
                      }
                    >
                      Переглянути фото
                    </button>
                    {expanded === p.id && <ProfileGallery profile={p} />}
                    {tab === 'titles' ? <MemberTitleEditor key={p.id + (p.member_title_updated_at ?? '')} profile={p} onChange={()=>{setRevision(x=>x+1);onChange();}} /> : <form
                      className="sv-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        review(
                          "profile",
                          p.id,
                          String(f.get("decision")),
                          String(f.get("note")),
                        );
                      }}
                    >
                      <label>
                        Рішення
                        <select
                          name="decision"
                          defaultValue={
                            p.membership_status === "pending"
                              ? "approved"
                              : "suspended"
                          }
                        >
                          <option value="approved">
                            Схвалити / відновити доступ
                          </option>
                          <option value="suspended">Призупинити доступ</option>
                          <option value="pending">
                            Повернути на перевірку
                          </option>
                        </select>
                      </label>
                      <label>
                        Пояснення для журналу команди
                        <textarea
                          name="note"
                          required
                          minLength={3}
                          maxLength={1000}
                        />
                      </label>
                      <button className="sv-btn" disabled={busy}>
                        Зберегти рішення
                      </button>
                    </form>}
                  </article>
                ))}
              {tab === 'titles' && !profiles.length && <EmptyState title="Схвалених анкет не знайдено"><p>Спробуй інше ім’я або спочатку схвали анкету у вкладці «Анкети».</p></EmptyState>}
              {tab === 'profiles' && !search &&
                !profiles.some((p) => p.membership_status === "pending") && (
                  <EmptyState title="Нових анкет поки немає">
                    <p>Для пошуку чинної учасниці введи ім’я вище.</p>
                  </EmptyState>
                )}
            </>
          )}
          {tab === "reports" &&
            (reports.length ? (
              reports.map((r) => (
                <article key={r.id} className="sv-feature-box">
                  <h3>Звернення учасниці</h3>
                  <p>{r.reason}</p>
                  {r.target_user_id && (
                    <p>
                      Анкета:{" "}
                      {profiles.find((p) => p.id === r.target_user_id)?.name ??
                        r.target_user_id}
                    </p>
                  )}
                  {r.entry_id && (
                    <a
                      href={`?entry=${r.entry_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Відкрити публікацію ↗
                    </a>
                  )}
                  <form
                    className="sv-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      review(
                        "report",
                        r.id,
                        "resolved",
                        String(new FormData(e.currentTarget).get("note")),
                      );
                    }}
                  >
                    <label>
                      Результат розгляду
                      <textarea
                        name="note"
                        required
                        minLength={5}
                        maxLength={1000}
                      />
                    </label>
                    <button className="sv-btn" disabled={busy}>
                      Завершити розгляд
                    </button>
                  </form>
                </article>
              ))
            ) : (
              <EmptyState title="Усі звернення розглянуто">
                <p>Нові звернення з’являться тут.</p>
              </EmptyState>
            ))}
          {tab === "stories" &&
            (stories.length ? (
              stories.map((s) => (
                <article key={s.id} className="sv-feature-box">
                  <span className="sv-overline">
                    {s.kind === "host" ? "ОРГАНІЗАТОРКА" : "ІСТОРІЯ ЗУСТРІЧІ"}
                  </span>
                  <h3>{s.title}</h3>
                  <p className="sv-preserve-lines">{s.body}</p>
                  <div className="sv-public-gallery">
                    {s.image_paths.map((path) => (
                      <a
                        href={publicPhoto(path)}
                        key={path}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img src={publicPhoto(path)} alt="Фото для перевірки" />
                      </a>
                    ))}
                  </div>
                  <div className="sv-inline-actions">
                    <button
                      className="sv-btn"
                      disabled={busy}
                      onClick={() => review("story", s.id, "published")}
                    >
                      Опублікувати
                    </button>
                    <button
                      className="sv-outline"
                      disabled={busy}
                      onClick={() => review("story", s.id, "rejected")}
                    >
                      Не погоджувати
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState title="Публікацій на перевірці немає">
                <p>Тут будуть історії та представлення організаторок.</p>
              </EmptyState>
            ))}
          {tab === "benefits" &&
            (benefits.length ? (
              benefits.map((b) => (
                <article key={b.id} className="sv-feature-box">
                  <span className="sv-overline">
                    {b.provider} · {b.city}
                  </span>
                  <h3>{b.title}</h3>
                  <p>{b.description}</p>
                  <h4>Умови</h4>
                  <p>{b.terms}</p>
                  <p>
                    До {new Date(b.valid_until).toLocaleDateString("uk-UA")}
                  </p>
                  {b.url && (
                    <a href={b.url} target="_blank" rel="noopener noreferrer">
                      Перевірити партнера ↗
                    </a>
                  )}
                  <div className="sv-inline-actions">
                    <button
                      className="sv-btn"
                      disabled={busy}
                      onClick={() => review("benefit", b.id, "published")}
                    >
                      Партнера перевірено — опублікувати
                    </button>
                    <button
                      className="sv-outline"
                      disabled={busy}
                      onClick={() => review("benefit", b.id, "rejected")}
                    >
                      Не погоджувати
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState title="Нових партнерських пропозицій немає">
                <p>
                  Перед публікацією перевір умови та повноваження представниці.
                </p>
              </EmptyState>
            ))}
        </div>
      )}
    </>
  );
}
