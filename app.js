const els = {
  search: document.querySelector('#pokemon-search'),
  select: document.querySelector('#pokemon-select'),
  status: document.querySelector('#status'),
  result: document.querySelector('#result'),
  empty: document.querySelector('#final-form'),
  generation: document.querySelector('#generation-pill'),
  currentCard: document.querySelector('#current-card'),
  currentImage: document.querySelector('#current-image'),
  currentName: document.querySelector('#current-name'),
  currentTypes: document.querySelector('#current-types'),
  currentMeta: document.querySelector('#current-meta'),
  nextCard: document.querySelector('#next-card'),
  nextImage: document.querySelector('#next-image'),
  nextName: document.querySelector('#next-name'),
  nextTypes: document.querySelector('#next-types'),
  nextMeta: document.querySelector('#next-meta'),
  branchButtons: document.querySelector('#branch-buttons'),
  statsGrid: document.querySelector('#stats-grid'),
  scoreRing: document.querySelector('#score-ring'),
  scoreValue: document.querySelector('#score-value'),
  decisionPanel: document.querySelector('.decision-panel'),
  decisionBadge: document.querySelector('#decision-badge'),
  decisionText: document.querySelector('#decision-text'),
  decisionNote: document.querySelector('#decision-note')
};

const STAT_FIELDS = [
  ['HP', 'hp'],
  ['Attack', 'attack'],
  ['Defense', 'defense'],
  ['Sp. Atk', 'special_attack'],
  ['Sp. Def', 'special_defense'],
  ['Speed', 'speed']
];

