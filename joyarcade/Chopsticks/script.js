const screens = {
  auth: document.getElementById("auth"),
  register: document.getElementById("register"),
  rules: document.getElementById("rules"),
  game: document.getElementById("game"),
};

const welcome = document.getElementById("welcome");
const end = document.getElementById("end");
const endImg = document.getElementById("endImg");
const endText = document.getElementById("endText");
const turnStatus = document.getElementById("turnStatus");
const trashTalk = document.getElementById("trashTalk");

const winsCount = document.getElementById("winsCount");
const lossesCount = document.getElementById("lossesCount");
const difficultySelect = document.getElementById("difficultySelect");
const bgPicker = document.getElementById("bgPicker");

const pL = document.getElementById("pL");
const pR = document.getElementById("pR");
const aL = document.getElementById("aL");
const aR = document.getElementById("aR");

const mergeBtn = document.getElementById("mergeBtn");
const splitBtn = document.getElementById("splitBtn");

const handImages = {
  0: "assets/0.png",
  1: "assets/1.png",
  2: "assets/2.png",
  3: "assets/3.png",
  4: "assets/4.png",
};

const difficultyDepth = { easy: 1, medium: 2, hard: 3 };
const themeOptions = ["neon", "sunset", "ocean", "forest", "space"];
const aiTaunts = [
  "I saw that move coming 😏",
  "Is that your best combo?",
  "Math beats vibes.",
  "You sure about that move?",
  "I run simulations for breakfast.",
];
const playerTaunts = [
  "Nice hit! Keep pressure on 🔥",
  "Clean move. AI felt that.",
  "You’re cooking now 🍳",
  "That’s how you control the board.",
  "Big brain move unlocked.",
];

let player = { L: 1, R: 1 };
let ai = { L: 1, R: 1 };
let selectedHand = null;
let aiThinking = false;
let gameEnded = false;
let activeUser = null;
let aiTimeoutId = null;
let matchLocked = false;

function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

function getUsers() {
  return JSON.parse(localStorage.getItem("users") || "{}");
}

function saveUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
}

function setBackgroundTheme(themeKey) {
  const safeTheme = themeOptions.includes(themeKey) ? themeKey : "neon";
  localStorage.setItem("bgTheme", safeTheme);
  document.body.setAttribute("data-bg", safeTheme);
  if (bgPicker) bgPicker.value = safeTheme;
}

function applySavedBackgroundTheme() {
  const stored = localStorage.getItem("bgTheme");
  const safeTheme = themeOptions.includes(stored) ? stored : "neon";
  document.body.setAttribute("data-bg", safeTheme);
  if (bgPicker) bgPicker.value = safeTheme;
}

function setStatus(text) {
  turnStatus.textContent = text;
}

