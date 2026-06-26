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
  snapBounce: 0.18,    // piece settle after correct snap  (1 → 1.06 → 1)
  boardReveal: 0.45,   // board fade-in + scale on level start (0.96 → 1)
  trayStagger: 0.08,   // per-piece stagger delay for tray spawn animation
  snapGlow: 0.35,      // radial glow flash behind piece
  snapGlowPulse: 0.28, // piece border glow pulse (0 → 1 → 0)
  snapDust: 0.50,      // ceramic dust particle lifetime
  snapSlotPulse: 0.30, // gold border flash on the target slot
  wrongShake: 0.22,    // x-axis shake on invalid drop (left→right→left→center)
  wrongPulse: 0.30,    // soft red radial burst at drop zone
  wrongRedGlow: 0.25,  // piece border red glow (0 → 1 → 0)
  wrongDust: 0.35,     // crack dust particle lifetime

  // ── Hint FX ──────────────────────────────────────────────────────────────
  hintReveal: 0.35,      // ornament fade in (0 → 0.85)
  hintHold: 2.50,        // ornament visible hold
  hintFadeOut: 0.40,     // ornament fade out
  hintShimmer: 0.80,     // shimmer sweep left → right
  hintBoardGlow: 0.60,   // board glow pulse total (0 → 1 → 0)
  hintParticle: 1.20,    // magical particle max lifetime
  hintBtnPulse: 0.25,    // lamp button scale bounce (1 → 1.15 → 1)

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

  // ── Win FX ───────────────────────────────────────────────────────────────
  winSceneDelay: 2.20,   // wait (seconds) after final piece before switching to win scene
  winGlowWave: 0.80,     // board glow wave total duration (0 → 0.8 → 0)
  winEdgeFlash: 0.35,    // screen edge gold flash
  winConfetti: 2.50,     // confetti rain particle lifetime
  winShard: 2.00,        // mosaic shard explosion duration
  winSparkle: 1.40,      // coin sparkle blink lifetime

  // ── Coins ──────────────────────────────────────────────────────────────────
  coinFloat: 0.80,       // floating "+N" coin reward text lifetime

  // ── Reward chest ─────────────────────────────────────────────────────────
  chestOpen: 1.20,       // chest opening animation (shake + lid + gold burst)
  chestReveal: 0.40,     // reward card scale-in (0 → 1.1 → 1)

  // ── Audio ─────────────────────────────────────────────────────────────────
  audioFadeIn: 0.3,
  audioFadeOut: 0.5,
} as const;
