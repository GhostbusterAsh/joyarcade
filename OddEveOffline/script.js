let user = "Player";
let difficulty = "easy";
let mood = 'troll';

let userScore = 0;
let aiScore = 0;

let batting = null; // "user" or "ai"
let inning = 1;
let gameOver = false;
let inputLocked = false;
let matchStarted = false;
let isMuted = false;

// target-mode tension system
let targetMode = true;
let chaseTarget = null;
let firstInningsScore = null;
// overs / balls
let currentBall = 0;
let currentOver = 0;
let maxOvers = 1;
let isTest = false;
let target = 0;

let userHistory = [];
let aiHistory = [];
// resumedFromSave: when true, user resumed a saved match and restart must be disabled
let resumedFromSave = false;

// player profile / progression
let profile = JSON.parse(localStorage.getItem('oec_profile') || '{}') || {};
profile.name = profile.name || user || 'Player';
profile.matches = profile.matches || 0;
profile.wins = profile.wins || 0;
profile.losses = profile.losses || 0;
profile.bestStreak = profile.bestStreak || 0;
profile.coins = profile.coins || 0;
profile.level = profile.level || 1;
profile.title = profile.title || 'Rookie';

function saveProfile(){
  try { localStorage.setItem('oec_profile', JSON.stringify(profile)); } catch(e){}
}

function computeLevel(){
  // simple level: 1 level per 5 wins
  profile.level = Math.max(1, Math.floor((profile.wins) / 5) + 1);
  if (profile.level >= 8) profile.title = 'Legend';
  else if (profile.level >= 5) profile.title = 'Pro';
  else if (profile.level >= 3) profile.title = 'Skilled';
  else profile.title = 'Street Cricketer';
}

function renderProfile(){
  const box = document.getElementById('profileBox');
  if (!box) return;
  box.querySelector('.p-name').innerText = profile.name || user;
  box.querySelector('.p-level').innerText = `Level ${profile.level} — ${profile.title}`;
  box.querySelector('.p-stats').innerText = `Matches: ${profile.matches} • Wins: ${profile.wins} • Win Rate: ${profile.matches?Math.round((profile.wins/profile.matches)*100):0}%`;
  box.querySelector('.p-best').innerText = `Best Streak: ${profile.bestStreak}`;
  box.querySelector('.p-coins').innerText = `Coins: ${profile.coins}`;
}
// tutorialAfterMode removed — tutorial is optional and no longer auto-started after mode

// progression hooks
let winStreak = 0;
let bestScore = parseInt(localStorage.getItem('oec_best') || '0', 10) || 0;

// Leaderboard helpers
function updateLeaderboard(score) {
  const best = JSON.parse(localStorage.getItem('oec_leaderboard')) || [];
  const entry = {
    _id: Date.now(),
    name: user,
    score: score,
    mode: (isTest ? 'test' : (maxOvers || 1) + 'ov'),
    difficulty: difficulty || 'easy',
    date: new Date().toISOString()
  };
  const prevTop = best.length ? best[0].score : -Infinity;
  best.push(entry);
  best.sort((a, b) => (b.score - a.score) || (new Date(b.date) - new Date(a.date)));
  const top = best.slice(0, 5);
  localStorage.setItem('oec_leaderboard', JSON.stringify(top));
  localStorage.setItem('oec_last_entry_id', String(entry._id));
  return { id: entry._id, isNewTop: entry.score > prevTop };
}

function renderLeaderboard() {
  const list = document.getElementById('leaderboardList');
  if (!list) return;
  const data = JSON.parse(localStorage.getItem('oec_leaderboard')) || [];
  list.innerHTML = '';
  const lastId = localStorage.getItem('oec_last_entry_id');
  data.forEach((entry, index) => {
    const li = document.createElement('li');
    li.innerText = `${index + 1}. ${entry.name} - ${entry.score} (${entry.mode}, ${entry.difficulty})`;
    const meta = document.createElement('div'); meta.className = 'lb-meta'; meta.innerText = (new Date(entry.date)).toLocaleString();
    li.appendChild(meta);
    if (String(entry._id) === String(lastId)) li.classList.add('latest');
    list.appendChild(li);
  });
}

// input blocker helper
function blockInputs(flag) {
  // No-op: we no longer enforce a locked linear flow. Keep blocker hidden so UI is accessible.
  const b = document.getElementById('inputBlocker');
  if (!b) return;
  b.classList.add('hidden');
}

function showBlockedMessage() {
  // contextual message depending on why inputs are locked
  if (document.getElementById('tutorialOverlay')?.classList.contains('show')) {
    showPop('Finish the tutorial first');
    return;
  }
  if (!matchStarted) {
    showPop('Finish the toss first');
    return;
  }
  if (gameOver) {
    showPop('Match finished — restart to play again');
    return;
  }
  showPop('Finish previous task');
}

// safe restart: only allow restart after match is over
function safeRestart() {
  if (resumedFromSave) {
    showPop('Restart disabled for resumed saved match');
    return;
  }
  if (gameOver) {
    restartGame();
  } else {
    showPop('Cannot restart while match is in progress');
  }
}

function login() {
  user = document.getElementById("usernameInput").value.trim();
  if (!user) return;
  const pass = (document.getElementById('passwordInput') && document.getElementById('passwordInput').value) || '';

  difficulty = document.getElementById("difficulty").value;
  // (duplicate assignment removed)
  const moodSel = document.getElementById('moodSelect');
  mood = moodSel ? moodSel.value : mood;

  localStorage.setItem("oec_user", user);
  if (pass) localStorage.setItem('oec_pass', pass);
  localStorage.setItem("oec_diff", difficulty);
  localStorage.setItem("oec_mood", mood);

  // initialize AI visuals and chatter
  updateAiMoodVisual(mood);
  startAiTrashInterval();

  document.getElementById("loginBox").classList.add("hidden");
  document.getElementById("gameBox").classList.remove("hidden");
  document.getElementById("welcomeText").innerText = `Welcome, ${user}`;
  const userLabel = document.getElementById('userLabel');
  if (userLabel) userLabel.innerText = user;
  // do not auto-start tutorial here; tutorial will run after mode selection

  // if a saved match exists for this user, auto-restore it
  try {
    const saved = loadSavedMatch(user);
    if (saved) {
      // show resume prompt and block other inputs
      const rb = document.getElementById('resumeBox'); if (rb) rb.classList.remove('hidden');
      const b = document.getElementById('inputBlocker'); if (b) b.classList.remove('hidden');
    }
  } catch(e){}
}

/* logout handled later with cleanup */

