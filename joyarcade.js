(function () {
  const search = document.getElementById('game-search');
  const cards = Array.from(document.querySelectorAll('.game-card'));
  const count = document.getElementById('result-count');
  const chips = Array.from(document.querySelectorAll('.chip'));
  const randomBtn = document.getElementById('randomGameBtn');
  const quizBtn = document.getElementById('take-quiz');

  function updateCount(shown) {
    if (!count) return;
    count.textContent = `${shown} of ${cards.length} games`;
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

  if (search) {
    search.addEventListener('input', (e) => filterCards(e.target.value));
    filterCards('');
  }

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const filter = chip.dataset.filter || '';
      if (search) search.value = filter;
      filterCards(filter);
    });
  });

  if (randomBtn) {
    randomBtn.addEventListener('click', () => {
      const links = cards.map((c) => c.querySelector('a')?.getAttribute('href')).filter(Boolean);
      if (!links.length) return;
      location.href = links[Math.floor(Math.random() * links.length)];
    });
  }

  if (quizBtn) {
    quizBtn.addEventListener('click', () => {
      const collections = document.getElementById('collections');
      if (collections) collections.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
})();
