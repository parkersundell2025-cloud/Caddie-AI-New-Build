// The plan generator's LLM writes session_type variants ("Rest Day",
// "Rest & Recovery", "Recovery") — exact-string checks miss them and render
// rest days as workable sessions. Match on intent instead.
export const isRestSession = (session) =>
  !session || /rest|recovery/i.test(session.session_type || '');