/**********************/
function userToss() {
  const predEl = document.getElementById('tossPrediction');
  const numEl = document.getElementById('tossNumber');
  if (!predEl || !numEl) return;
  playSound('click.mp3');

  const prediction = predEl.value; // 'odd' or 'even'
  const userNum = parseInt(numEl.value, 10) || 0;
  const aiNum = Math.floor(Math.random() * 7);
  const sum = userNum + aiNum;
  const result = sum % 2 === 0 ? 'even' : 'odd';

  const status = `${user} chose ${userNum}, AI chose ${aiNum}. Sum ${sum} (${result}).`;
  document.getElementById('statusText').innerText = status;

  const tossBox = document.getElementById('tossBox');
  const choiceBox = document.getElementById('choiceBox');

  if (result === prediction) {
    // user wins toss — let them choose
    if (tossBox) tossBox.classList.add('hidden');
    if (choiceBox) choiceBox.classList.remove('hidden');
    document.getElementById('statusText').innerText = status + ' You won the toss! Choose to bat or bowl.';
  } else {
    // AI wins toss — AI chooses, prefer batting
    const aiChoosesBat = Math.random() < 0.7; // 70% prefer batting
    batting = aiChoosesBat ? 'ai' : 'user';
    if (tossBox) tossBox.classList.add('hidden');
    if (choiceBox) choiceBox.classList.add('hidden');
    document.getElementById('statusText').innerText = status + ` AI won the toss and chose to ${aiChoosesBat ? 'bat' : 'bowl'}.`;
    startMatch();
  }
}
function applyMood() {
  // removed mood-driven background for v2 (keep default CSS backgrounds)
}

function chooseBat() {
  playSound('click.mp3');
  batting = "user";
  startMatch();
}

function chooseBowl() {
  playSound('click.mp3');
  batting = "ai";
  startMatch();
}

function startMatch() {
  document.getElementById("tossBox").classList.add("hidden");
  document.getElementById("choiceBox").classList.add("hidden");
  // initialize match state
  inning = 1;
  gameOver = false;
  inputLocked = false;
  userScore = 0;
  aiScore = 0;
  userHistory = [];
  aiHistory = [];
  firstInningsScore = null;
  chaseTarget = null;
  // batting should be set by toss/choice; default to user if missing
  if (!batting) batting = 'user';
  matchStarted = true;
  // update UI
  const td = document.getElementById('targetDisplay');
  if (td) td.innerText = `Chase: —`;
  updateScores();
  updateStatus();
  updateOverDisplay();
  // unlock inputs for play
  blockInputs(false);
}

/* --- Mode / Overs handlers --- */
function setMode(val) {
  playSound('click.mp3');
  if (val === 'test') {
    isTest = true;
    maxOvers = 9999;
  } else {
    isTest = false;
    maxOvers = Number(val) || 1;
  }
  const modeBox = document.getElementById('modeBox'); if (modeBox) modeBox.classList.add('hidden');
  // simply reveal toss UI; tutorial is optional and can be launched by the user anytime
  const tossBox = document.getElementById('tossBox'); if (tossBox) tossBox.classList.remove('hidden');
  const td = document.getElementById('targetDisplay'); if (td) td.innerText = `Chase: —`;
  updateOverDisplay();
  const status = document.getElementById('statusText'); if (status) status.innerText = `Mode: ${isTest ? 'Test (∞)' : maxOvers + ' over(s)'} — Do the toss`;
  // block inputs until match starts (toss must happen)
  blockInputs(true);
}

function showCustom() {
  const cb = document.getElementById('customBox'); if (cb) cb.classList.remove('hidden');
}

function setCustomMode() {
  const inp = document.getElementById('customOvers');
  if (!inp) return;
  const v = parseInt(inp.value, 10) || 1;
  setMode(v);
}

function aiMove() {
  const rand = (n = 7) => Math.floor(Math.random() * n);
  if (difficulty === 'easy') return rand();

  const windowSize = Math.min(8, userHistory.length);
  const window = userHistory.slice(-windowSize);
  let most = null;
  let counts = {};
  for (let v of window) counts[v] = (counts[v]||0) + 1;
  let maxCount = 0;
  for (let k in counts) {
    if (counts[k] > maxCount) { maxCount = counts[k]; most = parseInt(k,10); }
  }

  const repeatedLast3 = window.length >= 3 && window.slice(-3).every(v => v === window[window.length-1]);
  const freqRatio = windowSize ? (maxCount / windowSize) : 0;
  const hasTendency = repeatedLast3 || freqRatio >= 0.5;

  if (difficulty === 'medium') {
    if (hasTendency && most !== null && Math.random() < 0.75) {
      if (batting === 'user') return most;
      const avoid = most;
      const options = [6,5,4,3,2,1,0].filter(n => n !== avoid);
      // bias slightly to higher runs for medium
      const weighted = [];
      options.forEach(v => {
        const weight = v >= 4 ? 3 : 1;
        for (let i=0;i<weight;i++) weighted.push(v);
      });
      return weighted[rand(weighted.length)];
    }
    // slight bias to higher numbers to make medium more threatening
    const base = [6,5,4,3,2,1,0];
    const weightedBase = [];
    base.forEach(v=>{ const w = v>=4?3:1; for(let i=0;i<w;i++) weightedBase.push(v); });
    return weightedBase[rand(weightedBase.length)];
  }

  if (difficulty === 'hard') {
    if (hasTendency && most !== null) {
      if (batting === 'user') {
        if (Math.random() < 0.95) return most;
      } else {
        const avoid = most;
        // prefer high scoring numbers but avoid predicted
        const preferred = [6,6,6,5,5,4,3,2,1].filter(n => n !== avoid);
        if (preferred.length) return preferred[rand(preferred.length)];
      }
    }

    const aiWindowSize = Math.min(6, aiHistory.length);
    const aiWindow = aiHistory.slice(-aiWindowSize);
    if (aiWindow.length >= 3) {
      const diffs = [];
      for (let i = 1; i < aiWindow.length; i++) diffs.push(aiWindow[i] - aiWindow[i-1]);
      const uniform = diffs.every(d => d === diffs[0]);
      if (uniform) {
        const last = aiWindow[aiWindow.length - 1];
        const predictedNext = (last + diffs[0] + 7) % 7;
        if (Math.random() < 0.85) {
          const alt = [0,1,2,3,4,5,6].filter(n=>n!==predictedNext);
          return alt[rand(alt.length)];
        }
      }
    }

    if (windowSize > 0) {
      const probs = new Array(7).fill(1);
      for (let k in counts) {
        const idx = parseInt(k,10);
        if (batting === 'user') probs[idx] += counts[k] * 3;
        else probs[idx] = Math.max(1, probs[idx] - counts[k]);
      }
      // bias towards larger numbers when AI batting
      if (batting === 'ai') {
        for (let i=4;i<=6;i++) probs[i] += 2;
      }
      const total = probs.reduce((a,b)=>a+b,0);
      let r = Math.random() * total;
      for (let i=0;i<probs.length;i++){
        r -= probs[i];
        if (r <= 0) return i;
      }
    }
    // fallback: biased high choice
    const fallback = [6,6,5,5,4,3,2,1,0];
    return fallback[rand(fallback.length)];
  }

  return rand();
}

