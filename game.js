(() => {
  "use strict";

  const TILE = 32;
  const MOVE_SLIDE = 0.14;
  let VIEW_W = 32;
  let VIEW_H = 15;
  let CANVAS_W = VIEW_W * TILE;
  let CANVAS_H = VIEW_H * TILE;
  // Canvas pixels per game pixel, so the art is drawn at screen resolution
  let renderScale = 1;
  // How far wall tops rise above the floor, and how much they lean outward
  const WALL_LIFT = 9;
  const WALL_LEAN = 0.022;

  const TILES = { WALL: 0, FLOOR: 1, STAIRS: 2 };

  // Each theme paints the dungeon as soft gradient blocks: a light tiled floor,
  // raised wall tops, and darker wall faces that give the walls their height.
  const THEMES = [
    {
      id: "crypt",
      name: "Crypt Stone",
      floor: ["#e6d6b8", "#dac8a6"],
      wallTop: ["#e2dafa", "#9d90cc"],
      wallFace: ["#7e70ae", "#41366c"],
      bg: "#1d1830",
      accent: "#ffc94a",
      fog: "rgba(16,11,34,0.42)",
      stairs: ["#6a5c99", "#120e1f"],
    },
    {
      id: "frost",
      name: "Frost Catacombs",
      floor: ["#e2eef7", "#d2e3f0"],
      wallTop: ["#f0f8ff", "#9cc7e6"],
      wallFace: ["#6fa3c8", "#2f5c82"],
      bg: "#13223a",
      accent: "#7fd6ff",
      fog: "rgba(8,20,40,0.42)",
      stairs: ["#4f86ad", "#0b1a2c"],
    },
    {
      id: "ember",
      name: "Ember Depths",
      floor: ["#f3d0b0", "#e8bf9b"],
      wallTop: ["#f7b49a", "#c8644a"],
      wallFace: ["#a3432f", "#5c1d12"],
      bg: "#2a1210",
      accent: "#ff8a3d",
      fog: "rgba(36,8,4,0.42)",
      stairs: ["#9c3c26", "#1e0806"],
    },
    {
      id: "verdant",
      name: "Verdant Ruin",
      floor: ["#dce9c9", "#cbdcb5"],
      wallTop: ["#c4e8b4", "#6fae6a"],
      wallFace: ["#4f8a55", "#24492b"],
      bg: "#122416",
      accent: "#7cf0b0",
      fog: "rgba(6,22,10,0.42)",
      stairs: ["#467a4c", "#081a0c"],
    },
    {
      id: "void",
      name: "Void Sanctum",
      floor: ["#ddd1f2", "#cdbfe8"],
      wallTop: ["#c3a2ff", "#7a4fd0"],
      wallFace: ["#5a33a8", "#26145a"],
      bg: "#120a24",
      accent: "#e0b0ff",
      fog: "rgba(12,4,28,0.46)",
      stairs: ["#5a3a9a", "#0a0418"],
    },
  ];

  const SPELLS = {
    fire: { name: "Fire", cost: 4, color: "#ff6b35", range: 4 },
    frost: { name: "Frost", cost: 3, color: "#7ec8e3", range: 5 },
    bolt: { name: "Bolt", cost: 5, color: "#f4d35e", range: 6 },
  };

  const WEAPONS = {
    sword: { name: "Sword", baseDmg: 5, baseRange: 1 },
    bow: { name: "Bow", baseDmg: 3, baseRange: 3 },
  };

  const SHOP = [
    { id: "dmg", category: "attack", name: "Sharper Edge", desc: "+1 weapon damage", cost: 12, key: "bonusDmg", amount: 1 },
    { id: "range", category: "attack", name: "Longer Reach", desc: "+1 attack range", cost: 16, key: "bonusRange", amount: 1 },
    { id: "maxHp", category: "health", name: "Vitality Charm", desc: "+4 maximum HP", cost: 12, key: "bonusHp", amount: 4 },
    { id: "heal", category: "health", name: "Moss Tonic", desc: "Restore 10 HP now", cost: 7, effect: "heal", amount: 10, flatCost: true },
    { id: "maxMp", category: "mana", name: "Mana Crystal", desc: "+3 maximum MP", cost: 12, key: "bonusMp", amount: 3 },
    { id: "restoreMp", category: "mana", name: "Azure Draught", desc: "Restore 7 MP now", cost: 6, effect: "restoreMp", amount: 7, flatCost: true },
    { id: "guard", category: "defense", name: "Iron Guard", desc: "Block lasts 0.2s longer", cost: 14, key: "bonusBlock", amount: 0.2 },
    { id: "spellPower", category: "magic", name: "Runic Focus", desc: "+2 spell damage", cost: 15, key: "bonusSpellDmg", amount: 2 },
    { id: "spellRange", category: "magic", name: "Far Sigil", desc: "+1 spell range", cost: 13, key: "bonusSpellRange", amount: 1 },
    { id: "manaEff", category: "mana", name: "Quiet Casting", desc: "Spells cost 1 less MP", cost: 18, key: "manaDiscount", amount: 1, max: 2 },
    { id: "unlockFire", category: "magic", name: "Tome of Embers", desc: "Unlock the Fire spell", cost: 20, unlockSpell: "fire" },
    { id: "unlockFrost", category: "magic", name: "Tome of Winter", desc: "Unlock the Frost spell", cost: 20, unlockSpell: "frost" },
    { id: "unlockBolt", category: "magic", name: "Tome of Storms", desc: "Unlock the Bolt spell", cost: 20, unlockSpell: "bolt" },
    { id: "fireRune", category: "magic", name: "Ember Rune", desc: "Fire splashes onto nearby foes", cost: 24, spellEffect: "fire" },
    { id: "frostRune", category: "magic", name: "Rime Rune", desc: "Frost slows for much longer", cost: 24, spellEffect: "frost" },
    { id: "boltRune", category: "magic", name: "Forked Rune", desc: "Bolt arcs to a second foe", cost: 24, spellEffect: "bolt" },
    { id: "phaseRune", category: "magic", name: "Phase Rune", desc: "Spells can pass through walls", cost: 28, spellEffect: "phase" },
  ];

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  const els = {
    floorBadge: document.getElementById("floorBadge"),
    themeName: document.getElementById("themeName"),
    hpBar: document.getElementById("hpBar"),
    hpText: document.getElementById("hpText"),
    mpBar: document.getElementById("mpBar"),
    mpText: document.getElementById("mpText"),
    dmgText: document.getElementById("dmgText"),
    rangeText: document.getElementById("rangeText"),
    coinText: document.getElementById("coinText"),
    blockText: document.getElementById("blockText"),
    spellText: document.getElementById("spellText"),
    weaponText: document.getElementById("weaponText"),
    banner: document.getElementById("banner"),
    hint: document.getElementById("hint"),
    welcomeScreen: document.getElementById("welcomeScreen"),
    startScreen: document.getElementById("startScreen"),
    weaponChoice: document.getElementById("weaponChoice"),
    spellChoice: document.getElementById("spellChoice"),
    pauseScreen: document.getElementById("pauseScreen"),
    spellbookScreen: document.getElementById("spellbookScreen"),
    shopScreen: document.getElementById("shopScreen"),
    deathScreen: document.getElementById("deathScreen"),
    deathCard: document.getElementById("deathCard"),
    deathVeil: document.getElementById("deathVeil"),
    deathTitle: document.getElementById("deathTitle"),
    deathBody: document.getElementById("deathBody"),
    deathPeak: document.getElementById("deathPeak"),
    deathStats: document.getElementById("deathStats"),
    deathBest: document.getElementById("deathBest"),
    deathBestBadge: document.getElementById("deathBestBadge"),
    deathBestText: document.getElementById("deathBestText"),
    shopCoins: document.getElementById("shopCoins"),
    shopGrid: document.getElementById("shopGrid"),
    spellKeyList: document.getElementById("spellKeyList"),
    spellbookList: document.getElementById("spellbookList"),
    btnAttack: document.getElementById("btnAttack"),
    btnBlock: document.getElementById("btnBlock"),
    btnCast: document.getElementById("btnCast"),
    moveJoystick: document.getElementById("moveJoystick"),
    joystickKnob: document.getElementById("joystickKnob"),
    btnPause: document.getElementById("btnPause"),
    btnMusic: document.getElementById("btnMusic"),
    btnShop: document.getElementById("btnShop"),
    btnResume: document.getElementById("btnResume"),
    btnPauseShop: document.getElementById("btnPauseShop"),
    btnSpellbook: document.getElementById("btnSpellbook"),
    btnCloseSpellbook: document.getElementById("btnCloseSpellbook"),
    btnPauseRestart: document.getElementById("btnPauseRestart"),
    btnCloseShop: document.getElementById("btnCloseShop"),
    btnRefreshShop: document.getElementById("btnRefreshShop"),
    btnDeathRestart: document.getElementById("btnDeathRestart"),
    btnDeathTitle: document.getElementById("btnDeathTitle"),
    btnDeathHistory: document.getElementById("btnDeathHistory"),
    btnWelcomeHistory: document.getElementById("btnWelcomeHistory"),
    btnPauseHistory: document.getElementById("btnPauseHistory"),
    btnCloseHistory: document.getElementById("btnCloseHistory"),
    historyScreen: document.getElementById("historyScreen"),
    historyLifetime: document.getElementById("historyLifetime"),
    historyRecords: document.getElementById("historyRecords"),
    historyRunsTitle: document.getElementById("historyRunsTitle"),
    historyList: document.getElementById("historyList"),
    pickSword: document.getElementById("pickSword"),
    pickBow: document.getElementById("pickBow"),
    btnEnterCrypt: document.getElementById("btnEnterCrypt"),
    btnBackWeapon: document.getElementById("btnBackWeapon"),
    themePreview: document.getElementById("themePreview"),
  };

  let textureCache = {};
  let animFrame = 0;
  let bannerTimer = 0;
  let lastTime = 0;
  let moveCooldown = 0;
  let attackCooldown = 0;
  let castCooldown = 0;
  let blockTimer = 0;
  let blockCooldown = 0;
  let spawnGuard = 0;
  let fx = [];
  let projectiles = [];
  let spellShots = [];
  let heldDirs = new Set();
  let game = null;
  let meta = null;
  let paused = false;
  let started = false;
  let returnToPauseAfterShop = false;
  let camX = 0;
  let camY = 0;
  let audioCtx = null;
  let audioReady = false;
  let musicOn = false;
  let musicTimer = null;
  let musicStep = 0;
  let pendingWeapon = null;
  let run = null;
  let deathSeq = null;
  let swallowNextClick = false;

  const BEST_FLOOR_KEY = "cryptDepths.bestFloor";
  const HISTORY_KEY = "cryptDepths.runHistory";
  // Older runs are trimmed past this many, but the best runs are always kept
  const HISTORY_LIMIT = 60;
  const HISTORY_KEEP_BEST = 10;
  const HISTORY_SHOWN = 10;
  let historyView = "best";
  let historyReturnFocus = null;
  let lastRecordedRunId = 0;
  const reducedMotion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  const BOSS_NAMES = {
    ogre: "Crypt Ogre",
    wraith: "Grave Wraith",
    drake: "Ash Drake",
  };

  const HIT_SOURCES = {
    sword: { label: "Sword", phrase: "Your sword cleaved a foe" },
    bow: { label: "Bow", phrase: "Your arrow pierced a foe" },
    fire: { label: "Fire", phrase: "Your fire spell scorched a foe" },
    frost: { label: "Frost", phrase: "Your frost spell struck a foe" },
    bolt: { label: "Bolt", phrase: "Your lightning bolt struck a foe" },
  };

  function ensureAudio() {
    if (audioReady && audioCtx) return audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    audioReady = true;
    return audioCtx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.08, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = filterFreq || 1200;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.1, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  const sfx = {
    swing() {
      noiseBurst(0.11, 0.075, 2600);
      tone(420, 0.08, "sawtooth", 0.035, 110);
    },
    bow() {
      tone(680, 0.055, "triangle", 0.045, 260);
      noiseBurst(0.14, 0.055, 1900);
    },
    hit() {
      tone(140, 0.09, "square", 0.07, 70);
      noiseBurst(0.07, 0.08, 900);
    },
    hurt() {
      tone(220, 0.12, "sawtooth", 0.07, 90);
      tone(110, 0.14, "square", 0.05, 60);
    },
    block() {
      tone(300, 0.08, "triangle", 0.06, 180);
      noiseBurst(0.05, 0.05, 1600);
    },
    miss() {
      tone(240, 0.05, "sine", 0.03, 160);
    },
    crate() {
      noiseBurst(0.045, 0.12, 1450);
      window.setTimeout(() => noiseBurst(0.06, 0.1, 1050), 28);
      window.setTimeout(() => noiseBurst(0.08, 0.08, 720), 62);
      tone(210, 0.11, "square", 0.04, 75);
    },
    kill() {
      tone(320, 0.08, "triangle", 0.06, 160);
      tone(180, 0.14, "sawtooth", 0.05, 70);
    },
    fire() {
      noiseBurst(0.16, 0.09, 500);
      tone(260, 0.12, "sawtooth", 0.05, 120);
    },
    frost() {
      tone(640, 0.1, "sine", 0.05, 420);
      tone(880, 0.08, "triangle", 0.04, 600);
    },
    bolt() {
      tone(900, 0.05, "square", 0.06, 300);
      noiseBurst(0.08, 0.07, 2200);
    },
    potion() {
      tone(520, 0.08, "sine", 0.045, 760);
      tone(760, 0.11, "triangle", 0.035, 980);
    },
    tome() {
      tone(330, 0.18, "sine", 0.04, 660);
      window.setTimeout(() => tone(660, 0.2, "triangle", 0.035, 990), 90);
    },
    creak() {
      const ctx = ensureAudio();
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const dur = 1.1;
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const p = i / len;
        const env = Math.pow(1 - p, 0.28) * (0.35 + 0.65 * Math.min(1, p * 8));
        const scrape = Math.sin(i * 0.009) * Math.sin(i * 0.0021);
        const grit = (Math.random() * 2 - 1) * (0.55 + 0.45 * scrape);
        data[i] = grit * env;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 5.5;
      filter.frequency.setValueAtTime(980, t0);
      filter.frequency.exponentialRampToValueAtTime(180, t0 + dur);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.05);
      gain.gain.setValueAtTime(0.12, t0 + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
      tone(175, 0.38, "sawtooth", 0.045, 85);
      window.setTimeout(() => tone(135, 0.42, "triangle", 0.038, 68), 160);
      window.setTimeout(() => tone(105, 0.5, "sawtooth", 0.032, 52), 380);
      window.setTimeout(() => noiseBurst(0.1, 0.055, 380), 920);
    },
  };

  function musicPulse() {
    if (!musicOn) return;
    const bass = [82, 82, 98, 73, 82, 110, 98, 73];
    const note = bass[musicStep % bass.length];
    tone(note, 0.58, "sine", 0.055, note * 0.98);
    tone(note * 1.5, 0.42, "triangle", 0.026, note * 1.35);
    if (musicStep % 2 === 0) tone(note * 3, 0.24, "sine", 0.02, note * 2.2);
    musicStep++;
  }

  function toggleMusic() {
    musicOn = !musicOn;
    ensureAudio();
    if (musicOn) {
      musicPulse();
      musicTimer = window.setInterval(musicPulse, 620);
    } else if (musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
    els.btnMusic.textContent = musicOn ? "♫ Music On" : "♫ Music Off";
    els.btnMusic.setAttribute("aria-pressed", musicOn ? "true" : "false");
  }

  function isTouchMode() {
    // The query override keeps the touch layout directly testable on desktop browsers.
    if (new URLSearchParams(window.location.search).get("touch") === "1") return true;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const noHover = window.matchMedia("(hover: none)").matches;
    const canHover = window.matchMedia("(hover: hover)").matches;
    const touchPoints = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
    const uaMobile = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent);

    // Prefer real input capabilities over viewport width alone
    if (coarse && !fine) return true;
    if (noHover && touchPoints && !canHover) return true;
    if (uaMobile && touchPoints) return true;
    return false;
  }

  function applyInputMode() {
    const touch = isTouchMode();
    document.body.classList.toggle("mode-touch", touch);
    document.body.classList.toggle("mode-desktop", !touch);
  }

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function dist(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function themeForFloor(floor) {
    const idx = Math.floor((floor - 1) / 5) % THEMES.length;
    return THEMES[idx];
  }

  function applyThemeUI(theme) {
    THEMES.forEach((t) => document.body.classList.remove("theme-" + t.id));
    document.body.classList.add("theme-" + (theme ? theme.id : "crypt"));
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      theme ? theme.bg : THEMES[0].bg
    );
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mixHex(a, b, t) {
    const x = hexToRgb(a);
    const y = hexToRgb(b);
    return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
  }

  function rgba(hex, alpha) {
    return `rgba(${hexToRgb(hex).join(",")},${alpha})`;
  }

  function linear(x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([at, color]) => g.addColorStop(at, color));
    return g;
  }

  // Gradients for one theme, authored in tile-local coordinates. Drawing code
  // moves the origin to each tile, so a single set serves the whole map.
  function themePaints(theme) {
    if (textureCache[theme.id]) return textureCache[theme.id];

    const lift = WALL_LIFT;
    const deep = theme.stairs[1];
    const rim = theme.stairs[0];
    const step = (t) => mixHex(deep, rim, t);

    textureCache[theme.id] = {
      theme,
      floorA: linear(0, 0, TILE, TILE, [[0, mixHex(theme.floor[0], "#ffffff", 0.18)], [1, theme.floor[0]]]),
      floorB: linear(0, 0, TILE, TILE, [[0, mixHex(theme.floor[1], "#ffffff", 0.14)], [1, theme.floor[1]]]),
      shadeTop: linear(0, 0, 0, 13, [[0, rgba(theme.bg, 0.42)], [1, rgba(theme.bg, 0)]]),
      shadeLeft: linear(0, 0, 8, 0, [[0, rgba(theme.bg, 0.26)], [1, rgba(theme.bg, 0)]]),
      shadeRight: linear(TILE, 0, TILE - 8, 0, [[0, rgba(theme.bg, 0.26)], [1, rgba(theme.bg, 0)]]),
      bossTint: linear(0, 0, TILE, TILE, [[0, "rgba(255,90,110,0.10)"], [1, "rgba(200,30,60,0.22)"]]),
      wallTop: linear(0, -lift, TILE * 0.45, TILE - lift, [
        [0, mixHex(theme.wallTop[0], theme.wallTop[1], 0.15)],
        [1, mixHex(theme.wallTop[0], theme.wallTop[1], 0.5)],
      ]),
      wallFront: linear(0, TILE - lift, 0, TILE, [[0, theme.wallFace[0]], [1, theme.wallFace[1]]]),
      wallSide: linear(0, -lift, 0, TILE, [
        [0, mixHex(theme.wallFace[0], "#000000", 0.12)],
        [1, mixHex(theme.wallFace[1], "#000000", 0.2)],
      ]),
      stairs: linear(0, 3, 0, TILE - 3, [
        [0, deep], [0.22, deep],
        [0.22, step(0.3)], [0.42, step(0.3)],
        [0.42, step(0.55)], [0.62, step(0.55)],
        [0.62, step(0.8)], [0.82, step(0.8)],
        [0.82, rim], [1, mixHex(rim, "#ffffff", 0.15)],
      ]),
      stairsEdge: linear(3, 0, TILE - 3, 0, [
        [0, "rgba(0,0,0,0.4)"], [0.28, "rgba(0,0,0,0)"],
        [0.72, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.4)"],
      ]),
    };
    return textureCache[theme.id];
  }

  function buildThemePreview() {
    if (!els.themePreview) return;
    els.themePreview.innerHTML = "";
    THEMES.forEach((theme) => {
      const wrap = document.createElement("div");
      wrap.className = "theme-swatch";
      const c = document.createElement("canvas");
      c.width = TILE * 2;
      c.height = TILE;
      const g = c.getContext("2d");
      const wallFill = g.createLinearGradient(0, 0, 0, TILE);
      wallFill.addColorStop(0, theme.wallTop[0]);
      wallFill.addColorStop(0.7, theme.wallTop[1]);
      wallFill.addColorStop(0.7, theme.wallFace[0]);
      wallFill.addColorStop(1, theme.wallFace[1]);
      g.fillStyle = wallFill;
      g.fillRect(0, 0, TILE, TILE);
      const floorFill = g.createLinearGradient(TILE, 0, TILE * 2, TILE);
      floorFill.addColorStop(0, theme.floor[0]);
      floorFill.addColorStop(1, theme.floor[1]);
      g.fillStyle = floorFill;
      g.fillRect(TILE, 0, TILE, TILE);
      g.fillStyle = theme.accent;
      g.beginPath();
      g.arc(TILE * 1.5, TILE / 2, 4, 0, Math.PI * 2);
      g.fill();
      const label = document.createElement("span");
      label.textContent = theme.name;
      wrap.appendChild(c);
      wrap.appendChild(label);
      els.themePreview.appendChild(wrap);
    });
  }

  function emptyMap(w, h, fill) {
    return Array.from({ length: h }, () => Array(w).fill(fill));
  }

  function carveRoom(map, room) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) map[y][x] = TILES.FLOOR;
    }
  }

  function carveHall(map, x1, y1, x2, y2) {
    let x = x1;
    let y = y1;
    while (x !== x2) {
      map[y][x] = TILES.FLOOR;
      x += x < x2 ? 1 : -1;
    }
    while (y !== y2) {
      map[y][x] = TILES.FLOOR;
      y += y < y2 ? 1 : -1;
    }
    map[y][x] = TILES.FLOOR;
  }

  function roomCenter(room) {
    return {
      x: Math.floor(room.x + room.w / 2),
      y: Math.floor(room.y + room.h / 2),
    };
  }

  function roomsOverlap(a, b, pad) {
    return !(
      a.x + a.w + pad <= b.x ||
      b.x + b.w + pad <= a.x ||
      a.y + a.h + pad <= b.y ||
      b.y + b.h + pad <= a.y
    );
  }

  function generateDungeon(floor) {
    const size = Math.min(36 + Math.floor(floor / 2), 52);
    const map = emptyMap(size, size, TILES.WALL);
    const rooms = [];
    const roomCount = 6 + Math.min(floor, 7);

    for (let tries = 0; tries < 90 && rooms.length < roomCount; tries++) {
      const w = rand(5, 8);
      const h = rand(5, 8);
      const room = {
        x: rand(1, size - w - 2),
        y: rand(1, size - h - 2),
        w,
        h,
      };
      if (rooms.some((r) => roomsOverlap(r, room, 1))) continue;
      carveRoom(map, room);
      if (rooms.length) {
        const prev = roomCenter(rooms[rooms.length - 1]);
        const cur = roomCenter(room);
        carveHall(map, prev.x, prev.y, cur.x, cur.y);
      }
      rooms.push(room);
    }

    const start = roomCenter(rooms[0]);
    const bossRoom = rooms[rooms.length - 1];
    const bossPos = roomCenter(bossRoom);
    const floors = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (map[y][x] === TILES.FLOOR) floors.push({ x, y });
      }
    }

    return {
      map,
      size,
      rooms,
      start,
      bossPos,
      bossRoom,
      stairsPos: { x: bossPos.x, y: bossPos.y },
      floors,
      theme: themeForFloor(floor),
    };
  }

  function isMapFloor(dungeon, x, y) {
    if (x < 0 || y < 0 || x >= dungeon.size || y >= dungeon.size) return false;
    const t = dungeon.map[y][x];
    return t === TILES.FLOOR || t === TILES.STAIRS;
  }

  function enemyStats(floor, isBoss) {
    if (isBoss) {
      return {
        hp: 16 + floor * 7,
        maxHp: 16 + floor * 7,
        dmg: 2 + Math.floor(floor * 0.6),
        speed: 0.48,
      };
    }
    const tier = 1 + Math.floor((floor - 1) / 2);
    return {
      hp: 5 + tier * 2,
      maxHp: 5 + tier * 2,
      dmg: 1 + Math.floor(tier * 0.5),
      speed: 0.62 + Math.min(tier * 0.03, 0.2),
    };
  }

  function spawnEnemies(dungeon, floor) {
    const enemies = [];
    const used = new Set([`${dungeon.start.x},${dungeon.start.y}`]);
    const count = 3 + Math.min(floor, 7);
    const roomSpots = [];

    for (let i = 1; i < dungeon.rooms.length - 1; i++) {
      for (let n = 0; n < 6; n++) {
        roomSpots.push({
          x: dungeon.rooms[i].x + rand(0, dungeon.rooms[i].w - 1),
          y: dungeon.rooms[i].y + rand(0, dungeon.rooms[i].h - 1),
        });
      }
    }

    for (let i = 0; i < count; i++) {
      let spot = null;
      const pool = roomSpots.length ? roomSpots : dungeon.floors;
      for (let t = 0; t < 50; t++) {
        const p = pick(pool);
        const key = `${p.x},${p.y}`;
        if (used.has(key) || !isMapFloor(dungeon, p.x, p.y)) continue;
        if (dist(p, dungeon.start) < 7 || dist(p, dungeon.bossPos) < 3) continue;
        spot = p;
        used.add(key);
        break;
      }
      if (!spot) continue;
      enemies.push({
        x: spot.x,
        y: spot.y,
        ...enemyStats(floor, false),
        kind: pick(["slime", "bat", "skeleton"]),
        isBoss: false,
        moveTimer: 0.8 + Math.random() * 0.8,
        attackWindup: 0,
        flash: 0,
        slow: 0,
      });
    }

    enemies.push({
      x: dungeon.bossPos.x,
      y: dungeon.bossPos.y,
      ...enemyStats(floor, true),
      kind: pick(["ogre", "wraith", "drake"]),
      isBoss: true,
      moveTimer: 1.2,
      attackWindup: 0,
      flash: 0,
      slow: 0,
    });

    return enemies;
  }

  function spawnCrates(dungeon) {
    const crates = [];
    const used = new Set([`${dungeon.start.x},${dungeon.start.y}`, `${dungeon.bossPos.x},${dungeon.bossPos.y}`]);
    const count = 4 + rand(0, 3);

    for (let i = 0; i < count; i++) {
      for (let t = 0; t < 40; t++) {
        const p = pick(dungeon.floors);
        const key = `${p.x},${p.y}`;
        if (used.has(key) || dist(p, dungeon.start) < 2 || dist(p, dungeon.bossPos) < 3) continue;
        used.add(key);
        crates.push({
          x: p.x,
          y: p.y,
          hp: 1,
          coins: rand(2, 7),
          heal: Math.random() < 0.55 ? rand(3, 7) : 0,
          mana: Math.random() < 0.45 ? rand(2, 6) : 0,
        });
        break;
      }
    }
    return crates;
  }

  function createMeta(weaponId, spellId) {
    return {
      weapon: weaponId,
      coins: 0,
      bonusDmg: 0,
      bonusRange: 0,
      bonusHp: 0,
      bonusMp: 0,
      bonusBlock: 0,
      bonusSpellDmg: 0,
      bonusSpellRange: 0,
      manaDiscount: 0,
      unlockedSpells: { fire: spellId === "fire", frost: spellId === "frost", bolt: spellId === "bolt" },
      spellOrder: [spellId],
      spellEffects: { fire: false, frost: false, bolt: false, phase: false },
      purchased: {},
    };
  }

  function playerStats() {
    const w = WEAPONS[meta.weapon];
    return {
      dmg: w.baseDmg + meta.bonusDmg,
      range: w.baseRange + meta.bonusRange,
      maxHp: 24 + meta.bonusHp,
      maxMp: 12 + meta.bonusMp,
      spellDmg: meta.bonusSpellDmg,
      spellRange: meta.bonusSpellRange,
    };
  }

  function makePlayer(carry) {
    const stats = playerStats();
    const hp = carry ? Math.min(carry.hp + 5, stats.maxHp) : stats.maxHp;
    const mp = carry ? Math.min(carry.mp + 3, stats.maxMp) : stats.maxMp;
    return {
      x: 0,
      y: 0,
      hp,
      maxHp: stats.maxHp,
      mp,
      maxMp: stats.maxMp,
      spell: carry ? carry.spell : Object.keys(meta.unlockedSpells).find((id) => meta.unlockedSpells[id]),
      facing: { x: 0, y: 1 },
      attackT: 0,
    };
  }

  function unlockSpell(id) {
    if (!SPELLS[id] || meta.unlockedSpells[id]) return false;
    meta.unlockedSpells[id] = true;
    meta.spellOrder.push(id);
    return true;
  }

  function showBanner(text, ms) {
    els.banner.textContent = text;
    els.banner.classList.remove("hidden");
    bannerTimer = ms;
  }

  function hideAllMenus() {
    els.pauseScreen.classList.add("hidden");
    els.shopScreen.classList.add("hidden");
    els.spellbookScreen.classList.add("hidden");
    els.deathScreen.classList.add("hidden");
    els.historyScreen.classList.add("hidden");
  }

  function updateHud() {
    if (!game || !meta) return;
    const p = game.player;
    const stats = playerStats();
    els.hpBar.style.width = Math.max(0, (p.hp / p.maxHp) * 100) + "%";
    els.mpBar.style.width = Math.max(0, (p.mp / p.maxMp) * 100) + "%";
    els.hpText.textContent = `${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}`;
    els.mpText.textContent = `${Math.max(0, Math.ceil(p.mp))}/${p.maxMp}`;
    els.dmgText.textContent = String(stats.dmg);
    els.rangeText.textContent = String(stats.range);
    els.coinText.textContent = String(meta.coins);
    els.floorBadge.textContent = `Floor ${game.floor}`;
    els.themeName.textContent = game.dungeon.theme.name;
    els.spellText.textContent = SPELLS[p.spell].name;
    els.weaponText.textContent = WEAPONS[meta.weapon].name;

    if (blockTimer > 0) {
      els.blockText.textContent = "Blocking";
      els.blockText.classList.add("blocking");
    } else if (blockCooldown > 0) {
      els.blockText.textContent = "Wait";
      els.blockText.classList.remove("blocking");
    } else {
      els.blockText.textContent = "Ready";
      els.blockText.classList.remove("blocking");
    }

    document.querySelectorAll(".spell-btn").forEach((btn) => {
      const unlocked = !!meta.unlockedSpells[btn.dataset.spell];
      const on = btn.dataset.spell === p.spell;
      btn.disabled = !unlocked;
      btn.classList.toggle("locked", !unlocked);
      btn.classList.toggle("active", unlocked && on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.setAttribute("aria-label", unlocked ? `${SPELLS[btn.dataset.spell].name} spell` : `${SPELLS[btn.dataset.spell].name} spell locked`);
      const cost = Math.max(1, SPELLS[btn.dataset.spell].cost - meta.manaDiscount);
      const costEl = btn.querySelector(".spell-cost");
      const nameEl = btn.querySelector(".spell-name");
      if (nameEl) nameEl.textContent = SPELLS[btn.dataset.spell].name;
      if (costEl) costEl.textContent = unlocked ? `${cost} MP` : "Locked";
    });
    if (els.spellKeyList) {
      els.spellKeyList.innerHTML = meta.spellOrder
        .map((id, index) => `<span><kbd>${index + 1}</kbd> ${SPELLS[id].name}</span>`)
        .join("");
    }
  }

  function isWalkable(x, y) {
    const { map, size } = game.dungeon;
    if (x < 0 || y < 0 || x >= size || y >= size) return false;
    const t = map[y][x];
    return t === TILES.FLOOR || t === TILES.STAIRS;
  }

  function entityAt(x, y, ignore) {
    return game.enemies.find((e) => e !== ignore && e.hp > 0 && e.x === x && e.y === y);
  }

  function crateAt(x, y) {
    return game.crates.find((c) => c.hp > 0 && c.x === x && c.y === y);
  }

  function collectPickupsAt(x, y) {
    if (!game || !game.pickups) return;
    for (const pickup of game.pickups) {
      if (pickup.collected || pickup.x !== x || pickup.y !== y) continue;
      if (pickup.type === "health") {
        if (game.player.hp >= game.player.maxHp) {
          showBanner("HP already full", 500);
          continue;
        }
        const before = game.player.hp;
        game.player.hp = Math.min(game.player.maxHp, game.player.hp + pickup.amount);
        pickup.collected = true;
        sfx.potion();
        showBanner(`Potion +${game.player.hp - before} HP`, 750);
        updateHud();
      } else if (pickup.type === "mana") {
        if (game.player.mp >= game.player.maxMp) {
          showBanner("MP already full", 500);
          continue;
        }
        const before = game.player.mp;
        game.player.mp = Math.min(game.player.maxMp, game.player.mp + pickup.amount);
        pickup.collected = true;
        sfx.potion();
        showBanner(`Potion +${game.player.mp - before} MP`, 750);
        updateHud();
      }
    }
  }

  function addFx(type, x, y, color, life, angle) {
    fx.push({ type, x, y, color, life, max: life, angle: angle || 0 });
  }

  function createRunStats() {
    return {
      deepestFloor: 1,
      bossesDefeated: 0,
      enemiesDefeated: 0,
      biggestHit: null,
      coinsCollected: 0,
      playTime: 0,
      lastBoss: null,
    };
  }

  function gainCoins(amount) {
    meta.coins += amount;
    if (run) run.coinsCollected += amount;
  }

  function recordHit(amount, source) {
    if (!run || !HIT_SOURCES[source] || amount <= 0) return;
    if (!run.biggestHit || amount > run.biggestHit.amount) {
      run.biggestHit = { amount, source, floor: game.floor };
    }
  }

  function recordKill(enemy) {
    if (!run) return;
    if (enemy.isBoss) {
      run.bossesDefeated += 1;
      run.lastBoss = { name: BOSS_NAMES[enemy.kind] || "crypt guardian", floor: game.floor };
    } else {
      run.enemiesDefeated += 1;
    }
  }

  function readBestFloor() {
    try {
      const value = parseInt(window.localStorage.getItem(BEST_FLOOR_KEY), 10);
      return value > 0 ? value : 0;
    } catch (_err) {
      return 0;
    }
  }

  function saveBestFloor(floor) {
    try {
      window.localStorage.setItem(BEST_FLOOR_KEY, String(floor));
    } catch (_err) {
      /* storage can be unavailable in private browsing */
    }
  }

  function formatRunTime(seconds) {
    const total = Math.max(0, Math.round(seconds));
    const hours = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = String(total % 60).padStart(2, "0");
    return hours > 0 ? `${hours}:${String(mins).padStart(2, "0")}:${secs}` : `${mins}:${secs}`;
  }

  function plural(count, one, many) {
    return `${count} ${count === 1 ? one : many}`;
  }

  function emptyHistory() {
    return {
      runs: [],
      lifetime: {
        runs: 0,
        enemiesDefeated: 0,
        bossesDefeated: 0,
        coinsCollected: 0,
        playTime: 0,
        records: {
          deepestFloor: 0,
          mostBosses: 0,
          mostEnemies: 0,
          mostCoins: 0,
          longestRun: 0,
          biggestHit: null,
        },
      },
    };
  }

  function readHistory() {
    const fresh = emptyHistory();
    try {
      const data = JSON.parse(window.localStorage.getItem(HISTORY_KEY));
      if (data && Array.isArray(data.runs) && data.lifetime) {
        return {
          runs: data.runs,
          lifetime: { ...fresh.lifetime, ...data.lifetime, records: { ...fresh.lifetime.records, ...data.lifetime.records } },
        };
      }
    } catch (_err) {
      /* fall through to an empty history */
    }
    return fresh;
  }

  function writeHistory(history) {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (_err) {
      /* storage can be unavailable in private browsing */
    }
  }

  function compareRuns(a, b) {
    return (
      b.deepestFloor - a.deepestFloor ||
      b.bossesDefeated - a.bossesDefeated ||
      b.enemiesDefeated - a.enemiesDefeated ||
      b.coinsCollected - a.coinsCollected ||
      a.endedAt - b.endedAt
    );
  }

  function recordRunInHistory(r, title, peak) {
    const history = readHistory();
    const entry = {
      id: Date.now(),
      endedAt: Date.now(),
      weapon: meta ? meta.weapon : "sword",
      spells: meta ? meta.spellOrder.slice() : [],
      deepestFloor: r.deepestFloor,
      bossesDefeated: r.bossesDefeated,
      enemiesDefeated: r.enemiesDefeated,
      coinsCollected: r.coinsCollected,
      playTime: Math.round(r.playTime),
      biggestHit: r.biggestHit ? { amount: r.biggestHit.amount, source: r.biggestHit.source } : null,
      title,
      peak,
    };
    history.runs.push(entry);
    if (history.runs.length > HISTORY_LIMIT) {
      const keep = new Set(history.runs.slice().sort(compareRuns).slice(0, HISTORY_KEEP_BEST));
      const oldest = history.runs.findIndex((x) => !keep.has(x));
      if (oldest >= 0) history.runs.splice(oldest, 1);
    }

    const life = history.lifetime;
    const rec = life.records;
    life.runs += 1;
    life.enemiesDefeated += entry.enemiesDefeated;
    life.bossesDefeated += entry.bossesDefeated;
    life.coinsCollected += entry.coinsCollected;
    life.playTime += entry.playTime;
    rec.deepestFloor = Math.max(rec.deepestFloor, entry.deepestFloor);
    rec.mostBosses = Math.max(rec.mostBosses, entry.bossesDefeated);
    rec.mostEnemies = Math.max(rec.mostEnemies, entry.enemiesDefeated);
    rec.mostCoins = Math.max(rec.mostCoins, entry.coinsCollected);
    rec.longestRun = Math.max(rec.longestRun, entry.playTime);
    if (entry.biggestHit && (!rec.biggestHit || entry.biggestHit.amount > rec.biggestHit.amount)) {
      rec.biggestHit = entry.biggestHit;
    }

    writeHistory(history);
    lastRecordedRunId = entry.id;
  }

  function statItem(label, value, className) {
    const item = document.createElement("div");
    item.className = className;
    const labelEl = document.createElement("dt");
    labelEl.className = "run-stat-label";
    labelEl.textContent = label;
    const valueEl = document.createElement("dd");
    valueEl.className = "run-stat-value";
    valueEl.textContent = value;
    item.append(labelEl, valueEl);
    return item;
  }

  function loadoutText(entry) {
    const weapon = WEAPONS[entry.weapon] ? WEAPONS[entry.weapon].name : "Sword";
    const spells = (entry.spells || []).filter((id) => SPELLS[id]).map((id) => SPELLS[id].name);
    if (!spells.length) return weapon;
    const list = spells.length > 1 ? `${spells.slice(0, -1).join(", ")} and ${spells[spells.length - 1]}` : spells[0];
    return `${weapon} with ${list}`;
  }

  function historyRow(entry, rank) {
    const row = document.createElement("li");
    row.className = "history-run";
    const isLatest = entry.id === lastRecordedRunId && game && game.over;
    if (isLatest) row.classList.add("is-latest");

    if (rank) {
      const rankEl = document.createElement("span");
      rankEl.className = "history-rank";
      rankEl.textContent = String(rank);
      rankEl.setAttribute("aria-label", `Rank ${rank}`);
      row.append(rankEl);
    }

    const main = document.createElement("div");
    main.className = "history-run-main";

    const top = document.createElement("div");
    top.className = "history-run-top";
    const floor = document.createElement("strong");
    floor.className = "history-floor";
    floor.textContent = `Floor ${entry.deepestFloor}`;
    const title = document.createElement("span");
    title.className = "history-run-title";
    title.textContent = entry.title || runTitle(entry);
    top.append(floor, title);
    if (isLatest) {
      const tag = document.createElement("span");
      tag.className = "history-tag";
      tag.textContent = "This run";
      top.append(tag);
    }

    const peak = document.createElement("p");
    peak.className = "history-peak";
    peak.textContent = entry.peak || peakMoment(entry);

    const details = document.createElement("p");
    details.className = "history-meta";
    const date = new Date(entry.endedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    details.textContent = [
      loadoutText(entry),
      plural(entry.bossesDefeated, "boss", "bosses"),
      plural(entry.enemiesDefeated, "enemy", "enemies"),
      plural(entry.coinsCollected, "coin", "coins"),
      formatRunTime(entry.playTime),
      date,
    ].join(" · ");

    main.append(top, peak, details);
    row.append(main);
    return row;
  }

  function renderHistory() {
    const history = readHistory();
    const life = history.lifetime;
    const rec = life.records;
    const deepest = Math.max(rec.deepestFloor, readBestFloor());

    els.historyLifetime.replaceChildren(
      statItem("Runs played", String(life.runs), "history-life-item"),
      statItem("Time in the crypt", formatRunTime(life.playTime), "history-life-item"),
      statItem("Enemies defeated", String(life.enemiesDefeated), "history-life-item"),
      statItem("Bosses defeated", String(life.bossesDefeated), "history-life-item"),
      statItem("Coins collected", String(life.coinsCollected), "history-life-item")
    );

    const hit = rec.biggestHit;
    els.historyRecords.replaceChildren(
      statItem("Deepest floor", deepest ? String(deepest) : "None yet", "run-stat"),
      statItem("Most bosses in a run", String(rec.mostBosses), "run-stat"),
      statItem("Most enemies in a run", String(rec.mostEnemies), "run-stat"),
      statItem("Biggest hit", hit && HIT_SOURCES[hit.source] ? `${hit.amount} with ${HIT_SOURCES[hit.source].label}` : "None yet", "run-stat"),
      statItem("Most coins in a run", String(rec.mostCoins), "run-stat"),
      statItem("Longest run", formatRunTime(rec.longestRun), "run-stat")
    );

    els.historyRunsTitle.textContent = historyView === "best" ? "Best runs" : "Recent runs";
    document.querySelectorAll("[data-history-view]").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.historyView === historyView ? "true" : "false");
    });

    const runs = historyView === "best"
      ? history.runs.slice().sort(compareRuns).slice(0, HISTORY_SHOWN)
      : history.runs.slice(-HISTORY_SHOWN).reverse();
    if (!runs.length) {
      const empty = document.createElement("li");
      empty.className = "history-empty";
      empty.textContent = "No runs have been recorded yet. Your next descent will appear here.";
      els.historyList.replaceChildren(empty);
    } else {
      els.historyList.replaceChildren(
        ...runs.map((entry, index) => historyRow(entry, historyView === "best" ? index + 1 : 0))
      );
    }
    els.historyList.scrollTop = 0;
  }

  function openHistory() {
    historyReturnFocus = document.activeElement;
    renderHistory();
    els.historyScreen.classList.remove("hidden");
    els.btnCloseHistory.focus({ preventScroll: true });
  }

  function closeHistory() {
    els.historyScreen.classList.add("hidden");
    if (historyReturnFocus && document.body.contains(historyReturnFocus)) {
      historyReturnFocus.focus({ preventScroll: true });
    }
    historyReturnFocus = null;
  }

  function setHistoryView(view) {
    historyView = view;
    renderHistory();
  }

  function peakMoment(r) {
    if (r.lastBoss) return `You brought down the ${r.lastBoss.name} on floor ${r.lastBoss.floor}.`;
    if (r.biggestHit) {
      const hit = r.biggestHit;
      return `${HIT_SOURCES[hit.source].phrase} for ${hit.amount} damage on floor ${hit.floor}.`;
    }
    if (r.deepestFloor > 1) return `You made it down to floor ${r.deepestFloor}.`;
    return "You took your first steps into the crypt.";
  }

  function runTitle(r) {
    if (r.bossesDefeated >= 5 || r.deepestFloor >= 6) return "A Legendary Descent";
    if (r.bossesDefeated >= 2) return "A Hard-Won Descent";
    if (r.bossesDefeated === 1) return "A Worthy Delve";
    if (r.enemiesDefeated >= 3) return "A Brave Beginning";
    return "The Crypt Wins This Time";
  }

  function renderRunSummary() {
    const r = run || createRunStats();
    r.deepestFloor = Math.max(r.deepestFloor, game.floor);
    const prevBest = readBestFloor();
    const newBest = r.deepestFloor > prevBest && (prevBest > 0 || r.deepestFloor > 1);
    if (r.deepestFloor > prevBest) saveBestFloor(r.deepestFloor);

    els.deathBody.textContent = `Your run ended on floor ${game.floor}.`;
    els.deathTitle.textContent = runTitle(r);
    els.deathPeak.textContent = peakMoment(r);

    const hit = r.biggestHit;
    const stats = [
      ["Deepest floor", String(r.deepestFloor)],
      ["Bosses defeated", String(r.bossesDefeated)],
      ["Enemies defeated", String(r.enemiesDefeated)],
      ["Biggest hit", hit ? `${hit.amount} with ${HIT_SOURCES[hit.source].label}` : "None"],
      ["Coins collected", String(r.coinsCollected)],
      ["Time in the crypt", formatRunTime(r.playTime)],
    ];
    els.deathStats.replaceChildren(
      ...stats.map(([label, value], index) => {
        const item = statItem(label, value, "run-stat reveal");
        item.style.setProperty("--i", String(index + 4));
        return item;
      })
    );
    recordRunInHistory(r, els.deathTitle.textContent, els.deathPeak.textContent);

    els.deathBest.classList.toggle("new-best", newBest);
    els.deathBestBadge.classList.toggle("hidden", !newBest);
    if (newBest && prevBest > 0) {
      els.deathBestText.textContent = `You went deeper than ever before. Your old best was floor ${prevBest}.`;
    } else if (newBest) {
      els.deathBestText.textContent = `Floor ${r.deepestFloor} is your first personal best.`;
    } else if (r.deepestFloor === prevBest) {
      els.deathBestText.textContent = `You matched your personal best of floor ${prevBest}.`;
    } else {
      els.deathBestText.textContent = `Your personal best is floor ${Math.max(prevBest, r.deepestFloor)}.`;
    }
  }

  function startDeathSequence() {
    const calm = !!(reducedMotion && reducedMotion.matches);
    clearDeathSequence();
    renderRunSummary();
    deathSeq = { slow: !calm, calm, timers: [], startedAt: performance.now() };
    addFx("burst", game.player.x, game.player.y, "#c44536", 0.9);
    els.deathScreen.classList.add("revealing");
    els.deathVeil.classList.remove("hidden");
    void els.deathVeil.offsetWidth;
    els.deathVeil.classList.add("on");
    document.body.classList.add("run-ending");
    deathSeq.timers.push(window.setTimeout(revealRunSummary, calm ? 250 : 650));
  }

  function revealRunSummary() {
    if (!deathSeq) return;
    deathSeq.slow = false;
    els.deathScreen.classList.remove("hidden");
    deathSeq.timers.push(window.setTimeout(settleDeathSequence, deathSeq.calm ? 300 : 1150));
  }

  function settleDeathSequence() {
    if (!deathSeq) return;
    deathSeq.timers.forEach((id) => window.clearTimeout(id));
    deathSeq = null;
    els.deathVeil.classList.add("on");
    els.deathScreen.classList.remove("hidden", "revealing");
    els.btnDeathRestart.focus({ preventScroll: true });
  }

  function skipDeathSequence() {
    // Ignore the first moments so taps and keys still held from combat do not skip the ending
    if (!deathSeq || performance.now() - deathSeq.startedAt < 350) return false;
    els.deathVeil.classList.add("instant");
    els.deathScreen.classList.add("skipped");
    settleDeathSequence();
    return true;
  }

  function clearDeathSequence() {
    if (deathSeq) deathSeq.timers.forEach((id) => window.clearTimeout(id));
    deathSeq = null;
    els.deathVeil.classList.remove("on", "instant");
    els.deathVeil.classList.add("hidden");
    els.deathScreen.classList.remove("revealing", "skipped");
    document.body.classList.remove("run-ending");
  }

  function hurtPlayer(amount) {
    if (!game || game.over || paused) return;
    let dmg = amount;
    if (blockTimer > 0) {
      dmg = Math.max(0, Math.floor(amount * 0.25));
      sfx.block();
      showBanner(dmg === 0 ? "Blocked!" : "Glanced!", 500);
    }
    game.player.hp -= dmg;
    if (dmg > 0) {
      sfx.hurt();
      addFx("flash", game.player.x, game.player.y, "#c44536", 0.25);
    }
    if (game.player.hp <= 0) {
      game.player.hp = 0;
      game.over = true;
      paused = false;
      hideAllMenus();
      startDeathSequence();
    }
    updateHud();
  }

  function killEnemy(enemy) {
    enemy.hp = 0;
    sfx.kill();
    addFx("burst", enemy.x, enemy.y, enemy.isBoss ? "#d4a84b" : "#c44536", 0.45);
    gainCoins(enemy.isBoss ? 8 + game.floor : rand(1, 3));
    recordKill(enemy);
    if (enemy.isBoss && !game.bossDown) {
      game.bossDown = true;
      const { stairsPos, map } = game.dungeon;
      map[stairsPos.y][stairsPos.x] = TILES.STAIRS;
      const bossRoom = game.dungeon.bossRoom;
      const rewardSpots = [];
      for (let y = bossRoom.y; y < bossRoom.y + bossRoom.h; y++) {
        for (let x = bossRoom.x; x < bossRoom.x + bossRoom.w; x++) rewardSpots.push({ x, y });
      }
      rewardSpots.sort((a, b) => dist(a, enemy) - dist(b, enemy));
      const rewardSpot = rewardSpots.find((spot) =>
        isMapFloor(game.dungeon, spot.x, spot.y) &&
        !crateAt(spot.x, spot.y) &&
        !entityAt(spot.x, spot.y) &&
        (spot.x !== stairsPos.x || spot.y !== stairsPos.y) &&
        (spot.x !== game.player.x || spot.y !== game.player.y)
      ) || { x: bossRoom.x, y: bossRoom.y };
      game.crates.push({ ...rewardSpot, hp: 1, coins: 8 + game.floor * 2, heal: 0, mana: 0, tome: true, bossChest: true });
      showBanner("Boss down! A relic chest appeared", 1800);
      if (els.hint) els.hint.textContent = "Stand on the stairs to go deeper";
    }
    updateHud();
  }

  function damageEnemy(enemy, amount, color, source) {
    recordHit(amount, source);
    enemy.hp -= amount;
    enemy.flash = 0.2;
    sfx.hit();
    addFx("text", enemy.x, enemy.y, color || "#f0e2c4", 0.45);
    if (enemy.hp <= 0) killEnemy(enemy);
  }

  function breakCrate(crate) {
    crate.hp = 0;
    sfx.crate();
    addFx("burst", crate.x, crate.y, "#c9a227", 0.35);
    const bits = [];
    if (crate.coins > 0) {
      gainCoins(crate.coins);
      bits.push(`+${crate.coins} coins`);
    }
    if (crate.heal > 0) {
      game.pickups.push({ x: crate.x, y: crate.y, type: "health", amount: crate.heal, collected: false });
      bits.push("Health potion dropped");
    }
    if (crate.mana > 0) {
      game.pickups.push({ x: crate.x, y: crate.y, type: "mana", amount: crate.mana, collected: false });
      bits.push("Mana potion dropped");
    }
    if (crate.tome) {
      const locked = Object.keys(SPELLS).filter((id) => !meta.unlockedSpells[id]);
      if (locked.length) {
        const learned = pick(locked);
        unlockSpell(learned);
        bits.push(`${SPELLS[learned].name} unlocked`);
      } else {
        const missingRunes = ["fire", "frost", "bolt"].filter((id) =>
          meta.unlockedSpells[id] && !meta.spellEffects[id]
        );
        const reward = rand(1, 4);
        if (reward === 1) {
          const amount = rand(1, 3);
          meta.bonusSpellDmg += amount;
          bits.push(`Tome: +${amount} spell damage`);
        } else if (reward === 2) {
          meta.bonusSpellRange += 1;
          bits.push("Tome: +1 spell range");
        } else if (reward === 3) {
          meta.bonusMp += 3;
          game.player.maxMp += 3;
          game.player.mp = Math.min(game.player.maxMp, game.player.mp + 3);
          bits.push("Tome: +3 maximum MP");
        } else if (missingRunes.length) {
          const rune = pick(missingRunes);
          meta.spellEffects[rune] = true;
          bits.push(`${SPELLS[rune].name} rune awakened`);
        } else {
          const amount = rand(1, 3);
          meta.bonusSpellDmg += amount;
          bits.push(`Tome: +${amount} spell damage`);
        }
      }
      sfx.tome();
    }
    showBanner(bits.length ? bits.join(" · ") : "Empty crate", 2600);
    updateHud();
  }

  function beginSlide(ent, nx, ny, duration = MOVE_SLIDE) {
    ent.fromX = visualPos(ent).x;
    ent.fromY = visualPos(ent).y;
    ent.x = nx;
    ent.y = ny;
    ent.moveT = duration;
    ent.moveDur = duration;
  }

  function visualPos(ent) {
    if (!ent || !ent.moveT || ent.moveT <= 0 || ent.moveDur <= 0) {
      return { x: ent.x, y: ent.y };
    }
    const t = 1 - ent.moveT / ent.moveDur;
    // Linear interpolation keeps held movement at a constant speed instead of
    // easing in and out on every tile (which reads as a repeated bounce).
    const ease = t;
    const fromX = ent.fromX != null ? ent.fromX : ent.x;
    const fromY = ent.fromY != null ? ent.fromY : ent.y;
    return {
      x: fromX + (ent.x - fromX) * ease,
      y: fromY + (ent.y - fromY) * ease,
    };
  }

  function tickSlide(ent, dt) {
    if (ent.moveT && ent.moveT > 0) {
      ent.moveT = Math.max(0, ent.moveT - dt);
    }
  }

  function tryMove(dx, dy) {
    if (!started || !game || game.over || paused || moveCooldown > 0) return false;
    const p = game.player;
    if (p.moveT > 0) return false;
    const nx = p.x + dx;
    const ny = p.y + dy;
    p.facing = { x: dx, y: dy };
    if (!isWalkable(nx, ny)) return false;
    if (entityAt(nx, ny)) return false;
    if (crateAt(nx, ny)) return false;
    const touchHeld = document.body.classList.contains("mode-touch") && heldDirs.size > 0;
    const moveDuration = touchHeld ? 0.22 : MOVE_SLIDE;
    beginSlide(p, nx, ny, moveDuration);
    collectPickupsAt(nx, ny);
    moveCooldown = moveDuration * 0.92;
    if (game.dungeon.map[p.y][p.x] === TILES.STAIRS) nextFloor();
    return true;
  }

  function cellsInRange(range) {
    const cells = [];
    const p = game.player;
    const fx = p.facing.x;
    const fy = p.facing.y;
    if (meta.weapon === "sword") {
      // Facing cell plus side swings at range 1; longer range extends forward
      for (let r = 1; r <= range; r++) {
        const x = p.x + fx * r;
        const y = p.y + fy * r;
        if (!isWalkable(x, y)) break;
        cells.push({ x, y });
      }
      if (range >= 1 && isWalkable(p.x + fx, p.y + fy)) {
        if (fx !== 0) {
          cells.push({ x: p.x + fx, y: p.y - 1 });
          cells.push({ x: p.x + fx, y: p.y + 1 });
        } else {
          cells.push({ x: p.x - 1, y: p.y + fy });
          cells.push({ x: p.x + 1, y: p.y + fy });
        }
      }
    } else {
      for (let r = 1; r <= range; r++) {
        cells.push({ x: p.x + fx * r, y: p.y + fy * r });
      }
    }
    return cells;
  }

  function doAttack() {
    if (!started || !game || game.over || paused || attackCooldown > 0) return;
    const stats = playerStats();
    attackCooldown = meta.weapon === "bow" ? 0.34 : 0.26;
    const p = game.player;

    if (meta.weapon === "bow") {
      sfx.bow();
      projectiles.push({
        x: p.x,
        y: p.y,
        dx: p.facing.x,
        dy: p.facing.y,
        left: stats.range,
        dmg: stats.dmg,
        color: "#e8d5a3",
      });
      addFx(
        "arrow",
        p.x + p.facing.x,
        p.y + p.facing.y,
        "#e8d5a3",
        0.18,
        Math.atan2(p.facing.y, p.facing.x)
      );
      return;
    }

    sfx.swing();
    p.attackT = 0.26;
    addFx(
      "slash",
      p.x + p.facing.x * 0.4,
      p.y + p.facing.y * 0.4,
      "#f0e2c4",
      0.18,
      Math.atan2(p.facing.y, p.facing.x)
    );
    let hit = false;
    for (const cell of cellsInRange(stats.range)) {
      const crate = crateAt(cell.x, cell.y);
      if (crate) {
        breakCrate(crate);
        hit = true;
      }
      const enemy = entityAt(cell.x, cell.y);
      if (enemy) {
        damageEnemy(enemy, stats.dmg + rand(0, 1), "#ffd27a", "sword");
        hit = true;
      }
    }
    if (!hit) {
      sfx.miss();
      showBanner("Miss", 350);
    }
    updateHud();
  }

  function doBlock() {
    if (!started || !game || game.over || paused || blockCooldown > 0 || blockTimer > 0) return;
    blockTimer = 0.7 + meta.bonusBlock;
    blockCooldown = 1.35;
    sfx.block();
    showBanner("Blocking", 400);
    updateHud();
  }

  function hasLineOfSight(from, to) {
    let x = from.x;
    let y = from.y;
    const dx = Math.abs(to.x - x);
    const dy = Math.abs(to.y - y);
    const sx = x < to.x ? 1 : -1;
    const sy = y < to.y ? 1 : -1;
    let err = dx - dy;
    while (x !== to.x || y !== to.y) {
      const e2 = err * 2;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
      if ((x !== to.x || y !== to.y) && game.dungeon.map[y][x] === TILES.WALL) return false;
    }
    return true;
  }

  function nearestEnemy(maxRange) {
    let best = null;
    let bestD = Infinity;
    for (const e of game.enemies) {
      if (e.hp <= 0) continue;
      const d = dist(e, game.player);
      if (d <= maxRange && d < bestD && (meta.spellEffects.phase || hasLineOfSight(game.player, e))) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  function launchSpellShot(kind, target, dmg, extras) {
    const p = game.player;
    const origin = extras && extras.from ? extras.from : p;
    const distTiles = Math.max(1, dist(origin, target));
    spellShots.push({
      kind,
      x0: origin.x,
      y0: origin.y,
      x1: target.x,
      y1: target.y,
      t: 0,
      dur: 0.18 + distTiles * 0.07,
      color: SPELLS[kind].color,
      target,
      dmg,
      extras: extras || {},
      done: false,
    });
  }

  function updateSpellShots(dt) {
    const next = [];
    for (const shot of spellShots) {
      shot.t += dt;
      const u = Math.min(1, shot.t / shot.dur);
      const x = shot.x0 + (shot.x1 - shot.x0) * u;
      const y = shot.y0 + (shot.y1 - shot.y0) * u;

      if (shot.kind === "fire") {
        addFx("flame", x + (Math.random() - 0.5) * 0.25, y + (Math.random() - 0.5) * 0.25, shot.color, 0.18);
      } else if (shot.kind === "frost") {
        addFx("ice", x, y, shot.color, 0.22);
      } else {
        addFx("spark", x, y, shot.color, 0.12);
      }

      if (u < 1) {
        next.push(shot);
        continue;
      }
      if (shot.done || shot.miss) continue;
      shot.done = true;

      if (shot.extras.crate) {
        breakCrate(shot.extras.crate);
      } else if (shot.target && shot.target.hp > 0) {
        damageEnemy(shot.target, shot.dmg, shot.color, shot.kind);
        if (shot.kind === "fire") {
          addFx("burst", shot.target.x, shot.target.y, shot.color, 0.45);
          for (let i = 0; i < 6; i++) {
            addFx(
              "flame",
              shot.target.x + (Math.random() - 0.5) * 0.8,
              shot.target.y + (Math.random() - 0.5) * 0.8,
              shot.color,
              0.3
            );
          }
          if (meta.spellEffects.fire) {
            for (const nearby of game.enemies) {
              if (nearby !== shot.target && nearby.hp > 0 && dist(nearby, shot.target) <= 1) {
                damageEnemy(nearby, Math.max(1, Math.floor(shot.dmg * 0.5)), shot.color, shot.kind);
              }
            }
          }
        } else if (shot.kind === "frost") {
          shot.target.slow = meta.spellEffects.frost ? 3.2 : 1.6;
          addFx("ring", shot.target.x, shot.target.y, shot.color, 0.5);
          for (let i = 0; i < 5; i++) {
            addFx(
              "ice",
              shot.target.x + (Math.random() - 0.5) * 0.7,
              shot.target.y + (Math.random() - 0.5) * 0.7,
              shot.color,
              0.4
            );
          }
          showBanner("Slowed", 450);
        } else {
          addFx("burst", shot.target.x, shot.target.y, shot.color, 0.35);
          if (meta.spellEffects.bolt && !shot.extras.forked) {
            const second = game.enemies.find((e) => e !== shot.target && e.hp > 0 && dist(e, shot.target) <= 3);
            if (second) {
              next.push({
                kind: "bolt",
                x0: shot.target.x,
                y0: shot.target.y,
                x1: second.x,
                y1: second.y,
                t: 0,
                dur: 0.22,
                color: SPELLS.bolt.color,
                target: second,
                dmg: Math.max(1, shot.dmg - 2),
                extras: { forked: true },
                done: false,
              });
            }
          }
        }
      }
      updateHud();
    }
    spellShots = next;
  }

  function doCast() {
    if (!started || !game || game.over || paused || castCooldown > 0) return;
    const p = game.player;
    const spell = SPELLS[p.spell];
    const stats = playerStats();
    const spellCost = Math.max(1, spell.cost - meta.manaDiscount);
    const spellRange = spell.range + stats.spellRange;
    if (p.mp < spellCost) {
      showBanner("Not enough MP", 600);
      return;
    }

    castCooldown = 0.55;
    p.mp -= spellCost;
    addFx("cast", p.x, p.y, spell.color, 0.4);

    if (p.spell === "fire") {
      sfx.fire();
      const target = nearestEnemy(spellRange);
      if (!target) {
        showBanner("No target", 450);
        updateHud();
        return;
      }
      launchSpellShot("fire", target, 5 + Math.floor(game.floor / 2) + stats.spellDmg);
    } else if (p.spell === "frost") {
      sfx.frost();
      const target = nearestEnemy(spellRange);
      if (!target) {
        showBanner("No target", 450);
        updateHud();
        return;
      }
      launchSpellShot("frost", target, 3 + Math.floor(game.floor / 3) + stats.spellDmg);
    } else if (p.spell === "bolt") {
      sfx.bolt();
      let x = p.x;
      let y = p.y;
      let hitEnemy = null;
      let hitCrate = null;
      let lastX = x;
      let lastY = y;
      for (let i = 0; i < spellRange; i++) {
        x += p.facing.x;
        y += p.facing.y;
        if (
          x < 0 || y < 0 ||
          x >= game.dungeon.size || y >= game.dungeon.size ||
          (!meta.spellEffects.phase && game.dungeon.map[y][x] === TILES.WALL)
        ) break;
        lastX = x;
        lastY = y;
        const crate = crateAt(x, y);
        if (crate) {
          hitCrate = crate;
          break;
        }
        const e = entityAt(x, y);
        if (e) {
          hitEnemy = e;
          break;
        }
      }
      if (hitEnemy) {
        launchSpellShot("bolt", hitEnemy, 7 + Math.floor(game.floor / 2) + stats.spellDmg);
      } else if (hitCrate) {
        launchSpellShot("bolt", hitCrate, 0, { crate: hitCrate });
      } else {
        spellShots.push({
          kind: "bolt",
          x0: p.x,
          y0: p.y,
          x1: lastX,
          y1: lastY,
          t: 0,
          dur: 0.2,
          color: spell.color,
          target: null,
          dmg: 0,
          extras: {},
          done: false,
          miss: true,
        });
        showBanner("Bolt missed", 450);
      }
    }

    updateHud();
  }

  function equipSpell(id) {
    if (!started || !game || game.over || !SPELLS[id] || !meta.unlockedSpells[id]) return;
    game.player.spell = id;
    showBanner(`${SPELLS[id].name} ready`, 450);
    updateHud();
  }

  function shopCost(item) {
    const owned = meta.purchased[item.id] || 0;
    return item.flatCost ? item.cost : item.cost + owned * Math.ceil(item.cost * 0.35);
  }

  function shopItemAvailable(item) {
    const owned = meta.purchased[item.id] || 0;
    if (item.max && owned >= item.max) return false;
    if (item.unlockSpell && meta.unlockedSpells[item.unlockSpell]) return false;
    if (item.spellEffect && item.spellEffect !== "phase" && (!meta.unlockedSpells[item.spellEffect] || meta.spellEffects[item.spellEffect])) return false;
    if (item.spellEffect === "phase" && meta.spellEffects.phase) return false;
    return true;
  }

  function rollShopOffers() {
    const pool = SHOP.filter(shopItemAvailable);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = rand(0, i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    game.shopOffers = pool.slice(0, 3).map((item) => item.id);
    game.shopPurchased = {};
  }

  function renderShop() {
    els.shopCoins.textContent = String(meta ? meta.coins : 0);
    els.shopGrid.innerHTML = "";
    const offers = game && game.shopOffers ? game.shopOffers : [];
    offers.forEach((id) => {
      const item = SHOP.find((entry) => entry.id === id);
      if (!item) return;
      const owned = meta.purchased[item.id] || 0;
      const cost = shopCost(item);
      const sold = !!game.shopPurchased[item.id];
      const card = document.createElement("div");
      card.className = `shop-item shop-item--${item.category}`;
      card.innerHTML = `
        <div class="shop-heading">
          <strong>${item.name}</strong>
          <span class="shop-category">${item.category}</span>
        </div>
        <p>${item.desc}${owned && !item.flatCost ? ` (owned ×${owned})` : ""}</p>
        <div class="shop-meta">
          <span>${cost} coins</span>
          <button type="button" class="shop-buy" data-id="${item.id}">${sold ? "Sold" : "Buy"}</button>
        </div>
      `;
      const btn = card.querySelector(".shop-buy");
      btn.disabled = !meta || meta.coins < cost || sold;
      btn.addEventListener("click", () => buyUpgrade(item.id));
      els.shopGrid.appendChild(card);
    });
    els.btnRefreshShop.disabled = !meta || meta.coins < 2;
  }

  function buyUpgrade(id) {
    if (!meta || els.shopScreen.classList.contains("hidden")) return;
    const item = SHOP.find((s) => s.id === id);
    if (!item || game.shopPurchased[item.id]) return;
    const owned = meta.purchased[item.id] || 0;
    const cost = shopCost(item);
    if (meta.coins < cost) {
      showBanner("Need more coins", 600);
      return;
    }
    meta.coins -= cost;
    game.shopPurchased[item.id] = true;
    meta.purchased[item.id] = owned + 1;
    if (item.key) meta[item.key] += item.amount;
    if (item.unlockSpell) unlockSpell(item.unlockSpell);
    if (item.spellEffect) meta.spellEffects[item.spellEffect] = true;

    if (game && !game.over) {
      const stats = playerStats();
      game.player.maxHp = stats.maxHp;
      game.player.maxMp = stats.maxMp;
      if (item.effect === "heal") game.player.hp = Math.min(stats.maxHp, game.player.hp + item.amount);
      if (item.effect === "restoreMp") game.player.mp = Math.min(stats.maxMp, game.player.mp + item.amount);
    }

    showBanner(`Bought ${item.name}`, 700);
    renderShop();
    updateHud();
  }

  function refreshShop() {
    if (!meta || !game || meta.coins < 2) {
      showBanner("Need 2 coins to refresh", 650);
      return;
    }
    meta.coins -= 2;
    rollShopOffers();
    renderShop();
    updateHud();
    showBanner("New wares arrived", 600);
  }

  function openPause() {
    if (!started || (game && game.over)) return;
    paused = true;
    els.shopScreen.classList.add("hidden");
    els.spellbookScreen.classList.add("hidden");
    els.pauseScreen.classList.remove("hidden");
  }

  function closePause() {
    if (!started || (game && game.over)) return;
    paused = false;
    els.pauseScreen.classList.add("hidden");
  }

  function togglePause() {
    if (!started || (game && game.over)) return;
    if (!els.spellbookScreen.classList.contains("hidden")) {
      closeSpellbook();
      return;
    }
    if (!els.shopScreen.classList.contains("hidden")) {
      closeShop();
      return;
    }
    if (paused) closePause();
    else openPause();
  }

  function openShop(fromPause) {
    if (!started || (game && game.over)) return;
    returnToPauseAfterShop = !!fromPause;
    paused = true;
    els.pauseScreen.classList.add("hidden");
    renderShop();
    els.shopScreen.classList.remove("hidden");
  }

  function closeShop() {
    els.shopScreen.classList.add("hidden");
    if (returnToPauseAfterShop) {
      returnToPauseAfterShop = false;
      els.pauseScreen.classList.remove("hidden");
      paused = true;
    } else {
      paused = false;
    }
  }

  function renderSpellbook() {
    if (!meta) return;
    const runeNames = {
      fire: "Ember Rune — fire splashes to adjacent foes",
      frost: "Rime Rune — frost slows for longer",
      bolt: "Forked Rune — bolt arcs to a second foe",
      phase: "Phase Rune — spells can cross walls",
    };
    const spellRows = meta.spellOrder.map((id, index) => {
      const spell = SPELLS[id];
      const cost = Math.max(1, spell.cost - meta.manaDiscount);
      return `<div class="spellbook-entry"><div class="spellbook-title"><strong>${index + 1}. ${spell.name}</strong><span class="spellbook-cost">${cost} MP</span></div><span>${meta.spellEffects[id] ? runeNames[id] : "No spell rune yet"}</span></div>`;
    });
    const extraRunes = meta.spellEffects.phase
      ? [`<div class="spellbook-entry rune"><strong>Universal Rune</strong><span>${runeNames.phase}</span></div>`]
      : [];
    els.spellbookList.innerHTML = [...spellRows, ...extraRunes].join("");
  }

  function openSpellbook(fromPause) {
    if (!started || !meta || (game && game.over)) return;
    returnToPauseAfterShop = !!fromPause;
    paused = true;
    els.pauseScreen.classList.add("hidden");
    els.shopScreen.classList.add("hidden");
    renderSpellbook();
    els.spellbookScreen.classList.remove("hidden");
  }

  function closeSpellbook() {
    els.spellbookScreen.classList.add("hidden");
    if (returnToPauseAfterShop) {
      returnToPauseAfterShop = false;
      els.pauseScreen.classList.remove("hidden");
      paused = true;
    } else {
      paused = false;
    }
  }

  function nextFloor() {
    const floor = game.floor + 1;
    const carry = {
      hp: game.player.hp,
      mp: game.player.mp,
      spell: game.player.spell,
    };
    startFloor(floor, carry);
    const theme = themeForFloor(floor);
    if ((floor - 1) % 5 === 0) {
      showBanner(`Theme: ${theme.name}`, 1600);
    } else {
      showBanner(`Floor ${floor}`, 1000);
    }
    if (els.hint) els.hint.textContent = "Move · Smash crates · Beat the boss · Descend";
  }

  function startFloor(floor, carry) {
    const dungeon = generateDungeon(floor);
    themePaints(dungeon.theme);
    const player = makePlayer(carry);
    player.x = dungeon.start.x;
    player.y = dungeon.start.y;
    player.fromX = player.x;
    player.fromY = player.y;
    player.moveT = 0;
    player.moveDur = MOVE_SLIDE;
    const enemies = spawnEnemies(dungeon, floor);
    enemies.forEach((e) => {
      e.fromX = e.x;
      e.fromY = e.y;
      e.moveT = 0;
      e.moveDur = MOVE_SLIDE;
    });
    game = {
      floor,
      dungeon,
      player,
      enemies,
      crates: spawnCrates(dungeon),
      pickups: [],
      shopOffers: [],
      shopPurchased: {},
      bossDown: false,
      over: false,
    };
    if (run) run.deepestFloor = Math.max(run.deepestFloor, floor);
    fx = [];
    projectiles = [];
    spellShots = [];
    applyThemeUI(dungeon.theme);
    moveCooldown = 0;
    attackCooldown = 0;
    castCooldown = 0;
    blockTimer = 0;
    blockCooldown = 0;
    spawnGuard = 1.5;
    rollShopOffers();
    snapCameraToPlayer();
    updateHud();
  }

  function showWeaponChoice() {
    pendingWeapon = null;
    els.weaponChoice.classList.remove("hidden");
    els.spellChoice.classList.add("hidden");
  }

  function chooseWeapon(weaponId) {
    pendingWeapon = weaponId;
    els.weaponChoice.classList.add("hidden");
    els.spellChoice.classList.remove("hidden");
  }

  function openCryptDoors() {
    if (!els.welcomeScreen || els.welcomeScreen.classList.contains("opening")) return;
    els.welcomeScreen.classList.add("opening");
    if (els.startScreen) els.startScreen.classList.remove("hidden");
    try {
      ensureAudio();
      sfx.creak();
    } catch (_err) {
      /* ignore audio failures so the gate still opens */
    }
    window.setTimeout(() => {
      if (els.welcomeScreen) els.welcomeScreen.classList.add("hidden");
    }, 1180);
  }

  function beginRun(weaponId, spellId) {
    ensureAudio();
    meta = createMeta(weaponId, spellId);
    run = createRunStats();
    started = true;
    paused = false;
    hideAllMenus();
    els.startScreen.classList.add("hidden");
    startFloor(1, null);
    showBanner(`${WEAPONS[weaponId].name} · ${SPELLS[spellId].name} ready`, 1200);
  }

  function restartRun() {
    started = false;
    paused = false;
    game = null;
    meta = null;
    run = null;
    clearDeathSequence();
    hideAllMenus();
    showWeaponChoice();
    els.startScreen.classList.remove("hidden");
  }

  function returnToTitle() {
    restartRun();
    els.startScreen.classList.add("hidden");
    els.welcomeScreen.classList.remove("opening", "hidden");
  }

  function updateProjectiles() {
    const next = [];
    for (const bolt of projectiles) {
      bolt.x += bolt.dx;
      bolt.y += bolt.dy;
      bolt.left -= 1;
      addFx("arrow", bolt.x, bolt.y, bolt.color, 0.16, Math.atan2(bolt.dy, bolt.dx));

      if (
        bolt.x < 0 || bolt.y < 0 ||
        bolt.x >= game.dungeon.size || bolt.y >= game.dungeon.size ||
        game.dungeon.map[bolt.y][bolt.x] === TILES.WALL
      ) {
        continue;
      }

      const crate = crateAt(bolt.x, bolt.y);
      if (crate) {
        breakCrate(crate);
        continue;
      }

      const enemy = entityAt(bolt.x, bolt.y);
      if (enemy) {
        damageEnemy(enemy, bolt.dmg, "#ffd27a", "bow");
        continue;
      }

      if (bolt.left > 0) next.push(bolt);
    }
    projectiles = next;
  }

  function updateEnemies(dt) {
    const p = game.player;
    for (const e of game.enemies) {
      if (e.hp <= 0) continue;
      tickSlide(e, dt);
      if (e.flash > 0) e.flash -= dt;
      if (e.slow > 0) e.slow -= dt;
      if (e.attackWindup > 0) {
        e.attackWindup -= dt;
        if (e.attackWindup <= 0 && dist(e, p) === 1) hurtPlayer(e.dmg);
        continue;
      }
      e.moveTimer -= dt * (e.slow > 0 ? 0.45 : 1);
      if (e.moveTimer > 0 || (e.moveT && e.moveT > 0)) continue;

      e.moveTimer = (e.isBoss ? 0.55 : 0.42) / e.speed;
      if (spawnGuard > 0) continue;

      const d = dist(e, p);
      if (d === 1) {
        e.attackWindup = e.isBoss ? 0.8 : 0.58;
        addFx("telegraph", e.x, e.y, "#ff594d", e.attackWindup);
        continue;
      }
      if (d > 7) continue;

      let dx = 0;
      let dy = 0;
      if (Math.abs(p.x - e.x) > Math.abs(p.y - e.y)) dx = p.x > e.x ? 1 : -1;
      else if (p.y !== e.y) dy = p.y > e.y ? 1 : -1;
      else dx = p.x > e.x ? 1 : -1;

      const nx = e.x + dx;
      const ny = e.y + dy;
      if (
        isWalkable(nx, ny) &&
        !entityAt(nx, ny) &&
        !crateAt(nx, ny) &&
        !(nx === p.x && ny === p.y)
      ) {
        beginSlide(e, nx, ny);
      }
    }
  }

  function updateFx(dt) {
    fx = fx.filter((f) => {
      f.life -= dt;
      return f.life > 0;
    });
  }

  function snapCameraToPlayer() {
    if (!game) return;
    const p = visualPos(game.player);
    const maxX = Math.max(0, game.dungeon.size - VIEW_W);
    const maxY = Math.max(0, game.dungeon.size - VIEW_H);
    camX = Math.max(0, Math.min(maxX, p.x - VIEW_W / 2 + 0.5));
    camY = Math.max(0, Math.min(maxY, p.y - VIEW_H / 2 + 0.5));
  }

  function updateCamera(dt) {
    if (!game) return;
    const p = visualPos(game.player);
    const maxX = Math.max(0, game.dungeon.size - VIEW_W);
    const maxY = Math.max(0, game.dungeon.size - VIEW_H);
    const targetX = Math.max(0, Math.min(maxX, p.x - VIEW_W / 2 + 0.5));
    const targetY = Math.max(0, Math.min(maxY, p.y - VIEW_H / 2 + 0.5));
    const follow = 1 - Math.exp(-7 * dt);
    camX += (targetX - camX) * follow;
    camY += (targetY - camY) * follow;
  }

  function roundRectPath(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // A soft oval shadow on the floor, fading out at its edge
  function drawGroundShadow(cx, cy, rx, ry, alpha) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(20,14,40,${alpha})`);
    g.addColorStop(1, "rgba(20,14,40,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // A sphere lit from the top left: [highlight, body, shadow side]
  function fillBall(cx, cy, r, colors) {
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.08, cx, cy, r);
    g.addColorStop(0, colors[0]);
    g.addColorStop(0.45, colors[1]);
    g.addColorStop(1, colors[2]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function fillTriangle(ax, ay, bx, by, cx, cy, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();
  }

  function drawCrate(px, py, crate) {
    // Treasure chest: a rounded lid on a darker front, with a gold latch
    const boss = crate && crate.bossChest;
    drawGroundShadow(px + 16, py + 27, 14, 4, 0.42);
    ctx.fillStyle = linear(0, py + 17, 0, py + 27, boss
      ? [[0, "#7a3fa0"], [1, "#3a1656"]]
      : [[0, "#a9662f"], [1, "#6a3a18"]]);
    roundRectPath(px + 5, py + 16, 22, 11, 3);
    ctx.fill();
    ctx.fillStyle = linear(px + 5, py + 6, px + 20, py + 19, boss
      ? [[0, "#e2c2ff"], [1, "#9a5ad0"]]
      : [[0, "#f6c590"], [1, "#c47b40"]]);
    roundRectPath(px + 5, py + 6, 22, 12, 5);
    ctx.fill();
    ctx.fillStyle = linear(px + 13, py + 13, px + 19, py + 20, [[0, "#fff2b0"], [0.5, "#ffc700"], [1, "#c98f00"]]);
    roundRectPath(px + 13, py + 13, 6, 7, 1.5);
    ctx.fill();
  }

  function drawPickup(pickup, px, py) {
    const bob = Math.sin(animFrame * 0.09 + pickup.x) * 2;
    const isMana = pickup.type === "mana";
    drawGroundShadow(px + 16, py + 26, 8, 3, 0.35 - bob * 0.03);
    fillBall(px + 16, py + 15 + bob, 6.5, isMana
      ? ["#e6eeff", "#6f9bff", "#2242b0"]
      : ["#ffe2e8", "#ff5c7a", "#b01f3d"]);
  }

  function drawPlayer(px, py) {
    const cx = px + 16;
    const cy = py + 16;
    const facing = game.player.facing;
    const facingAngle = Math.atan2(facing.y, facing.x);
    drawGroundShadow(cx, py + 27, 12, 4, 0.45);

    let swordSwing = 0;
    if (meta.weapon === "sword" && game.player.attackT > 0) {
      const progress = Math.max(0, Math.min(1, 1 - game.player.attackT / 0.26));
      if (progress < 0.72) {
        const forward = progress / 0.72;
        const eased = 0.5 - Math.cos(forward * Math.PI) / 2;
        swordSwing = -1.02 + eased * 2.08;
      } else {
        const recovery = (progress - 0.72) / 0.28;
        const eased = 0.5 - Math.cos(recovery * Math.PI) / 2;
        swordSwing = 1.06 * (1 - eased);
      }
    }

    // Weapons are authored pointing right, then rotated to the player's facing.
    // The sword rides at the player's side so the facing triangle stays clear.
    const drawWeapon = () => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(facingAngle + swordSwing);
      if (meta.weapon === "bow") {
        ctx.lineCap = "round";
        ctx.strokeStyle = linear(0, -9, 0, 9, [[0, "#f2c27a"], [0.5, "#c4843f"], [1, "#7a4a1e"]]);
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(6, -9);
        ctx.quadraticCurveTo(14, 0, 6, 9);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(6, -9);
        ctx.lineTo(6, 9);
        ctx.stroke();
      } else {
        ctx.fillStyle = linear(0, 6.2, 0, 9.8, [[0, "#ffffff"], [0.5, "#c9ced8"], [1, "#7c8496"]]);
        ctx.beginPath();
        ctx.moveTo(3, 6.2);
        ctx.lineTo(19, 8);
        ctx.lineTo(3, 9.8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = linear(0, 4, 0, 12, [[0, "#fff2b0"], [0.5, "#ffc700"], [1, "#b07d00"]]);
        roundRectPath(1, 4, 2.6, 8, 1.2);
        ctx.fill();
        ctx.fillStyle = linear(0, 7, 0, 9, [[0, "#b07a4a"], [1, "#5c3a1c"]]);
        roundRectPath(-4, 7, 5.5, 2, 1);
        ctx.fill();
      }
      ctx.restore();
    };

    const weaponBehind = facing.y < 0;
    if (weaponBehind) drawWeapon();
    fillBall(cx, cy, 10.5, ["#dce6ff", "#4f74f5", "#16309a"]);
    if (!weaponBehind) drawWeapon();

    // Facing indicator: a small triangle just in front of the player
    ctx.save();
    ctx.translate(cx + Math.cos(facingAngle) * 18, cy + Math.sin(facingAngle) * 18);
    ctx.rotate(facingAngle);
    fillTriangle(5.5, 0, -3.5, -5, -3.5, 5, linear(-3.5, 0, 5.5, 0, [[0, "#8fa8ff"], [1, "#ffffff"]]));
    ctx.restore();

    if (blockTimer > 0) {
      const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, 16);
      g.addColorStop(0, "rgba(124,240,176,0)");
      g.addColorStop(0.72, "rgba(124,240,176,0.22)");
      g.addColorStop(1, "rgba(190,255,215,0.8)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawEnemy(e, px, py) {
    const pulse = Math.sin(animFrame * 0.12 + e.x * 2) * 1.2;
    const cx = px + 16;
    if (e.flash > 0) ctx.globalAlpha = 0.55 + Math.sin(animFrame) * 0.2;

    const flying = e.kind === "bat" || e.kind === "wraith";
    drawGroundShadow(cx, py + 27, e.isBoss ? 17 : 10, e.isBoss ? 5 : 3.5, flying ? 0.24 : 0.42);

    if (e.isBoss) {
      if (e.kind === "ogre") {
        // A heavy green block
        const top = py + pulse * 0.6;
        ctx.fillStyle = linear(cx - 14, top, cx + 6, top + 18, [[0, "#d2f59c"], [1, "#7fb33f"]]);
        roundRectPath(cx - 14, top, 28, 18, 4);
        ctx.fill();
        ctx.fillStyle = linear(0, top + 17, 0, top + 27, [[0, "#5c8a2a"], [1, "#2a4710"]]);
        roundRectPath(cx - 14, top + 16, 28, 11, 3);
        ctx.fill();
      } else if (e.kind === "wraith") {
        // A pale floating pyramid with a cold glow
        const top = py - 6 + pulse * 2;
        const glow = ctx.createRadialGradient(cx, top + 16, 2, cx, top + 16, 20);
        glow.addColorStop(0, "rgba(150,180,255,0.4)");
        glow.addColorStop(1, "rgba(150,180,255,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, top + 16, 20, 0, Math.PI * 2);
        ctx.fill();
        fillTriangle(cx, top, cx, top + 28, cx - 13, top + 23,
          linear(cx - 13, top, cx, top + 28, [[0, "#eef2ff"], [1, "#8aa0e8"]]));
        fillTriangle(cx, top, cx + 13, top + 23, cx, top + 28,
          linear(cx, top, cx + 13, top + 28, [[0, "#8aa0e8"], [1, "#27326a"]]));
      } else {
        // A fiery ball with horns and wings
        const by = py + 14 + pulse;
        const wing = Math.sin(animFrame * 0.2) * 2;
        fillTriangle(cx - 9, by - 2, cx - 21, by - 9 + wing, cx - 15, by + 8,
          linear(cx - 21, by - 9, cx - 9, by + 8, [[0, "#ffb07a"], [1, "#9c2f14"]]));
        fillTriangle(cx + 9, by - 2, cx + 21, by - 9 + wing, cx + 15, by + 8,
          linear(cx + 21, by - 9, cx + 9, by + 8, [[0, "#ff9a5c"], [1, "#7a220e"]]));
        const horn = linear(0, by - 18, 0, by - 6, [[0, "#fff2b0"], [1, "#c98f00"]]);
        fillTriangle(cx - 8, by - 8, cx - 11, by - 19, cx - 3, by - 11, horn);
        fillTriangle(cx + 8, by - 8, cx + 11, by - 19, cx + 3, by - 11, horn);
        fillBall(cx, by, 12.5, ["#ffd8b8", "#ff6a3d", "#8a1d0c"]);
      }
    } else if (e.kind === "slime") {
      // A squat green dome
      const base = py + 25;
      const h = 15 + pulse * 0.8;
      const g = ctx.createRadialGradient(cx - 4, base - h * 0.7, 1, cx, base - h * 0.4, 15);
      g.addColorStop(0, "#d6ffe6");
      g.addColorStop(0.3, "#72f0a8");
      g.addColorStop(0.62, "#3ddc84");
      g.addColorStop(1, "#1a9354");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - 11.5, base);
      ctx.bezierCurveTo(cx - 11.5, base - h * 1.25, cx + 11.5, base - h * 1.25, cx + 11.5, base);
      ctx.quadraticCurveTo(cx, base + 3, cx - 11.5, base);
      ctx.closePath();
      ctx.fill();
    } else if (e.kind === "bat") {
      // A purple ball on flapping triangle wings
      const by = py + 11 + pulse * 1.5;
      const flap = Math.sin(animFrame * 0.35) * 3;
      fillTriangle(cx - 4, by, cx - 15, by - 5 + flap, cx - 11, by + 6,
        linear(cx - 15, by - 5, cx - 4, by + 6, [[0, "#a77cff"], [1, "#4a1fa8"]]));
      fillTriangle(cx + 4, by, cx + 15, by - 5 + flap, cx + 11, by + 6,
        linear(cx + 15, by - 5, cx + 4, by + 6, [[0, "#9468f5"], [1, "#3c1890"]]));
      fillBall(cx, by, 6, ["#efe4ff", "#b48cff", "#5a28c0"]);
    } else {
      // A skeleton: a bone-white skull resting on rounded shoulders
      const sy = py + pulse * 0.6;
      ctx.fillStyle = linear(0, sy + 18, 0, sy + 25, [[0, "#fbf8f2"], [0.6, "#d8d1c2"], [1, "#a39a86"]]);
      roundRectPath(cx - 9, sy + 18, 18, 7, 3.5);
      ctx.fill();
      fillBall(cx, sy + 13, 7, ["#ffffff", "#f0ebe1", "#b5ab98"]);
    }

    ctx.globalAlpha = 1;
    if (e.isBoss || e.hp < e.maxHp) {
      const w = e.isBoss ? 28 : 18;
      const hx = px + (32 - w) / 2;
      const hy = e.isBoss ? py - 11 : py + 1;
      ctx.fillStyle = "rgba(20,14,40,0.6)";
      roundRectPath(hx, hy, w, 5, 2.5);
      ctx.fill();
      const fillW = w * Math.max(0, e.hp / e.maxHp);
      if (fillW > 0) {
        ctx.fillStyle = linear(0, hy, 0, hy + 5, e.isBoss
          ? [[0, "#fff0a0"], [1, "#e09a00"]]
          : [[0, "#ff9db0"], [1, "#d6264a"]]);
        roundRectPath(hx, hy, Math.max(fillW, 2.5), 5, 2.5);
        ctx.fill();
      }
    }
  }

  function drawFx(cx, cy) {
    for (const shot of spellShots) {
      const u = Math.min(1, shot.t / shot.dur);
      const x = shot.x0 + (shot.x1 - shot.x0) * u;
      const y = shot.y0 + (shot.y1 - shot.y0) * u;
      const px = (x - cx) * TILE + TILE / 2;
      const py = (y - cy) * TILE + TILE / 2;
      if (shot.kind === "fire") {
        const r = 6 + Math.sin(animFrame * 0.4) * 2;
        const grad = ctx.createRadialGradient(px, py, 1, px, py, r + 4);
        grad.addColorStop(0, "#fff2a8");
        grad.addColorStop(0.35, "#ff6b35");
        grad.addColorStop(1, "rgba(180,40,10,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, r + 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (shot.kind === "frost") {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(u * Math.PI * 2);
        ctx.fillStyle = "#e8f7ff";
        ctx.strokeStyle = shot.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2;
          const rad = i % 2 ? 7 : 4;
          const sx = Math.cos(ang) * rad;
          const sy = Math.sin(ang) * rad;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = shot.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px - 8, py);
        ctx.lineTo(px + 8, py);
        ctx.stroke();
        ctx.fillStyle = "#fff6c8";
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const f of fx) {
      const px = (f.x - cx) * TILE + TILE / 2;
      const py = (f.y - cy) * TILE + TILE / 2;
      const a = f.life / f.max;
      ctx.globalAlpha = Math.max(0, a);
      if (f.type === "burst" || f.type === "ring") {
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, (f.type === "ring" ? 10 : 4) + (1 - a) * 12, 0, Math.PI * 2);
        ctx.stroke();
      } else if (f.type === "slash") {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(f.angle);
        ctx.strokeStyle = f.color;
        ctx.lineCap = "round";
        const slashSegments = 8;
        const visibleSegments = Math.max(1, Math.ceil((1 - a) * slashSegments));
        for (let i = 0; i < visibleSegments; i++) {
          const start = -0.92 + (i / slashSegments) * 1.84;
          const end = -0.92 + ((i + 1) / slashSegments) * 1.84 + 0.035;
          ctx.globalAlpha = Math.max(0, a) * (0.6 + i / (slashSegments * 2.2));
          ctx.lineWidth = 0.65 + i * 0.58;
          ctx.beginPath();
          ctx.arc(0, 0, 9.5 + i * 0.13, start, end);
          ctx.stroke();
        }
        ctx.restore();
      } else if (f.type === "arrow") {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(f.angle);
        ctx.strokeStyle = f.color;
        ctx.fillStyle = f.color;
        ctx.lineWidth = 1.15;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(7, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(5, -2.2);
        ctx.lineTo(5, 2.2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(-11, -2.5);
        ctx.moveTo(-8, 0);
        ctx.lineTo(-11, 2.5);
        ctx.stroke();
        ctx.restore();
      } else if (f.type === "cast") {
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 5 + (1 - a) * 17, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const angle = animFrame * 0.08 + i * Math.PI / 2;
          ctx.fillStyle = f.color;
          ctx.fillRect(px + Math.cos(angle) * 12 - 1, py + Math.sin(angle) * 12 - 1, 3, 3);
        }
      } else if (f.type === "telegraph") {
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 2 + Math.sin(animFrame * .45);
        ctx.beginPath();
        ctx.arc(px, py, 11 + Math.sin(animFrame * .35) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = f.color;
        ctx.font = "700 15px Fredoka, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("!", px, py - 14);
      } else if (f.type === "flame") {
        const h = 6 + (1 - a) * 8;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, h);
        grad.addColorStop(0, "rgba(255,240,160,0.9)");
        grad.addColorStop(0.45, f.color);
        grad.addColorStop(1, "rgba(120,20,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(px, py - h);
        ctx.quadraticCurveTo(px + 5, py - h * 0.3, px + 2, py + 3);
        ctx.quadraticCurveTo(px, py + 1, px - 2, py + 3);
        ctx.quadraticCurveTo(px - 5, py - h * 0.3, px, py - h);
        ctx.fill();
      } else if (f.type === "ice") {
        ctx.strokeStyle = f.color;
        ctx.fillStyle = "rgba(220,245,255,0.75)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px, py - 6);
        ctx.lineTo(px + 4, py);
        ctx.lineTo(px, py + 6);
        ctx.lineTo(px - 4, py);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px - 5, py - 2);
        ctx.lineTo(px + 5, py + 2);
        ctx.moveTo(px + 5, py - 2);
        ctx.lineTo(px - 5, py + 2);
        ctx.stroke();
      } else if (f.type === "spark" || f.type === "flash") {
        ctx.fillStyle = f.color;
        if (f.type === "flash") {
          const glow = ctx.createRadialGradient(px, py, 0, px, py, 12);
          glow.addColorStop(0, f.color);
          glow.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(px, py, 12, 0, Math.PI * 2);
          ctx.fill();
        }
        else {
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (f.type === "text") {
        ctx.fillStyle = f.color;
        ctx.font = "700 14px Fredoka, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("!", px, py - (1 - a) * 12);
      }
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    const s = renderScale;
    const home = () => ctx.setTransform(s, 0, 0, s, 0, 0);
    const at = (x, y) => ctx.setTransform(s, 0, 0, s, x * s, y * s);
    home();
    const theme = game ? game.dungeon.theme : THEMES[0];
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (!game) return;

    const paints = themePaints(theme);
    const { map, size } = game.dungeon;
    const bossRoom = game.dungeon.bossRoom;
    const startX = Math.floor(camX) - 1;
    const startY = Math.floor(camY) - 1;
    const endX = Math.ceil(camX + VIEW_W) + 1;
    const endY = Math.ceil(camY + VIEW_H) + 1;
    const inMap = (x, y) => x >= 0 && y >= 0 && x < size && y < size;
    const isWall = (x, y) => !inMap(x, y) || map[y][x] === TILES.WALL;

    // Floors first, shaded where they meet a wall
    for (let my = startY; my <= endY; my++) {
      for (let mx = startX; mx <= endX; mx++) {
        if (isWall(mx, my)) continue;
        at((mx - camX) * TILE, (my - camY) * TILE);
        ctx.fillStyle = (mx + my) % 2 ? paints.floorB : paints.floorA;
        ctx.fillRect(0, 0, TILE + 0.5, TILE + 0.5);
        if (map[my][mx] === TILES.STAIRS) {
          ctx.fillStyle = paints.stairs;
          roundRectPath(3, 3, TILE - 6, TILE - 6, 4);
          ctx.fill();
          ctx.fillStyle = paints.stairsEdge;
          ctx.fill();
        }
        if (
          mx >= bossRoom.x && mx < bossRoom.x + bossRoom.w &&
          my >= bossRoom.y && my < bossRoom.y + bossRoom.h
        ) {
          ctx.fillStyle = paints.bossTint;
          ctx.fillRect(0, 0, TILE + 0.5, TILE + 0.5);
        }
        if (isWall(mx, my - 1)) {
          ctx.fillStyle = paints.shadeTop;
          ctx.fillRect(0, 0, TILE + 0.5, 13);
        }
        if (isWall(mx - 1, my)) {
          ctx.fillStyle = paints.shadeLeft;
          ctx.fillRect(0, 0, 8, TILE + 0.5);
        }
        if (isWall(mx + 1, my)) {
          ctx.fillStyle = paints.shadeRight;
          ctx.fillRect(TILE - 8, 0, 8, TILE + 0.5);
        }
      }
    }
    home();

    const pPos = visualPos(game.player);
    const playerPx = (pPos.x - camX) * TILE;
    const playerPy = (pPos.y - camY) * TILE;

    // A soft pool of light follows the player
    const pool = ctx.createRadialGradient(
      playerPx + TILE / 2, playerPy + TILE / 2, 0,
      playerPx + TILE / 2, playerPy + TILE / 2, TILE * 6
    );
    pool.addColorStop(0, "rgba(255,248,230,0.16)");
    pool.addColorStop(1, "rgba(255,248,230,0)");
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (game.bossDown) {
      const sp = game.dungeon.stairsPos;
      const sx = (sp.x - camX) * TILE + TILE / 2;
      const sy = (sp.y - camY) * TILE + TILE / 2;
      const pulse = 0.5 + Math.sin(animFrame * 0.08) * 0.2;
      const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, TILE);
      glow.addColorStop(0, rgba(theme.accent, pulse));
      glow.addColorStop(1, rgba(theme.accent, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(sx - TILE, sy - TILE, TILE * 2, TILE * 2);
    }

    const bossPx = (game.dungeon.bossPos.x - camX) * TILE + TILE / 2;
    const bossPy = (game.dungeon.bossPos.y - camY) * TILE + TILE / 2;
    ctx.save();
    ctx.translate(bossPx, bossPy);
    ctx.rotate(animFrame * 0.002);
    ctx.strokeStyle = game.bossDown ? "rgba(120,100,160,.25)" : "rgba(255,77,109,.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
      ctx.lineTo(Math.cos(a) * 31, Math.sin(a) * 31);
    }
    ctx.stroke();
    ctx.restore();

    // Everything that stands on the floor is drawn row by row, so a wall
    // in front of a creature can hide its feet.
    const rows = new Map();
    const place = (row, paint) => {
      const r = Math.max(startY, Math.min(endY + 1, row));
      if (!rows.has(r)) rows.set(r, []);
      rows.get(r).push(paint);
    };
    const onScreen = (px, py) => px > -TILE * 2 && py > -TILE * 2 && px < CANVAS_W + TILE && py < CANVAS_H + TILE;

    for (const crate of game.crates) {
      if (crate.hp <= 0) continue;
      const px = (crate.x - camX) * TILE;
      const py = (crate.y - camY) * TILE;
      if (onScreen(px, py)) place(crate.y, () => drawCrate(px, py, crate));
    }
    for (const pickup of game.pickups) {
      if (pickup.collected) continue;
      const px = (pickup.x - camX) * TILE;
      const py = (pickup.y - camY) * TILE;
      if (onScreen(px, py)) place(pickup.y, () => drawPickup(pickup, px, py));
    }
    for (const e of game.enemies) {
      if (e.hp <= 0) continue;
      const pos = visualPos(e);
      const px = (pos.x - camX) * TILE;
      const py = (pos.y - camY) * TILE;
      if (onScreen(px, py)) place(Math.ceil(pos.y - 0.001), () => drawEnemy(e, px, py));
    }
    place(Math.ceil(pPos.y - 0.001), () => drawPlayer(playerPx, playerPy));

    // Only walls that border open ground are drawn as blocks; solid rock
    // beyond them stays dark.
    const bordersOpen = (x, y) => {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx || dy) && !isWall(x + dx, y + dy)) return true;
        }
      }
      return false;
    };
    const lift = WALL_LIFT;

    for (let my = startY; my <= endY + 1; my++) {
      for (let mx = startX; mx <= endX; mx++) {
        if (!inMap(mx, my) || map[my][mx] !== TILES.WALL || !bordersOpen(mx, my)) continue;
        const px = (mx - camX) * TILE;
        const py = (my - camY) * TILE;
        // Wall tops lean away from the middle of the screen, so the camera
        // sees the inner face of walls to either side.
        const ox = (px + TILE / 2 - CANVAS_W / 2) * WALL_LEAN;
        at(px, py);
        if (ox < 0 && !isWall(mx + 1, my)) {
          ctx.fillStyle = paints.wallSide;
          ctx.beginPath();
          ctx.moveTo(TILE, 0);
          ctx.lineTo(TILE + ox, -lift);
          ctx.lineTo(TILE + ox, TILE - lift);
          ctx.lineTo(TILE, TILE);
          ctx.closePath();
          ctx.fill();
        } else if (ox > 0 && !isWall(mx - 1, my)) {
          ctx.fillStyle = paints.wallSide;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(ox, -lift);
          ctx.lineTo(ox, TILE - lift);
          ctx.lineTo(0, TILE);
          ctx.closePath();
          ctx.fill();
        }
        if (!isWall(mx, my + 1)) {
          ctx.fillStyle = paints.wallFront;
          ctx.beginPath();
          ctx.moveTo(0, TILE);
          ctx.lineTo(ox, TILE - lift);
          ctx.lineTo(TILE + ox, TILE - lift);
          ctx.lineTo(TILE, TILE);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = paints.wallTop;
        ctx.fillRect(ox - 0.5, -lift, TILE + 1, TILE + 0.5);
      }
      home();
      const paintsInRow = rows.get(my);
      if (paintsInRow) paintsInRow.forEach((paint) => paint());
    }
    home();

    drawFx(camX, camY);

    const g = ctx.createRadialGradient(
      CANVAS_W / 2, CANVAS_H / 2, Math.min(CANVAS_W, CANVAS_H) * 0.38,
      CANVAS_W / 2, CANVAS_H / 2, Math.max(CANVAS_W, CANVAS_H) * 0.72
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, theme.fog);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (game.bossDown) {
      const st = game.dungeon.stairsPos;
      const dx = st.x - game.player.x;
      const dy = st.y - game.player.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 4) {
        const horizontal = Math.abs(dx) > Math.abs(dy);
        const labelX = horizontal ? (dx > 0 ? CANVAS_W - 18 : 18) : CANVAS_W / 2;
        const labelY = horizontal ? CANVAS_H / 2 : (dy > 0 ? CANVAS_H - 16 : 16);
        const angle = horizontal ? (dx > 0 ? 0 : Math.PI) : (dy > 0 ? Math.PI / 2 : -Math.PI / 2);
        ctx.save();
        ctx.translate(labelX, labelY);
        ctx.rotate(angle);
        fillTriangle(7, 0, -5, -8, -5, 8, linear(-5, 0, 7, 0, [[0, theme.accent], [1, "#ffffff"]]));
        ctx.restore();
      }
    }
  }

  function tick(time) {
    const dt = Math.min(0.05, (time - lastTime) / 1000 || 0.016);
    lastTime = time;
    animFrame++;

    if (bannerTimer > 0) {
      bannerTimer -= dt * 1000;
      if (bannerTimer <= 0) els.banner.classList.add("hidden");
    }

    if (started && game && !game.over && !paused) {
      if (run) run.playTime += dt;
      if (spawnGuard > 0) spawnGuard -= dt;
      if (moveCooldown > 0) moveCooldown -= dt;
      if (attackCooldown > 0) attackCooldown -= dt;
      if (game.player.attackT > 0) game.player.attackT = Math.max(0, game.player.attackT - dt);
      if (castCooldown > 0) castCooldown -= dt;
      if (blockTimer > 0) {
        blockTimer -= dt;
        if (blockTimer <= 0) updateHud();
      }
      if (blockCooldown > 0) {
        blockCooldown -= dt;
        if (blockCooldown <= 0) updateHud();
      }

      tickSlide(game.player, dt);

      if (moveCooldown <= 0 && heldDirs.size) {
        for (const d of ["up", "down", "left", "right"]) {
          if (!heldDirs.has(d)) continue;
          const vec = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d];
          if (tryMove(vec[0], vec[1])) break;
        }
      }

      // Step projectiles on a short cadence
      if (!game._projAcc) game._projAcc = 0;
      game._projAcc += dt;
      if (game._projAcc >= 0.08) {
        game._projAcc = 0;
        updateProjectiles();
      }

      updateEnemies(dt);
      updateSpellShots(dt);
      updateCamera(dt);
      updateFx(dt);
    } else if (game) {
      // While a run is ending, the world drifts on in slow motion
      const stepDt = deathSeq && deathSeq.slow ? dt * 0.3 : dt;
      if (deathSeq) {
        tickSlide(game.player, stepDt);
        for (const e of game.enemies) {
          if (e.hp > 0) tickSlide(e, stepDt);
        }
      }
      updateSpellShots(stepDt);
      updateFx(stepDt);
      updateCamera(stepDt);
    }

    draw();
    requestAnimationFrame(tick);
  }

  function bindControls() {
    const dirMap = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0],
    };

    document.querySelectorAll(".pad-btn.dir").forEach((btn) => {
      const dir = btn.dataset.dir;
      const press = (ev) => {
        ev.preventDefault();
        heldDirs.add(dir);
        btn.classList.add("held");
        const [dx, dy] = dirMap[dir];
        tryMove(dx, dy);
      };
      const release = (ev) => {
        ev.preventDefault();
        heldDirs.delete(dir);
        btn.classList.remove("held");
      };
      btn.addEventListener("pointerdown", press);
      btn.addEventListener("pointerup", release);
      btn.addEventListener("pointerleave", release);
      btn.addEventListener("pointercancel", release);
    });

    if (els.moveJoystick && els.joystickKnob) {
      let joystickPointer = null;
      let joystickDir = null;

      const setJoystickDirection = (nextDir) => {
        if (joystickDir === nextDir) return;
        if (joystickDir) heldDirs.delete(joystickDir);
        joystickDir = nextDir;
        if (!nextDir) {
          els.moveJoystick.setAttribute("aria-valuetext", "Centered");
          return;
        }
        heldDirs.add(nextDir);
        els.moveJoystick.setAttribute("aria-valuetext", `Moving ${nextDir}`);
        const [dx, dy] = dirMap[nextDir];
        tryMove(dx, dy);
      };

      const updateJoystick = (ev) => {
        const rect = els.moveJoystick.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const rawX = ev.clientX - cx;
        const rawY = ev.clientY - cy;
        const distance = Math.hypot(rawX, rawY);
        const limit = Math.max(24, rect.width * 0.3);
        const scale = distance > limit ? limit / distance : 1;
        const x = rawX * scale;
        const y = rawY * scale;
        els.joystickKnob.style.transform = `translate(${x}px, ${y}px)`;

        if (distance < rect.width * 0.13) {
          setJoystickDirection(null);
        } else if (Math.abs(rawX) > Math.abs(rawY)) {
          setJoystickDirection(rawX > 0 ? "right" : "left");
        } else {
          setJoystickDirection(rawY > 0 ? "down" : "up");
        }
      };

      const releaseJoystick = (ev) => {
        if (joystickPointer !== ev.pointerId) return;
        joystickPointer = null;
        setJoystickDirection(null);
        els.joystickKnob.style.transform = "translate(0, 0)";
        els.moveJoystick.classList.remove("active");
      };

      els.moveJoystick.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        joystickPointer = ev.pointerId;
        els.moveJoystick.setPointerCapture(ev.pointerId);
        els.moveJoystick.classList.add("active");
        updateJoystick(ev);
      });
      els.moveJoystick.addEventListener("pointermove", (ev) => {
        if (joystickPointer !== ev.pointerId) return;
        ev.preventDefault();
        updateJoystick(ev);
      });
      els.moveJoystick.addEventListener("pointerup", releaseJoystick);
      els.moveJoystick.addEventListener("pointercancel", releaseJoystick);
      els.moveJoystick.addEventListener("lostpointercapture", (ev) => {
        if (joystickPointer === ev.pointerId) releaseJoystick(ev);
      });
    }

    const bindAction = (el, fn) => {
      if (!el) return;
      el.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        el.classList.add("held");
        fn();
      });
      const up = (ev) => {
        ev.preventDefault();
        el.classList.remove("held");
      };
      el.addEventListener("pointerup", up);
      el.addEventListener("pointerleave", up);
      el.addEventListener("pointercancel", up);
    };

    bindAction(els.btnAttack, doAttack);
    bindAction(els.btnBlock, doBlock);
    bindAction(els.btnCast, doCast);

    document.querySelectorAll(".spell-btn").forEach((btn) => {
      btn.addEventListener("click", () => equipSpell(btn.dataset.spell));
    });

    els.btnPause.addEventListener("click", togglePause);
    els.btnMusic.addEventListener("click", toggleMusic);
    els.btnShop.addEventListener("click", () => openShop(false));
    els.btnResume.addEventListener("click", closePause);
    els.btnPauseShop.addEventListener("click", () => openShop(true));
    els.btnSpellbook.addEventListener("click", () => openSpellbook(true));
    els.btnCloseSpellbook.addEventListener("click", closeSpellbook);
    els.btnPauseRestart.addEventListener("click", restartRun);
    els.btnCloseShop.addEventListener("click", closeShop);
    els.btnRefreshShop.addEventListener("click", refreshShop);
    els.btnDeathRestart.addEventListener("click", restartRun);
    els.btnDeathTitle.addEventListener("click", returnToTitle);
    els.btnDeathHistory.addEventListener("click", openHistory);
    els.btnPauseHistory.addEventListener("click", openHistory);
    els.btnWelcomeHistory.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openHistory();
    });
    els.btnCloseHistory.addEventListener("click", closeHistory);
    document.querySelectorAll("[data-history-view]").forEach((btn) => {
      btn.addEventListener("click", () => setHistoryView(btn.dataset.historyView));
    });

    // A tap during the ending skips to the summary. The click from that
    // same tap is swallowed so it cannot land on a summary button.
    document.addEventListener(
      "pointerdown",
      () => {
        swallowNextClick = skipDeathSequence() === true;
      },
      true
    );
    document.addEventListener(
      "click",
      (ev) => {
        if (!swallowNextClick) return;
        swallowNextClick = false;
        ev.preventDefault();
        ev.stopPropagation();
      },
      true
    );
    if (els.btnEnterCrypt) {
      els.btnEnterCrypt.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (!els.welcomeScreen.classList.contains("opening")) openCryptDoors();
      });
    }
    els.pickSword.addEventListener("click", () => chooseWeapon("sword"));
    els.pickBow.addEventListener("click", () => chooseWeapon("bow"));
    els.btnBackWeapon.addEventListener("click", showWeaponChoice);
    document.querySelectorAll("[data-start-spell]").forEach((btn) => {
      btn.addEventListener("click", () => beginRun(pendingWeapon, btn.dataset.startSpell));
    });

    const keyDirs = {
      ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
      w: "up", W: "up", s: "down", S: "down", a: "left", A: "left", d: "right", D: "right",
    };

    window.addEventListener("keydown", (ev) => {
      if (deathSeq) {
        ev.preventDefault();
        if (!ev.repeat) skipDeathSequence();
        return;
      }
      if (!els.historyScreen.classList.contains("hidden")) {
        if (ev.key === "Escape") {
          ev.preventDefault();
          closeHistory();
        }
        return;
      }
      if (!els.welcomeScreen.classList.contains("hidden")) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          if (!els.welcomeScreen.classList.contains("opening")) openCryptDoors();
        }
        return;
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        togglePause();
        return;
      }

      if (!started || (game && game.over) || paused) {
        if (!els.shopScreen.classList.contains("hidden") && (ev.key === "e" || ev.key === "E")) {
          closeShop();
        } else if (!els.spellbookScreen.classList.contains("hidden") && (ev.key === "r" || ev.key === "R")) {
          closeSpellbook();
        }
        return;
      }

      if (keyDirs[ev.key]) {
        if (ev.repeat) return;
        ev.preventDefault();
        const dir = keyDirs[ev.key];
        heldDirs.add(dir);
        const [dx, dy] = dirMap[dir];
        tryMove(dx, dy);
        return;
      }

      if (ev.key === " " || ev.key === "j" || ev.key === "J") {
        ev.preventDefault();
        doAttack();
      } else if (ev.key === "k" || ev.key === "K" || ev.key === "Shift") {
        ev.preventDefault();
        doBlock();
      } else if (ev.key === "v" || ev.key === "V") {
        ev.preventDefault();
        doCast();
      } else if (/^[1-9]$/.test(ev.key)) equipSpell(meta.spellOrder[Number(ev.key) - 1]);
      else if (ev.key === "e" || ev.key === "E") openShop(false);
      else if (ev.key === "r" || ev.key === "R") openSpellbook(false);
      else if (ev.key === "p" || ev.key === "P") openPause();
    });

    window.addEventListener("keyup", (ev) => {
      const dir = keyDirs[ev.key];
      if (dir) heldDirs.delete(dir);
    });

    let touchStart = null;
    canvas.addEventListener("pointerdown", (ev) => {
      if (!document.body.classList.contains("mode-touch")) return;
      touchStart = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
      canvas.setPointerCapture(ev.pointerId);
    });
    canvas.addEventListener("pointerup", (ev) => {
      if (!touchStart || touchStart.id !== ev.pointerId) return;
      const dx = ev.clientX - touchStart.x;
      const dy = ev.clientY - touchStart.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      touchStart = null;
      if (Math.max(absX, absY) < 24) {
        doAttack();
        return;
      }
      if (absX > absY) tryMove(dx > 0 ? 1 : -1, 0);
      else tryMove(0, dy > 0 ? 1 : -1);
    });

    document.getElementById("app").addEventListener(
      "touchmove",
      (ev) => {
        if (ev.target.closest(".controls") || ev.target === canvas) ev.preventDefault();
      },
      { passive: false }
    );
  }

  function syncViewSize() {
    const touch = document.body.classList.contains("mode-touch");
    const wrap = document.querySelector(".stage-wrap");
    const rect = wrap ? wrap.getBoundingClientRect() : null;
    // The view may hold a fraction of a tile, so it always has the exact
    // shape of the stage and the art is never stretched.
    let nextW;
    let nextH;
    if (touch && rect && rect.width > 0 && rect.height > 0) {
      // About 9 tiles across the stage's shorter side, at most 18 along the longer
      const tilePx = Math.max(
        Math.min(rect.width, rect.height) / 9,
        Math.max(rect.width, rect.height) / 18
      );
      nextW = rect.width / tilePx;
      nextH = rect.height / tilePx;
    } else if (touch) {
      nextW = 9;
      nextH = 9;
    } else {
      // Keep 15 tiles visible vertically; widen horizontally to match the window
      const tilePx = Math.max(window.innerHeight / 15, window.innerWidth / 48);
      nextW = window.innerWidth / tilePx;
      nextH = window.innerHeight / tilePx;
    }
    // Draw at the size the canvas is shown, so gradients stay smooth
    const shownW = touch ? (rect && rect.width) || nextW * TILE : window.innerWidth;
    const dpr = window.devicePixelRatio || 1;
    const nextScale = Math.max(1, Math.min(3, Math.ceil((shownW / (nextW * TILE)) * dpr * 2) / 2));
    if (
      nextW === VIEW_W && nextH === VIEW_H && nextScale === renderScale &&
      canvas.width === Math.round(nextW * TILE * nextScale)
    ) return;
    VIEW_W = nextW;
    VIEW_H = nextH;
    CANVAS_W = VIEW_W * TILE;
    CANVAS_H = VIEW_H * TILE;
    renderScale = nextScale;
    canvas.width = Math.round(CANVAS_W * renderScale);
    canvas.height = Math.round(CANVAS_H * renderScale);
    if (game) snapCameraToPlayer();
  }

  function fitStage() {
    applyInputMode();
    syncViewSize();
    if (document.body.classList.contains("mode-desktop")) {
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      return;
    }
    canvas.style.width = "100%";
    canvas.style.height = "100%";
  }

  applyInputMode();
  applyThemeUI(THEMES[0]);
  buildThemePreview();
  bindControls();
  fitStage();
  window.addEventListener("resize", fitStage);
  // The stage also changes size when the layout around it does
  if (typeof ResizeObserver === "function") {
    const stageWrap = document.querySelector(".stage-wrap");
    if (stageWrap) new ResizeObserver(() => syncViewSize()).observe(stageWrap);
  }
  requestAnimationFrame(tick);
})();
