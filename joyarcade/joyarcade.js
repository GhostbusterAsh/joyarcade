(function () {
  const search = document.getElementById('game-search');
  const cards = Array.from(document.querySelectorAll('.game-card'));
  const count = document.getElementById('result-count');
  const randomBtn = document.getElementById('randomGameBtn');
  const quizCta = document.getElementById('take-quiz');
  const quizForm = document.getElementById('quickQuiz');
  const quizMood = document.getElementById('quizMood');
  const quizResult = document.getElementById('quizResult');
  const menuToggle = document.getElementById('menuToggle');
  const nav = document.getElementById('mainNav');
  const pulseOnline = document.getElementById('pulseOnline');
  const pulseReaction = document.getElementById('pulseReaction');
  const pulseFail = document.getElementById('pulseFail');
  const idleOverlay = document.getElementById('idleOverlay');
  const idleCountdown = document.getElementById('idleCountdown');
  const idleCancel = document.getElementById('idleCancel');
  const rewardToast = document.getElementById('rewardToast');
  const audioToggle = document.getElementById('audioToggle');
  const themeMusic = document.getElementById('themeMusic');

  const PLAY_KEY = 'joyarcade_last_play';
  const MUSIC_TIME_KEY = 'joyarcade_theme_music_time';
  const MUSIC_ENABLED_KEY = 'joyarcade_theme_music_enabled';
  const GAME_PROGRESS_PREFIX = 'joyarcade_game_progress_';

  let interacted = false;
  let idleTimer = null;
  let countdownTimer = null;

  function updateCount(shown) {
    if (count) count.textContent = `${shown} of ${cards.length} games`;
  }

  function filterCards(query) {
    const q = query.trim().toLowerCase();
    let shown = 0;
    cards.forEach((card) => {
      const title = (card.dataset.title || '').toLowerCase();
      const tags = (card.dataset.tags || '').toLowerCase();
      const matched = !q || title.includes(q) || tags.includes(q);
      card.style.display = matched ? '' : 'none';
      if (matched) shown += 1;
    });
    updateCount(shown);
  }

  function cancelIdleFlow() {
    document.body.classList.remove('dimmed');
    if (idleOverlay) idleOverlay.classList.remove('show');
    if (countdownTimer) clearInterval(countdownTimer);
  }

  if (search) {
    search.addEventListener('input', (e) => {
      interacted = true;
      cancelIdleFlow();
      filterCards(e.target.value);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== search) {
        e.preventDefault();
        search.focus();
      }
    });
    filterCards('');
  }

  document.querySelectorAll('.play-link, .btn, input, select').forEach((el) => {
    el.addEventListener('pointerdown', () => {
      interacted = true;
      cancelIdleFlow();
    }, { passive: true });
  });

  if (randomBtn) {
    randomBtn.addEventListener('click', () => {
      interacted = true;
      const visible = cards.filter((card) => card.style.display !== 'none');
      const pool = visible.length ? visible : cards;
      const links = pool.map((c) => c.querySelector('a')?.getAttribute('href')).filter(Boolean);
      if (!links.length) return;
      location.href = links[Math.floor(Math.random() * links.length)];
    });
  }

  if (quizForm && quizMood && quizResult) {
    quizForm.addEventListener('submit', (e) => {
      e.preventDefault();
      interacted = true;
      const mood = quizMood.value;
      const firstMatch = cards.find((card) => (card.dataset.tags || '').includes(mood));
      const link = firstMatch?.querySelector('a');
      if (!link) {
        quizResult.textContent = 'No matching game found yet. Try another mood.';
        return;
      }
      quizResult.innerHTML = `Recommended: <strong>${firstMatch.dataset.title}</strong> · <a href="${link.getAttribute('href')}">Play now</a>`;
    });
  }

  if (quizCta) {
    quizCta.addEventListener('click', () => {
      interacted = true;
      if (quizMood) setTimeout(() => quizMood.focus(), 120);
    });
  }

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      interacted = true;
      const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!expanded));
      nav.classList.toggle('nav-open');
    });
  }

  function updatePulse() {
    const online = 9 + Math.floor(Math.random() * 26);
    const reaction = 240 + Math.floor(Math.random() * 95);
    const fail = 45 + Math.floor(Math.random() * 35);
    if (pulseOnline) pulseOnline.textContent = `🔥 ${online} players online`;
    if (pulseReaction) pulseReaction.textContent = `⚡ Avg reaction: ${reaction}ms`;
    if (pulseFail) pulseFail.textContent = `🧠 ${fail}% failed today`;
  }
  updatePulse();
  setInterval(updatePulse, 4000);

  function runIdleCountdown() {
    if (interacted || !idleOverlay || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let left = 3;
    document.body.classList.add('dimmed');
    idleOverlay.classList.add('show');
    if (idleCountdown) idleCountdown.textContent = String(left);

    countdownTimer = setInterval(() => {
      left -= 1;
      if (idleCountdown) idleCountdown.textContent = String(Math.max(left, 0));
      if (left <= 0) {
        clearInterval(countdownTimer);
        cancelIdleFlow();
        location.href = 'reactiontest/index.html';
      }
    }, 1000);
  }

  if (idleCancel) {
    idleCancel.addEventListener('click', () => {
      interacted = true;
      cancelIdleFlow();
    });
  }
  idleTimer = setTimeout(runIdleCountdown, 4500);

  function saveGameProgress(gameId, data) {
    if (!gameId) return;
    localStorage.setItem(`${GAME_PROGRESS_PREFIX}${gameId}`, JSON.stringify({ ...data, at: Date.now() }));
  }

  function loadGameProgress(gameId) {
    if (!gameId) return null;
    try { return JSON.parse(localStorage.getItem(`${GAME_PROGRESS_PREFIX}${gameId}`) || 'null'); } catch (e) { return null; }
  }

  window.JoyArcadeProgress = { saveGameProgress, loadGameProgress };

  document.querySelectorAll('.play-link, #startChallenge').forEach((link) => {
    link.addEventListener('click', () => {
      const gameId = link.dataset.gameId || link.closest('.game-card')?.dataset.title || 'Challenge';
      localStorage.setItem(PLAY_KEY, JSON.stringify({ title: gameId, at: Date.now() }));
      saveGameProgress(gameId, { checkpoint: 'launch', musicTime: Number(localStorage.getItem(MUSIC_TIME_KEY) || '0') });

      // pause homepage song exactly at current point before entering game
      if (themeMusic && !themeMusic.paused) {
        localStorage.setItem(MUSIC_TIME_KEY, String(themeMusic.currentTime || 0));
        themeMusic.pause();
      }
    });
  });

  try {
    const last = JSON.parse(localStorage.getItem(PLAY_KEY) || 'null');
    if (last && rewardToast && Date.now() - last.at < 20 * 60 * 1000) {
      const beat = 58 + Math.floor(Math.random() * 37);
      const points = 8 + Math.floor(Math.random() * 11);
      rewardToast.hidden = false;
      rewardToast.innerHTML = `<strong>${last.title}</strong><br>You beat ${beat}% of players<br>+${points} points · <a href="#games">Try again?</a>`;
      setTimeout(() => { rewardToast.hidden = true; }, 9000);
      localStorage.removeItem(PLAY_KEY);
    }
  } catch (e) {}

  // Theme music: "Feet Don't Fail Me Now" local asset integration.
  function fadeMusic(target, ms) {
    if (!themeMusic) return;
    const start = themeMusic.volume;
    const diff = target - start;
    const steps = 12;
    let i = 0;
    const tick = ms / steps;
    const timer = setInterval(() => {
      i += 1;
      themeMusic.volume = Math.max(0, Math.min(1, start + diff * (i / steps)));
      if (i >= steps) clearInterval(timer);
    }, tick);
  }

  if (themeMusic) {
    themeMusic.volume = 0;
    themeMusic.addEventListener('timeupdate', () => {
      localStorage.setItem(MUSIC_TIME_KEY, String(themeMusic.currentTime || 0));
    });

    const savedTime = Number(localStorage.getItem(MUSIC_TIME_KEY) || '0');
    if (savedTime > 0) {
      themeMusic.currentTime = savedTime;
    }

    window.addEventListener('beforeunload', () => {
      localStorage.setItem(MUSIC_TIME_KEY, String(themeMusic.currentTime || 0));
      localStorage.setItem(MUSIC_ENABLED_KEY, themeMusic.paused ? '0' : '1');
    });
  }

  if (audioToggle) {
    audioToggle.addEventListener('click', async () => {
      interacted = true;
      if (!themeMusic) return;

      if (themeMusic.paused) {
        try {
          const savedTime = Number(localStorage.getItem(MUSIC_TIME_KEY) || '0');
          if (savedTime > 0 && Math.abs(themeMusic.currentTime - savedTime) > 1) {
            themeMusic.currentTime = savedTime;
          }
          await themeMusic.play();
          fadeMusic(0.14, 900);
          audioToggle.textContent = '🔊';
          audioToggle.setAttribute('aria-pressed', 'true');
          localStorage.setItem(MUSIC_ENABLED_KEY, '1');
        } catch (e) {
          audioToggle.textContent = '🔇';
        }
      } else {
        fadeMusic(0, 700);
        setTimeout(() => {
          themeMusic.pause();
          localStorage.setItem(MUSIC_TIME_KEY, String(themeMusic.currentTime || 0));
        }, 740);
        audioToggle.textContent = '🔇';
        audioToggle.setAttribute('aria-pressed', 'false');
        localStorage.setItem(MUSIC_ENABLED_KEY, '0');
      }
    });
  }
})();