// helper wait
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function playHand(num) {
  if (gameOver || inputLocked) return;
  if (!matchStarted) { showPop('Finish toss first'); return; }
  if (!batting) { showPop('Do toss first'); return; }

  // micro press feedback
  const handImg = document.querySelector(`.row img[data-num="${num}"]`);
  if (handImg) { handImg.classList.add('pressed'); setTimeout(() => handImg.classList.remove('pressed'), 120); }

  inputLocked = true;
  playSound('click.mp3');

  const status = document.getElementById('statusText');
  if (status) status.innerText = `${user} played ${num}...`;
  showPop(`${user}: ${num}`);

  await wait(400);

  if (status) status.innerText = `AI is choosing...`;
  showPop('AI is choosing...');

  await wait(400);

  const ai = aiMove();
  aiHistory.push(ai);
  userHistory.push(num);

  // micro-pattern detection: AI comments when user repeats same number 3 times
  if (userHistory.length >= 3) {
    const last3 = userHistory.slice(-3);
    if (last3[0] === last3[1] && last3[1] === last3[2]) {
      const aiTalk = document.getElementById('aiTalk'); if (aiTalk) aiTalk.innerText = 'AI: I figured you out 👀';
    }
  }

  // Last-ball tension: if final ball of chase, show LAST BALL and pause
  try {
    if (inning === 2 && !isTest && maxOvers > 0) {
      const totalBalls = maxOvers * 6;
      const used = (currentOver * 6) + currentBall;
      const remaining = Math.max(0, totalBalls - used);
      if (remaining <= 1) {
        showPop('LAST BALL', 'error');
        await wait(500);
      }
    }
  } catch(e){}

  if (status) status.innerText = `AI played ${ai}`;
  showPop(`AI: ${ai}`);

  await wait(200);

  // RESULT
  if (num === ai) {
    showOut();
    // count the ball that produced the OUT
    currentBall++;
    if (currentBall === 6) { currentBall = 0; currentOver++; }
    updateOverDisplay();
    // record and switch innings
    // capture first innings score inside switchInnings
    switchInnings();
    speakGameLine();
    inputLocked = false;
    return;
  }

  if (batting === 'user') {
    userScore += num;
    showRun(num);
  } else {
    aiScore += ai;
    showRun(ai);
  }

  updateScores();
  updatePressure();
  speakGameLine();
  // BALL SYSTEM
  currentBall++;
  if (currentBall === 6) { currentBall = 0; currentOver++; }
  updateOverDisplay();
  updateTarget();

  checkEnd();
  inputLocked = false;
}

function switchInnings() {
  if (inning === 1) {
    // record first innings score and set chase target/target
    firstInningsScore = (batting === 'user') ? userScore : aiScore;
    if (targetMode) {
      chaseTarget = firstInningsScore + 1;
      target = chaseTarget;
      const td = document.getElementById('targetDisplay'); if (td) td.innerText = `Target: ${target}`;
    }
    // reset balls/overs for second innings
    currentBall = 0; currentOver = 0;
    updateOverDisplay();
    inning = 2;
    batting = batting === "user" ? "ai" : "user";
    updateStatus("💥 OUT! Switching innings");
    // brief lock so transition is visible
    inputLocked = true;
    blockInputs(true);
    setTimeout(()=> { inputLocked = false; blockInputs(false); }, 700);
  } else {
    endGame();
  }
}

function showOut() {
  const status = document.getElementById("statusText");
  if (status) status.innerText = "💥 OUTTTT!!!";

  // flash body red briefly then restore via applyMood
  document.body.style.background = '#5c0000';
  setTimeout(() => applyMood(), 200);

  // show OUT popup + sound
  const outEl = document.getElementById('outPopup');
  if (outEl) {
    outEl.classList.remove('hidden');
    outEl.classList.add('show');
    setTimeout(() => { outEl.classList.remove('show'); outEl.classList.add('hidden'); }, 900);
  }
  playSound('wicket.mp3', 1.0);

  // small shake on board
  const board = document.querySelector('.board');
  if (board) {
    board.classList.add('shake');
    setTimeout(()=> board.classList.remove('shake'), 520);
  }
}

function showRun(runs) {
  const status = document.getElementById('statusText');
  if (status) status.innerText = `🔥 +${runs} RUNS!`;
  playSound('click.mp3', 0.9);
  status.style.transform = 'scale(1.2)';
  setTimeout(() => { if (status) status.style.transform = 'scale(1)'; }, 150);
}

function updatePressure() {
  const status = document.getElementById('statusText');
  if (!status) return;
  if (inning === 2) {
    const target = (batting === 'user') ? (aiScore + 1) : (userScore + 1);
    const current = (batting === 'user') ? userScore : aiScore;
    const needed = target - current;
    if (needed > 0) {
      status.innerText += `\n🎯 Need ${needed} runs`;
      if (needed <= 6) status.innerText += `\n🔥 CLUTCH MOMENT`;
    }
  }
}

function speakGameLine() {
  const aiTalk = document.getElementById('aiTalk');
  if (!aiTalk) return;
  const lines = [
    "You're getting lucky...",
    "I see your pattern.",
    "Too easy.",
    "You're nervous now 😏",
    "This is over.",
    "Try harder."
  ];
  if (Math.random() < 0.5) aiTalk.innerText = 'AI: ' + lines[Math.floor(Math.random() * lines.length)];
}

function addRuns(userNum, aiNum){
  const board = document.querySelector('.board');
  const statusText = document.getElementById('statusText');
  if (batting === 'user') {
    userScore += userNum;
    if (statusText) statusText.innerHTML = `<span class="run-text">🔥 +${userNum} RUNS!</span>`;
  } else {
    aiScore += aiNum;
    if (statusText) statusText.innerHTML = `<span class="run-text">🔥 AI +${aiNum} RUNS!</span>`;
  }
  if (board) { board.classList.add('flash-green'); setTimeout(()=> board.classList.remove('flash-green'), 240); }
  updateScores();
  // pop and ai reaction
  showPop(batting === 'user' ? `🔥 +${userNum} RUNS!` : `🔥 AI +${aiNum} RUNS!`);
  const aiTalk = document.getElementById('aiTalk');
  if (aiTalk) {
    if (targetMode && inning === 2) {
      const remaining = batting === 'user' ? (chaseTarget - userScore) : (chaseTarget - aiScore);
      if (remaining <= 3 && remaining > 0) aiTalk.innerText = `You're getting nervous...`;
      else aiTalk.innerText = `Lucky...`;
    } else {
      aiTalk.innerText = `Nice move.`;
    }
  }
  checkEnd();
}

