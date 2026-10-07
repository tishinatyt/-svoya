import { useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { clubDb } from "@/lib/club-db";
import { toast } from "sonner";
import { useTask, authRedirect } from "./shared";
export default function AuthPanel({
  user,
  recovery = false,
  onComplete,
}: {
  user: User | null;
  recovery?: boolean;
  onComplete: () => void;
}) {
  const [mode, setMode] = useState<"signup" | "login" | "reset" | "password">(
    recovery ? "password" : "signup",
  );
  const [notice, setNotice] = useState("");
  const { busy, run } = useTask();
  const anonymous = !!user?.is_anonymous;
  const emailPending = anonymous && !!user?.new_email;
  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    await run(async () => {
      if (mode === "password") {
        const r = await clubDb().auth.updateUser({ password });
        if (r.error) throw r.error;
        toast.success("Пароль збережено.");
        setNotice("Тепер можна входити з email і цим паролем.");
        onComplete();
        return;
      }
      if (mode === "reset") {
        const r = await clubDb().auth.resetPasswordForEmail(email, {
          redirectTo: authRedirect(),
        });
        if (r.error) throw r.error;
        setNotice(
          "Якщо для цього email є акаунт, на нього надійде лист для відновлення. Перевір також «Спам».",
        );
        return;
      }
      if (mode === "login") {
        const r = await clubDb().auth.signInWithPassword({ email, password });
        if (r.error) throw r.error;
        toast.success("Ти увійшла до клубу.");
        onComplete();
        return;
      }
      if (anonymous) {
        const r = await clubDb().auth.updateUser(
          { email },
          { emailRedirectTo: authRedirect() },
        );
        if (r.error) throw r.error;
        setNotice(
          "Підтвердь email за посиланням у листі, повернися в цей профіль і створи пароль. Фото, заявки та повідомлення залишаться з тобою.",
        );
        return;
      }
      const r = await clubDb().auth.signUp({
        email,
        password,
        options: { emailRedirectTo: authRedirect() },
      });
      if (r.error) throw r.error;
      if (r.data.session) {
        onComplete();
      } else
        setNotice(
          "Ми надіслали лист. Підтвердь email, потім увійди та заповни анкету клубу.",
        );
    });
  }
  if (user && !anonymous && !recovery && mode !== "password")
    return (
      <div className="sv-account-box">
        <div>
          <span className="sv-overline">ПОСТІЙНИЙ АКАУНТ</span>
          <h3>Твій профіль збережений</h3>
          <p>{user.email}</p>
          <small>Можна увійти з іншого пристрою за email і паролем.</small>
        </div>
        <button className="sv-outline" onClick={() => setMode("password")}>
          Задати / змінити пароль
        </button>
      </div>
    );
  return (
    <div className="sv-auth-panel">
      {anonymous ? (
        <>
          <h3>Збережи свій профіль назавжди</h3>
          <p>
            Прив’яжи email до цього швидкого профілю. Після підтвердження створи
            пароль. Не виходь з акаунта до завершення.
          </p>
          {emailPending && (
            <p className="sv-notice">
              Чекаємо підтвердження: {user?.new_email}
            </p>
          )}
        </>
      ) : (
        mode !== "password" && (
          <div className="sv-segmented">
            {(["signup", "login", "reset"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => {
                  setMode(m);
                  setNotice("");
                }}
              >
                {m === "signup"
                  ? "Реєстрація"
                  : m === "login"
                    ? "Вхід"
                    : "Забула пароль"}
              </button>
            ))}
          </div>
        )
      )}
      <form className="sv-form" onSubmit={submit}>
        {mode !== "password" && (
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
        )}
        {!anonymous && mode !== "reset" && (
          <label>
            {mode === "password" ? "Новий пароль" : "Пароль"}
            <input
              name="password"
              type="password"
              minLength={mode === "login" ? 1 : 10}
              maxLength={128}
              required
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
            <small>{mode === "login" ? "" : "Щонайменше 10 символів."}</small>
          </label>
        )}
        <button className="sv-btn" disabled={busy}>
          {busy
            ? "Зачекай…"
            : anonymous
              ? "Надіслати підтвердження"
              : mode === "signup"
                ? "Створити акаунт"
                : mode === "login"
                  ? "Увійти"
                  : mode === "reset"
                    ? "Відновити доступ"
                    : "Зберегти пароль"}
        </button>
      </form>
      {notice && (
        <p className="sv-notice" role="status">
          {notice}
        </p>
      )}
      {anonymous && (
        <small>
          Якщо email уже зайнятий іншим акаунтом, прив’яжи інший власний email.
          Дані різних акаунтів автоматично не об’єднуються.
        </small>
      )}
    </div>
  );
}
