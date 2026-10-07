import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { clubDb } from "@/lib/club-db";
import type { Entry, Membership, Profile } from "@/lib/club-types";
import {
  action,
  EmptyState,
  ErrorState,
  FeatureHeader,
  PhotoUpload,
  publicPhoto,
  uploadPublicImages,
  useTask,
} from "./shared";
export type Benefit = {
  id: string;
  owner_id: string;
  title: string;
  provider: string;
  description: string;
  terms: string;
  city: string;
  url: string;
  valid_until: string;
  status: string;
};
export type Story = {
  id: string;
  owner_id: string;
  entry_id: string | null;
  kind: "host" | "story";
  title: string;
  body: string;
  city: string;
  image_paths: string[];
  status: string;
  created_at: string;
};
export function Benefits({
  profile,
  onLogin,
  city,
}: {
  profile: Profile | null;
  onLogin: () => void;
  city: string;
}) {
  const [items, setItems] = useState<Benefit[]>([]),
    [form, setForm] = useState(false),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [codes, setCodes] = useState<Record<string, string>>({});
  const { busy, run } = useTask();
  useEffect(() => {
    let active = true;
    setLoading(true);
    clubDb()
      .from("svoya_benefits")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .then((r) => {
        if (active) {
          setItems(r.data ?? []);
          setError(!!r.error);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [revision, profile?.id]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    const f = new FormData(e.currentTarget);
    await run(async () => {
      const r = await clubDb()
        .from("svoya_benefits")
        .insert({
          owner_id: profile.id,
          title: String(f.get("title")).trim(),
          provider: String(f.get("provider")).trim(),
          description: String(f.get("description")).trim(),
          terms: String(f.get("terms")).trim(),
          city: String(f.get("city")).trim(),
          url: String(f.get("url") ?? "").trim(),
          valid_until: new Date(
            String(f.get("valid_until")) + "T23:59:59",
          ).toISOString(),
        })
        .select()
        .single();
      if (r.error) throw r.error;
      const code = String(f.get("code") ?? "").trim();
      if (code) {
        const c = await clubDb()
          .from("svoya_benefit_codes")
          .insert({ benefit_id: r.data.id, code });
        if (c.error) {
          toast.error(
            "Пропозиція збережена, але код не додано. Передай його команді перед схваленням.",
          );
          throw c.error;
        }
      }
      toast.success("Пропозицію передано на перевірку.");
      setForm(false);
      setRevision((x) => x + 1);
    });
  }
  const published = items.filter(
    (i) =>
      i.status === "published" &&
      Date.parse(i.valid_until) > Date.now() &&
      (city === "Усі міста" || i.city === city),
  );
  return (
    <>
      <FeatureHeader eyebrow="ПЕРЕВАГИ УЧАСТІ" title="Приємно бути своєю.">
        Пропозиції від місцевих партнерів з прозорими умовами. Код або спосіб
        отримання доступні схваленим учасницям.
      </FeatureHeader>
      <button
        className="sv-outline"
        onClick={() =>
          !profile
            ? onLogin()
            : profile.membership_status !== "approved"
              ? toast.info("Публікації доступні після схвалення анкети.")
              : setForm(!form)
        }
      >
        {form ? "Закрити форму" : "Запропонувати привілей"}
      </button>
      {form && profile && (
        <form className="sv-form sv-feature-box" onSubmit={submit}>
          <h2>Пропозиція для учасниць</h2>
          <label>
            Назва
            <input name="title" required minLength={3} maxLength={120} />
          </label>
          <label>
            Партнер / заклад
            <input name="provider" required minLength={2} maxLength={120} />
          </label>
          <label>
            Що пропонуєте
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={3000}
            />
          </label>
          <label>
            Повні умови та обмеження
            <textarea name="terms" required minLength={5} maxLength={2000} />
          </label>
          <label>
            Місто
            <input
              name="city"
              required
              minLength={2}
              maxLength={80}
              defaultValue={profile.city}
            />
          </label>
          <label>
            Посилання партнера
            <input
              name="url"
              type="url"
              pattern="https://.*"
              placeholder="https://"
              maxLength={2000}
            />
          </label>
          <label>
            Діє до
            <input
              name="valid_until"
              type="date"
              required
              min={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <label>
            Код для учасниць (необов’язково)
            <input name="code" maxLength={200} />
            <small>Не показується у відкритій стрічці.</small>
          </label>
          <label className="sv-check">
            <input type="checkbox" required />
            Маю право опублікувати цю пропозицію від імені партнера.
          </label>
          <button className="sv-btn" disabled={busy}>
            Надіслати на перевірку
          </button>
        </form>
      )}
      {error ? (
        <ErrorState retry={() => setRevision((x) => x + 1)} />
      ) : loading ? (
        <p role="status">Завантажуємо привілеї…</p>
      ) : !published.length ? (
        <EmptyState title="Місце для перших партнерів">
          <p>
            У цьому місті поки немає перевірених активних пропозицій. Тут
            з’являться реальні привілеї після погодження з партнерами.
          </p>
        </EmptyState>
      ) : (
        <div className="sv-benefit-grid">
          {published.map((i) => (
            <article className="sv-benefit-card" key={i.id}>
              <span className="sv-overline">
                {i.provider} · {i.city}
              </span>
              <h2>{i.title}</h2>
              <p>{i.description}</p>
              <details>
                <summary>Умови пропозиції</summary>
                <p>{i.terms}</p>
                <p>До {new Date(i.valid_until).toLocaleDateString("uk-UA")}</p>
                {i.url && (
                  <a href={i.url} target="_blank" rel="noopener noreferrer">
                    Сторінка партнера ↗
                  </a>
                )}
              </details>
              <button
                className="sv-btn"
                disabled={busy}
                onClick={() => {
                  if (!profile) {
                    onLogin();
                    return;
                  }
                  void run(async () => {
                    const r = await action("claim_benefit", { id: i.id });
                    setCodes((s) => ({ ...s, [i.id]: r.code }));
                  });
                }}
              >
                Отримати привілей
              </button>
              {codes[i.id] && (
                <p className="sv-benefit-code" role="status">
                  {codes[i.id]}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      {items.some(
        (i) => i.owner_id === profile?.id && i.status !== "published",
      ) && (
        <details className="sv-feature-box">
          <summary>Мої пропозиції на розгляді</summary>
          {items
            .filter(
              (i) => i.owner_id === profile?.id && i.status !== "published",
            )
            .map((i) => (
              <p key={i.id}>
                {i.title} —{" "}
                {i.status === "pending"
                  ? "очікує перевірки"
                  : i.status === "rejected"
                    ? "не погоджено"
                    : "архів"}
              </p>
            ))}
        </details>
      )}
    </>
  );
}
export function StoryCard({ story: s }: { story: Story }) {
  return (
    <article className="sv-story-card">
      {s.image_paths?.[0] && (
        <img src={publicPhoto(s.image_paths[0])} alt={s.title} loading="lazy" />
      )}
      <div>
        <span className="sv-overline">
          {s.kind === "host"
            ? "ЗНАЙОМСТВО З ОРГАНІЗАТОРКОЮ"
            : "ІСТОРІЯ ЗУСТРІЧІ"}{" "}
          · {s.city}
        </span>
        <h3>{s.title}</h3>
        <p>{s.body}</p>
        {s.image_paths?.length > 1 && (
          <div className="sv-public-gallery">
            {s.image_paths.slice(1).map((path) => (
              <a
                key={path}
                href={publicPhoto(path)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={publicPhoto(path)}
                  alt="Фото зі згоди учасниць"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
export function Stories({
  profile,
  entries,
  members,
  onLogin,
  city,
}: {
  profile: Profile | null;
  entries: Entry[];
  members: Membership[];
  onLogin: () => void;
  city: string;
}) {
  const [items, setItems] = useState<Story[]>([]),
    [form, setForm] = useState(false),
    [kind, setKind] = useState("story"),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const { busy, run } = useTask();
  useEffect(() => {
    let active = true;
    setLoading(true);
    clubDb()
      .from("svoya_stories")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80)
      .then((r) => {
        if (active) {
          setItems(r.data ?? []);
          setError(!!r.error);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [revision, profile?.id]);
  const past = entries.filter(
    (e) =>
      !e.is_demo &&
      e.starts_at &&
      Date.parse(e.starts_at) < Date.now() &&
      (e.owner_id === profile?.id ||
        members.some(
          (m) =>
            m.entry_id === e.id &&
            m.user_id === profile?.id &&
            m.status === "joined",
        )),
  );
  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!profile) return;
    const formElement = ev.currentTarget;
    const f = new FormData(formElement);
    await run(async () => {
      const paths = await uploadPublicImages(
        (formElement.elements.namedItem("images") as HTMLInputElement).files,
        profile.id,
      );
      try {
        const r = await clubDb()
          .from("svoya_stories")
          .insert({
            owner_id: profile.id,
            kind,
            entry_id: kind === "story" ? String(f.get("entry_id")) : null,
            title: String(f.get("title")).trim(),
            body: String(f.get("body")).trim(),
            city: profile.city,
            image_paths: paths,
            public_consent: true,
          });
        if (r.error) throw r.error;
        setForm(false);
        setRevision((x) => x + 1);
        toast.success("Публікацію передано команді на перевірку.");
      } catch (e) {
        if (paths.length)
          await clubDb().storage.from("svoya-community").remove(paths);
        throw e;
      }
    });
  }
  const published = items.filter(
    (i) =>
      i.status === "published" && (city === "Усі міста" || i.city === city),
  );
  return (
    <>
      <FeatureHeader
        eyebrow="ЖИВИЙ КЛУБ"
        title="Люди та моменти, що залишаються."
      >
        Знайомства з організаторками, розповіді й фото з наших зустрічей — за
        згодою учасниць.
      </FeatureHeader>
      <button
        className="sv-outline"
        onClick={() =>
          !profile
            ? onLogin()
            : profile.membership_status !== "approved"
              ? toast.info("Публікації доступні після схвалення анкети.")
              : setForm(!form)
        }
      >
        {form ? "Закрити форму" : "Поділитися історією / представитися"}
      </button>
      {form && profile && (
        <form className="sv-form sv-feature-box" onSubmit={submit}>
          <label>
            Що публікуємо
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="story">Історію зустрічі</option>
              <option value="host">Знайомство зі мною як організаторкою</option>
            </select>
          </label>
          {kind === "story" && (
            <label>
              Зустріч, у якій ти брала участь
              <select name="entry_id" required defaultValue="">
                <option value="" disabled>
                  Обери минулу зустріч
                </option>
                {past.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
              {!past.length && (
                <small>
                  Після першої підтвердженої зустрічі тут можна буде додати
                  історію. Зараз можна представитися як організаторка.
                </small>
              )}
            </label>
          )}
          <label>
            Заголовок
            <input name="title" required minLength={3} maxLength={120} />
          </label>
          <label>
            {kind === "host"
              ? "Про тебе, твій досвід і зустрічі, які плануєш"
              : "Як пройшла зустріч"}
            <textarea name="body" required minLength={20} maxLength={5000} />
          </label>
          <PhotoUpload />
          <label className="sv-check">
            <input type="checkbox" required />
            Даю згоду на публікацію на сайті клубу. Маю згоду всіх зображених
            людей.
          </label>
          <button
            className="sv-btn"
            disabled={busy || (kind === "story" && !past.length)}
          >
            Передати на перевірку
          </button>
        </form>
      )}
      {error ? (
        <ErrorState retry={() => setRevision((x) => x + 1)} />
      ) : loading ? (
        <p role="status">Завантажуємо історії…</p>
      ) : !published.length ? (
        <EmptyState title="Наша історія ще пишеться">
          <p>
            Тут з’являться справжні організаторки та спогади з перших зустрічей.
            Можеш поділитися своїми через форму вище.
          </p>
        </EmptyState>
      ) : (
        <div className="sv-story-grid">
          {published.map((s) => (
            <StoryCard key={s.id} story={s} />
          ))}
        </div>
      )}
      {items.some(
        (i) => i.owner_id === profile?.id && i.status !== "published",
      ) && (
        <details className="sv-feature-box">
          <summary>Мої публікації</summary>
          {items
            .filter(
              (i) => i.owner_id === profile?.id && i.status !== "published",
            )
            .map((i) => (
              <p key={i.id}>
                {i.title} —{" "}
                {i.status === "pending"
                  ? "очікує перевірки"
                  : i.status === "rejected"
                    ? "не погоджено"
                    : "архів"}
              </p>
            ))}
        </details>
      )}
    </>
  );
}
