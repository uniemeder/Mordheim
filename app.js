const HERO_RULES = {
  Captain: { max: 1, baseCost: 60 },
  Champion: { max: 2, baseCost: 35 },
  Youngblood: { max: 2, baseCost: 15 },
  "Promoted Henchman": { max: 1, baseCost: 0 },
};

const MAX_HEROES = 6;
const STORAGE_KEY = "mordheim_mercenary_roster_v1";

const heroList = document.getElementById("hero-list");
const heroTemplate = document.getElementById("hero-template");
const addHeroBtn = document.getElementById("add-hero");
const saveBtn = document.getElementById("save-roster");
const loadBtn = document.getElementById("load-roster");
const clearBtn = document.getElementById("clear-roster");
const validation = document.getElementById("validation");

const warbandNameInput = document.getElementById("warband-name");
const captainNameInput = document.getElementById("captain-name");
const startingGcInput = document.getElementById("starting-gc");

const heroCountEl = document.getElementById("hero-count");
const heroCostEl = document.getElementById("hero-cost");
const remainingGcEl = document.getElementById("remaining-gc");
const heroTitle = document.querySelector(".section-head h2");

function readHeroCard(card) {
  const type = card.querySelector(".hero-type").value;
  const gearCost = Number(card.querySelector(".hero-gear-cost").value || 0);
  const totalCost = HERO_RULES[type].baseCost + gearCost;

  return {
    name: card.querySelector(".hero-name").value.trim(),
    type,
    xp: Number(card.querySelector(".hero-xp").value || 0),
    gear: card.querySelector(".hero-gear").value.trim(),
    gearCost,
    totalCost,
  };
}

function validateRoster(heroes) {
  const errors = [];

  if (heroes.length > MAX_HEROES) {
    errors.push(`Only ${MAX_HEROES} heroes are allowed.`);
  }

  const counts = heroes.reduce((acc, hero) => {
    acc[hero.type] = (acc[hero.type] || 0) + 1;
    return acc;
  }, {});

  for (const [heroType, rule] of Object.entries(HERO_RULES)) {
    const count = counts[heroType] || 0;
    if (count > rule.max) {
      errors.push(`${heroType} exceeds max (${rule.max}).`);
    }
  }

  return errors;
}

function getHeroes() {
  return [...heroList.querySelectorAll(".hero-card")].map(readHeroCard);
}

function updateTotals() {
  const heroes = getHeroes();
  const totalCost = heroes.reduce((sum, hero) => sum + hero.totalCost, 0);
  const startingGc = Number(startingGcInput.value || 0);
  const remainingGc = startingGc - totalCost;
  const errors = validateRoster(heroes);

  heroCountEl.textContent = String(heroes.length);
  heroCostEl.textContent = String(totalCost);
  remainingGcEl.textContent = String(remainingGc);
  heroTitle.textContent = `Hero Roster (${heroes.length}/${MAX_HEROES})`;
  validation.textContent = errors.join(" ");

  for (const card of heroList.querySelectorAll(".hero-card")) {
    const hero = readHeroCard(card);
    card.querySelector(".hero-total-cost").textContent = String(hero.totalCost);
  }
}

function addHeroCard(hero = null) {
  if (heroList.querySelectorAll(".hero-card").length >= MAX_HEROES) {
    updateTotals();
    return;
  }

  const fragment = heroTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".hero-card");

  if (hero) {
    card.querySelector(".hero-name").value = hero.name || "";
    card.querySelector(".hero-type").value = hero.type || "Champion";
    card.querySelector(".hero-xp").value = hero.xp ?? 0;
    card.querySelector(".hero-gear").value = hero.gear || "";
    card.querySelector(".hero-gear-cost").value = hero.gearCost ?? 0;
  }

  card.querySelector(".remove-hero").addEventListener("click", () => {
    card.remove();
    updateTotals();
  });

  for (const input of card.querySelectorAll("input, select")) {
    input.addEventListener("input", updateTotals);
  }

  heroList.appendChild(fragment);
  updateTotals();
}

function getRosterState() {
  return {
    warbandName: warbandNameInput.value.trim(),
    captainName: captainNameInput.value.trim(),
    startingGc: Number(startingGcInput.value || 0),
    heroes: getHeroes(),
  };
}

function applyRosterState(state) {
  warbandNameInput.value = state.warbandName || "";
  captainNameInput.value = state.captainName || "";
  startingGcInput.value = state.startingGc ?? 500;
  heroList.innerHTML = "";

  for (const hero of state.heroes || []) {
    addHeroCard(hero);
  }

  updateTotals();
}

function saveRoster() {
  const state = getRosterState();
  const errors = validateRoster(state.heroes);

  if (errors.length > 0) {
    validation.textContent = `Cannot save: ${errors.join(" ")}`;
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  validation.textContent = "Roster saved.";
}

function loadRoster() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    validation.textContent = "No saved roster found.";
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    applyRosterState(parsed);
    validation.textContent = "Roster loaded.";
  } catch {
    validation.textContent = "Saved roster is invalid.";
  }
}

function clearRoster() {
  localStorage.removeItem(STORAGE_KEY);
  warbandNameInput.value = "";
  captainNameInput.value = "";
  startingGcInput.value = 500;
  heroList.innerHTML = "";
  validation.textContent = "Roster cleared.";
  updateTotals();
}

addHeroBtn.addEventListener("click", () => addHeroCard());
saveBtn.addEventListener("click", saveRoster);
loadBtn.addEventListener("click", loadRoster);
clearBtn.addEventListener("click", clearRoster);
startingGcInput.addEventListener("input", updateTotals);

addHeroCard({ type: "Captain", name: "", xp: 0, gear: "Sword, dagger", gearCost: 10 });
updateTotals();
