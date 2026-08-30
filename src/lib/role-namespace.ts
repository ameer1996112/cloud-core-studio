/**
 * Authorize a role route before attempting its optional locale chunk.
 * Keeping the namespace loader deferred guarantees a wrong-role redirect wins
 * even when the chunk request would fail.
 */
export async function loadAuthorizedRoleNamespace<T>(
  authorize: () => Promise<T>,
  ensureNamespace: () => Promise<void>,
): Promise<T> {
  const context = await authorize();
  await ensureNamespace();
  return context;
}
