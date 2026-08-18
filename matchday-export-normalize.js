// Normalize Matchday events before they are persisted to Supabase.
// This keeps scorekeeping/UI behaviour unchanged while ensuring Excel imports
// do not treat an opponent own goal as a goal scored by one of our players.
(() => {
  if (typeof payload !== "function") return;

  const corePayload = payload;
  payload = function normalizedMatchdayPayload(finalSecond) {
    const data = corePayload(finalSecond);
    data.events = (data.events || []).map(event => {
      if (event?.type === "Goal" && event?.goalType === "Own Goal") {
        return {
          ...event,
          type: "Own Goal",
          playerId: ""
        };
      }
      return event;
    });
    return data;
  };
})();
