// ISOLATED world content script (group 0).
// Runs before the MAIN world entry so that bridge injection shifts
// array positions — this catches canonical-index vs array-position bugs.
console.log('[content-main-world] isolated-one loaded (ISOLATED world)')
