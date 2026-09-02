const STAT_FIELDS = [
  ['HP', 'hp'],
  ['Attack', 'attack'],
  ['Defense', 'defense'],
  ['Sp. Attack', 'special_attack'],
  ['Sp. Defense', 'special_defense'],
  ['Speed', 'speed']
];

const TYPE_THEMES = {
  bug: ['#9cc93b', 'rgba(156,201,59,.18)'],
  dark: ['#6b7280', 'rgba(107,114,128,.18)'],
  dragon: ['#5b8cff', 'rgba(91,140,255,.18)'],
  electric: ['#f8c72a', 'rgba(248,199,42,.18)'],
  fairy: ['#f38ed0', 'rgba(243,142,208,.18)'],
  fighting: ['#ef6461', 'rgba(239,100,97,.18)'],
  fire: ['#ff7a45', 'rgba(255,122,69,.18)'],
  flying: ['#85b6ff', 'rgba(133,182,255,.18)'],
  ghost: ['#8971e8', 'rgba(137,113,232,.18)'],
  grass: ['#56c271', 'rgba(86,194,113,.18)'],
  ground: ['#c99a5a', 'rgba(201,154,90,.18)'],
  ice: ['#60d7e9', 'rgba(96,215,233,.18)'],
  normal: ['#a8a29e', 'rgba(168,162,158,.18)'],
  poison: ['#bc71f0', 'rgba(188,113,240,.18)'],
  psychic: ['#ff6eb0', 'rgba(255,110,176,.18)'],
  rock: ['#c4a461', 'rgba(196,164,97,.18)'],
  steel: ['#9aa9c7', 'rgba(154,169,199,.18)'],
  water: ['#4ea7ff', 'rgba(78,167,255,.18)']
};

const els = {
  search: document.getElementById('pokemon-search'),
  searchForm: document.getElementById('pokemon-search-form'),
  searchButton: document.getElementById('pokemon-search-button'),
  select: document.getElementById('pokemon-select'),
  status: document.getElementById('status'),
  result: document.getElementById('result'),
  empty: document.getElementById('final-form'),
  generation: document.getElementById('generation-pill'),
  typePill: document.getElementById('type-pill'),
  evolutionChain: document.getElementById('evolution-chain'),
  currentCard: document.getElementById('current-card'),
  nextCard: document.getElementById('next-card'),
  currentImage: document.getElementById('current-image'),
  nextImage: document.getElementById('next-image'),
  currentName: document.getElementById('current-name'),
  nextName: document.getElementById('next-name'),
  currentTypes: document.getElementById('current-types'),
  nextTypes: document.getElementById('next-types'),
  currentMeta: document.getElementById('current-meta'),
  nextMeta: document.getElementById('next-meta'),
  currentAbilities: document.getElementById('current-abilities'),
  nextAbilities: document.getElementById('next-abilities'),
  currentCryButton: document.getElementById('current-cry-btn'),
  nextCryButton: document.getElementById('next-cry-btn'),
  branchButtons: document.getElementById('branch-buttons'),
  currentTotal: document.getElementById('current-total'),
  nextTotal: document.getElementById('next-total'),
  totalGain: document.getElementById('total-gain'),
  statsGrid: document.getElementById('stats-grid'),
  decisionPanel: document.getElementById('decision-panel'),
  scoreRing: document.getElementById('score-ring'),
  scoreValue: document.getElementById('score-value'),
  decisionBadge: document.getElementById('decision-badge'),
  decisionText: document.getElementById('decision-text'),
  decisionNote: document.getElementById('decision-note'),
  tcgCards: document.getElementById('tcg-cards'),
  tcgLoading: document.getElementById('tcg-loading')
};

let pokemon = [];
let selected = null;
let selectedEvolution = null;

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell);
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers = rows.shift() || [];
  return rows.map(cols => Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? ''])));
}

