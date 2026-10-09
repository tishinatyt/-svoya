import { useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { clubDb } from "@/lib/club-db";
import { toast } from "sonner";
import { useTask, authRedirect } from "./shared";
import { loginAddress, registerUsername, usernameFor, usernameRegistration } from "@/lib/club-login";
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
  const usernameSignup = usernameRegistration() && mode === "signup";
  const savedUsername = usernameFor(user);
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
        setNotice("Пароль оновлено. Збережи його для наступного входу.");
        onComplete();
        return;
      }
      if (mode === "reset") {
        if (!email.includes('@')) {
          setNotice("Для акаунта за логіном відновлення через пошту недоступне. Якщо ти ще ввійшла на іншому пристрої, зміни пароль у своєму профілі. Збережи новий пароль у менеджері паролів.");
          return;
        }
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
        const r = await clubDb().auth.signInWithPassword({ email: loginAddress(email), password });
        if (r.error) throw r.error;
        toast.success("Ти увійшла до клубу.");
        onComplete();
        return;
      }
      if (usernameSignup) {
        if (password !== String(f.get("confirmPassword") ?? "")) throw new Error('SV_PASSWORD_MISMATCH');
        await registerUsername(String(f.get("username") ?? ""),password,anonymous);
        toast.success("Акаунт створено. Збережи свій логін і пароль.");
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
          "Якщо це новий email, очікуй лист підтвердження. Якщо акаунт уже існує, скористайся входом або відновленням пароля.",
        );
    });
  }
  if (user && !anonymous && !recovery && mode !== "password")
    return (
      <div className="sv-account-box">
        <div>
          <span className="sv-overline">ПОСТІЙНИЙ АКАУНТ</span>
          <h3>Твій профіль збережений</h3>
          <p>{savedUsername ? `Логін: ${savedUsername}` : user.email}</p>
          <small>Можна увійти з іншого пристрою за {savedUsername ? "логіном" : "email"} і паролем.</small>
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
            {usernameSignup ? "Обери логін і пароль для цього профілю. Фото й заявки залишаться з тобою. Не виходь до завершення." : "Прив’яжи email до цього швидкого профілю. Після підтвердження створи пароль. Не виходь з акаунта до завершення."}
          </p>
          {emailPending && !usernameSignup && (
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
      {usernameSignup && <p className="sv-notice">Тимчасово реєструємо без email. Збережи логін і пароль: відновлення через пошту для такого акаунта недоступне.</p>}
      <form className="sv-form" onSubmit={submit}>
        {usernameSignup ? (
          <label>Логін
            <input name="username" type="text" required minLength={3} maxLength={24} pattern="[A-Za-z0-9][A-Za-z0-9_]{2,23}" autoComplete="username" autoCapitalize="none" spellCheck={false} />
            <small>3–24 латинські літери, цифри або _. Без пробілів.</small>
          </label>
        ) : mode !== "password" && (
          <label>
            {mode === "signup" ? "Email" : "Логін або email"}
            <input name="email" type={mode === "signup" ? "email" : "text"} required autoComplete={mode === "signup" ? "email" : "username"} autoCapitalize="none" spellCheck={false} />
          </label>
        )}
        {(!anonymous || usernameSignup) && mode !== "reset" && (
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
        {usernameSignup && <label>Повтори пароль<input name="confirmPassword" type="password" required minLength={10} maxLength={128} autoComplete="new-password" /></label>}
        <button className="sv-btn" disabled={busy}>
          {busy
            ? "Зачекай…"
            : anonymous && !usernameSignup
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
      {anonymous && !usernameSignup && (
        <small>
          Якщо email уже зайнятий іншим акаунтом, прив’яжи інший власний email.
          Дані різних акаунтів автоматично не об’єднуються.
        </small>
      )}
    </div>
  );
}
