(() => {
  "use strict";

  const TILE = 32;
  const MOVE_SLIDE = 0.14;
  let VIEW_W = 32;
  let VIEW_H = 15;
  let CANVAS_W = VIEW_W * TILE;
  let CANVAS_H = VIEW_H * TILE;

  const TILES = { WALL: 0, FLOOR: 1, STAIRS: 2 };

  const THEMES = [
    {
      id: "crypt",
      name: "Crypt Stone",
      floor: ["#3a2f24", "#46382c", "#34291f"],
      wall: ["#1c1511", "#4a3a2e", "#3d2f24", "#6a543f"],
      accent: "#c9a227",
      fog: "rgba(8,5,3,0.32)",
      stairs: ["#6b5428", "#8a6d2e"],
    },
    {
      id: "frost",
      name: "Frost Catacombs",
      floor: ["#2a3a48", "#334858", "#243440"],
      wall: ["#152028", "#3a5568", "#2d4454", "#7eb6c9"],
      accent: "#9ad7ef",
      fog: "rgba(10,20,30,0.32)",
      stairs: ["#4a7a8a", "#7ec8e3"],
    },
    {
      id: "ember",
      name: "Ember Depths",
      floor: ["#3a2218", "#4a2a1c", "#2e1810"],
      wall: ["#1a0e0a", "#6a2e1c", "#4a2014", "#e07040"],
      accent: "#ff6b35",
      fog: "rgba(30,8,4,0.32)",
      stairs: ["#8a3a20", "#d06838"],
    },
    {
      id: "verdant",
      name: "Verdant Ruin",
      floor: ["#2a3424", "#354530", "#22301c"],
      wall: ["#121810", "#3f5a38", "#30462c", "#7dcea0"],
      accent: "#8fd4a0",
      fog: "rgba(6,16,8,0.32)",
      stairs: ["#3a6a40", "#6fbf78"],
    },
    {
      id: "void",
      name: "Void Sanctum",
      floor: ["#221828", "#2c2036", "#1a1220"],
      wall: ["#0e0a14", "#46305e", "#342446", "#b48cff"],
      accent: "#c9a0ff",
      fog: "rgba(8,4,16,0.34)",
      stairs: ["#5a3a7a", "#9b6fd4"],
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
    { id: "dmg", name: "Sharper Edge", desc: "+1 weapon damage", cost: 18, key: "bonusDmg", amount: 1 },
    { id: "range", name: "Longer Reach", desc: "+1 attack range", cost: 22, key: "bonusRange", amount: 1 },
    { id: "hp", name: "Vitality Charm", desc: "+4 max HP and heal 4", cost: 16, key: "bonusHp", amount: 4 },
    { id: "mp", name: "Mana Crystal", desc: "+3 max MP and restore 3", cost: 16, key: "bonusMp", amount: 3 },
    { id: "guard", name: "Iron Guard", desc: "Block lasts longer", cost: 20, key: "bonusBlock", amount: 0.2 },
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
    startScreen: document.getElementById("startScreen"),
    pauseScreen: document.getElementById("pauseScreen"),
    shopScreen: document.getElementById("shopScreen"),
    deathScreen: document.getElementById("deathScreen"),
    deathTitle: document.getElementById("deathTitle"),
    deathBody: document.getElementById("deathBody"),
    shopCoins: document.getElementById("shopCoins"),
    shopGrid: document.getElementById("shopGrid"),
    themePreview: document.getElementById("themePreview"),
    btnAttack: document.getElementById("btnAttack"),
    btnBlock: document.getElementById("btnBlock"),
    btnCast: document.getElementById("btnCast"),
    btnPause: document.getElementById("btnPause"),
    btnShop: document.getElementById("btnShop"),
    btnResume: document.getElementById("btnResume"),
    btnPauseShop: document.getElementById("btnPauseShop"),
    btnPauseRestart: document.getElementById("btnPauseRestart"),
    btnCloseShop: document.getElementById("btnCloseShop"),
    btnDeathRestart: document.getElementById("btnDeathRestart"),
    pickSword: document.getElementById("pickSword"),
    pickBow: document.getElementById("pickBow"),
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
      noiseBurst(0.08, 0.07, 1800);
      tone(180, 0.07, "sawtooth", 0.04, 90);
    },
    bow() {
      tone(520, 0.05, "triangle", 0.05, 220);
      noiseBurst(0.06, 0.05, 2400);
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
      noiseBurst(0.12, 0.1, 700);
      tone(160, 0.08, "square", 0.05, 80);
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
  };

  function isTouchMode() {
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
      theme.id === "frost" ? "#0a141c"
        : theme.id === "ember" ? "#120805"
        : theme.id === "verdant" ? "#060c06"
        : theme.id === "void" ? "#080510"
        : "#1a1410"
    );
  }

  function createThemeTextures(theme) {
    if (textureCache[theme.id]) return textureCache[theme.id];

    const mk = (draw) => {
      const c = document.createElement("canvas");
      c.width = TILE;
      c.height = TILE;
      draw(c.getContext("2d"));
      return c;
    };

    const drawBrickWall = (g, irregular) => {
      g.fillStyle = theme.wall[0];
      g.fillRect(0, 0, TILE, TILE);
      const bricks = irregular
        ? [
            [0, 0, 14, 9], [14, 0, 18, 9],
            [0, 9, 8, 12], [8, 9, 15, 12], [23, 9, 9, 12],
            [0, 21, 18, 11], [18, 21, 14, 11],
          ]
        : [
            [0, 0, 16, 10], [16, 0, 16, 10],
            [0, 10, 10, 11], [10, 10, 12, 11], [22, 10, 10, 11],
            [0, 21, 14, 11], [14, 21, 18, 11],
          ];
      bricks.forEach(([x, y, w, h], i) => {
        g.fillStyle = i % 2 ? theme.wall[1] : theme.wall[2];
        g.fillRect(x + 1, y + 1, w - 2, h - 2);
        g.strokeStyle = theme.wall[3];
        g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
        g.fillStyle = "rgba(0,0,0,0.22)";
        g.fillRect(x + 2, y + h - 4, w - 4, 2);
      });
    };

    const floor = mk((g) => {
      g.fillStyle = theme.floor[0];
      g.fillRect(0, 0, TILE, TILE);

      if (theme.id === "crypt") {
        // Worn flagstones
        g.strokeStyle = "rgba(0,0,0,0.35)";
        g.strokeRect(1, 1, 14, 14);
        g.strokeRect(16, 1, 15, 14);
        g.strokeRect(1, 16, 15, 15);
        g.strokeRect(17, 16, 14, 15);
        for (let i = 0; i < 18; i++) {
          g.fillStyle = i % 2 ? theme.floor[1] : theme.floor[2];
          g.fillRect((i * 11) % 28 + 2, (i * 7) % 28 + 2, 2, 2);
        }
        g.fillStyle = "rgba(180,140,80,0.12)";
        g.fillRect(4, 5, 6, 3);
      } else if (theme.id === "frost") {
        // Cracked ice plates
        g.fillStyle = theme.floor[1];
        g.beginPath();
        g.moveTo(2, 4);
        g.lineTo(18, 2);
        g.lineTo(30, 14);
        g.lineTo(16, 30);
        g.lineTo(2, 20);
        g.closePath();
        g.fill();
        g.strokeStyle = "rgba(180,230,255,0.55)";
        g.beginPath();
        g.moveTo(4, 8);
        g.lineTo(14, 18);
        g.lineTo(22, 10);
        g.moveTo(10, 24);
        g.lineTo(20, 16);
        g.stroke();
        g.fillStyle = "rgba(255,255,255,0.2)";
        g.fillRect(8, 6, 4, 2);
        g.fillRect(20, 20, 5, 2);
      } else if (theme.id === "ember") {
        // Scorched rock with lava seams
        for (let i = 0; i < 30; i++) {
          g.fillStyle = i % 3 ? theme.floor[1] : theme.floor[2];
          g.fillRect((i * 5) % 30, (i * 9) % 30, 3, 3);
        }
        g.strokeStyle = "rgba(255,90,30,0.65)";
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(2, 10);
        g.quadraticCurveTo(12, 16, 8, 28);
        g.moveTo(18, 2);
        g.quadraticCurveTo(22, 14, 30, 20);
        g.stroke();
        g.fillStyle = "rgba(255,140,40,0.35)";
        g.fillRect(10, 14, 2, 6);
        g.fillRect(24, 8, 2, 5);
      } else if (theme.id === "verdant") {
        // Mossy cobble
        const cobbles = [
          [2, 2, 12, 10], [16, 3, 13, 11], [4, 15, 11, 13], [18, 17, 12, 12],
        ];
        cobbles.forEach(([x, y, w, h], i) => {
          g.fillStyle = i % 2 ? theme.floor[1] : theme.floor[2];
          g.beginPath();
          g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = "rgba(20,40,20,0.45)";
          g.stroke();
        });
        g.strokeStyle = "rgba(120,200,120,0.45)";
        g.beginPath();
        g.moveTo(0, 22);
        g.quadraticCurveTo(10, 18, 16, 26);
        g.quadraticCurveTo(24, 20, 32, 24);
        g.stroke();
        g.fillStyle = "rgba(140,220,120,0.28)";
        g.fillRect(6, 8, 3, 3);
        g.fillRect(22, 12, 4, 2);
      } else {
        // Void: geometric rune tiles
        g.fillStyle = theme.floor[1];
        g.beginPath();
        g.moveTo(16, 2);
        g.lineTo(30, 16);
        g.lineTo(16, 30);
        g.lineTo(2, 16);
        g.closePath();
        g.fill();
        g.strokeStyle = theme.accent;
        g.globalAlpha = 0.55;
        g.stroke();
        g.beginPath();
        g.arc(16, 16, 5, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
        g.fillStyle = "rgba(180,120,255,0.25)";
        g.fillRect(14, 6, 4, 4);
        g.fillRect(6, 14, 4, 4);
        g.fillRect(22, 14, 4, 4);
        g.fillRect(14, 22, 4, 4);
      }

      g.strokeStyle = "rgba(0,0,0,0.25)";
      g.strokeRect(0.5, 0.5, TILE - 1, TILE - 1);
    });

    const wall = mk((g) => {
      if (theme.id === "crypt") {
        drawBrickWall(g, false);
        g.fillStyle = "rgba(180,140,80,0.12)";
        g.fillRect(6, 4, 5, 2);
        g.fillRect(20, 16, 4, 2);
      } else if (theme.id === "frost") {
        // Jagged ice blocks
        g.fillStyle = theme.wall[0];
        g.fillRect(0, 0, TILE, TILE);
        const shards = [
          [0, 0, 18, 14], [14, 0, 18, 12], [0, 12, 12, 20], [10, 11, 22, 21],
        ];
        shards.forEach(([x, y, w, h], i) => {
          g.fillStyle = i % 2 ? theme.wall[1] : theme.wall[2];
          g.beginPath();
          g.moveTo(x + 2, y + h - 2);
          g.lineTo(x + w * 0.35, y + 2);
          g.lineTo(x + w - 2, y + 4);
          g.lineTo(x + w - 1, y + h - 1);
          g.closePath();
          g.fill();
          g.strokeStyle = "rgba(180,230,255,0.45)";
          g.stroke();
        });
        g.fillStyle = "rgba(220,245,255,0.3)";
        g.fillRect(8, 4, 2, 10);
        g.fillRect(22, 14, 2, 9);
      } else if (theme.id === "ember") {
        drawBrickWall(g, true);
        g.fillStyle = "rgba(255,80,20,0.4)";
        g.fillRect(13, 8, 3, 16);
        g.fillStyle = "rgba(255,180,60,0.35)";
        g.fillRect(14, 12, 1, 8);
        g.fillStyle = "rgba(0,0,0,0.35)";
        g.fillRect(4, 20, 8, 3);
      } else if (theme.id === "verdant") {
        drawBrickWall(g, true);
        g.strokeStyle = "rgba(100,200,120,0.55)";
        g.beginPath();
        g.moveTo(2, 28);
        g.quadraticCurveTo(8, 16, 6, 4);
        g.moveTo(18, 30);
        g.quadraticCurveTo(22, 18, 28, 8);
        g.stroke();
        g.fillStyle = "rgba(120,200,100,0.4)";
        g.beginPath();
        g.ellipse(8, 10, 3, 2, 0.4, 0, Math.PI * 2);
        g.ellipse(24, 18, 4, 2.5, -0.3, 0, Math.PI * 2);
        g.fill();
      } else {
        // Void: stacked rune slabs
        g.fillStyle = theme.wall[0];
        g.fillRect(0, 0, TILE, TILE);
        for (let row = 0; row < 3; row++) {
          const y = row * 11;
          g.fillStyle = row % 2 ? theme.wall[1] : theme.wall[2];
          g.fillRect(2, y + 2, 28, 8);
          g.strokeStyle = theme.wall[3];
          g.strokeRect(2.5, y + 2.5, 27, 7);
          g.fillStyle = "rgba(180,120,255,0.35)";
          g.fillRect(8, y + 4, 3, 3);
          g.fillRect(20, y + 4, 3, 3);
        }
        g.strokeStyle = "rgba(200,160,255,0.4)";
        g.beginPath();
        g.arc(16, 16, 4, 0, Math.PI * 2);
        g.stroke();
      }
    });

    const stairs = mk((g) => {
      g.drawImage(floor, 0, 0);
      for (let i = 0; i < 5; i++) {
        const y = 4 + i * 5;
        const inset = i * 2;
        g.fillStyle = i % 2 ? theme.stairs[0] : theme.stairs[1];
        g.fillRect(inset + 4, y, TILE - inset * 2 - 8, 4);
        g.strokeStyle = theme.accent;
        g.strokeRect(inset + 4.5, y + 0.5, TILE - inset * 2 - 9, 3);
      }
    });

    textureCache[theme.id] = { floor, wall, stairs, theme };
    return textureCache[theme.id];
  }

  function buildThemePreview() {
    els.themePreview.innerHTML = "";
    THEMES.forEach((theme) => {
      const tex = createThemeTextures(theme);
      const wrap = document.createElement("div");
      wrap.className = "theme-swatch";
      const c = document.createElement("canvas");
      c.width = TILE * 2;
      c.height = TILE;
      const g = c.getContext("2d");
      g.drawImage(tex.wall, 0, 0);
      g.drawImage(tex.floor, TILE, 0);
      g.fillStyle = theme.accent;
      g.fillRect(TILE + 12, 12, 6, 6);
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
    const bossPos = roomCenter(rooms[rooms.length - 1]);
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
        if (used.has(key) || dist(p, dungeon.start) < 2) continue;
        used.add(key);
        crates.push({
          x: p.x,
          y: p.y,
          hp: 1,
          coins: rand(2, 7),
          heal: Math.random() < 0.55 ? rand(3, 7) : 0,
        });
        break;
      }
    }
    return crates;
  }

  function createMeta(weaponId) {
    return {
      weapon: weaponId,
      coins: 0,
      bonusDmg: 0,
      bonusRange: 0,
      bonusHp: 0,
      bonusMp: 0,
      bonusBlock: 0,
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
      spell: carry ? carry.spell : "fire",
      facing: { x: 0, y: 1 },
    };
  }

  function showBanner(text, ms) {
    els.banner.textContent = text;
    els.banner.classList.remove("hidden");
    bannerTimer = ms;
  }

  function hideAllMenus() {
    els.pauseScreen.classList.add("hidden");
    els.shopScreen.classList.add("hidden");
    els.deathScreen.classList.add("hidden");
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
      const on = btn.dataset.spell === p.spell;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
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

  function addFx(type, x, y, color, life) {
    fx.push({ type, x, y, color, life, max: life });
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
      els.deathTitle.textContent = "You Fell";
      els.deathBody.textContent = `Reached floor ${game.floor} with ${meta.coins} coins.`;
      els.deathScreen.classList.remove("hidden");
    }
    updateHud();
  }

  function killEnemy(enemy) {
    enemy.hp = 0;
    sfx.kill();
    addFx("burst", enemy.x, enemy.y, enemy.isBoss ? "#d4a84b" : "#c44536", 0.45);
    meta.coins += enemy.isBoss ? 8 + game.floor : rand(1, 3);
    if (enemy.isBoss && !game.bossDown) {
      game.bossDown = true;
      const { stairsPos, map } = game.dungeon;
      map[stairsPos.y][stairsPos.x] = TILES.STAIRS;
      showBanner("Boss down! Stairs open", 1800);
      if (els.hint) els.hint.textContent = "Stand on the stairs to go deeper";
    }
    updateHud();
  }

  function damageEnemy(enemy, amount, color) {
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
      meta.coins += crate.coins;
      bits.push(`+${crate.coins} coins`);
    }
    if (crate.heal > 0) {
      const before = game.player.hp;
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + crate.heal);
      const gained = game.player.hp - before;
      if (gained > 0) bits.push(`+${gained} HP`);
    }
    showBanner(bits.length ? bits.join(" · ") : "Empty crate", 900);
    updateHud();
  }

  function beginSlide(ent, nx, ny) {
    ent.fromX = visualPos(ent).x;
    ent.fromY = visualPos(ent).y;
    ent.x = nx;
    ent.y = ny;
    ent.moveT = MOVE_SLIDE;
    ent.moveDur = MOVE_SLIDE;
  }

  function visualPos(ent) {
    if (!ent || !ent.moveT || ent.moveT <= 0 || ent.moveDur <= 0) {
      return { x: ent.x, y: ent.y };
    }
    const t = 1 - ent.moveT / ent.moveDur;
    const ease = t * t * (3 - 2 * t);
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
    beginSlide(p, nx, ny);
    moveCooldown = MOVE_SLIDE * 0.85;
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
        cells.push({ x: p.x + fx * r, y: p.y + fy * r });
      }
      if (range >= 1) {
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
      addFx("spark", p.x + p.facing.x, p.y + p.facing.y, "#e8d5a3", 0.15);
      return;
    }

    sfx.swing();
    addFx("slash", p.x + p.facing.x * 0.4, p.y + p.facing.y * 0.4, "#f0e2c4", 0.18);
    let hit = false;
    for (const cell of cellsInRange(stats.range)) {
      const crate = crateAt(cell.x, cell.y);
      if (crate) {
        breakCrate(crate);
        hit = true;
      }
      const enemy = entityAt(cell.x, cell.y);
      if (enemy) {
        damageEnemy(enemy, stats.dmg + rand(0, 1), "#ffd27a");
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

  function nearestEnemy(maxRange) {
    let best = null;
    let bestD = Infinity;
    for (const e of game.enemies) {
      if (e.hp <= 0) continue;
      const d = dist(e, game.player);
      if (d <= maxRange && d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  function launchSpellShot(kind, target, dmg, extras) {
    const p = game.player;
    const distTiles = Math.max(1, dist(p, target));
    spellShots.push({
      kind,
      x0: p.x,
      y0: p.y,
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
        damageEnemy(shot.target, shot.dmg, shot.color);
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
        } else if (shot.kind === "frost") {
          shot.target.slow = 1.6;
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
    if (p.mp < spell.cost) {
      showBanner("Not enough MP", 600);
      return;
    }

    castCooldown = 0.55;
    p.mp -= spell.cost;

    if (p.spell === "fire") {
      sfx.fire();
      const target = nearestEnemy(spell.range);
      if (!target) {
        showBanner("No target", 450);
        updateHud();
        return;
      }
      launchSpellShot("fire", target, 5 + Math.floor(game.floor / 2));
    } else if (p.spell === "frost") {
      sfx.frost();
      const target = nearestEnemy(spell.range);
      if (!target) {
        showBanner("No target", 450);
        updateHud();
        return;
      }
      launchSpellShot("frost", target, 3 + Math.floor(game.floor / 3));
    } else if (p.spell === "bolt") {
      sfx.bolt();
      let x = p.x;
      let y = p.y;
      let hitEnemy = null;
      let hitCrate = null;
      let lastX = x;
      let lastY = y;
      for (let i = 0; i < spell.range; i++) {
        x += p.facing.x;
        y += p.facing.y;
        if (
          x < 0 || y < 0 ||
          x >= game.dungeon.size || y >= game.dungeon.size ||
          game.dungeon.map[y][x] === TILES.WALL
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
        launchSpellShot("bolt", hitEnemy, 7 + Math.floor(game.floor / 2));
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
    if (!started || !game || game.over || !SPELLS[id]) return;
    game.player.spell = id;
    showBanner(`${SPELLS[id].name} ready`, 450);
    updateHud();
  }

  function renderShop() {
    els.shopCoins.textContent = String(meta ? meta.coins : 0);
    els.shopGrid.innerHTML = "";
    SHOP.forEach((item) => {
      const owned = meta.purchased[item.id] || 0;
      const cost = item.cost + owned * Math.ceil(item.cost * 0.45);
      const card = document.createElement("div");
      card.className = "shop-item";
      card.innerHTML = `
        <strong>${item.name}</strong>
        <p>${item.desc}${owned ? ` (owned ×${owned})` : ""}</p>
        <div class="shop-meta">
          <span>${cost} coins</span>
          <button type="button" class="shop-buy" data-id="${item.id}">Buy</button>
        </div>
      `;
      const btn = card.querySelector(".shop-buy");
      btn.disabled = !meta || meta.coins < cost;
      btn.addEventListener("click", () => buyUpgrade(item.id));
      els.shopGrid.appendChild(card);
    });
  }

  function buyUpgrade(id) {
    if (!meta || els.shopScreen.classList.contains("hidden")) return;
    const item = SHOP.find((s) => s.id === id);
    if (!item) return;
    const owned = meta.purchased[item.id] || 0;
    const cost = item.cost + owned * Math.ceil(item.cost * 0.45);
    if (meta.coins < cost) {
      showBanner("Need more coins", 600);
      return;
    }
    meta.coins -= cost;
    meta.purchased[item.id] = owned + 1;
    meta[item.key] += item.amount;

    if (game && !game.over) {
      const stats = playerStats();
      game.player.maxHp = stats.maxHp;
      game.player.maxMp = stats.maxMp;
      if (item.key === "bonusHp") {
        game.player.hp = Math.min(stats.maxHp, game.player.hp + item.amount);
      }
      if (item.key === "bonusMp") {
        game.player.mp = Math.min(stats.maxMp, game.player.mp + item.amount);
      }
    }

    showBanner(`Bought ${item.name}`, 700);
    renderShop();
    updateHud();
  }

  function openPause() {
    if (!started || (game && game.over)) return;
    paused = true;
    els.shopScreen.classList.add("hidden");
    els.pauseScreen.classList.remove("hidden");
  }

  function closePause() {
    if (!started || (game && game.over)) return;
    paused = false;
    els.pauseScreen.classList.add("hidden");
  }

  function togglePause() {
    if (!started || (game && game.over)) return;
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
    createThemeTextures(dungeon.theme);
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
      bossDown: false,
      over: false,
    };
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
    snapCameraToPlayer();
    updateHud();
  }

  function beginRun(weaponId) {
    ensureAudio();
    meta = createMeta(weaponId);
    started = true;
    paused = false;
    hideAllMenus();
    els.startScreen.classList.add("hidden");
    startFloor(1, null);
    showBanner(`${WEAPONS[weaponId].name} chosen`, 1000);
  }

  function restartRun() {
    started = false;
    paused = false;
    game = null;
    meta = null;
    hideAllMenus();
    els.startScreen.classList.remove("hidden");
  }

  function updateProjectiles() {
    const next = [];
    for (const bolt of projectiles) {
      bolt.x += bolt.dx;
      bolt.y += bolt.dy;
      bolt.left -= 1;
      addFx("spark", bolt.x, bolt.y, bolt.color, 0.12);

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
        damageEnemy(enemy, bolt.dmg, "#ffd27a");
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
      e.moveTimer -= dt * (e.slow > 0 ? 0.45 : 1);
      if (e.moveTimer > 0 || (e.moveT && e.moveT > 0)) continue;

      e.moveTimer = (e.isBoss ? 0.55 : 0.42) / e.speed;
      if (spawnGuard > 0) continue;

      const d = dist(e, p);
      if (d === 1) {
        hurtPlayer(e.dmg);
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

  function drawCrate(px, py) {
    // Treasure chest with lid, bands, and latch
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(px + 16, py + 28, 11, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#5a3218";
    ctx.fillRect(px + 5, py + 14, 22, 12);
    ctx.fillStyle = "#7a4a24";
    ctx.fillRect(px + 5, py + 8, 22, 8);
    ctx.fillStyle = "#8b5a2b";
    ctx.beginPath();
    ctx.moveTo(px + 5, py + 14);
    ctx.quadraticCurveTo(px + 16, py + 4, px + 27, py + 14);
    ctx.lineTo(px + 5, py + 14);
    ctx.fill();

    ctx.fillStyle = "#c9a227";
    ctx.fillRect(px + 5, py + 13, 22, 3);
    ctx.fillRect(px + 5, py + 22, 22, 2);
    ctx.fillRect(px + 14, py + 8, 4, 16);
    ctx.strokeStyle = "#8b6914";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 5.5, py + 8.5, 21, 17);

    ctx.fillStyle = "#e8d5a3";
    ctx.beginPath();
    ctx.arc(px + 16, py + 16, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6b3a2a";
    ctx.fillRect(px + 15, py + 15, 2, 3);

    ctx.fillStyle = "rgba(255,230,150,0.22)";
    ctx.fillRect(px + 7, py + 9, 6, 3);
  }

  function drawPlayer(px, py) {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(px + 16, py + 28, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#8a2f28";
    ctx.fillRect(px + 10, py + 13, 12, 11);
    ctx.fillStyle = "#c44536";
    ctx.fillRect(px + 11, py + 12, 10, 4);
    ctx.fillStyle = "#e8d5a3";
    ctx.beginPath();
    ctx.arc(px + 16, py + 9, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a2218";
    ctx.fillRect(px + 12, py + 8, 2, 2);
    ctx.fillRect(px + 18, py + 8, 2, 2);
    ctx.fillStyle = "#6b3a2a";
    ctx.fillRect(px + 11, py + 3, 10, 5);
    ctx.fillStyle = "#8b6914";
    ctx.fillRect(px + 10, py + 7, 12, 2);

    if (meta.weapon === "bow") {
      ctx.strokeStyle = "#d4a84b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px + 24, py + 16, 7, -1.2, 1.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px + 24, py + 9);
      ctx.lineTo(px + 24, py + 23);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#b0b8c4";
      ctx.fillRect(px + 22, py + 8, 3, 13);
      ctx.fillStyle = "#d4a84b";
      ctx.fillRect(px + 21, py + 6, 5, 4);
      ctx.fillStyle = "#6b4226";
      ctx.fillRect(px + 22, py + 20, 3, 4);
    }

    if (blockTimer > 0) {
      ctx.strokeStyle = "rgba(125,206,160,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px + 16, py + 16, 14, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawEnemy(e, px, py) {
    const pulse = Math.sin(animFrame * 0.12 + e.x * 2) * 1.2;
    if (e.flash > 0) ctx.globalAlpha = 0.55 + Math.sin(animFrame) * 0.2;

    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.beginPath();
    ctx.ellipse(px + 16, py + 28, e.isBoss ? 12 : 8, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    if (e.isBoss) {
      if (e.kind === "ogre") {
        ctx.fillStyle = "#4a5a32";
        ctx.fillRect(px + 7, py + 12 + pulse, 18, 14);
        ctx.fillStyle = "#6a7a42";
        ctx.fillRect(px + 8, py + 13 + pulse, 16, 5);
        ctx.fillStyle = "#8a9a4a";
        ctx.beginPath();
        ctx.arc(px + 16, py + 8 + pulse, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#2a2010";
        ctx.fillRect(px + 12, py + 6 + pulse, 2, 3);
        ctx.fillRect(px + 18, py + 6 + pulse, 2, 3);
        ctx.fillStyle = "#c44536";
        ctx.fillRect(px + 14, py + 10 + pulse, 4, 2);
        ctx.fillStyle = "#d4a84b";
        ctx.fillRect(px + 2, py + 14 + pulse, 5, 13);
        ctx.fillStyle = "#8b6914";
        ctx.fillRect(px + 1, py + 12 + pulse, 7, 3);
      } else if (e.kind === "wraith") {
        const grad = ctx.createLinearGradient(px + 16, py + 2, px + 16, py + 28);
        grad.addColorStop(0, "#8aa0e8");
        grad.addColorStop(1, "#2a3568");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(px + 16, py + 3 + pulse);
        ctx.lineTo(px + 28, py + 24 + pulse);
        ctx.quadraticCurveTo(px + 16, py + 30 + pulse, px + 4, py + 24 + pulse);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#e8d5a3";
        ctx.beginPath();
        ctx.arc(px + 16, py + 12 + pulse, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1a1410";
        ctx.fillRect(px + 13, py + 11 + pulse, 2, 2);
        ctx.fillRect(px + 17, py + 11 + pulse, 2, 2);
        ctx.fillStyle = "rgba(180,200,255,0.35)";
        ctx.fillRect(px + 10, py + 18 + pulse, 12, 6);
      } else {
        ctx.fillStyle = "#6b2818";
        ctx.beginPath();
        ctx.ellipse(px + 16, py + 17 + pulse, 13, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#a84428";
        ctx.beginPath();
        ctx.ellipse(px + 16, py + 15 + pulse, 9, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#d4a84b";
        ctx.fillRect(px + 7, py + 7 + pulse, 3, 7);
        ctx.fillRect(px + 22, py + 7 + pulse, 3, 7);
        ctx.fillStyle = "#f0e2c4";
        ctx.beginPath();
        ctx.arc(px + 12, py + 14 + pulse, 2.2, 0, Math.PI * 2);
        ctx.arc(px + 20, py + 14 + pulse, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1a1410";
        ctx.fillRect(px + 11, py + 13 + pulse, 2, 2);
        ctx.fillRect(px + 19, py + 13 + pulse, 2, 2);
        ctx.fillStyle = "#ff6b35";
        ctx.beginPath();
        ctx.moveTo(px + 14, py + 18 + pulse);
        ctx.lineTo(px + 18, py + 18 + pulse);
        ctx.lineTo(px + 16, py + 22 + pulse);
        ctx.fill();
      }
    } else if (e.kind === "slime") {
      ctx.fillStyle = "#2f6a52";
      ctx.beginPath();
      ctx.ellipse(px + 16, py + 20 + pulse, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4a8f6f";
      ctx.beginPath();
      ctx.ellipse(px + 16, py + 17 + pulse, 11, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7dcea0";
      ctx.beginPath();
      ctx.ellipse(px + 12, py + 13 + pulse, 3.5, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1410";
      ctx.fillRect(px + 11, py + 16 + pulse, 2, 3);
      ctx.fillRect(px + 18, py + 16 + pulse, 2, 3);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(px + 18, py + 14 + pulse, 3, 2);
    } else if (e.kind === "bat") {
      const wing = Math.sin(animFrame * 0.35) * 3;
      ctx.fillStyle = "#4a2840";
      ctx.beginPath();
      ctx.moveTo(px + 16, py + 16 + pulse);
      ctx.quadraticCurveTo(px + 6, py + 8 + pulse + wing, px + 2, py + 16 + pulse);
      ctx.quadraticCurveTo(px + 8, py + 14 + pulse, px + 16, py + 16 + pulse);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px + 16, py + 16 + pulse);
      ctx.quadraticCurveTo(px + 26, py + 8 + pulse + wing, px + 30, py + 16 + pulse);
      ctx.quadraticCurveTo(px + 24, py + 14 + pulse, px + 16, py + 16 + pulse);
      ctx.fill();
      ctx.fillStyle = "#8b4a6a";
      ctx.beginPath();
      ctx.ellipse(px + 16, py + 15 + pulse, 5, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c9a227";
      ctx.beginPath();
      ctx.arc(px + 14, py + 14 + pulse, 1.5, 0, Math.PI * 2);
      ctx.arc(px + 18, py + 14 + pulse, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1410";
      ctx.fillRect(px + 13, py + 13 + pulse, 1, 1);
      ctx.fillRect(px + 17, py + 13 + pulse, 1, 1);
    } else {
      ctx.fillStyle = "#c4b8a4";
      ctx.fillRect(px + 10, py + 12 + pulse, 12, 13);
      ctx.fillStyle = "#ddd4c4";
      ctx.fillRect(px + 11, py + 13 + pulse, 10, 4);
      ctx.fillStyle = "#efe6d4";
      ctx.beginPath();
      ctx.arc(px + 16, py + 8 + pulse, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1410";
      ctx.fillRect(px + 12, py + 7 + pulse, 2, 2);
      ctx.fillRect(px + 18, py + 7 + pulse, 2, 2);
      ctx.strokeStyle = "#5a4634";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 13, py + 11 + pulse);
      ctx.lineTo(px + 19, py + 11 + pulse);
      ctx.stroke();
      ctx.strokeStyle = "#8b6914";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + 22, py + 12 + pulse);
      ctx.lineTo(px + 28, py + 22 + pulse);
      ctx.stroke();
      ctx.fillStyle = "#b0b8c4";
      ctx.beginPath();
      ctx.moveTo(px + 26, py + 20 + pulse);
      ctx.lineTo(px + 30, py + 24 + pulse);
      ctx.lineTo(px + 24, py + 23 + pulse);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    if (e.isBoss || e.hp < e.maxHp) {
      const w = e.isBoss ? 26 : 18;
      const hx = px + (32 - w) / 2;
      ctx.fillStyle = "#0d0a08";
      ctx.fillRect(hx, py + 1, w, 4);
      ctx.fillStyle = e.isBoss ? "#d4a84b" : "#c44536";
      ctx.fillRect(hx, py + 1, w * Math.max(0, e.hp / e.maxHp), 4);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.strokeRect(hx + 0.5, py + 1.5, w - 1, 3);
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
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px, py, 10, -0.8, 0.8);
        ctx.stroke();
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
        if (f.type === "flash") ctx.fillRect(px - 10, py - 10, 20, 20);
        else {
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (f.type === "text") {
        ctx.fillStyle = f.color;
        ctx.font = "700 14px Cinzel, serif";
        ctx.textAlign = "center";
        ctx.fillText("!", px, py - (1 - a) * 12);
      }
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    ctx.fillStyle = "#070504";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (!game) return;

    const textures = createThemeTextures(game.dungeon.theme);
    const { map, size, theme } = game.dungeon;
    const startX = Math.floor(camX) - 1;
    const startY = Math.floor(camY) - 1;
    const endX = Math.ceil(camX + VIEW_W) + 1;
    const endY = Math.ceil(camY + VIEW_H) + 1;

    for (let my = startY; my <= endY; my++) {
      for (let mx = startX; mx <= endX; mx++) {
        if (mx < 0 || my < 0 || mx >= size || my >= size) continue;
        const t = map[my][mx];
        const px = (mx - camX) * TILE;
        const py = (my - camY) * TILE;
        if (t === TILES.WALL) ctx.drawImage(textures.wall, px, py);
        else if (t === TILES.STAIRS) ctx.drawImage(textures.stairs, px, py);
        else {
          ctx.drawImage(textures.floor, px, py);
          if ((mx + my) % 5 === 0) {
            ctx.fillStyle = "rgba(0,0,0,0.12)";
            ctx.fillRect(px + 6, py + 10, 14, 8);
          }
        }
      }
    }

    for (const crate of game.crates) {
      if (crate.hp <= 0) continue;
      const px = (crate.x - camX) * TILE;
      const py = (crate.y - camY) * TILE;
      if (px < -TILE || py < -TILE || px > CANVAS_W || py > CANVAS_H) continue;
      drawCrate(px, py);
    }

    for (const e of game.enemies) {
      if (e.hp <= 0) continue;
      const pos = visualPos(e);
      const px = (pos.x - camX) * TILE;
      const py = (pos.y - camY) * TILE;
      if (px < -TILE || py < -TILE || px > CANVAS_W || py > CANVAS_H) continue;
      drawEnemy(e, px, py);
    }

    const pPos = visualPos(game.player);
    drawPlayer((pPos.x - camX) * TILE, (pPos.y - camY) * TILE);
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
      const s = game.dungeon.stairsPos;
      const dx = s.x - game.player.x;
      const dy = s.y - game.player.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 4) {
        const labelX = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? CANVAS_W - 18 : 18)
          : CANVAS_W / 2;
        const labelY = Math.abs(dx) > Math.abs(dy)
          ? CANVAS_H / 2
          : (dy > 0 ? CANVAS_H - 16 : 16);
        ctx.fillStyle = theme.accent;
        ctx.beginPath();
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) {
            ctx.moveTo(labelX + 6, labelY);
            ctx.lineTo(labelX - 5, labelY - 7);
            ctx.lineTo(labelX - 5, labelY + 7);
          } else {
            ctx.moveTo(labelX - 6, labelY);
            ctx.lineTo(labelX + 5, labelY - 7);
            ctx.lineTo(labelX + 5, labelY + 7);
          }
        } else if (dy > 0) {
          ctx.moveTo(labelX, labelY + 6);
          ctx.lineTo(labelX - 7, labelY - 5);
          ctx.lineTo(labelX + 7, labelY - 5);
        } else {
          ctx.moveTo(labelX, labelY - 6);
          ctx.lineTo(labelX - 7, labelY + 5);
          ctx.lineTo(labelX + 7, labelY + 5);
        }
        ctx.closePath();
        ctx.fill();
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
      if (spawnGuard > 0) spawnGuard -= dt;
      if (moveCooldown > 0) moveCooldown -= dt;
      if (attackCooldown > 0) attackCooldown -= dt;
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
      updateSpellShots(dt);
      updateFx(dt);
      updateCamera(dt);
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
    els.btnShop.addEventListener("click", () => openShop(false));
    els.btnResume.addEventListener("click", closePause);
    els.btnPauseShop.addEventListener("click", () => openShop(true));
    els.btnPauseRestart.addEventListener("click", restartRun);
    els.btnCloseShop.addEventListener("click", closeShop);
    els.btnDeathRestart.addEventListener("click", restartRun);
    els.pickSword.addEventListener("click", () => beginRun("sword"));
    els.pickBow.addEventListener("click", () => beginRun("bow"));

    const keyDirs = {
      ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
      w: "up", W: "up", s: "down", S: "down", a: "left", A: "left", d: "right", D: "right",
    };

    window.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        togglePause();
        return;
      }

      if (!started || (game && game.over) || paused) {
        if (!els.shopScreen.classList.contains("hidden") && (ev.key === "b" || ev.key === "B")) {
          closeShop();
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
      } else if (ev.key === "l" || ev.key === "L" || ev.key === "f" || ev.key === "F") {
        ev.preventDefault();
        doCast();
      } else if (ev.key === "1") equipSpell("fire");
      else if (ev.key === "2") equipSpell("frost");
      else if (ev.key === "3") equipSpell("bolt");
      else if (ev.key === "b" || ev.key === "B") openShop(false);
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
    let nextW;
    let nextH;
    if (touch) {
      nextW = 15;
      nextH = 15;
    } else {
      // Keep ~15 tiles visible vertically; widen horizontally to match aspect
      nextH = 15;
      const tilePx = window.innerHeight / nextH;
      nextW = Math.max(24, Math.min(48, Math.round(window.innerWidth / tilePx)));
    }
    if (nextW === VIEW_W && nextH === VIEW_H && canvas.width === nextW * TILE) return;
    VIEW_W = nextW;
    VIEW_H = nextH;
    CANVAS_W = VIEW_W * TILE;
    CANVAS_H = VIEW_H * TILE;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
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
    const wrap = document.querySelector(".stage-wrap");
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const side = Math.floor(Math.min(rect.width, rect.height));
    if (side > 0) {
      canvas.style.width = side + "px";
      canvas.style.height = side + "px";
    }
  }

  applyInputMode();
  applyThemeUI(THEMES[0]);
  buildThemePreview();
  bindControls();
  fitStage();
  window.addEventListener("resize", fitStage);
  requestAnimationFrame(tick);
})();
