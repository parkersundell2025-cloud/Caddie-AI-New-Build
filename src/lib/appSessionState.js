// App-level session state tracker
// Detects whether Coach is being opened fresh or returning within an active session
// This is memory-only and resets naturally when app process is killed

let appSessionStarted = false;
let coachOpenedThisSession = false;

export const initializeAppSession = () => {
  if (!appSessionStarted) {
    appSessionStarted = true;
    coachOpenedThisSession = false;
  }
};

export const isCoachFreshOpen = () => {
  return !coachOpenedThisSession;
};

export const markCoachAsOpened = () => {
  coachOpenedThisSession = true;
};

export const resetCoachSessionFlag = () => {
  coachOpenedThisSession = false;
};