function num(value) {
  if (value === undefined || value === null || value === '' || value === 'NA') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function titleCase(text = '') {
  return String(text).replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function artworkUrl(p) {
  const id = num(p.id);
  return id ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png` : '';
}

function totalStats(p) {
  return STAT_FIELDS.reduce((sum, [, key]) => sum + (num(p[key]) || 0), 0);
}

function abilitiesText(p) {
  const parts = [p.ability_1, p.ability_2, p.ability_hidden]
    .filter(Boolean)
    .filter(v => v !== 'NA')
    .map(titleCase);
  return parts.length ? parts.join(' · ') : 'No ability data available';
}

function nextEvolutions(p) {
  const speciesId = num(p.species_id);
  return pokemon.filter(candidate => num(candidate.evolves_from_species_id) === speciesId);
}

function chainMembers(p) {
  const chainId = num(p.evolution_chain_id);
  if (chainId == null) return [p];
  return pokemon.filter(candidate => num(candidate.evolution_chain_id) === chainId);
}

function chainRoots(members) {
  const species = new Set(members.map(p => num(p.species_id)));
  return members.filter(p => {
    const parent = num(p.evolves_from_species_id);
    return parent == null || !species.has(parent);
  });
}

function childrenOf(p, members) {
  const speciesId = num(p.species_id);
  return members.filter(candidate => num(candidate.evolves_from_species_id) === speciesId);
}

function updateTheme(p) {
  const type = (p.type_1 || '').toLowerCase();
  const [main, soft] = TYPE_THEMES[type] || [p.color_1 || '#5b8cff', 'rgba(91,140,255,.18)'];
  document.documentElement.style.setProperty('--theme-main', main);
  document.documentElement.style.setProperty('--theme-soft', soft);
  els.typePill.textContent = `${titleCase(p.type_1 || 'Unknown')} theme`;
}


let activeCry = null;

function cryUrl(p, version = 'legacy') {
  const id = num(p?.id);
  if (!id) return '';
  return `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/${version}/${id}.ogg`;
}

function playPokemonCry(p) {
  if (!p) return;

  if (activeCry) {
    activeCry.pause();
    activeCry.currentTime = 0;
    activeCry = null;
  }

  const legacy = cryUrl(p, 'legacy');
  const latest = cryUrl(p, 'latest');
  if (!legacy && !latest) return;

  const audio = new Audio(legacy || latest);
  audio.volume = 0.65;
  activeCry = audio;

  let triedLatest = false;
  audio.addEventListener('error', () => {
    if (!triedLatest && latest) {
      triedLatest = true;
      audio.src = latest;
      audio.play().catch(() => {});
    }
  });

  audio.play().catch(error => {
    console.warn('Pokémon cry could not be played.', error);
  });
}

function chainCard(p, depth) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `chain-card${selected && String(p.id) === String(selected.id) ? ' selected' : ''}`;
  card.style.setProperty('--pokemon-color', p.color_1 || '#bdbdbd');
  card.setAttribute('aria-label', `Select ${titleCase(p.pokemon)}`);
  card.innerHTML = `
    <span class="chain-stage">STAGE ${depth + 1}</span>
    <img src="${artworkUrl(p)}" alt="${titleCase(p.pokemon)} artwork" />
    <strong>${titleCase(p.pokemon)}</strong>
    <span class="chain-id">#${String(p.id).padStart(3, '0')}</span>`;
  const image = card.querySelector('img');
  image.addEventListener('error', () => { image.style.visibility = 'hidden'; });
  card.addEventListener('click', () => {
    playPokemonCry(p);
    choosePokemon(p.id);
  });
  return card;
}

function renderEvolutionChain(p) {
  els.evolutionChain.innerHTML = '';
  const members = chainMembers(p);
  const roots = chainRoots(members);
  if (!members.length || !roots.length) {
    els.evolutionChain.innerHTML = '<p class="meta">No evolution-chain data is available.</p>';
    return;
  }

  const columns = [];
  const visited = new Set();
  let level = roots;
  let depth = 0;

  while (level.length && depth < 8) {
    columns.push(level);
    const next = [];
    level.forEach(member => {
      const key = String(member.species_id);
      if (visited.has(key)) return;
      visited.add(key);
      childrenOf(member, members).forEach(child => {
        if (!visited.has(String(child.species_id))) next.push(child);
      });
    });
    level = next;
    depth++;
  }

  columns.forEach((stage, index) => {
    if (index > 0) {
      const arrow = document.createElement('div');
      arrow.className = 'chain-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';
      els.evolutionChain.appendChild(arrow);
    }
    const group = document.createElement('div');
    group.className = `chain-stage-group${stage.length > 1 ? ' branched' : ''}`;
    stage.forEach(member => group.appendChild(chainCard(member, index)));
    els.evolutionChain.appendChild(group);
  });
}

function typeChip(type, color) {
  if (!type || type === 'NA') return '';
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
  const ability = prefix === 'current' ? els.currentAbilities : els.nextAbilities;

  image.src = artworkUrl(p);
  image.alt = `${titleCase(p.pokemon)} artwork`;
  image.onerror = () => { image.style.visibility = 'hidden'; };
  image.onload = () => { image.style.visibility = 'visible'; };
  name.textContent = titleCase(p.pokemon);
  fillTypes(types, p);
  const heightM = num(p.height) != null ? (num(p.height) / 10).toFixed(1) : '—';
  const weightKg = num(p.weight) != null ? (num(p.weight) / 10).toFixed(1) : '—';
  meta.textContent = `#${String(p.id).padStart(3, '0')} · ${heightM} m · ${weightKg} kg`;
  ability.textContent = abilitiesText(p);
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

function renderInsightCards(current, next) {
  const currentTotal = totalStats(current);
  const nextTotal = totalStats(next);
  const gain = nextTotal - currentTotal;
  els.currentTotal.textContent = currentTotal;
  els.nextTotal.textContent = nextTotal;
  els.totalGain.textContent = `${gain >= 0 ? '+' : ''}${gain}`;
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
  const score = Math.max(0, Math.min(100, Math.round(40 + pct * 2)));
  return { score, pct, currentTotal, nextTotal };
}

function renderDecision(current, next) {
  const { score, pct, currentTotal, nextTotal } = evolutionScore(current, next);
  const roundedPct = Math.round(pct * 10) / 10;
  const diff = nextTotal - currentTotal;
  let verdict = 'EVOLVE';
  let color = 'var(--good)';
  let text = `The next evolution adds ${diff} total base-stat points (${roundedPct >= 0 ? '+' : ''}${roundedPct}%).`;

  if (diff <= 0) {
    verdict = 'WAIT / REVIEW';
    color = 'var(--warn)';
    text = `The next evolution does not increase total base stats in this dataset (${roundedPct}%).`;
  } else if (roundedPct < 10) {
    verdict = 'SMALL UPGRADE';
    color = 'var(--warn)';
    text = `The next evolution improves total base stats by ${diff} points (+${roundedPct}%), but the gain is relatively modest.`;
  }

  els.scoreValue.textContent = score;
  els.scoreRing.style.setProperty('--score-deg', `${score * 3.6}deg`);
  els.scoreRing.style.setProperty('--decision-color', `var(${color.replace('var(', '').replace(')', '')})`);
  els.decisionBadge.textContent = verdict;
  els.decisionText.textContent = text;
  els.decisionNote.textContent = `Base-stat total: ${currentTotal} → ${nextTotal}. This recommendation uses the supplied stats only; it does not account for moves, level requirements, items, or personal preference.`;
}


let tcgRequestToken = 0;

function htmlEscape(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function cardMarketPrice(card) {
  const prices = card?.cardmarket?.prices;
  if (!prices) return null;

  const candidates = [
    ['Trend price', prices.trendPrice],
    ['Average sale', prices.averageSellPrice],
    ['7-day average', prices.avg7],
    ['Low price', prices.lowPrice]
  ];

  for (const [label, value] of candidates) {
    if (Number.isFinite(Number(value)) && Number(value) > 0) {
      return {
        currency: '€',
        value: Number(value),
        label,
        marketplace: 'Cardmarket',
        updatedAt: card.cardmarket.updatedAt || ''
      };
    }
  }
  return null;
}

function tcgPlayerPrice(card) {
  const groups = card?.tcgplayer?.prices;
  if (!groups) return null;

  const priority = ['holofoil', 'reverseHolofoil', 'normal', '1stEditionHolofoil', 'unlimitedHolofoil'];
  const keys = [...priority, ...Object.keys(groups).filter(k => !priority.includes(k))];

  for (const key of keys) {
    const p = groups[key];
    if (!p) continue;
    const value =
      Number.isFinite(Number(p.market)) && Number(p.market) > 0 ? Number(p.market) :
      Number.isFinite(Number(p.mid)) && Number(p.mid) > 0 ? Number(p.mid) :
      Number.isFinite(Number(p.low)) && Number(p.low) > 0 ? Number(p.low) :
      null;

    if (value !== null) {
      return {
        currency: '$',
        value,
        label: titleCase(key),
        marketplace: 'TCGPlayer',
        updatedAt: card.tcgplayer.updatedAt || ''
      };
    }
  }
  return null;
}

function bestCardPrice(card) {
  return cardMarketPrice(card) || tcgPlayerPrice(card);
}

function formatPrice(price) {
  if (!price) return 'Price unavailable';
  return `${price.currency}${price.value.toFixed(2)}`;
}

function cardSortValue(card) {
  const price = bestCardPrice(card);
  return price ? price.value : -1;
}

function renderTCGCard(card) {
  const price = bestCardPrice(card);
  const marketUrl = card?.cardmarket?.url || card?.tcgplayer?.url || '';
  const imageUrl = card?.images?.small || card?.images?.large || '';
  const setName = card?.set?.name || 'Unknown set';
  const rarity = card?.rarity || 'Rarity not listed';
  const number = card?.number ? `#${card.number}` : '';
  const updated = price?.updatedAt ? `Updated ${price.updatedAt}` : 'Update date unavailable';

  const linkOpen = marketUrl
    ? `<a class="tcg-market-link" href="${htmlEscape(marketUrl)}" target="_blank" rel="noopener noreferrer">Market details</a>`
    : '';

  return `
    <article class="tcg-card">
      <div class="tcg-image-wrap">
        ${imageUrl ? `<img src="${htmlEscape(imageUrl)}" alt="${htmlEscape(card.name)} trading card" loading="lazy">` : '<div class="tcg-image-fallback">No image</div>'}
      </div>
      <div class="tcg-card-info">
        <div class="tcg-card-topline">
          <span>${htmlEscape(setName)}</span>
          <span>${htmlEscape(number)}</span>
        </div>
        <h3>${htmlEscape(card.name)}</h3>
        <p class="tcg-rarity">${htmlEscape(rarity)}</p>
        <div class="tcg-price-row">
          <div>
            <span class="tcg-price-label">${price ? htmlEscape(price.marketplace) : 'Market estimate'}</span>
            <strong class="tcg-price">${formatPrice(price)}</strong>
          </div>
          ${linkOpen}
        </div>
        <p class="tcg-price-meta">${price ? htmlEscape(price.label) + ' · ' : ''}${htmlEscape(updated)}</p>
      </div>
    </article>`;
}

async function fetchTCGQuery(query) {
  const params = new URLSearchParams({
    q: query,
    pageSize: '250'
  });

  const response = await fetch(`https://api.pokemontcg.io/v2/cards?${params.toString()}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    const error = new Error(`Pokémon TCG API HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  return Array.isArray(payload.data) ? payload.data : [];
}

async function loadTCGCards(p) {
  const token = ++tcgRequestToken;
  els.tcgCards.innerHTML = '';
  els.tcgLoading.style.display = 'block';
  els.tcgLoading.textContent = `Finding the 3 most valuable ${titleCase(p.pokemon)} cards…`;

  try {
    const pokedexNumber = num(p.species_id) || num(p.id);
    const cleanName = String(p.pokemon || '').trim().toLowerCase();

    let cards = [];

    // First choice: National Pokédex number. This is more reliable than card-name
    // matching because TCG cards can have suffixes such as ex, V, GX, VMAX, etc.
    if (pokedexNumber != null) {
      try {
        cards = await fetchTCGQuery(`nationalPokedexNumbers:${pokedexNumber}`);
      } catch (firstError) {
        console.warn('Pokédex-number TCG query failed; trying name search.', firstError);
      }
    }

    // Fallback: simple documented Lucene-style name query.
    if (!cards.length) {
      cards = await fetchTCGQuery(`name:${cleanName}`);
    }

    if (token !== tcgRequestToken) return;

    // Keep cards that actually refer to the selected Pokémon whenever Pokédex
    // numbers are available in the returned data.
    const matchedByDex = pokedexNumber == null ? [] : cards.filter(card =>
      Array.isArray(card.nationalPokedexNumbers) &&
      card.nationalPokedexNumbers.map(Number).includes(Number(pokedexNumber))
    );

    const displayPool = matchedByDex.length ? matchedByDex : cards;

    // Rank by Cardmarket euro data first.
    const cardmarketCards = displayPool
      .filter(card => cardMarketPrice(card))
      .sort((a, b) => cardMarketPrice(b).value - cardMarketPrice(a).value);

    // Only use TCGPlayer-priced cards when Cardmarket supplies fewer than 3.
    const tcgFallbackCards = displayPool
      .filter(card => !cardMarketPrice(card) && tcgPlayerPrice(card))
      .sort((a, b) => tcgPlayerPrice(b).value - tcgPlayerPrice(a).value);

    const ranked = [...cardmarketCards, ...tcgFallbackCards];

    const seen = new Set();
    const topCards = ranked.filter(card => {
      if (!card?.id || seen.has(card.id)) return false;
      seen.add(card.id);
      return true;
    }).slice(0, 3);

    els.tcgLoading.style.display = 'none';

    if (!topCards.length) {
      els.tcgCards.innerHTML =
        '<p class="tcg-message">Cards were found, but no current Cardmarket or TCGPlayer price data is available for this Pokémon.</p>';
      return;
    }

    els.tcgCards.innerHTML = topCards.map(renderTCGCard).join('');
  } catch (error) {
    console.error(error);
    if (token !== tcgRequestToken) return;

    els.tcgCards.innerHTML = '';
    els.tcgLoading.style.display = 'block';

    if (error?.status === 429) {
      els.tcgLoading.textContent =
        'The trading-card service rate limit was reached. Wait a moment and select the Pokémon again.';
    } else if (error?.status >= 500) {
      els.tcgLoading.textContent =
        'The trading-card service is temporarily unavailable. Try again shortly.';
    } else if (error?.status === 400) {
      els.tcgLoading.textContent =
        'The trading-card service rejected this search. Try another Pokémon or refresh the page.';
    } else {
      els.tcgLoading.textContent =
        'Trading-card data could not be loaded from the external service. The evolution analysis still works normally.';
    }
  }
}

function renderNoEvolution(p) {
  els.result.classList.remove('hidden');
  els.empty.classList.add('hidden');
  updateTheme(p);
  loadTCGCards(p);
  els.generation.textContent = p.generation_id ? `Generation ${Math.round(num(p.generation_id))}` : 'Generation —';
  renderEvolutionChain(p);
  fillCard('current', p);

  els.nextImage.removeAttribute('src');
  els.nextImage.alt = '';
  els.nextImage.style.visibility = 'hidden';
  els.nextName.textContent = 'No next evolution';
  els.nextTypes.innerHTML = '';
  els.nextMeta.textContent = 'This dataset shows no Pokémon evolving directly from this species.';
  els.nextAbilities.textContent = 'No next-evolution abilities available';
  els.nextCryButton.style.display = 'none';
  els.nextCard.style.setProperty('--pokemon-color', '#7f8aa2');
  els.branchButtons.innerHTML = '';
  els.currentTotal.textContent = totalStats(p);
  els.nextTotal.textContent = '—';
  els.totalGain.textContent = '—';
  els.statsGrid.innerHTML = '<p class="meta">No next-stage stats are available to compare.</p>';

  els.scoreValue.textContent = '—';
  els.scoreRing.style.setProperty('--score-deg', '0deg');
  els.scoreRing.style.setProperty('--decision-color', '#7f8aa2');
  els.decisionBadge.textContent = 'FINAL EVOLUTION';
  els.decisionText.textContent = `${titleCase(p.pokemon)} has no next evolution listed in the supplied dataset.`;
  els.decisionNote.textContent = 'No evolution recommendation can be calculated.';
}

function renderComparison() {
  if (!selected) return;
  const options = nextEvolutions(selected);
  if (!options.length) {
    renderNoEvolution(selected);
    return;
  }
  if (!selectedEvolution || !options.some(o => o.id === selectedEvolution.id)) selectedEvolution = options[0];

  els.result.classList.remove('hidden');
  els.empty.classList.add('hidden');
  updateTheme(selected);
  loadTCGCards(selected);
  els.generation.textContent = selected.generation_id ? `Generation ${Math.round(num(selected.generation_id))}` : 'Generation —';
  renderEvolutionChain(selected);
  fillCard('current', selected);
  fillCard('next', selectedEvolution);
  els.currentCryButton.style.display = 'inline-flex';
  els.nextCryButton.style.display = 'inline-flex';
  renderBranches(options);
  renderInsightCards(selected, selectedEvolution);
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
  list.forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = `#${String(p.id).padStart(3, '0')} ${titleCase(p.pokemon)}`;
    els.select.appendChild(option);
  });
  if ([...els.select.options].some(o => o.value === previous)) els.select.value = previous;
}

function submitPokemonSearch() {
  const q = els.search.value.trim().toLowerCase();

  if (!q) {
    els.status.textContent = 'Type a Pokémon name to search.';
    els.search.focus();
    return;
  }

  const exact = pokemon.find(p => p.pokemon.toLowerCase() === q);
  if (exact) {
    choosePokemon(exact.id);
    els.status.textContent = `${titleCase(exact.pokemon)} selected.`;
    return;
  }

  const startsWith = pokemon.filter(p => p.pokemon.toLowerCase().startsWith(q));
  if (startsWith.length) {
    choosePokemon(startsWith[0].id);
    els.status.textContent = `${titleCase(startsWith[0].pokemon)} selected.`;
    return;
  }

  const contains = pokemon.filter(p => p.pokemon.toLowerCase().includes(q));
  if (contains.length) {
    choosePokemon(contains[0].id);
    els.status.textContent = `${titleCase(contains[0].pokemon)} selected.`;
    return;
  }

  els.status.textContent = 'No matching Pokémon found.';
}

els.searchForm.addEventListener('submit', event => {
  event.preventDefault();
  submitPokemonSearch();
});


els.currentCryButton.addEventListener('click', event => {
  event.stopPropagation();
  playPokemonCry(selected);
});

els.nextCryButton.addEventListener('click', event => {
  event.stopPropagation();
  playPokemonCry(selectedEvolution);
});

els.search.addEventListener('input', () => {
  const q = els.search.value.trim().toLowerCase();
  if (!q) {
    populateSelect();
    els.status.textContent = '';
    return;
  }
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
