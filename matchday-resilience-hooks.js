// Explicit hooks for Matchday resilience actions.
// Core Matchday event listeners were registered before the resilience extension,
// so these listeners run afterwards and react to the resulting state.
(() => {
  if (typeof state === "undefined" || typeof md === "undefined") return;

  function afterCoreAction(fn) {
    window.setTimeout(fn, 0);
  }

  md.start?.addEventListener("click", () => afterCoreAction(() => {
    if (state.status !== "running") return;
    // matchday-resilience.js detects this running state on its interval/autosave
    // path; force a reload-safe state write immediately after kickoff.
    state.safetyStopTriggered = false;
    saveState();
    window.dispatchEvent(new CustomEvent("welling-matchday-started"));
  }));

  md.pause?.addEventListener("click", () => afterCoreAction(() => {
    if (state.status === "paused") window.dispatchEvent(new CustomEvent("welling-matchday-paused"));
  }));

  md.resume?.addEventListener("click", () => afterCoreAction(() => {
    if (state.status === "running") window.dispatchEvent(new CustomEvent("welling-matchday-resumed"));
  }));

  md.fullTime?.addEventListener("click", () => {
    // finishMatch is async; wait briefly for the Supabase result, then notify
    // resilience code to clear the live recovery row if the final save worked.
    let checks = 0;
    const timer = window.setInterval(() => {
      checks += 1;
      if (state.status === "finished" && state.supabaseId) {
        window.clearInterval(timer);
        window.dispatchEvent(new CustomEvent("welling-matchday-finished"));
      } else if (checks >= 30) {
        window.clearInterval(timer);
      }
    }, 500);
  });

  document.addEventListener("click", (event) => {
    if (event.target?.id !== "matchday-cancel") return;
    const recoveryId = state.recoveryId;
    afterCoreAction(() => {
      if (state.status === "setup") {
        window.dispatchEvent(new CustomEvent("welling-matchday-cancelled", { detail: { recoveryId } }));
      }
    });
  });
})();
