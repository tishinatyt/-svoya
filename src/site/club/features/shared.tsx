import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { clubDb } from "@/lib/club-db";
import { siteUrl } from "@/lib/site-path";
export const publicPhoto = (path: string) =>
  clubDb().storage.from("svoya-community").getPublicUrl(path).data.publicUrl;
export function messageFor(error: unknown) {
  const msg = String((error as { message?: string })?.message ?? "");
  const errors: Record<string, string> = {
    SV_REVIEW_PENDING: "Анкета очікує на схвалення команди клубу.",
    SV_USERNAME_INVALID: "Логін: 3–24 латинські літери, цифри або _. Обери власне ім’я без пробілів.",
    SV_USERNAME_TAKEN: "Цей логін уже зайнятий. Обери інший або увійди до свого акаунта.",
    SV_PASSWORD_LENGTH: "Пароль має містити від 10 до 128 символів.",
    SV_PASSWORD_MISMATCH: "Паролі не збігаються. Перевір повторення.",
    SV_SIGNUP_LIMIT: "Забагато спроб реєстрації. Спробуй пізніше.",
    SV_REGISTRATION_UNAVAILABLE: "Реєстрація зараз недоступна. Спробуй ще раз трохи пізніше.",
    SV_SESSION_REQUIRED: "Сесію завершено. Онови сторінку та спробуй знову.",
    SV_ACCOUNT_ALREADY_SAVED: "Цей акаунт уже збережено. Скористайся входом.",
    SV_CREATED_LOGIN_AGAIN: "Акаунт створено. Відкрий «Вхід» і введи свій логін та пароль.",
    SV_EMAIL_REQUIRED:
      "Спершу потрібно підтвердити email і зберегти постійний акаунт.",
    SV_ADMIN_ONLY: "Ця дія доступна команді клубу.",
    SV_TITLE_INVALID: "Обери титул зі списку.",
    SV_TITLE_REASON: "Опиши підтверджений внесок: від 10 до 1000 символів.",
    SV_TITLE_APPROVAL: "Спочатку схвали анкету учасниці.",
    SV_TITLE_CONFLICT: "Інший модератор уже змінив титул. Переглянь оновлену анкету й повтори рішення.",
    SV_UNAVAILABLE: "Зараз це знайомство недоступне.",
    SV_ALREADY_JOINED: "Твоя заявка вже є у списку.",
    SV_CLOSED: "Зустріч уже закрито або вона недоступна.",
    SV_FULL: "Усі місця зайняті. Онови сторінку, щоб перевірити чергу.",
    SV_EXPIRED: "Термін пропозиції завершився.",
    SV_BLOCKED: "Контакт недоступний.",
    SV_GREETER_INVALID:
      "Обери організаторку або підтверджену учасницю, яка погодилась зустрічати новеньких.",
    SV_IMAGE_LIMIT: "Можна завантажити до 6 фото за раз.",
    SV_QUICK_TIME: "Швидкий план має починатися в найближчі 24 години.",
    SV_IMAGE_INVALID: "Не вдалося підтвердити завантажене фото.",
    "Invalid login credentials": "Перевір логін або email і пароль.",
    "Email not confirmed": "Підтвердь email за посиланням у листі.",
    "rate limit": "Забагато спроб. Спробуй пізніше.",
    "User already registered":
      "Цей email уже зареєстрований. Скористайся входом або відновленням.",
    "duplicate key": "Таке запрошення або заявка вже існує.",
  };
  return (
    Object.entries(errors).find(([k]) => msg.includes(k))?.[1] ??
    "Не вдалося виконати дію. Перевір з’єднання та спробуй ще раз."
  );
}
export async function action(name: string, data: Record<string, unknown> = {}) {
  const r = await clubDb().rpc("svoya_community_action", {
    action: name,
    data,
  });
  if (r.error) throw r.error;
  return r.data;
}
export function useTask() {
  const [busy, setBusy] = useState(false);
  return {
    busy,
    run: async (fn: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      try {
        await fn();
      } catch (e) {
        toast.error(messageFor(e));
      } finally {
        setBusy(false);
      }
    },
  };
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="sv-feature-empty">
      <span className="sv-overline">СВОЯ · ЖІНОЧИЙ КЛУБ</span>
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  );
}
export function FeatureHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="sv-feature-heading">
      <p className="sv-overline">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{children}</p>
    </div>
  );
}
export function SignInPrompt({ onLogin }: { onLogin: () => void }) {
  return (
    <EmptyState title="Тут починається твоє коло">
      <p>Створи профіль жіночого клубу або увійди, щоб долучитися.</p>
      <button className="sv-btn" onClick={onLogin}>
        Увійти / зареєструватися
      </button>
    </EmptyState>
  );
}
export function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div className="sv-error" role="alert">
      Не вдалося завантажити дані.{" "}
      <button onClick={retry}>Спробувати ще</button>
    </div>
  );
}
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
export const authRedirect = () =>
  `${location.origin}${siteUrl("/club?section=profile")}`;
export async function uploadPublicImages(
  files: FileList | null,
  userId: string,
) {
  if ((files?.length ?? 0) > 6) throw Error("SV_IMAGE_LIMIT");
  const paths: string[] = [];
  try {
    for (const file of Array.from(files ?? []).slice(0, 6)) {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 6 * 1024 * 1024
      )
        throw Error("SV_IMAGE_INVALID");
      const image = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas
        .getContext("2d")!
        .drawImage(image, 0, 0, canvas.width, canvas.height);
      image.close();
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(
          (b) => (b ? res(b) : rej(Error("SV_IMAGE_INVALID"))),
          "image/webp",
          0.86,
        ),
      );
      const path = `${userId}/${crypto.randomUUID()}.webp`;
      const r = await clubDb()
        .storage.from("svoya-community")
        .upload(path, blob, { contentType: "image/webp" });
      if (r.error) throw r.error;
      paths.push(path);
    }
    return paths;
  } catch (e) {
    if (paths.length)
      await clubDb().storage.from("svoya-community").remove(paths);
    throw e;
  }
}
export function PhotoUpload() {
  return (
    <label>
      Фото для публікації{" "}
      <input
        type="file"
        name="images"
        accept="image/jpeg,image/png,image/webp"
        multiple
      />
      <small>
        До 6 фото, кожне до 6 МБ. Фото будуть загальнодоступними. Завантажуй
        лише з дозволу всіх зображених людей.
      </small>
    </label>
  );
}