function checkEnd() {
  // Over limit reached
  if (!isTest && currentOver >= maxOvers) {
    switchInnings();
    return;
  }

  // Chase logic
  if (inning === 2) {
    if (batting === "user" && userScore > aiScore) endGame();
    if (batting === "ai" && aiScore > userScore) endGame();
  }
}

function endGame() {
  gameOver = true;
  let result =
    userScore > aiScore ? "You Win!" :
    userScore < aiScore ? "AI Wins!" : "Draw!";
  const statusText = document.getElementById('statusText');
  if (statusText) statusText.innerHTML = `🏁 ${result}`;
  // update leaderboard with player's score and capture if new top
  let lbRes = null;
  try { lbRes = updateLeaderboard(userScore); } catch(e){}
  // refresh leaderboard UI
  try { renderLeaderboard(); } catch(e){}

  // persist simple progression stats and update player profile + coins
  try {
    let wins = parseInt(localStorage.getItem('oec_wins') || '0', 10);
    let losses = parseInt(localStorage.getItem('oec_losses') || '0', 10);
    if (result === 'You Win!') {
      wins += 1;
      winStreak = (winStreak || 0) + 1;
    } else if (result === 'AI Wins!') {
      losses += 1;
      winStreak = 0;
    }
    // best score
    if (userScore > bestScore) { bestScore = userScore; localStorage.setItem('oec_best', String(bestScore)); }
    localStorage.setItem('oec_wins', String(wins));
    localStorage.setItem('oec_losses', String(losses));
    const ps = document.getElementById('progressStats'); if (ps) ps.innerText = `Wins: ${wins} | Losses: ${losses} | Best: ${bestScore} | Win Streak: ${winStreak}`;

    // update profile
    profile.name = user;
    profile.matches = (profile.matches || 0) + 1;
    if (result === 'You Win!') profile.wins = (profile.wins || 0) + 1;
    if (result === 'AI Wins!') profile.losses = (profile.losses || 0) + 1;
    profile.bestStreak = Math.max(profile.bestStreak || 0, winStreak || 0);

    // coin rewards: easy 10, medium 25, hard 60
    const baseCoins = (difficulty === 'easy') ? 10 : (difficulty === 'medium') ? 25 : 60;
    const streakMultiplier = Math.min(5, (winStreak || 0) + 1);
    let coinsEarned = 0;
    if (result === 'You Win!') {
      coinsEarned = baseCoins * streakMultiplier;
      profile.coins = (profile.coins || 0) + coinsEarned;
    }

    // recompute level/title and persist profile
    computeLevel();
    saveProfile();
    try { renderProfile(); } catch(e){}

    // show coins earned popup
    if (coinsEarned > 0) showPop(`+${coinsEarned} coins`, 'success');

  } catch(e){}

  // play a sound for win/lose
  if (result === 'You Win!') playSound('win.mp3');
  else if (result === 'AI Wins!') playSound('lost.mp3');

  // block inputs and visual result popup + effects
  blockInputs(true);
  const popup = document.getElementById('resultPopup');
  const conf = document.getElementById('confetti');
  const board = document.querySelector('.board');
  if (popup) {
    popup.classList.remove('hidden');
    popup.innerText = result;
    popup.classList.remove('result-win', 'result-lose');
    if (result === 'You Win!') popup.classList.add('result-win');
    else if (result === 'AI Wins!') popup.classList.add('result-lose');
    // show animated popup
    popup.classList.add('show');
  }

  if (result === 'You Win!') {
    // confetti simple emoji burst
    if (conf) {
      conf.classList.remove('hidden');
      const colors = ['🎉','✨','🎊','💚','🟢'];
      for (let i=0;i<18;i++){
        const s = document.createElement('span');
        s.innerText = colors[Math.floor(Math.random()*colors.length)];
        s.style.left = (10 + Math.random()*80) + '%';
        s.style.top = (5 + Math.random()*10) + '%';
        s.style.fontSize = (12 + Math.random()*20) + 'px';
        s.style.transform = `translateY(0) rotate(${Math.random()*360}deg)`;
        s.style.animationDelay = (Math.random()*200) + 'ms';
        conf.appendChild(s);
      }
      setTimeout(()=>{ conf.innerHTML=''; conf.classList.add('hidden'); }, 1600);
    }
    // green flash on board
    if (board) { board.classList.add('flash-green'); setTimeout(()=>board.classList.remove('flash-green'), 900); }
  } else if (result === 'AI Wins!') {
    // red flash, ai trash talk, shake
    if (board) { board.classList.add('flash-red'); setTimeout(()=>board.classList.remove('flash-red'), 900); }
    shakeScreen();
    const aiTalk = document.getElementById('aiTalk'); if (aiTalk) aiTalk.innerText = 'AI: Told you so!';
  }

  // New high score popup if applicable
  try {
    if (lbRes && lbRes.isNewTop) {
      const nr = document.getElementById('newRecordPopup');
      if (nr) {
        nr.classList.remove('hidden'); nr.classList.add('show'); nr.innerText = '🔥 NEW HIGH SCORE!';
        setTimeout(()=>{ nr.classList.remove('show'); nr.classList.add('hidden'); }, 1600);
      }
    }
  } catch(e){}

  // show lose-by message or win message in hook area
  const hook = document.getElementById('hookText');
  if (hook) {
    if (result === 'You Win!') {
      hook.innerText = `YOU WON 🔥 — Win Streak: ${winStreak}`;
    } else if (result === 'AI Wins!') {
      const diff = Math.abs(aiScore - userScore);
      hook.innerText = `Lost by ${diff} run${diff>1?'s':''}… Try again?`;
    } else hook.innerText = `Draw — good fight`;
  }

  // show end-screen after brief moment so popup registers
  setTimeout(()=>{
    const endScreen = document.getElementById('endScreen');
    const endResult = document.getElementById('endResult');
    const endDetails = document.getElementById('endDetails');
    if (endResult) endResult.innerText = `🏁 ${result}`;
    if (endDetails) endDetails.innerText = `Score: ${userScore} - ${aiScore}`;
    if (endScreen) {
      endScreen.classList.remove('hidden');
      endScreen.classList.add('show');
      endScreen.setAttribute('aria-hidden','false');
    }
    // ensure popup hides when overlay open
    if (popup) { popup.classList.remove('show'); popup.classList.add('hidden'); }
  }, 700);
}

function updateScores() {
  const userEl = document.getElementById("userScore");
  const aiEl = document.getElementById("aiScore");
  const board = document.getElementById('scoreBoard');
  if (userEl) userEl.innerText = userScore;
  if (aiEl) aiEl.innerText = aiScore;
  if (board) {
    board.classList.add('score-pop');
    setTimeout(()=> board.classList.remove('score-pop'), 200);
  }
}


