// Explicit persistence hooks for Matchday resilience.
(() => {
  if (typeof state === "undefined" || typeof md === "undefined") return;

  const AUTOSAVE_MS = 3 * 60 * 1000;
  let busy = false;

  async function saveRecovery(reason) {
    if (busy || !["running", "paused"].includes(state.status)) return;
    if (typeof isSupabaseConfigured !== "function" || !isSupabaseConfigured()) return;
    busy = true;
    try {
      const seconds = elapsedSeconds();
      const data = payload(seconds);
      data.recovery = { live: true, reason, savedAt: new Date().toISOString() };
      const row = {
        team: data.team,
        season: data.season,
        match_id: data.matchId,
        match_date: data.fixture?.date || null,
        opposition: data.fixture?.opposition || null,
        submitted_by: data.submittedBy,
        started_at: data.startedAt,
        saved_at: new Date().toISOString(),
        reason,
        match_seconds: data.matchSeconds,
        payload: data
      };
      const client = getSupabaseClient();
      if (state.recoveryId) {
        const { error } = await client.from("matchday_recovery").update(row).eq("id", state.recoveryId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await client.from("matchday_recovery").insert(row).select("id").single();
        if (error) throw error;
        state.recoveryId = inserted.id;
        saveState();
      }
    } catch (error) {
      console.warn("Matchday recovery save failed", error);
    } finally {
      busy = false;
    }
  }

  async function clearRecovery(recoveryId = state.recoveryId) {
    if (!recoveryId || typeof isSupabaseConfigured !== "function" || !isSupabaseConfigured()) return;
    try {
      await getSupabaseClient().from("matchday_recovery").delete().eq("id", recoveryId);
    } catch (error) {
      console.warn("Could not clear Matchday recovery row", error);
    }
    if (state.recoveryId === recoveryId) {
      state.recoveryId = null;
      saveState();
    }
  }

  function afterCoreAction(fn) {
    window.setTimeout(fn, 0);
  }

  md.start?.addEventListener("click", () => afterCoreAction(() => {
    if (state.status !== "running") return;
    state.recoveryId = null;
    state.safetyStopTriggered = false;
    saveState();
    saveRecovery("kickoff");
  }));

  md.pause?.addEventListener("click", () => afterCoreAction(() => {
    if (state.status === "paused") saveRecovery("pause");
  }));

  md.resume?.addEventListener("click", () => afterCoreAction(() => {
    if (state.status === "running") saveRecovery("resume");
  }));

  md.fullTime?.addEventListener("click", () => {
    let checks = 0;
    const timer = window.setInterval(() => {
      checks += 1;
      if (state.status === "finished" && state.supabaseId) {
        window.clearInterval(timer);
        clearRecovery();
      } else if (checks >= 30) {
        window.clearInterval(timer);
      }
    }, 500);
  });

  document.addEventListener("click", (event) => {
    if (event.target?.id !== "matchday-cancel") return;
    const recoveryId = state.recoveryId;
    afterCoreAction(() => {
      if (state.status === "setup") clearRecovery(recoveryId);
    });
  });

  window.setInterval(() => saveRecovery("interval"), AUTOSAVE_MS);

  if (["running", "paused"].includes(state.status)) {
    saveRecovery("app-reopen");
  }
})();
