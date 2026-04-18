const STORAGE_KEY = "mordheim_campaign_manager_v2";

const STANDARD_RULES = {
  maxStartingGc: 500,
  mercenaryFactions: new Set([
    "Reikland Mercenaries",
    "Middenheim Mercenaries",
    "Marienburg Mercenaries",
  ]),
  heroCaps: {
    captain: { min: 1, max: 1, cost: 60 },
    champion: { min: 0, max: 2, cost: 35 },
    youngblood: { min: 0, max: 2, cost: 15 },
    extraHero: { min: 0, max: 1, cost: 0 },
  },
  maxHeroes: 6,
};

const state = {
  db: loadDb(),
  session: null,
};

const el = {
  loginView: document.getElementById("login-view"),
  appView: document.getElementById("app-view"),
  loginForm: document.getElementById("login-form"),
  loginMessage: document.getElementById("login-message"),
  logoutBtn: document.getElementById("logout-btn"),
  sessionText: document.getElementById("session-text"),

  createWarbandForm: document.getElementById("create-warband-form"),
  createMessage: document.getElementById("create-message"),
  warbandList: document.getElementById("warband-list"),

  txForm: document.getElementById("transaction-form"),
  txMessage: document.getElementById("tx-message"),
  txLog: document.getElementById("tx-log"),
  txWarbandId: document.getElementById("tx-warband-id"),
};

function loadDb() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { users: [], warbands: [], transactions: [] };
  } catch {
    return { users: [], warbands: [], transactions: [] };
  }
}

function saveDb() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.db));
}

function id() {
  return crypto.randomUUID();
}

function hash(value) {
  return btoa(unescape(encodeURIComponent(value)));
}

function findUser(username, campaignHash) {
  return state.db.users.find(
    (user) => user.username === username && user.campaignPasswordHash === campaignHash,
  );
}

function loginOrRegister({ username, password, campaignPassword }) {
  const campaignHash = hash(campaignPassword);
  const passwordHash = hash(password);
  const existing = findUser(username, campaignHash);

  if (!existing) {
    const user = {
      id: id(),
      username,
      passwordHash,
      campaignPasswordHash: campaignHash,
      createdAt: new Date().toISOString(),
    };
    state.db.users.push(user);
    saveDb();
    return { ok: true, user, registered: true };
  }

  if (existing.passwordHash !== passwordHash) {
    return { ok: false, error: "Invalid password for this username/campaign combination." };
  }

  return { ok: true, user: existing, registered: false };
}

function getSessionWarbands() {
  if (!state.session) return [];
  const { userId, campaignPasswordHash } = state.session;
  return state.db.warbands.filter(
    (wb) => wb.ownerUserId === userId && wb.campaignPasswordHash === campaignPasswordHash,
  );
}

function validateStandardWarband(input) {
  const errors = [];

  if (!STANDARD_RULES.mercenaryFactions.has(input.faction)) {
    errors.push("Standard mode supports only mercenary factions.");
  }

  if (input.startingGc > STANDARD_RULES.maxStartingGc) {
    errors.push("Standard mode allows a maximum of 500 gc at creation.");
  }

  const heroCount = input.captain + input.champion + input.youngblood + input.extraHero;
  if (heroCount > STANDARD_RULES.maxHeroes) {
    errors.push("Standard mode allows max 6 heroes.");
  }

  for (const [key, cfg] of Object.entries(STANDARD_RULES.heroCaps)) {
    if (input[key] < cfg.min || input[key] > cfg.max) {
      errors.push(`${key} count must be between ${cfg.min} and ${cfg.max}.`);
    }
  }

  const heroCost =
    input.captain * STANDARD_RULES.heroCaps.captain.cost +
    input.champion * STANDARD_RULES.heroCaps.champion.cost +
    input.youngblood * STANDARD_RULES.heroCaps.youngblood.cost +
    input.extraHero * STANDARD_RULES.heroCaps.extraHero.cost +
    input.gearBudget;

  if (heroCost > input.startingGc) {
    errors.push("Hero + gear costs exceed starting gold.");
  }

  return { errors, heroCost, heroCount };
}