function updateStatus(msg) {
  const el = document.getElementById("statusText");
  if (!el) return;
  if (msg) { el.innerText = msg; return; }
  const who = batting === 'user' ? 'You' : 'AI';
  const colorDot = batting === 'user' ? '🟢' : '🔴';
  const inningText = ` (Innings ${inning})`;
  // Base line
  let base = `${colorDot} ${who} batting${inningText}`;
  // If chasing in inning 2, add pressure lines
  if (targetMode && inning === 2 && chaseTarget) {
    const remaining = batting === 'user' ? (chaseTarget - userScore) : (chaseTarget - aiScore);
    const targetLine = `Target: ${chaseTarget} • ${batting === 'user' ? `You need ${Math.max(0, remaining)} run(s)` : `AI needs ${Math.max(0, remaining)} run(s)`}`;
    const warn = `⚠️ One mistake = OUT`;
    let clutch = '';
    if (remaining <= 3 && remaining > 0) clutch = '🔥 CLUTCH MOMENT — Do or die!';
    el.innerText = `${base} — chasing ${chaseTarget}\n${targetLine}\n${warn}${clutch ? '\n' + clutch : ''}`;
    // nudge AI chatter for pressure
    const aiTalk = document.getElementById('aiTalk');
    if (aiTalk && remaining <= 3 && remaining > 0) aiTalk.innerText = `You're getting nervous...`;
  } else {
    el.innerText = base;
  }
  // last-over tension: if chasing in final over(s), nudge the status
  if (inning === 2 && !isTest && typeof maxOvers === 'number' && maxOvers > 0) {
    const totalBalls = maxOvers * 6;
    const used = currentOver * 6 + currentBall;
    const remainingBalls = Math.max(0, totalBalls - used);
    if (remainingBalls <= 6) {
      el.innerText += `\n⏱️ Final over — ${remainingBalls} ball(s) left`;
    }
  }
}

/**********************
  RESTART
**********************/
function restart() {
  if (resumedFromSave) { showPop('Restart disabled for resumed saved match'); return; }
  location.reload();
}

/* new restart handler that resets game state without full reload */
function restartGame() {
  if (resumedFromSave) { showPop('Restart disabled for resumed saved match'); return; }
  userScore = 0;
  aiScore = 0;
  batting = null;
  inning = 1;
  gameOver = false;
  userHistory = [];

  // reset target/chase
  chaseTarget = null;
  firstInningsScore = null;
  matchStarted = false;
  const td = document.getElementById('targetDisplay');
  if (td) td.innerText = `Chase: —`;
  // reset overs/balls and mode UI
  currentBall = 0; currentOver = 0; maxOvers = 1; isTest = false; target = 0;
  const modeBox = document.getElementById('modeBox'); if (modeBox) modeBox.classList.remove('hidden');
  updateOverDisplay(); if (td) td.innerText = '';

  // block inputs until user selects mode/toss again
  blockInputs(true);

  updateScores();

  const tossBox = document.getElementById("tossBox");
  const choiceBox = document.getElementById("choiceBox");
  if (tossBox) tossBox.classList.remove("hidden");
  if (choiceBox) choiceBox.classList.add("hidden");

  document.getElementById("statusText").innerText = "Choose for Toss";
  document.getElementById("welcomeText").innerText = `Welcome, ${user}`;
  const userLabel = document.getElementById('userLabel');
  if (userLabel) userLabel.innerText = user;

  applyBackground();
  applyMood();
  playSound('restart.mp3');
  startAiTrashInterval();
}

function restartFromEnd(){
  const endScreen = document.getElementById('endScreen');
  if (endScreen) { endScreen.classList.remove('show'); endScreen.classList.add('hidden'); endScreen.setAttribute('aria-hidden','true'); }
  if (resumedFromSave) { showPop('Restart disabled for resumed saved match'); return; }
  restartGame();
}

function closeEndScreen(){
  const endScreen = document.getElementById('endScreen');
  if (endScreen) { endScreen.classList.remove('show'); endScreen.classList.add('hidden'); endScreen.setAttribute('aria-hidden','true'); }
}

/* --- Visual helpers for v2 --- */
const targetScore = 20;

function showPop(text) {
  const el = document.getElementById('popOverlay');
  if (!el) return;
  // showPop(text, type) where type = 'info'|'success'|'error'
  const type = (arguments.length > 1) ? arguments[1] : 'info';
  el.className = 'pop-overlay';
  el.classList.add(type);
  el.classList.remove('hidden');
  el.innerText = text;
  // trigger animation
  el.classList.remove('show');
  // force reflow to restart animation
  void el.offsetWidth;
  el.classList.add('show');
  setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('hidden');
    // reset to default
    el.className = 'pop-overlay';
  }, 900);
}

function updateOverDisplay() {
  const el = document.getElementById('overDisplay');
  if (!el) return;
  el.innerText = `Over: ${currentOver}.${currentBall} / ${isTest ? '∞' : maxOvers}`;
  updateBallsLeft();
}

function updateBallsLeft() {
  const el = document.getElementById('ballsLeft');
  if (!el) return;
  if (isTest) { el.innerText = `Balls left: ∞`; return; }
  const totalBalls = (Number(maxOvers) || 0) * 6;
  const used = (currentOver * 6) + currentBall;
  const remaining = Math.max(0, totalBalls - used);
  el.innerText = `Balls left: ${remaining}`;
}

function updateTarget() {
  const el = document.getElementById('targetDisplay');
  if (!el) return;
  if (inning === 2) {
    el.innerText = `Target: ${target}`;
  } else {
    el.innerText = '';
  }
}

function shakeScreen() {
  const board = document.querySelector('.board');
  if (!board) return;
  board.classList.add('shake');
  setTimeout(()=> board.classList.remove('shake'), 340);
}

/* ------------------ Tutorial system ------------------ */
const tutorialSteps = [
  { sel: '#modeBox', title: 'Choose Mode', text: 'Select a match length: Quick, Standard, or Test. This determines overs.' },
  { sel: '#tossBox', title: 'Toss', text: 'After choosing mode, perform the toss here (Odd/Even).' },
  { sel: '#choiceBox', title: 'Bat or Bowl', text: 'If you win the toss, choose whether to bat or bowl.' },
  { sel: '#scoreBoard', title: 'Scoreboard', text: 'Watch your and the AI score here.' },
  { sel: '.hand-container', title: 'Play Hands', text: 'Click a number (0–6) to play a hand. Match numbers = OUT.' },
  { sel: '#overDisplay', title: 'Overs', text: 'Track overs and balls here. Matches follow the Mode you chose.' }
];
let tutorialIndex = 0;

