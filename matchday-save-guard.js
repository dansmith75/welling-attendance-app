// Guard completed Matchday submissions against duplicate saves and avoid
// showing Retry while the original Full Time save is still in flight.
(() => {
  if (typeof saveCompletedToSupabase !== "function" || typeof ensureRetryButton !== "function") return;

  const originalSaveCompletedToSupabase = saveCompletedToSupabase;
  const originalEnsureRetryButton = ensureRetryButton;
  let completedSavePromise = null;
  let retryTimer = null;

  window.saveCompletedToSupabase = async function guardedSaveCompletedToSupabase(data) {
    if (state?.supabaseId) return state.supabaseId;
    if (completedSavePromise) return completedSavePromise;

    completedSavePromise = (async () => {
      const client = getSupabaseClient();

      // If this exact Matchday was already saved, reuse it rather than inserting again.
      if (data?.matchId && data?.startedAt) {
        const { data: existing, error: lookupError } = await client
          .from("matchday_sessions")
          .select("id")
          .eq("match_id", data.matchId)
          .eq("started_at", data.startedAt)
          .order("created_at", { ascending: false })
          .limit(1);

        if (lookupError) throw lookupError;
        if (existing?.length) return existing[0].id;
      }

      return originalSaveCompletedToSupabase(data);
    })();

    try {
      return await completedSavePromise;
    } finally {
      completedSavePromise = null;
    }
  };

  window.ensureRetryButton = function guardedEnsureRetryButton() {
    if (state?.supabaseId) {
      document.getElementById("matchday-retry-save")?.remove();
      return;
    }

    // A genuine failure explicitly sets the status text before asking for Retry.
    if (String(md?.saveStatus?.textContent || "").startsWith("Save failed")) {
      originalEnsureRetryButton();
      return;
    }

    // renderFinished() runs just before the initial async save starts. Give that
    // save time to complete rather than immediately presenting a misleading Retry.
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (state?.supabaseId) return;
      const status = String(md?.saveStatus?.textContent || "");
      if (status.startsWith("Saving Matchday")) return;
      if (status.startsWith("Save failed")) originalEnsureRetryButton();
    }, 2500);
  };
})();