function createWarband(payload) {
  const owner = state.session;
  if (!owner) return { ok: false, error: "Not logged in." };

  const data = {
    name: payload.name.trim(),
    faction: payload.faction,
    mode: payload.mode,
    startingGc: Number(payload.startingGc),
    captain: Number(payload.captain),
    champion: Number(payload.champion),
    youngblood: Number(payload.youngblood),
    extraHero: Number(payload.extraHero),
    gearBudget: Number(payload.gearBudget),
  };

  if (!data.name) {
    return { ok: false, error: "Warband name is required." };
  }

  let heroCost =
    data.captain * 60 + data.champion * 35 + data.youngblood * 15 + data.extraHero * 0 + data.gearBudget;
  let heroCount = data.captain + data.champion + data.youngblood + data.extraHero;

  if (data.mode === "standard") {
    const result = validateStandardWarband(data);
    if (result.errors.length) {
      return { ok: false, error: result.errors.join(" ") };
    }
    heroCost = result.heroCost;
    heroCount = result.heroCount;
  }

  const warband = {
    id: id(),
    ownerUserId: owner.userId,
    campaignPasswordHash: owner.campaignPasswordHash,
    name: data.name,
    faction: data.faction,
    mode: data.mode,
    rosterSummary: {
      captain: data.captain,
      champion: data.champion,
      youngblood: data.youngblood,
      extraHero: data.extraHero,
      totalHeroes: heroCount,
    },
    startingGc: data.startingGc,
    creationAllocatedGc: heroCost,
    createdAt: new Date().toISOString(),
  };

  state.db.warbands.push(warband);
  state.db.transactions.push({
    id: id(),
    warbandId: warband.id,
    ownerUserId: owner.userId,
    campaignPasswordHash: owner.campaignPasswordHash,
    type: "inbetween games",
    date: new Date().toISOString().slice(0, 10),
    goldDelta: 0,
    xpDelta: 0,
    details: `Warband created (${data.mode} mode). Initial allocation: ${heroCost} gc.`,
    createdAt: new Date().toISOString(),
    actor: owner.username,
  });

  saveDb();
  return { ok: true };
}

function createTransaction(payload) {
  const owner = state.session;
  if (!owner) return { ok: false, error: "Not logged in." };

  const warband = getSessionWarbands().find((wb) => wb.id === payload.warbandId);
  if (!warband) {
    return { ok: false, error: "Warband not found in your current campaign/user scope." };
  }

  const tx = {
    id: id(),
    warbandId: warband.id,
    ownerUserId: owner.userId,
    campaignPasswordHash: owner.campaignPasswordHash,
    type: payload.type,
    date: payload.date,
    goldDelta: Number(payload.goldDelta),
    xpDelta: Number(payload.xpDelta),
    details: payload.details.trim(),
    createdAt: new Date().toISOString(),
    actor: owner.username,
  };

  if (!tx.details) {
    return { ok: false, error: "Transaction details are required." };
  }

  state.db.transactions.push(tx);
  saveDb();
  return { ok: true };
}

function renderWarbands() {
  const warbands = getSessionWarbands();
  if (!warbands.length) {
    el.warbandList.innerHTML = '<p class="muted">No warbands yet.</p>';
    return;
  }

  el.warbandList.innerHTML = warbands
    .map(
      (wb) => `
      <article class="warband-card">
        <h3>${escapeHtml(wb.name)}</h3>
        <ul>
          <li><strong>Faction:</strong> ${escapeHtml(wb.faction)}</li>
          <li><strong>Creation Mode:</strong> ${escapeHtml(wb.mode)}</li>
          <li><strong>Heroes at Creation:</strong> ${wb.rosterSummary.totalHeroes}</li>
          <li><strong>Starting GC:</strong> ${wb.startingGc}</li>
          <li><strong>Allocated GC:</strong> ${wb.creationAllocatedGc}</li>
          <li><strong>Created:</strong> ${wb.createdAt.slice(0, 10)}</li>
        </ul>
      </article>
    `,
    )
    .join("");
}

function renderTransactionWarbandOptions() {
  const warbands = getSessionWarbands();
  el.txWarbandId.innerHTML = warbands
    .map((wb) => `<option value="${wb.id}">${escapeHtml(wb.name)} (${escapeHtml(wb.faction)})</option>`)
    .join("");
}