function clearHighlights() {
  const prev = document.querySelectorAll('.tutorial-highlight');
  prev.forEach(n => n.classList.remove('tutorial-highlight'));
  const overlay = document.getElementById('tutorialOverlay');
  if (overlay) overlay.classList.remove('show');
  const box = document.getElementById('tutorialBox'); if (box) box.classList.add('hidden');
  // restore any element that was temporarily unhidden
  const tmp = document.querySelectorAll('[data-tut-temp-hidden]');
  tmp.forEach(e => { e.classList.add('hidden'); e.removeAttribute('data-tut-temp-hidden'); });
}

function highlightElement(sel) {
  clearHighlights();
  const overlay = document.getElementById('tutorialOverlay');
  if (overlay) overlay.classList.add('show');
  const el = document.querySelector(sel);
  if (el) {
    // if element is hidden, unhide temporarily and mark to restore later
    if (el.classList && el.classList.contains('hidden')) {
      el.classList.remove('hidden');
      el.setAttribute('data-tut-temp-hidden', '1');
    }
    el.classList.add('tutorial-highlight');
    // ensure visible
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  const box = document.getElementById('tutorialBox');
  if (box) box.classList.remove('hidden');
}

function showStep(i) {
  if (i < 0 || i >= tutorialSteps.length) return;
  tutorialIndex = i;
  const step = tutorialSteps[i];
  const title = document.getElementById('tutorialTitle');
  const body = document.getElementById('tutorialBody');
  if (title) title.innerText = step.title;
  if (body) body.innerText = step.text;
  highlightElement(step.sel);
}

function startTutorial() {
  tutorialIndex = 0;
  document.getElementById('tutorialOverlay')?.classList.add('show');
  // block inputs while tutorial active
  blockInputs(true);
  showStep(0);
}

function nextTutorial() {
  if (tutorialIndex < tutorialSteps.length - 1) showStep(tutorialIndex + 1);
  else endTutorial();
}

function prevTutorial() {
  if (tutorialIndex > 0) showStep(tutorialIndex - 1);
}

function endTutorial() {
  clearHighlights();
  // Do not alter match flow or UI visibility — tutorial is optional and non-destructive.
}

// initialize UI from localStorage if available
document.addEventListener('DOMContentLoaded', () => {
  const storedUser = localStorage.getItem('oec_user');
  if (storedUser) {
    user = storedUser;
    const welcome = document.getElementById('welcomeText');
    if (welcome) welcome.innerText = `Welcome, ${user}`;
    const userLabel = document.getElementById('userLabel');
    if (userLabel) userLabel.innerText = user;
    const photo = localStorage.getItem('oec_photo');
    if (photo) {
      const gameImg = document.getElementById('gameUserPhoto');
      if (gameImg) gameImg.src = photo;
      const preview = document.getElementById('userPhotoPreview');
      if (preview) { preview.src = photo; preview.classList.remove('hidden'); }
      const loginBox = document.getElementById('loginBox');
      const gameBox = document.getElementById('gameBox');
      if (loginBox) loginBox.classList.add('hidden');
      if (gameBox) gameBox.classList.remove('hidden');
      try { renderLeaderboard(); renderProfile(); } catch(e){}
    }
  }
  // if a saved match exists for this user, auto-resume it
  try {
    const saved = loadSavedMatch(user);
    if (saved) {
      resumeSavedMatch();
    }
  } catch(e){}
});

/**********************
  MOOD SWITCHER
**********************/
const body = document.body;
const moodSelect = document.getElementById("moodSelect");
if (moodSelect) moodSelect.addEventListener("change", () => {
  localStorage.setItem('oec_mood', moodSelect.value);
  applyMood();
  updateAiMoodVisual(moodSelect.value);
});

/* background selector hookup */
const bgSelect = document.getElementById("bgSelect");
function applyBackground() {
  if (!bgSelect) return;
  // clear inline background so CSS classes take precedence
  body.style.background = "";
  body.classList.remove("beach", "space", "forest", "city", "sunset", "neon");
  if (bgSelect.value === 'custom') {
    // apply stored custom gradient if exists
    applyCustomBg();
    return;
  }
  if (bgSelect.value && bgSelect.value !== "default") {
    body.classList.add(bgSelect.value);
  }
}
if (bgSelect) bgSelect.addEventListener('change', () => {
  localStorage.setItem('oec_bg', bgSelect.value);
  applyBackground();
});

/* Photo upload handling: show preview and persist */
const photoInput = document.getElementById('userPhotoInput');
function handlePhotoUpload(e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    const data = r.result;
    const preview = document.getElementById('userPhotoPreview');
    const gameImg = document.getElementById('gameUserPhoto');
    if (preview) { preview.src = data; preview.classList.remove('hidden'); }
    if (gameImg) gameImg.src = data;
    localStorage.setItem('oec_photo', data);
  };
  r.readAsDataURL(f);
}
if (photoInput) photoInput.addEventListener('change', handlePhotoUpload);

/* --- Market / Background purchases --- */
const availableBgs = [
  { id: 'beach', name: 'Beach', price: 150 },
  { id: 'space', name: 'Space', price: 200 },
  { id: 'forest', name: 'Forest', price: 180 },
  { id: 'city', name: 'City Lights', price: 220 },
  { id: 'sunset', name: 'Sunset', price: 200 },
  { id: 'neon', name: 'Neon Glow', price: 240 },
  { id: 'custom', name: 'Custom Gradient', price: 5000, special: true }
];

function getOwnedBgs(){
  try { return JSON.parse(localStorage.getItem('oec_owned_bgs')) || ['default']; } catch(e){ return ['default']; }
}
function setOwnedBgs(arr){ try { localStorage.setItem('oec_owned_bgs', JSON.stringify(arr)); } catch(e){} }

function syncBgOptions(){
  try {
    const owned = getOwnedBgs();
    if (!bgSelect) return;
    // disable options not owned
    Array.from(bgSelect.options).forEach(opt => {
      if (opt.value === 'default') { opt.disabled = false; return; }
      opt.disabled = !owned.includes(opt.value);
      opt.innerText = `${opt.value.charAt(0).toUpperCase()+opt.value.slice(1)}${owned.includes(opt.value)?'':' (Locked)'}`;
    });
  } catch(e){}
}

function openMarket(){
  const mb = document.getElementById('marketBox'); if (!mb) return;
  mb.classList.remove('hidden'); mb.setAttribute('aria-hidden','false');
  renderMarket();
}
function closeMarket(){
  const mb = document.getElementById('marketBox'); if (!mb) return;
  mb.classList.add('hidden'); mb.setAttribute('aria-hidden','true');
}

