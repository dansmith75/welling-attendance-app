// Retry a completed Matchday if the Full Time Supabase save failed.
// The completed Matchday remains in localStorage until it has been saved or reset.
(() => {
  const resetButton = document.getElementById("matchday-reset");
  const saveStatus = document.getElementById("matchday-save-status");
  if (!resetButton || !saveStatus || typeof state === "undefined") return;

  const retryButton = document.createElement("button");
  retryButton.id = "matchday-retry-save";
  retryButton.type = "button";
  retryButton.className = "primary-button matchday-wide hidden";
  retryButton.textContent = "Retry Save to Supabase";
  resetButton.parentNode.insertBefore(retryButton, resetButton);

  function updateRetryVisibility() {
    retryButton.classList.toggle("hidden", state.status !== "finished" || Boolean(state.supabaseId));
  }

  const originalRenderFinished = renderFinished;
  renderFinished = function () {
    originalRenderFinished();
    updateRetryVisibility();
    if (state.status === "finished" && !state.supabaseId) {
      saveStatus.textContent = "Not yet saved centrally. Retry when you have a data connection.";
    }
  };

  retryButton.addEventListener("click", async () => {
    if (state.status !== "finished" || state.supabaseId) return;
    retryButton.disabled = true;
    retryButton.textContent = "Saving...";
    saveStatus.textContent = "Saving Matchday to Supabase...";
    try {
      const finalSecond = Number(state.accumulatedSeconds || 0);
      state.supabaseId = await saveToSupabase(payload(finalSecond));
      saveState();
      saveStatus.textContent = `Saved to Supabase · ${state.supabaseId.slice(0, 8)}`;
      updateRetryVisibility();
    } catch (error) {
      console.error(error);
      saveStatus.textContent = "Save failed again. Matchday is still safe on this device; retry when connected.";
    } finally {
      retryButton.disabled = false;
      retryButton.textContent = "Retry Save to Supabase";
    }
  });

  updateRetryVisibility();
})();