function renderTransactions() {
  const warbands = getSessionWarbands();
  const warbandIds = new Set(warbands.map((wb) => wb.id));

  const txs = state.db.transactions
    .filter((tx) => warbandIds.has(tx.warbandId))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  if (!txs.length) {
    el.txLog.innerHTML = '<p class="muted">No transactions logged yet.</p>';
    return;
  }

  const warbandById = Object.fromEntries(warbands.map((wb) => [wb.id, wb]));

  el.txLog.innerHTML = txs
    .map(
      (tx) => `
      <article class="tx-card">
        <h3>${escapeHtml(tx.type)} — ${tx.date}</h3>
        <p><strong>Warband:</strong> ${escapeHtml(warbandById[tx.warbandId]?.name || "Unknown")}</p>
        <p><strong>Actor:</strong> ${escapeHtml(tx.actor)}</p>
        <p><strong>Gold Δ:</strong> ${tx.goldDelta} | <strong>XP Δ:</strong> ${tx.xpDelta}</p>
        <p>${escapeHtml(tx.details)}</p>
        <small>Logged at ${tx.createdAt}</small>
      </article>
    `,
    )
    .join("");
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function refreshAppView() {
  if (!state.session) return;
  el.sessionText.textContent = `Logged in as ${state.session.username} | Campaign scope active`;
  renderWarbands();
  renderTransactionWarbandOptions();
  renderTransactions();
}

function setLoggedOut() {
  state.session = null;
  el.appView.classList.add("hidden");
  el.loginView.classList.remove("hidden");
  el.loginForm.reset();
}

function setLoggedIn(session) {
  state.session = session;
  el.loginView.classList.add("hidden");
  el.appView.classList.remove("hidden");
  refreshAppView();
}

el.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const campaignPassword = document.getElementById("login-campaign-password").value;

  if (!username || !password || !campaignPassword) {
    el.loginMessage.textContent = "All login fields are required.";
    return;
  }

  const result = loginOrRegister({ username, password, campaignPassword });
  if (!result.ok) {
    el.loginMessage.textContent = result.error;
    return;
  }

  el.loginMessage.textContent = result.registered
    ? "Account registered and logged in."
    : "Logged in successfully.";

  setLoggedIn({
    userId: result.user.id,
    username: result.user.username,
    campaignPasswordHash: result.user.campaignPasswordHash,
  });
});

el.logoutBtn.addEventListener("click", () => {
  setLoggedOut();
});

el.createWarbandForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const payload = {
    name: document.getElementById("warband-name").value,
    faction: document.getElementById("warband-faction").value,
    mode: document.getElementById("warband-mode").value,
    startingGc: document.getElementById("warband-gc").value,
    captain: document.getElementById("captain-count").value,
    champion: document.getElementById("champion-count").value,
    youngblood: document.getElementById("youngblood-count").value,
    extraHero: document.getElementById("extra-hero-count").value,
    gearBudget: document.getElementById("gear-budget").value,
  };

  const result = createWarband(payload);
  if (!result.ok) {
    el.createMessage.textContent = result.error;
    return;
  }

  el.createMessage.textContent = "Warband created successfully.";
  el.createWarbandForm.reset();
  document.getElementById("warband-gc").value = 500;
  document.getElementById("captain-count").value = 1;
  document.getElementById("champion-count").value = 2;
  document.getElementById("youngblood-count").value = 2;
  document.getElementById("extra-hero-count").value = 0;
  document.getElementById("gear-budget").value = 0;

  refreshAppView();
});

el.txForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const payload = {
    warbandId: document.getElementById("tx-warband-id").value,
    type: document.getElementById("tx-type").value,
    date: document.getElementById("tx-date").value,
    goldDelta: document.getElementById("tx-gold-delta").value,
    xpDelta: document.getElementById("tx-xp-delta").value,
    details: document.getElementById("tx-details").value,
  };

  if (!payload.warbandId || !payload.type || !payload.date || !payload.details.trim()) {
    el.txMessage.textContent = "Warband, type, date, and details are required.";
    return;
  }

  const result = createTransaction(payload);
  if (!result.ok) {
    el.txMessage.textContent = result.error;
    return;
  }

  el.txMessage.textContent = "Transaction logged.";
  el.txForm.reset();
  document.getElementById("tx-gold-delta").value = 0;
  document.getElementById("tx-xp-delta").value = 0;
  document.getElementById("tx-date").value = new Date().toISOString().slice(0, 10);
  renderTransactionWarbandOptions();
  renderTransactions();
});

setLoggedOut();
document.getElementById("tx-date").value = new Date().toISOString().slice(0, 10);