function renderMarket(){
  const list = document.getElementById('marketList'); if (!list) return;
  list.innerHTML = '';
  const owned = getOwnedBgs();
  availableBgs.forEach(b => {
    const el = document.createElement('div'); el.className = 'market-item';
    const left = document.createElement('div'); left.className = 'mi-left';
    const name = document.createElement('div'); name.className='mi-name'; name.innerText = b.name;
    const price = document.createElement('div'); price.className='mi-price'; price.innerText = `${b.price}¢`;
    left.appendChild(name); left.appendChild(price);
    const btn = document.createElement('button');
    if (owned.includes(b.id)) {
      if (b.id === 'custom') { btn.innerText = 'Customize'; btn.onclick = ()=> openCustomEditor(); }
      else { btn.innerText = 'Owned'; btn.disabled = true; }
    } else {
      btn.innerText = `Buy ${b.price}`; btn.onclick = ()=> buyBackground(b.id);
    }
    el.appendChild(left); el.appendChild(btn);
    list.appendChild(el);
    // hover preview wiring
    el.onmouseenter = () => showMarketPreview(b.id);
    el.onmouseleave = () => clearMarketPreview();
  });
  // initial preview show current selected background
  try { const cur = localStorage.getItem('oec_bg') || (bgSelect && bgSelect.value) || 'default'; showMarketPreview(cur); } catch(e){}
}

function buyBackground(id){
  const bg = availableBgs.find(b=>b.id===id); if (!bg) return showPop('Invalid item');
  if ((profile.coins||0) < bg.price) return showPop('Not enough coins', 'error');
  // deduct
  profile.coins = (profile.coins||0) - bg.price;
  saveProfile(); renderProfile();
  // update market coins display if present
  try { const mc = document.getElementById('marketCoins'); if (mc) mc.innerText = profile.coins; } catch(e){}
  // add to owned
  const owned = getOwnedBgs();
  if (!owned.includes(id)) { owned.push(id); setOwnedBgs(owned); }
  showPop(`Purchased ${bg.name}`, 'success');
  renderMarket();
  syncBgOptions();
  // auto-apply purchased background
  try { if (bgSelect) { bgSelect.value = id; localStorage.setItem('oec_bg', id); applyBackground(); } } catch(e){}
  // update preview in market
  try { showMarketPreview(id); } catch(e){}
}

// ensure bg options reflect owned set on load
try { syncBgOptions(); } catch(e){}

/* --- Custom gradient utilities --- */
function getCustomBg(){
  try { return JSON.parse(localStorage.getItem('oec_custom_bg') || 'null'); } catch(e){ return null; }
}
function setCustomBg(obj){
  try { localStorage.setItem('oec_custom_bg', JSON.stringify(obj)); } catch(e){}
}

function openCustomEditor(){
  // prompt-based quick editor: two colors and angle
  const prev = getCustomBg();
  const c1 = prompt('Color 1 (hex or css)', prev?.c1 || '#ff7a18');
  if (!c1) return;
  const c2 = prompt('Color 2 (hex or css)', prev?.c2 || '#ffb86b');
  if (!c2) return;
  const angle = prompt('Angle (deg)', prev?.angle || '135');
  const g = { c1: c1, c2: c2, angle: Number(angle) || 135 };
  setCustomBg(g);
  applyCustomBg();
  try { if (bgSelect) { bgSelect.value = 'custom'; localStorage.setItem('oec_bg','custom'); } } catch(e){}
}

function applyCustomBg(){
  const g = getCustomBg();
  if (!g) return;
  try {
    // remove known classes
    body.classList.remove('beach','space','forest','city','sunset','neon');
    body.style.background = `linear-gradient(${g.angle}deg, ${g.c1}, ${g.c2})`;
    localStorage.setItem('oec_bg','custom');
  } catch(e){}
}

/* --- Market preview helpers --- */
function showMarketPreview(id){
  const preview = document.getElementById('marketPreview'); if (!preview) return;
  const previewStyles = {
    default: 'linear-gradient(180deg,#0f1724,#071126)',
    beach: 'linear-gradient(90deg,#7ec8ff,#a6f6c8)',
    space: 'radial-gradient(circle at 30% 20%,#1b1f3a,#0b0f2e 40%,#000 80%)',
    forest: 'linear-gradient(180deg,#0b3d2e,#66c38f)',
    city: 'linear-gradient(180deg,#111827,#374151)',
    sunset: 'linear-gradient(135deg,#ff7a18,#ffb86b)',
    neon: 'linear-gradient(90deg,#8affc1,#7a7bff)'
  };
  try {
    if (id === 'custom'){
      const g = getCustomBg();
      if (g) preview.style.background = `linear-gradient(${g.angle}deg, ${g.c1}, ${g.c2})`;
      else preview.style.background = previewStyles.default;
    } else {
      preview.style.background = previewStyles[id] || previewStyles.default;
    }
    const name = availableBgs.find(b=>b.id===id)?.name || (id==='default'?'Default':'Preview');
    preview.innerText = name;
    preview.style.color = '#001';
  } catch(e){ /* safe no-op */ }
}

function clearMarketPreview(){
  const preview = document.getElementById('marketPreview'); if (!preview) return;
  const cur = localStorage.getItem('oec_bg') || (bgSelect && bgSelect.value) || 'default';
  showMarketPreview(cur);
}

function logout() {
  // if a match is in progress, save it before logging out
  try {
    if (matchStarted && !gameOver) {
      saveMatchState();
    }
  } catch(e){}
  // clear lightweight user settings but keep saved match
  localStorage.removeItem('oec_user');
  localStorage.removeItem('oec_diff');
  localStorage.removeItem('oec_mood');
  localStorage.removeItem('oec_bg');
  stopAiTrashInterval();
  location.reload();
}

function saveMatchState() {
  try {
    const state = {
      user: user,
      userScore: userScore,
      aiScore: aiScore,
      batting: batting,
      inning: inning,
      matchStarted: matchStarted,
      gameOver: gameOver,
      currentBall: currentBall,
      currentOver: currentOver,
      maxOvers: maxOvers,
      isTest: isTest,
      target: target,
      chaseTarget: chaseTarget,
      firstInningsScore: firstInningsScore,
      userHistory: userHistory,
      aiHistory: aiHistory,
      difficulty: difficulty,
      mood: mood
    };
    const key = `oec_saved_match_${user}`;
    localStorage.setItem(key, JSON.stringify(state));
    showPop('Match saved', 'info');
  } catch(e){ console.warn('saveMatchState failed', e); }
}

