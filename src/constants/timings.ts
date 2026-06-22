export const TIMINGS = {
  // ── Gameplay ──────────────────────────────────────────────────────────────
  pickupEffect: 0.12,
  snapEffect: 0.18,
  pieceReturn: 0.25,
  completeEffect: 0.5,

  // ── Button interactions ───────────────────────────────────────────────────
  buttonHover: 0.15,
  buttonPress: 0.08,

  // ── Puzzle drag / snap (pieceReturn defined above is reused for invalid drop) ─
  dragGrab: 0.12,      // grow to grabScale on pickup
  snapPlace: 0.25,     // snap float into slot position
  snapBounce: 0.22,    // scale pulse after correct snap  (1 → 1.08 → 1)
  snapGlow: 0.35,      // radial glow flash behind piece
  snapSlotPulse: 0.30, // gold border flash on the target slot
  wrongShake: 0.25,    // x-axis shake on invalid drop

  // ── Screen transitions ───────────────────────────────────────────────────
  screenEnter: 0.35,
  screenExit: 0.2,
  sceneTransition: 0.4,

  // ── Splash screen ────────────────────────────────────────────────────────
  splashLogoIn: 0.7,
  splashGlowIn: 0.9,
  splashSubtitleIn: 0.5,
  splashHold: 1.0,
  splashOut: 0.45,

  // ── UI elements ──────────────────────────────────────────────────────────
  uiFadeIn: 0.3,
  uiFadeOut: 0.2,
  modalIn: 0.25,
  modalOut: 0.18,
  inputFocusGlow: 0.2,

  // ── Audio ─────────────────────────────────────────────────────────────────
  audioFadeIn: 0.3,
  audioFadeOut: 0.5,
} as const;