function setTrashTalk(text) {
  if (trashTalk) trashTalk.textContent = text;
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function setControlsEnabled(enabled) {
  mergeBtn.disabled = !enabled;
  splitBtn.disabled = !enabled;
}

function handSource(value) {
  return handImages[value] || handImages[0];
}

function setHandImage(element, value) {
  element.src = handSource(value);
}

function updateUI() {
  setHandImage(pL, player.L);
  setHandImage(pR, player.R);
  setHandImage(aL, ai.L);
  setHandImage(aR, ai.R);
  pL.classList.toggle("selected", selectedHand === "L");
  pR.classList.toggle("selected", selectedHand === "R");
}

function isDead(v) {
  return v === 0;
}

function applyHit(target, key, value) {
  target[key] += value;
  if (target[key] >= 5) target[key] = 0;
}

function gameOver() {
  return (isDead(player.L) && isDead(player.R)) || (isDead(ai.L) && isDead(ai.R));
}

function getStatsByUser() {
  return JSON.parse(localStorage.getItem("statsByUser") || "{}");
}

function saveStatsByUser(stats) {
  localStorage.setItem("statsByUser", JSON.stringify(stats));
}

function ensureUserStats() {
  const all = getStatsByUser();
  if (!all[activeUser]) {
    all[activeUser] = { wins: 0, losses: 0 };
    saveStatsByUser(all);
  }
}

function renderScoreboard() {
  const stats = getStatsByUser()[activeUser] || { wins: 0, losses: 0 };
  winsCount.textContent = String(stats.wins);
  lossesCount.textContent = String(stats.losses);
}

function recordResult(result) {
  const all = getStatsByUser();
  const stats = all[activeUser] || { wins: 0, losses: 0 };
  if (result === "win") stats.wins += 1;
  if (result === "loss") stats.losses += 1;
  all[activeUser] = stats;
  saveStatsByUser(all);
  renderScoreboard();
}

function getDifficulty() {
  const stored = localStorage.getItem("aiDifficulty") || "hard";
  return difficultyDepth[stored] ? stored : "hard";
}

function getDifficultyDepth() {
  return difficultyDepth[getDifficulty()];
}

function initDifficulty() {
  difficultySelect.value = getDifficulty();
}

function getGameStatesByUser() {
  return JSON.parse(localStorage.getItem("gameStatesByUser") || "{}");
}

function saveGameStatesByUser(allStates) {
  localStorage.setItem("gameStatesByUser", JSON.stringify(allStates));
}

function persistGameState() {
  if (!activeUser) return;
  const allStates = getGameStatesByUser();
  allStates[activeUser] = {
    player,
    ai,
    selectedHand,
    gameEnded,
    endText: endText.textContent,
    endImg: endImg.getAttribute("src") || "",
    matchLocked,
    difficulty: difficultySelect.value,
  };
  saveGameStatesByUser(allStates);
}

function clearPersistedGameState() {
  if (!activeUser) return;
  const allStates = getGameStatesByUser();
  delete allStates[activeUser];
  saveGameStatesByUser(allStates);
}

function restoreGameStateIfAvailable() {
  if (!activeUser) return false;
  const saved = getGameStatesByUser()[activeUser];
  if (!saved) return false;

  player = saved.player || { L: 1, R: 1 };
  ai = saved.ai || { L: 1, R: 1 };
  selectedHand = saved.selectedHand || null;
  gameEnded = Boolean(saved.gameEnded);
  aiThinking = false;
  aiTimeoutId = null;
  matchLocked = Boolean(saved.matchLocked);

  if (saved.difficulty && difficultyDepth[saved.difficulty]) {
    localStorage.setItem("aiDifficulty", saved.difficulty);
    difficultySelect.value = saved.difficulty;
  }

  setControlsEnabled(!gameOver());
  difficultySelect.disabled = matchLocked;

  if (gameEnded) {
    endImg.src = saved.endImg || "assets/win.png";
    endText.textContent = saved.endText || "Game over";
    end.classList.remove("hidden");
    setStatus("Match finished");
  } else {
    end.classList.add("hidden");
    setStatus("Your turn");
  }

  setTrashTalk("Welcome back. Same match, same heat 🔥");
  updateUI();
  return true;
}

function lockDifficultyForMatch() {
  if (matchLocked) return;
  matchLocked = true;
  difficultySelect.disabled = true;
  persistGameState();
}

function unlockDifficultyForNewMatch() {
  matchLocked = false;
  difficultySelect.disabled = false;
}

function showEnd(imageName, message) {
  gameEnded = true;
  endImg.src = `assets/${imageName}`;
  endImg.onerror = () => {
    endImg.style.display = "none";
  };
  endImg.style.display = "block";
  endText.textContent = message;
  end.classList.remove("hidden");
  persistGameState();
}

function checkWin() {
  if (gameEnded) return true;

  if (isDead(player.L) && isDead(player.R)) {
    recordResult("loss");
    setTrashTalk("Gotcha. Run it back? 😈");
    showEnd("lost.png", "You Lost");
    return true;
  }

  if (isDead(ai.L) && isDead(ai.R)) {
    recordResult("win");
    setTrashTalk("Okay wow... that was clean 😳");
    showEnd("win.png", "You Win");
    return true;
  }

  return false;
}

function cloneState(state) {
  return { player: { ...state.player }, ai: { ...state.ai } };
}

function sumHands(hands) {
  return hands.L + hands.R;
}

function handKeys(hands) {
  return ["L", "R"].filter((k) => !isDead(hands[k]));
}

function generateAttacks(attackerHands, defenderHands, actor) {
  const moves = [];
  for (const from of handKeys(attackerHands)) {
    for (const to of handKeys(defenderHands)) {
      moves.push({ type: "attack", actor, from, to });
    }
  }
  return moves;
}

function generateRedistributions(hands, actor) {
  const total = sumHands(hands);
  const moves = [];
  for (let l = 0; l <= 4; l += 1) {
    const r = total - l;
    if (r < 0 || r > 4) continue;
    if (l === hands.L && r === hands.R) continue;
    moves.push({ type: "redistribute", actor, L: l, R: r });
  }
  return moves;
}

function generateMoves(state, actor) {
  const self = actor === "ai" ? state.ai : state.player;
  const opp = actor === "ai" ? state.player : state.ai;
  return [...generateAttacks(self, opp, actor), ...generateRedistributions(self, actor)];
}

function applyMoveToState(state, move) {
  const next = cloneState(state);
  const self = move.actor === "ai" ? next.ai : next.player;
  const opp = move.actor === "ai" ? next.player : next.ai;

  if (move.type === "attack") {
    if (isDead(self[move.from]) || isDead(opp[move.to])) return next;
    opp[move.to] += self[move.from];
    if (opp[move.to] >= 5) opp[move.to] = 0;
    return next;
  }

  self.L = move.L;
  self.R = move.R;
  return next;
}

function winnerFromState(state) {
  const playerOut = isDead(state.player.L) && isDead(state.player.R);
  const aiOut = isDead(state.ai.L) && isDead(state.ai.R);
  if (aiOut) return "player";
  if (playerOut) return "ai";
  return null;
}

function evaluateState(state) {
  const winner = winnerFromState(state);
  if (winner === "ai") return 10000;
  if (winner === "player") return -10000;
  return (handKeys(state.ai).length - handKeys(state.player).length) * 120 +
    (sumHands(state.ai) - sumHands(state.player)) * 8;
}

function minimax(state, depth, maximizing) {
  const winner = winnerFromState(state);
  if (depth === 0 || winner) return evaluateState(state);

  const moves = generateMoves(state, maximizing ? "ai" : "player");
  if (!moves.length) return evaluateState(state);

  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) best = Math.max(best, minimax(applyMoveToState(state, m), depth - 1, false));
    return best;
  }

  let best = Infinity;
  for (const m of moves) best = Math.min(best, minimax(applyMoveToState(state, m), depth - 1, true));
  return best;
}

