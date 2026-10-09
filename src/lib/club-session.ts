/** Push housekeeping must not stop or indefinitely delay sign-out. */
export async function endClubSession(
  cleanupPush: () => Promise<unknown>,
  signOut: () => Promise<{ error: unknown }>,
  timeoutMs = 3000,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pushCleanupFailed = false;
  try {
    await Promise.race([
      Promise.resolve().then(cleanupPush),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('PUSH_CLEANUP_TIMEOUT')), timeoutMs); }),
    ]);
  } catch { pushCleanupFailed = true; }
  finally { clearTimeout(timer); }
  const result = await signOut();
  if (result.error) throw result.error;
  return { pushCleanupFailed };
}