function loadSavedMatch(forUser) {
  try {
    const who = forUser || user || localStorage.getItem('oec_user');
    if (!who) return null;
    const key = `oec_saved_match_${who}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s;
  } catch(e){ return null; }
}

function resumeSavedMatch() {
  const s = loadSavedMatch(user);
  if (!s) { showPop('No saved match', 'error'); return; }
  // restore state
  user = s.user || user;
  userScore = s.userScore || 0;
  aiScore = s.aiScore || 0;
  batting = s.batting || null;
  inning = s.inning || 1;
  matchStarted = Boolean(s.matchStarted);
  gameOver = Boolean(s.gameOver);
  currentBall = s.currentBall || 0;
  currentOver = s.currentOver || 0;
  maxOvers = s.maxOvers || 1;
  isTest = Boolean(s.isTest);
  target = s.target || 0;
  chaseTarget = s.chaseTarget || null;
  firstInningsScore = s.firstInningsScore || null;
  userHistory = s.userHistory || [];
  aiHistory = s.aiHistory || [];
  difficulty = s.difficulty || difficulty;
  mood = s.mood || mood;

  // update UI
  const loginBox = document.getElementById('loginBox');
  const gameBox = document.getElementById('gameBox');
  if (loginBox) loginBox.classList.add('hidden');
  if (gameBox) gameBox.classList.remove('hidden');
  const welcome = document.getElementById('welcomeText'); if (welcome) welcome.innerText = `Welcome, ${user}`;
  const userLabel = document.getElementById('userLabel'); if (userLabel) userLabel.innerText = user;
  updateScores(); updateStatus(); updateOverDisplay(); updateTarget();
  showPop('Resumed saved match', 'success');
  // hide resume prompt
  const rb = document.getElementById('resumeBox'); if (rb) rb.classList.add('hidden');
  const b = document.getElementById('inputBlocker'); if (b) b.classList.add('hidden');
  // start AI chatter
  startAiTrashInterval();
  // mark resumed state: disable any restart pathways and hide restart buttons
  resumedFromSave = true;
  try {
    document.querySelectorAll('.restart-btn').forEach(el => el.classList.add('hidden'));
  } catch(e){}
}

function discardSavedMatch() {
  const key = `oec_saved_match_${user || localStorage.getItem('oec_user')}`;
  localStorage.removeItem(key);
  const rb = document.getElementById('resumeBox'); if (rb) rb.classList.add('hidden');
  const b = document.getElementById('inputBlocker'); if (b) b.classList.add('hidden');
  showPop('Saved match discarded', 'info');
  // if user discards, allow restart options again
  resumedFromSave = false;
  try { document.querySelectorAll('.restart-btn').forEach(el => el.classList.remove('hidden')); } catch(e){}
}

// render leaderboard at DOM ready
document.addEventListener('DOMContentLoaded', () => {
  try { renderLeaderboard(); renderProfile(); renderMarket(); syncBgOptions(); } catch(e){}
});

// save on refresh/unload so refresh preserves in-progress matches
window.addEventListener('beforeunload', (e) => {
  try {
    if (matchStarted && !gameOver && user) saveMatchState();
  } catch(e){}
});

function updateAiMoodVisual(moodVal){
  const aiImg = document.getElementById('aiAvatar');
  const aiTalk = document.getElementById('aiTalk');
  if (aiImg) aiImg.src = `assets/ai-${moodVal}.png`;
  if (aiTalk) {
    // set an initial varied line
    speakTrash(moodVal);
  }
}

/* --- Trash talk variation + sounds --- */
const aiLines = {
  calm: [
    "Nice move—I'll adapt.",
    "Relax, I'm just observing.",
    "Calculating odds... looks good.",
    "Easy does it."
  ],
  rage: [
    "You're gone!",
    "Feel the burn!",
    "No mercy!",
    "I dominate!"
  ],
  troll: [
    "Heh, try that again.",
    "Is that all you've got?",
    "Haha, predictable!",
    "Come on, make it spicy."
  ]
};

function speakTrash(moodVal){
  const aiTalk = document.getElementById('aiTalk');
  if (!aiTalk) return;
  const pool = aiLines[moodVal] || [].concat(...Object.values(aiLines));
  const line = pool[Math.floor(Math.random() * pool.length)];
  aiTalk.innerText = `AI: ${line}`;
}

// Periodically update trash talk while game is visible
let aiTalkTimer = null;
function startAiTrashInterval() {
  if (aiTalkTimer) clearInterval(aiTalkTimer);
  aiTalkTimer = setInterval(() => {
    const currentMood = (moodSelect && moodSelect.value) || mood || 'troll';
    // 70% chance to say nothing (natural), 30% to utter a line
    if (Math.random() < 0.35) speakTrash(currentMood);
  }, 3500 + Math.random() * 3000);
}
function stopAiTrashInterval(){ if (aiTalkTimer) clearInterval(aiTalkTimer); aiTalkTimer = null }

/* Sound playback helper - uses available files in assets/ */
function playSound(name, vol = 0.9){
  if (isMuted) return;
  try {
    const audio = new Audio(`assets/${name}`);
    audio.volume = typeof vol === 'number' ? vol : 0.9;
    audio.play().catch(()=>{});
  } catch(e){}
}


window.onload = () => {
  const savedUser = localStorage.getItem("oec_user");
  const savedMood = localStorage.getItem("oec_mood");
  const savedBg = localStorage.getItem("oec_bg");

  if (savedUser) {
    document.getElementById("loginBox").classList.add("hidden");
    document.getElementById("gameBox").classList.remove("hidden");
    document.getElementById("welcomeText").innerText = `Welcome, ${savedUser}`;
    user = savedUser;
  }

  if (savedMood && moodSelect) moodSelect.value = savedMood;
  if (savedBg && bgSelect) bgSelect.value = savedBg;

  // apply selected background (including custom)
  try { applyBackground(); if (savedBg === 'custom') applyCustomBg(); } catch(e){}

  // sync owned background options
  try { syncBgOptions(); } catch(e){}

  if (savedMood) updateAiMoodVisual(savedMood);

  const savedPhoto = localStorage.getItem('oec_photo');
  if (savedPhoto) {
    const preview = document.getElementById('userPhotoPreview');
    const gameImg = document.getElementById('gameUserPhoto');
    if (preview) { preview.src = savedPhoto; preview.classList.remove('hidden'); }
    if (gameImg) gameImg.src = savedPhoto;
  }

  applyMood();
  applyBackground();
  // start periodic AI chatter when the game is visible
  const gameVisible = !document.getElementById('gameBox').classList.contains('hidden');
  if (gameVisible) startAiTrashInterval();
  // load progression stats
  try {
    const ps = document.getElementById('progressStats');
    const wins = localStorage.getItem('oec_wins') || '0';
    const losses = localStorage.getItem('oec_losses') || '0';
    if (ps) ps.innerText = `Wins: ${wins} | Losses: ${losses}`;
  } catch(e){}
  // ensure inputs are blocked until a match is started
  blockInputs(!matchStarted);
};
/**********************
  END OF SCRIPT
**********************/