function chooseBestAiMove(state, depth) {
  const moves = generateMoves(state, "ai");
  if (!moves.length) return null;

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    const next = applyMoveToState(state, move);
    if (winnerFromState(next) === "ai") return move;
    const score = minimax(next, depth - 1, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function aiTurn() {
  if (gameOver()) return;
  const move = chooseBestAiMove({ player, ai }, getDifficultyDepth());
  if (!move) return;
  if (move.type === "attack") {
    applyHit(player, move.to, ai[move.from]);
  } else {
    ai.L = move.L;
    ai.R = move.R;
  }
}

function finishPlayerMoveThenAi() {
  if (checkWin()) {
    updateUI();
    return;
  }

  aiThinking = true;
  setControlsEnabled(false);
  setStatus("AI is thinking...");
  setTrashTalk(randomFrom(aiTaunts));

  if (aiTimeoutId) clearTimeout(aiTimeoutId);
  aiTimeoutId = setTimeout(() => {
    aiTurn();
    aiThinking = false;
    aiTimeoutId = null;
    if (!checkWin()) {
      setStatus("Your turn");
      setTrashTalk(randomFrom(playerTaunts));
    }
    setControlsEnabled(!gameOver());
    updateUI();
    persistGameState();
  }, 700);
}

function selectPlayerHand(hand) {
  if (aiThinking || isDead(player[hand]) || gameOver()) return;
  selectedHand = hand;
  updateUI();
}

function attack(targetHand) {
  if (aiThinking || !selectedHand || gameOver()) return;
  if (isDead(player[selectedHand]) || isDead(ai[targetHand])) return;

  applyHit(ai, targetHand, player[selectedHand]);
  lockDifficultyForMatch();
  selectedHand = null;
  updateUI();
  persistGameState();
  finishPlayerMoveThenAi();
}

function merge() {
  if (aiThinking || gameOver()) return;
  if (isDead(player.L) || isDead(player.R)) return alert("Both hands must be alive");

  const total = player.L + player.R;
  if (total > 4) return alert("Illegal merge");

  player.L = total;
  player.R = 0;
  lockDifficultyForMatch();
  selectedHand = null;
  updateUI();
  persistGameState();
  finishPlayerMoveThenAi();
}

function split() {
  if (aiThinking || gameOver()) return;

  const total = player.L + player.R;
  const newL = Number(prompt("Left hand value:"));
  const newR = Number(prompt("Right hand value:"));

  const valid = Number.isInteger(newL) && Number.isInteger(newR) &&
    newL >= 0 && newR >= 0 && newL <= 4 && newR <= 4 &&
    newL + newR === total;

  if (!valid) return alert("Tally error – please play a possible move for your combo.");

  player.L = newL;
  player.R = newR;
  lockDifficultyForMatch();
  selectedHand = null;
  updateUI();
  persistGameState();
  finishPlayerMoveThenAi();
}

function resetGame() {
  if (aiTimeoutId) {
    clearTimeout(aiTimeoutId);
    aiTimeoutId = null;
  }
  player = { L: 1, R: 1 };
  ai = { L: 1, R: 1 };
  selectedHand = null;
  aiThinking = false;
  gameEnded = false;
  end.classList.add("hidden");
  endImg.style.display = "block";
  setControlsEnabled(true);
  unlockDifficultyForNewMatch();
  setStatus("Your turn");
  setTrashTalk("Ready when you are 👀");
  updateUI();
  persistGameState();
}

function login() {
  const username = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value;
  const users = getUsers();

  if (users[username] !== password) {
    alert("Wrong credentials");
    return;
  }

  activeUser = username;
  localStorage.setItem("activeUser", username);
  welcome.textContent = `Player: ${activeUser}`;
  ensureUserStats();
  renderScoreboard();
  initDifficulty();
  showScreen("game");
  if (!restoreGameStateIfAvailable()) {
    resetGame();
  }
}

function register() {
  const username = document.getElementById("regUser").value.trim();
  const password = document.getElementById("regPass").value;
  const users = getUsers();

  if (!username || !password) return alert("Fill all fields");
  if (users[username]) return alert("Username already exists");

  users[username] = password;
  saveUsers(users);
  alert("Registered. Please login.");
  showScreen("auth");
}

function logout() {
  localStorage.removeItem("activeUser");
  activeUser = null;
  if (aiTimeoutId) {
    clearTimeout(aiTimeoutId);
    aiTimeoutId = null;
  }
  showScreen("auth");
}

function tryAutoLogin() {
  const maybeUser = localStorage.getItem("activeUser");
  const users = getUsers();
  if (!maybeUser || !users[maybeUser]) return;

  activeUser = maybeUser;
  welcome.textContent = `Player: ${activeUser}`;
  ensureUserStats();
  renderScoreboard();
  initDifficulty();
  showScreen("game");
  if (!restoreGameStateIfAvailable()) {
    resetGame();
  }
}

// Nav / auth buttons
document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("goRegisterBtn").addEventListener("click", () => showScreen("register"));
document.getElementById("goRulesBtn").addEventListener("click", () => showScreen("rules"));
document.getElementById("registerBtn").addEventListener("click", register);
document.getElementById("backLoginFromRegisterBtn").addEventListener("click", () => showScreen("auth"));
document.getElementById("backLoginFromRulesBtn").addEventListener("click", () => showScreen("auth"));

if (bgPicker) {
  bgPicker.addEventListener("change", () => setBackgroundTheme(bgPicker.value));
}
difficultySelect.addEventListener("change", () => {
  if (matchLocked) {
    difficultySelect.value = getDifficulty();
    alert("Difficulty can be changed before a match starts (or after Play Again).");
    return;
  }
  localStorage.setItem("aiDifficulty", difficultySelect.value);
});

document.getElementById("logoutBtn").addEventListener("click", logout);
mergeBtn.addEventListener("click", merge);
splitBtn.addEventListener("click", split);
document.getElementById("playAgainBtn").addEventListener("click", () => {
  clearPersistedGameState();
  resetGame();
});
pL.addEventListener("click", () => selectPlayerHand("L"));
pR.addEventListener("click", () => selectPlayerHand("R"));
aL.addEventListener("click", () => attack("L"));
aR.addEventListener("click", () => attack("R"));

applySavedBackgroundTheme();
showScreen("auth");
tryAutoLogin();
