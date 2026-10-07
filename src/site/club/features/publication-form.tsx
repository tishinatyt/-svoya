import { useState, type FormEvent } from "react";
import { clubDb } from "@/lib/club-db";
import {
  labels,
  categories,
  type Kind,
  type Profile,
  type Entry,
} from "@/lib/club-types";
import { toast } from "sonner";
import { PhotoUpload, uploadPublicImages, useTask } from "./shared";
export default function PublicationForm({
  profile,
  initialKind,
  initialFormat = "standard",
  onPublished,
}: {
  profile: Profile;
  initialKind: Kind;
  initialFormat?: "standard" | "coffee" | "quick";
  onPublished: (e: Entry) => void;
}) {
  const [kind, setKind] = useState(initialKind),
    [format, setFormat] = useState(initialFormat),
    [category, setCategory] = useState(categories[initialKind][0]);
  const { busy, run } = useTask();
  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    await run(async () => {
      const start = String(f.get("starts_at") ?? ""),
        end = String(f.get("ends_at") ?? "");
      const starts = start ? new Date(start) : null;
      const ends = end
        ? new Date(end)
        : starts
          ? new Date(starts.getTime() + 60 * 60000)
          : null;
      if (kind === "event" && (!starts || starts.getTime() <= Date.now())) {
        toast.error("Обери майбутню дату.");
        return;
      }
      if (starts && ends && ends <= starts) {
        toast.error("Завершення має бути після початку.");
        return;
      }
      if (
        kind === "event" &&
        format === "quick" &&
        starts &&
        starts.getTime() > Date.now() + 24 * 3600000
      ) {
        toast.error("Швидкий план — на найближчі 24 години.");
        return;
      }
      const input = form.elements.namedItem("images") as HTMLInputElement;
      const paths = await uploadPublicImages(input.files, profile.id);
      try {
        const actualFormat = kind === "event" ? format : "standard";
        const r = await clubDb()
          .from("svoya_entries")
          .insert({
            owner_id: profile.id,
            kind,
            format: actualFormat,
            title: String(f.get("title")).trim(),
            description: String(f.get("description")).trim(),
            city: String(f.get("city")).trim(),
            category,
            location: String(f.get("location") ?? "").trim(),
            district: String(f.get("district") ?? "").trim(),
            starts_at: starts?.toISOString() ?? null,
            ends_at: ends?.toISOString() ?? null,
            expires_at: actualFormat === "quick" ? ends?.toISOString() : null,
            capacity:
              kind === "event" && format === "coffee"
                ? Number(f.get("capacity")) - 1
                : Number(f.get("capacity") ?? 12),
            price: Number(f.get("price") ?? 0),
            recurrence_note: String(f.get("recurrence_note") ?? "").trim(),
            welcome_newcomers: f.has("welcome_newcomers"),
            shelter_info: String(f.get("shelter_info") ?? "").trim(),
            accessibility_info: String(
              f.get("accessibility_info") ?? "",
            ).trim(),
            children_welcome: f.has("children_welcome"),
            image_paths: paths,
          })
          .select()
          .single();
        if (r.error) throw r.error;
        toast.success("Опубліковано у клубі.");
        onPublished(r.data);
      } catch (e) {
        if (paths.length)
          await clubDb().storage.from("svoya-community").remove(paths);
        throw e;
      }
    });
  }
  return (
    <form className="sv-form" onSubmit={submit}>
      <label>
        Тип публікації
        <select
          value={kind}
          onChange={(e) => {
            const v = e.target.value as Kind;
            setKind(v);
            setCategory(categories[v][0]);
          }}
        >
          {Object.entries(labels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {kind === "event" && (
        <label>
          Формат
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as typeof format)}
          >
            <option value="standard">Зустріч клубу</option>
            <option value="coffee">Кава на чотирьох · 4–6 разом з тобою</option>
            <option value="quick">Маю годину · найближчі 24 години</option>
          </select>
          <small>
            {format === "coffee"
              ? "Ти обираєш місце і час, запрошуєш 3–5 учасниць та підтверджуєш заявки."
              : format === "quick"
                ? "Після завершення оголошення автоматично зникне з публічної стрічки."
                : "Зустріч з власною програмою та кількістю місць."}
          </small>
        </label>
      )}
      <label>
        Назва
        <input
          name="title"
          required
          minLength={3}
          maxLength={120}
          placeholder={
            format === "coffee"
              ? "Кава та знайомство у маленькому колі"
              : "Що плануємо?"
          }
        />
      </label>
      <label>
        Категорія
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories[kind].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        Опис
        <textarea
          name="description"
          required
          minLength={10}
          maxLength={5000}
          placeholder="Для кого, що буде та що варто знати"
        />
      </label>
      <div className="sv-two-fields">
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
          Район
          <input
            name="district"
            maxLength={80}
            defaultValue={profile.district}
          />
        </label>
      </div>
      {["event", "circle"].includes(kind) && (
        <label>
          {kind === "event" && format === "coffee"
            ? "Разом з організаторкою"
            : "Кількість місць для учасниць (без організаторки)"}
          <input
            key={format}
            name="capacity"
            type="number"
            required
            min={format === "coffee" ? 4 : 2}
            max={format === "coffee" ? 6 : 500}
            defaultValue={format === "coffee" ? 4 : format === "quick" ? 4 : 12}
          />
        </label>
      )}
      {kind === "event" && (
        <div className="sv-two-fields">
          <label>
            Початок
            <input name="starts_at" type="datetime-local" required />
          </label>
          <label>
            Завершення
            <input
              name="ends_at"
              type="datetime-local"
              required={format === "quick"}
            />
          </label>
          <small>
            Часовий пояс пристрою:{" "}
            {Intl.DateTimeFormat().resolvedOptions().timeZone}. У клубі час
            показуємо за Києвом.
          </small>
        </div>
      )}
      {kind === "circle" && (
        <label>
          Як часто зустрічаємося
          <input
            name="recurrence_note"
            maxLength={180}
            placeholder="Наприклад, друга субота щомісяця"
          />
          <small>Окремі зустрічі кола публікуй як події з датою.</small>
        </label>
      )}
      <label>
        Місце / заклад
        <input
          name="location"
          maxLength={180}
          placeholder="Назва закладу. Не публікуй домашню адресу."
        />
      </label>
      {["event", "beauty", "business"].includes(kind) && (
        <label>
          Вартість, грн
          <input
            name="price"
            type="number"
            min={0}
            max={99999999}
            step="0.01"
            defaultValue={0}
          />
          <small>
            0 — без оплати за участь / за домовленістю. Оплата напряму.
          </small>
        </label>
      )}
      {["event", "circle"].includes(kind) && (
        <>
          <label className="sv-check">
            <input type="checkbox" name="welcome_newcomers" defaultChecked />
            Рада новеньким, допоможу познайомитися
          </label>
          <label className="sv-check">
            <input type="checkbox" name="children_welcome" />
            Можна з дітьми
          </label>
          <label>
            Укриття та дії під час тривоги
            <textarea
              name="shelter_info"
              maxLength={500}
              rows={2}
              placeholder="Уточни найближче укриття і домовленості групи"
            />
          </label>
          <label>
            Доступність місця
            <input
              name="accessibility_info"
              maxLength={500}
              placeholder="Сходи, пандус, доступний туалет — що перевірено"
            />
          </label>
        </>
      )}
      <PhotoUpload />
      <label className="sv-check">
        <input type="checkbox" required />
        Погоджуюсь на публічне розміщення тексту й фото та маю дозвіл зображених
        людей.
      </label>
      <button className="sv-btn" disabled={busy}>
        {busy ? "Публікуємо…" : "Опублікувати"}
      </button>
    </form>
  );
}