let pokemon = [];
let selected = null;
let selectedEvolution = null;

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { row.push(cell); cell = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map(h => h.trim());
  return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function titleCase(value) {
  return String(value || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function artworkUrl(p) {
  const id = num(p.id);
  return id ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png` : '';
}

function totalStats(p) {
  return STAT_FIELDS.reduce((sum, [, key]) => sum + (num(p[key]) || 0), 0);
}

function nextEvolutions(p) {
  const speciesId = num(p.species_id);
  return pokemon.filter(candidate => num(candidate.evolves_from_species_id) === speciesId);
}

function typeChip(type, color) {
  if (!type) return '';
  return `<span class="type-chip" style="--chip:${color || '#777'}">${titleCase(type)}</span>`;
}

function fillTypes(target, p) {
  target.innerHTML = `${typeChip(p.type_1, p.color_1)}${typeChip(p.type_2, p.color_2)}`;
}

function fillCard(prefix, p) {
  const image = prefix === 'current' ? els.currentImage : els.nextImage;
  const name = prefix === 'current' ? els.currentName : els.nextName;
  const types = prefix === 'current' ? els.currentTypes : els.nextTypes;
  const meta = prefix === 'current' ? els.currentMeta : els.nextMeta;
  const card = prefix === 'current' ? els.currentCard : els.nextCard;

  image.src = artworkUrl(p);
  image.alt = `${titleCase(p.pokemon)} artwork`;
  image.onerror = () => { image.style.visibility = 'hidden'; };
  image.onload = () => { image.style.visibility = 'visible'; };
  name.textContent = titleCase(p.pokemon);
  fillTypes(types, p);
  const heightM = num(p.height) != null ? (num(p.height) / 10).toFixed(1) : '—';
  const weightKg = num(p.weight) != null ? (num(p.weight) / 10).toFixed(1) : '—';
  meta.textContent = `#${String(p.id).padStart(3, '0')} · ${heightM} m · ${weightKg} kg`;
  card.style.setProperty('--pokemon-color', p.color_1 || '#bdbdbd');
}

function renderBranches(options) {
  els.branchButtons.innerHTML = '';
  if (options.length <= 1) return;
  options.forEach(option => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `branch-btn${option.id === selectedEvolution.id ? ' active' : ''}`;
    button.textContent = titleCase(option.pokemon);
    button.addEventListener('click', () => {
      selectedEvolution = option;
      renderComparison();
    });
    els.branchButtons.appendChild(button);
  });
}

function renderStats(current, next) {
  els.statsGrid.innerHTML = '';
  const maxStat = Math.max(...STAT_FIELDS.flatMap(([, key]) => [num(current[key]) || 0, num(next[key]) || 0]), 1);

  STAT_FIELDS.forEach(([label, key]) => {
    const a = num(current[key]) || 0;
    const b = num(next[key]) || 0;
    const diff = b - a;
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `
      <div class="stat-name">${label}</div>
      <div class="stat-bars" aria-label="${label}: current ${a}, evolution ${b}">
        <div class="track"><div class="bar current" style="width:${(a / maxStat) * 100}%"></div></div>
        <div class="track"><div class="bar next" style="width:${(b / maxStat) * 100}%"></div></div>
      </div>
      <div class="stat-change ${diff > 0 ? 'positive' : diff < 0 ? 'negative' : ''}">${diff > 0 ? '+' : ''}${diff}</div>`;
    els.statsGrid.appendChild(row);
  });
}

function evolutionScore(current, next) {
  const currentTotal = totalStats(current);
  const nextTotal = totalStats(next);
  if (currentTotal <= 0) return { score: 0, pct: 0, currentTotal, nextTotal };
  const pct = ((nextTotal - currentTotal) / currentTotal) * 100;
  // 0% improvement => 40, 30% improvement => 100. Clamp to keep the display intuitive.
  const score = Math.max(0, Math.min(100, Math.round(40 + pct * 2)));
  return { score, pct, currentTotal, nextTotal };
}

function renderDecision(current, next) {
  const { score, pct, currentTotal, nextTotal } = evolutionScore(current, next);
  const roundedPct = Math.round(pct * 10) / 10;
  const diff = nextTotal - currentTotal;
  let verdict = 'EVOLVE';
  let color = '#247a4b';
  let text = `The next evolution adds ${diff} total base-stat points (${roundedPct >= 0 ? '+' : ''}${roundedPct}%).`;

  if (diff <= 0) {
    verdict = 'WAIT / REVIEW';
    color = '#a66a00';
    text = `The next evolution does not increase total base stats in this dataset (${roundedPct}%).`;
  } else if (roundedPct < 10) {
    verdict = 'SMALL UPGRADE';
    color = '#a66a00';
    text = `The next evolution improves total base stats by ${diff} points (+${roundedPct}%), but the increase is relatively modest.`;
  }

  els.scoreValue.textContent = score;
  els.scoreRing.style.setProperty('--score-deg', `${score * 3.6}deg`);
  els.scoreRing.style.setProperty('--decision-color', color);
  els.decisionPanel.style.setProperty('--decision-color', color);
  els.decisionBadge.style.setProperty('--decision-color', color);
  els.decisionBadge.textContent = verdict;
  els.decisionText.textContent = text;
  els.decisionNote.textContent = `Base-stat total: ${currentTotal} → ${nextTotal}. This recommendation uses the supplied stats only; it does not account for moves, evolution items, level requirements, or personal preference.`;
}

function renderNoEvolution(p) {
  els.result.classList.remove('hidden');
  els.empty.classList.add('hidden');
  els.generation.textContent = p.generation_id ? `Generation ${Math.round(num(p.generation_id))}` : 'Generation —';
  fillCard('current', p);

  els.nextImage.removeAttribute('src');
  els.nextImage.alt = '';
  els.nextImage.style.visibility = 'hidden';
  els.nextName.textContent = 'No next evolution';
  els.nextTypes.innerHTML = '';
  els.nextMeta.textContent = 'This dataset shows no Pokémon evolving directly from this species.';
  els.nextCard.style.setProperty('--pokemon-color', '#bdbdbd');
  els.branchButtons.innerHTML = '';
  els.statsGrid.innerHTML = '<p class="meta">No next-stage stats are available to compare.</p>';

  els.scoreValue.textContent = '—';
  els.scoreRing.style.setProperty('--score-deg', '0deg');
  els.scoreRing.style.setProperty('--decision-color', '#6c7068');
  els.decisionPanel.style.setProperty('--decision-color', '#6c7068');
  els.decisionBadge.style.setProperty('--decision-color', '#6c7068');
  els.decisionBadge.textContent = 'FULLY EVOLVED / NO DIRECT EVOLUTION';
  els.decisionText.textContent = `${titleCase(p.pokemon)} has no next evolution listed in the supplied dataset.`;
  els.decisionNote.textContent = 'No evolution recommendation can be calculated.';
}

function renderComparison() {
  if (!selected) return;
  const options = nextEvolutions(selected);
  if (!options.length) { renderNoEvolution(selected); return; }
  if (!selectedEvolution || !options.some(o => o.id === selectedEvolution.id)) selectedEvolution = options[0];

  els.result.classList.remove('hidden');
  els.empty.classList.add('hidden');
  els.generation.textContent = selected.generation_id ? `Generation ${Math.round(num(selected.generation_id))}` : 'Generation —';
  fillCard('current', selected);
  fillCard('next', selectedEvolution);
  renderBranches(options);
  renderStats(selected, selectedEvolution);
  renderDecision(selected, selectedEvolution);
}

function choosePokemon(id) {
  selected = pokemon.find(p => p.id === String(id)) || null;
  selectedEvolution = null;
  if (!selected) return;
  els.select.value = selected.id;
  els.search.value = titleCase(selected.pokemon);
  els.status.textContent = '';
  renderComparison();
}

function populateSelect(list = pokemon) {
  const previous = els.select.value;
  els.select.innerHTML = '<option value="">Select a Pokémon</option>';
  list.slice(0, 811).forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = `#${String(p.id).padStart(3, '0')} ${titleCase(p.pokemon)}`;
    els.select.appendChild(option);
  });
  if ([...els.select.options].some(o => o.value === previous)) els.select.value = previous;
}

els.search.addEventListener('input', () => {
  const q = els.search.value.trim().toLowerCase();
  if (!q) { populateSelect(); els.status.textContent = ''; return; }
  const matches = pokemon.filter(p => p.pokemon.toLowerCase().includes(q));
  populateSelect(matches);
  els.status.textContent = matches.length ? `${matches.length} match${matches.length === 1 ? '' : 'es'} found.` : 'No matching Pokémon found.';
  if (matches.length === 1 && matches[0].pokemon.toLowerCase() === q) choosePokemon(matches[0].id);
});

els.select.addEventListener('change', () => {
  if (els.select.value) choosePokemon(els.select.value);
});

async function init() {
  try {
    els.status.textContent = 'Loading Pokémon data…';
    const response = await fetch('pokemon.csv');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    pokemon = parseCSV(text).filter(p => p.id && p.pokemon);
    pokemon.sort((a, b) => (num(a.id) || 0) - (num(b.id) || 0));
    populateSelect();
    els.status.textContent = `${pokemon.length} Pokémon loaded.`;
  } catch (error) {
    console.error(error);
    els.status.textContent = 'Could not load pokemon.csv. Keep index.html, style.css, app.js and pokemon.csv in the same folder.';
  }
}

init();
