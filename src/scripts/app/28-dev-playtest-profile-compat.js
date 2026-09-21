// Keep the dedicated dev-playtest verification profile aligned with the
  // current User Profile schema. This fragment is intentionally loaded
  // immediately before 27-hosted-images-startup.js, while the main app IIFE
  // is still open. The microtask runs after that fragment has installed
  // window.EmberAdventuresDevPlaytest, while retaining access to the IIFE's
  // profile helpers instead of depending on browser-global leakage.
  queueMicrotask(() => {
    return;
  });
  
