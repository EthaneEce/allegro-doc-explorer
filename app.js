(() => {
  const data = window.ALLEGRO_INDEX;
  const searchData = window.ALLEGRO_SEARCH_INDEX;

  if (!data || !searchData) {
    console.error('Missing index data. Run scripts/build-index.mjs first.');
    return;
  }

  const STRINGS = {
    en: {
      htmlLang: 'en',
      eyebrow: 'Offline Index For Allegro C Docs',
      appTitle: 'Allegro Docs Explorer',
      appSubtitle: 'Find functions quickly and search by topic in the full API documentation.',
      openOriginal: 'Open original docs',
      downloadOffline: 'Download offline pack',
      functionSearchTitle: 'Search by function name',
      functionSearchLabel: 'Function / macro / symbol',
      functionSearchPlaceholder: 'Example: set_gfx_mode',
      topicSearchTitle: 'Search by topic or term',
      topicSearchLabel: 'Text in summaries and descriptions',
      topicSearchPlaceholder: 'Example: mouse cursor clipping',
      favoritesTitle: 'Pinned functions',
      favoritesEmpty: 'No pinned function yet.',
      favoritesCount: (n) => `${n} pinned`,
      themeLabel: 'Theme (section)',
      allThemes: 'All sections',
      functionEmpty: 'Type a function name to start.',
      topicEmpty: 'Type a topic or term to start.',
      noResults: 'No results.',
      resultCount: (n) => `${n} result${n > 1 ? 's' : ''}`,
      emptyTitle: 'Select a symbol',
      emptyDescription: 'Use one of the search zones to load signatures, docs text, and direct links to the official HTML pages.',
      signatureTitle: 'Signature',
      descriptionTitle: 'Description',
      seeAlsoTitle: 'See also',
      sourceEntryLink: 'Open this symbol in original HTML',
      footerStats: (entries, sections) => `${entries} API entries indexed across ${sections} sections`,
      footerDatePrefix: 'Generated:',
      kind: {
        function: 'Function',
        macro: 'Macro',
        variable: 'Variable',
        typedef: 'Typedef',
        symbol: 'Symbol',
      },
      translateDescription: 'Translate description to French',
      translatingDescription: 'Translating description to French...',
      translationFailed: 'French translation failed. Showing English text.',
      translatingQuery: 'Translating query to improve topic search...',
      pinEntry: 'Pin',
      unpinEntry: 'Unpin',
      pinResult: 'Pin this function',
      unpinResult: 'Unpin this function',
      languageToggle: 'FR',
      sectionLabelPrefix: 'Section:',
    },
    fr: {
      htmlLang: 'fr',
      eyebrow: 'Index Local Pour La Doc C Allegro',
      appTitle: 'Explorateur De Doc Allegro',
      appSubtitle: 'Trouve rapidement les fonctions et recherche par thème dans toute la documentation API.',
      openOriginal: 'Ouvrir la doc originale',
      downloadOffline: 'Télécharger le pack hors-ligne',
      functionSearchTitle: 'Recherche par nom de fonction',
      functionSearchLabel: 'Fonction / macro / symbole',
      functionSearchPlaceholder: 'Exemple : set_gfx_mode',
      topicSearchTitle: 'Recherche par thème ou terme',
      topicSearchLabel: 'Texte dans les résumés et descriptions',
      topicSearchPlaceholder: 'Exemple : curseur souris clipping',
      favoritesTitle: 'Fonctions épinglées',
      favoritesEmpty: 'Aucune fonction épinglée pour le moment.',
      favoritesCount: (n) => `${n} épinglée${n > 1 ? 's' : ''}`,
      themeLabel: 'Thème (section)',
      allThemes: 'Toutes les sections',
      functionEmpty: 'Saisis un nom de fonction pour commencer.',
      topicEmpty: 'Saisis un thème ou un terme pour commencer.',
      noResults: 'Aucun résultat.',
      resultCount: (n) => `${n} résultat${n > 1 ? 's' : ''}`,
      emptyTitle: 'Sélectionne un symbole',
      emptyDescription: 'Utilise une zone de recherche pour charger la signature, la doc, et les liens directs vers les pages HTML officielles.',
      signatureTitle: 'Signature',
      descriptionTitle: 'Description',
      seeAlsoTitle: 'Voir aussi',
      sourceEntryLink: 'Ouvrir ce symbole dans le HTML original',
      footerStats: (entries, sections) => `${entries} entrées API indexées dans ${sections} sections`,
      footerDatePrefix: 'Généré le :',
      kind: {
        function: 'Fonction',
        macro: 'Macro',
        variable: 'Variable',
        typedef: 'Typedef',
        symbol: 'Symbole',
      },
      translateDescription: 'Traduire la description en français',
      translatingDescription: 'Traduction de la description en cours...',
      translationFailed: 'La traduction française a échoué. Texte anglais affiché.',
      translatingQuery: 'Traduction de la requête pour améliorer la recherche thématique...',
      pinEntry: 'Épingler',
      unpinEntry: 'Désépingler',
      pinResult: 'Épingler cette fonction',
      unpinResult: 'Désépingler cette fonction',
      languageToggle: 'EN',
      sectionLabelPrefix: 'Section :',
    },
  };

  const state = {
    lang: 'en',
    selectedId: null,
    favorites: [],
    translatedDescriptionById: {},
    translatingDescriptionIds: new Set(),
    translatedQueryByLangAndText: {},
    translatedSectionById: {},
    translatedSummaryById: {},
    pendingShortTranslationKeys: new Set(),
    pendingTopicTranslationToken: 0,
    translatedTopicQueryEn: '',
    topicTranslationInProgress: false,
  };

  const FAVORITES_STORAGE_KEY = 'allegro_doc_favorites_v1';

  const entries = data.entries;
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));

  const nodes = {
    eyebrow: document.getElementById('eyebrow'),
    appTitle: document.getElementById('appTitle'),
    appSubtitle: document.getElementById('appSubtitle'),
    openOriginal: document.getElementById('openOriginal'),
    downloadOffline: document.getElementById('downloadOffline'),
    langToggle: document.getElementById('langToggle'),
    functionSearchTitle: document.getElementById('functionSearchTitle'),
    functionSearchLabel: document.getElementById('functionSearchLabel'),
    functionQuery: document.getElementById('functionQuery'),
    functionResultsMeta: document.getElementById('functionResultsMeta'),
    functionResults: document.getElementById('functionResults'),
    favoritesTitle: document.getElementById('favoritesTitle'),
    favoritesMeta: document.getElementById('favoritesMeta'),
    favoritesList: document.getElementById('favoritesList'),
    topicSearchTitle: document.getElementById('topicSearchTitle'),
    topicSearchLabel: document.getElementById('topicSearchLabel'),
    topicQuery: document.getElementById('topicQuery'),
    themeLabel: document.getElementById('themeLabel'),
    themeFilter: document.getElementById('themeFilter'),
    topicResultsMeta: document.getElementById('topicResultsMeta'),
    topicResults: document.getElementById('topicResults'),
    emptyState: document.getElementById('emptyState'),
    entryDetail: document.getElementById('entryDetail'),
    emptyTitle: document.getElementById('emptyTitle'),
    emptyDescription: document.getElementById('emptyDescription'),
    entryKind: document.getElementById('entryKind'),
    entryName: document.getElementById('entryName'),
    entrySection: document.getElementById('entrySection'),
    entrySummary: document.getElementById('entrySummary'),
    signatureTitle: document.getElementById('signatureTitle'),
    entrySignature: document.getElementById('entrySignature'),
    descriptionTitle: document.getElementById('descriptionTitle'),
    entryDescription: document.getElementById('entryDescription'),
    seeAlsoTitle: document.getElementById('seeAlsoTitle'),
    entrySeeAlso: document.getElementById('entrySeeAlso'),
    openEntrySource: document.getElementById('openEntrySource'),
    translateDescriptionBtn: document.getElementById('translateDescriptionBtn'),
    pinEntryBtn: document.getElementById('pinEntryBtn'),
    footerStats: document.getElementById('footerStats'),
    footerDate: document.getElementById('footerDate'),
  };

  function t() {
    return STRINGS[state.lang];
  }

  function normalize(value) {
    return (value || '').trim().toLowerCase();
  }

  function readCookie(name) {
    const target = `${name}=`;
    const parts = document.cookie.split(';');
    for (const part of parts) {
      const candidate = part.trim();
      if (candidate.startsWith(target)) {
        return decodeURIComponent(candidate.slice(target.length));
      }
    }
    return '';
  }

  function writeCookie(name, value) {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
  }

  function loadFavorites() {
    let raw = '';
    try {
      raw = localStorage.getItem(FAVORITES_STORAGE_KEY) || '';
    } catch {
      raw = readCookie(FAVORITES_STORAGE_KEY);
    }

    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function persistFavorites() {
    const serialized = JSON.stringify(state.favorites);
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, serialized);
    } catch {
      writeCookie(FAVORITES_STORAGE_KEY, serialized);
    }
  }

  function isFavorite(entryId) {
    return state.favorites.includes(entryId);
  }

  function toggleFavorite(entryId) {
    if (!entryId) {
      return;
    }
    if (isFavorite(entryId)) {
      state.favorites = state.favorites.filter((id) => id !== entryId);
    } else {
      state.favorites = [entryId, ...state.favorites];
    }
    persistFavorites();
    renderAll();
  }

  function sectionLabel(entry) {
    if (state.lang !== 'fr') {
      return entry.sectionEn;
    }
    return state.translatedSectionById[entry.sectionId] || entry.sectionFr || entry.sectionEn;
  }

  function summaryLabel(entry) {
    if (state.lang !== 'fr') {
      return entry.summaryEn;
    }
    return state.translatedSummaryById[entry.id] || entry.summaryFr || entry.summaryEn;
  }

  function splitParagraphs(text) {
    return text
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function clearElement(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function renderParagraphText(container, text, cssClass = '') {
    clearElement(container);
    const paragraphs = splitParagraphs(text);
    if (paragraphs.length === 0) {
      const p = document.createElement('p');
      if (cssClass) {
        p.className = cssClass;
      }
      p.textContent = text;
      container.appendChild(p);
      return;
    }

    for (const paragraph of paragraphs) {
      const p = document.createElement('p');
      if (cssClass) {
        p.className = cssClass;
      }
      p.textContent = paragraph;
      container.appendChild(p);
    }
  }

  function pickInitialFunctionResults() {
    return [...entries]
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 28);
  }

  function rankFunction(entry, query) {
    const name = entry.name.toLowerCase();
    const idx = name.indexOf(query);
    if (idx === -1) {
      return -1;
    }
    if (name === query) {
      return 1000;
    }
    if (idx === 0) {
      return 850 - name.length;
    }
    return 500 - idx;
  }

  function functionSearchResults() {
    const query = normalize(nodes.functionQuery.value);
    if (!query) {
      return pickInitialFunctionResults();
    }

    const matches = [];
    for (const entry of entries) {
      const rank = rankFunction(entry, query);
      if (rank >= 0) {
        matches.push({ entry, rank });
      }
    }

    matches.sort((a, b) => b.rank - a.rank || a.entry.name.localeCompare(b.entry.name));
    return matches.slice(0, 60).map((item) => item.entry);
  }

  function matchTopic(entrySearch, queryFr, queryEn) {
    let score = 0;
    if (queryFr && entrySearch.searchTextFr.includes(queryFr)) {
      score += 3;
    }
    if (queryEn && entrySearch.searchTextEn.includes(queryEn)) {
      score += 4;
    }
    const loweredName = entrySearch.name.toLowerCase();
    if (queryFr && loweredName.includes(queryFr)) {
      score += 8;
    }
    if (queryEn && loweredName.includes(queryEn)) {
      score += 8;
    }
    if (queryFr && loweredName.startsWith(queryFr)) {
      score += 4;
    }
    if (queryEn && loweredName.startsWith(queryEn)) {
      score += 4;
    }
    return score;
  }

  function topicSearchResults() {
    const query = normalize(nodes.topicQuery.value);
    const selectedTheme = nodes.themeFilter.value;

    if (!query) {
      const bySection = entries
        .filter((entry) => selectedTheme === 'all' || entry.sectionId === selectedTheme)
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 28);
      return bySection;
    }

    const queryFr = state.lang === 'fr' ? query : '';
    const queryEn = state.lang === 'fr' ? (state.translatedTopicQueryEn || query) : query;

    const ranked = [];
    for (const searchEntry of searchData.entries) {
      if (selectedTheme !== 'all' && searchEntry.sectionId !== selectedTheme) {
        continue;
      }
      const score = matchTopic(searchEntry, queryFr, queryEn);
      if (score > 0) {
        const entry = entriesById.get(searchEntry.id);
        if (entry) {
          ranked.push({ entry, score });
        }
      }
    }

    ranked.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));
    return ranked.slice(0, 80).map((item) => item.entry);
  }

  function createResultItem(entry) {
    const locale = t();
    const favorite = isFavorite(entry.id);

    const row = document.createElement('div');
    row.className = 'result-row';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'result-item';
    if (state.selectedId === entry.id) {
      button.classList.add('active');
    }

    const name = document.createElement('span');
    name.className = 'result-name';
    name.textContent = entry.name;

    const section = document.createElement('span');
    section.className = 'result-section';
    section.textContent = sectionLabel(entry);

    const summary = document.createElement('span');
    summary.className = 'result-summary';
    summary.textContent = summaryLabel(entry);

    button.appendChild(name);
    button.appendChild(section);
    button.appendChild(summary);
    button.addEventListener('click', () => {
      state.selectedId = entry.id;
      renderAll();
    });

    const pinButton = document.createElement('button');
    pinButton.type = 'button';
    pinButton.className = 'result-pin';
    if (favorite) {
      pinButton.classList.add('favorited');
    }
    pinButton.textContent = favorite ? '★' : '☆';
    const pinLabel = favorite ? locale.unpinResult : locale.pinResult;
    pinButton.setAttribute('aria-label', `${pinLabel}: ${entry.name}`);
    pinButton.title = `${pinLabel}: ${entry.name}`;
    pinButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleFavorite(entry.id);
    });

    row.appendChild(button);
    row.appendChild(pinButton);
    return row;
  }

  function renderFunctionResults() {
    const results = functionSearchResults();
    clearElement(nodes.functionResults);

    if (!normalize(nodes.functionQuery.value)) {
      nodes.functionResultsMeta.textContent = t().functionEmpty;
    } else {
      nodes.functionResultsMeta.textContent = results.length ? t().resultCount(results.length) : t().noResults;
    }

    for (const entry of results) {
      const li = document.createElement('li');
      li.appendChild(createResultItem(entry));
      nodes.functionResults.appendChild(li);
    }

    if (state.selectedId && !results.some((entry) => entry.id === state.selectedId)) {
      for (const li of nodes.functionResults.querySelectorAll('.result-item')) {
        li.classList.remove('active');
      }
    }
  }

  function renderFavorites() {
    clearElement(nodes.favoritesList);

    const locale = t();
    nodes.favoritesMeta.textContent = state.favorites.length
      ? locale.favoritesCount(state.favorites.length)
      : locale.favoritesEmpty;

    for (const entryId of state.favorites) {
      const entry = entriesById.get(entryId);
      if (!entry) {
        continue;
      }
      const li = document.createElement('li');
      li.appendChild(createResultItem(entry));
      nodes.favoritesList.appendChild(li);
    }
  }

  function renderTopicResults() {
    const query = normalize(nodes.topicQuery.value);
    const results = topicSearchResults();
    clearElement(nodes.topicResults);

    if (!query) {
      nodes.topicResultsMeta.textContent = t().topicEmpty;
    } else if (state.topicTranslationInProgress && state.lang === 'fr') {
      nodes.topicResultsMeta.textContent = t().translatingQuery;
    } else {
      nodes.topicResultsMeta.textContent = results.length ? t().resultCount(results.length) : t().noResults;
    }

    for (const entry of results) {
      const li = document.createElement('li');
      li.appendChild(createResultItem(entry));
      nodes.topicResults.appendChild(li);
    }
  }

  async function translateText(text, sourceLang, targetLang) {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      return '';
    }

    const queryKey = `${sourceLang}:${targetLang}:${trimmed}`;
    if (state.translatedQueryByLangAndText[queryKey]) {
      return state.translatedQueryByLangAndText[queryKey];
    }

    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', sourceLang);
    url.searchParams.set('tl', targetLang);
    url.searchParams.set('dt', 't');
    url.searchParams.set('q', trimmed);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Translation failed (${response.status})`);
    }
    const payload = await response.json();
    const translated = Array.isArray(payload?.[0])
      ? payload[0].map((chunk) => chunk?.[0] || '').join('')
      : trimmed;

    state.translatedQueryByLangAndText[queryKey] = translated;
    return translated;
  }

  function chunkTextForTranslation(text, maxChunkSize = 1400) {
    const chunks = [];
    let current = '';

    const paragraphs = splitParagraphs(text);
    for (const paragraph of paragraphs) {
      if ((current + paragraph).length <= maxChunkSize) {
        current = current ? `${current}\n\n${paragraph}` : paragraph;
      } else {
        if (current) {
          chunks.push(current);
        }
        if (paragraph.length <= maxChunkSize) {
          current = paragraph;
        } else {
          let start = 0;
          while (start < paragraph.length) {
            chunks.push(paragraph.slice(start, start + maxChunkSize));
            start += maxChunkSize;
          }
          current = '';
        }
      }
    }

    if (current) {
      chunks.push(current);
    }

    return chunks.length ? chunks : [text];
  }

  async function translateLongText(text, sourceLang, targetLang) {
    const chunks = chunkTextForTranslation(text);
    const translatedChunks = [];

    for (const chunk of chunks) {
      translatedChunks.push(await translateText(chunk, sourceLang, targetLang));
    }

    return translatedChunks.join('\n\n');
  }

  function shouldTranslateAtRuntime(frenchText, englishText) {
    if (!frenchText) {
      return true;
    }
    return frenchText.trim().toLowerCase() === (englishText || '').trim().toLowerCase();
  }

  async function ensureFrenchShortFields(entry) {
    if (!entry || state.lang !== 'fr') {
      return;
    }

    const tasks = [];

    if (
      !state.translatedSectionById[entry.sectionId] &&
      shouldTranslateAtRuntime(entry.sectionFr, entry.sectionEn)
    ) {
      const key = `section:${entry.sectionId}`;
      if (!state.pendingShortTranslationKeys.has(key)) {
        state.pendingShortTranslationKeys.add(key);
        tasks.push(
          translateText(entry.sectionEn, 'en', 'fr')
            .then((translated) => {
              state.translatedSectionById[entry.sectionId] = translated || entry.sectionEn;
            })
            .finally(() => {
              state.pendingShortTranslationKeys.delete(key);
            })
        );
      }
    }

    if (
      !state.translatedSummaryById[entry.id] &&
      shouldTranslateAtRuntime(entry.summaryFr, entry.summaryEn)
    ) {
      const key = `summary:${entry.id}`;
      if (!state.pendingShortTranslationKeys.has(key)) {
        state.pendingShortTranslationKeys.add(key);
        tasks.push(
          translateText(entry.summaryEn, 'en', 'fr')
            .then((translated) => {
              state.translatedSummaryById[entry.id] = translated || entry.summaryEn;
            })
            .finally(() => {
              state.pendingShortTranslationKeys.delete(key);
            })
        );
      }
    }

    if (tasks.length) {
      try {
        await Promise.all(tasks);
      } finally {
        renderAll();
      }
    }
  }

  function translateSectionTitleIfNeeded(section) {
    if (state.lang !== 'fr') {
      return;
    }
    if (
      !shouldTranslateAtRuntime(section.titleFr, section.titleEn) ||
      state.translatedSectionById[section.id]
    ) {
      return;
    }
    const key = `section:${section.id}`;
    if (state.pendingShortTranslationKeys.has(key)) {
      return;
    }

    state.pendingShortTranslationKeys.add(key);
    translateText(section.titleEn, 'en', 'fr')
      .then((translated) => {
        state.translatedSectionById[section.id] = translated || section.titleEn;
      })
      .finally(() => {
        state.pendingShortTranslationKeys.delete(key);
        renderThemeFilter();
        renderFunctionResults();
        renderTopicResults();
        renderEntryDetail();
      });
  }

  async function updateTopicQueryTranslation() {
    const query = normalize(nodes.topicQuery.value);
    if (!query || state.lang !== 'fr') {
      state.translatedTopicQueryEn = '';
      state.topicTranslationInProgress = false;
      return;
    }

    const token = ++state.pendingTopicTranslationToken;
    state.topicTranslationInProgress = true;
    renderTopicResults();

    try {
      const translated = await translateText(query, 'fr', 'en');
      if (token !== state.pendingTopicTranslationToken) {
        return;
      }
      state.translatedTopicQueryEn = normalize(translated);
    } catch {
      if (token !== state.pendingTopicTranslationToken) {
        return;
      }
      state.translatedTopicQueryEn = query;
    } finally {
      if (token === state.pendingTopicTranslationToken) {
        state.topicTranslationInProgress = false;
        renderTopicResults();
      }
    }
  }

  async function ensureFrenchDescription(entry) {
    if (!entry || state.lang !== 'fr') {
      return;
    }

    if (state.translatedDescriptionById[entry.id]) {
      return;
    }

    if (state.translatingDescriptionIds.has(entry.id)) {
      return;
    }

    state.translatingDescriptionIds.add(entry.id);
    nodes.translateDescriptionBtn.disabled = true;
    renderParagraphText(nodes.entryDescription, t().translatingDescription, 'muted');

    try {
      const translated = await translateLongText(entry.descriptionEn, 'en', 'fr');
      state.translatedDescriptionById[entry.id] = translated;
      if (state.selectedId === entry.id && state.lang === 'fr') {
        renderParagraphText(nodes.entryDescription, translated);
      }
    } catch {
      if (state.selectedId === entry.id && state.lang === 'fr') {
        renderParagraphText(nodes.entryDescription, `${t().translationFailed}\n\n${entry.descriptionEn}`, '');
      }
    } finally {
      state.translatingDescriptionIds.delete(entry.id);
      nodes.translateDescriptionBtn.disabled = false;
    }
  }

  function renderSeeAlso(entry) {
    clearElement(nodes.entrySeeAlso);
    if (!entry.seeAlso || !entry.seeAlso.length) {
      const li = document.createElement('li');
      li.textContent = '-';
      nodes.entrySeeAlso.appendChild(li);
      return;
    }

    for (const linkInfo of entry.seeAlso) {
      const li = document.createElement('li');
      const anchor = document.createElement('a');
      anchor.href = linkInfo.href.startsWith('#') ? `${entry.file}${linkInfo.href}` : linkInfo.href;
      anchor.textContent = linkInfo.label;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      li.appendChild(anchor);
      nodes.entrySeeAlso.appendChild(li);
    }
  }

  function renderEntryDetail() {
    const entry = state.selectedId ? entriesById.get(state.selectedId) : null;

    if (!entry) {
      nodes.emptyState.hidden = false;
      nodes.entryDetail.hidden = true;
      nodes.pinEntryBtn.hidden = true;
      return;
    }

    nodes.emptyState.hidden = true;
    nodes.entryDetail.hidden = false;

    const locale = t();

    nodes.entryKind.textContent = locale.kind[entry.kind] || locale.kind.symbol;
    nodes.entryName.textContent = entry.name;
    nodes.entrySection.textContent = `${locale.sectionLabelPrefix} ${sectionLabel(entry)}`;
    nodes.entrySummary.textContent = summaryLabel(entry);
    nodes.entrySignature.textContent = entry.signatureEn;
    nodes.openEntrySource.href = entry.docUrl;
    nodes.openEntrySource.textContent = locale.sourceEntryLink;
    nodes.pinEntryBtn.hidden = false;
    nodes.pinEntryBtn.textContent = isFavorite(entry.id) ? locale.unpinEntry : locale.pinEntry;

    renderSeeAlso(entry);

    if (state.lang === 'fr') {
      ensureFrenchShortFields(entry);
      nodes.translateDescriptionBtn.hidden = false;
      nodes.translateDescriptionBtn.textContent = locale.translateDescription;
      if (state.translatedDescriptionById[entry.id]) {
        renderParagraphText(nodes.entryDescription, state.translatedDescriptionById[entry.id]);
      } else {
        renderParagraphText(nodes.entryDescription, locale.translatingDescription, 'muted');
        ensureFrenchDescription(entry);
      }
    } else {
      nodes.translateDescriptionBtn.hidden = true;
      renderParagraphText(nodes.entryDescription, entry.descriptionEn);
    }
  }

  function renderThemeFilter() {
    const selected = nodes.themeFilter.value || 'all';
    clearElement(nodes.themeFilter);

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = t().allThemes;
    nodes.themeFilter.appendChild(allOption);

    const sortedSections = [...data.sections].sort((a, b) => a.order - b.order);
    for (const section of sortedSections) {
      const option = document.createElement('option');
      option.value = section.id;
      if (state.lang === 'fr') {
        option.textContent = state.translatedSectionById[section.id] || section.titleFr || section.titleEn;
        translateSectionTitleIfNeeded(section);
      } else {
        option.textContent = section.titleEn;
      }
      nodes.themeFilter.appendChild(option);
    }

    nodes.themeFilter.value = sortedSections.some((s) => s.id === selected) || selected === 'all' ? selected : 'all';
  }

  function applyStaticTexts() {
    const locale = t();
    document.documentElement.lang = locale.htmlLang;

    nodes.eyebrow.textContent = locale.eyebrow;
    nodes.appTitle.textContent = locale.appTitle;
    nodes.appSubtitle.textContent = locale.appSubtitle;
    nodes.openOriginal.textContent = locale.openOriginal;
    nodes.downloadOffline.textContent = locale.downloadOffline;
    nodes.langToggle.textContent = locale.languageToggle;

    nodes.functionSearchTitle.textContent = locale.functionSearchTitle;
    nodes.functionSearchLabel.textContent = locale.functionSearchLabel;
    nodes.functionQuery.placeholder = locale.functionSearchPlaceholder;
    nodes.favoritesTitle.textContent = locale.favoritesTitle;

    nodes.topicSearchTitle.textContent = locale.topicSearchTitle;
    nodes.topicSearchLabel.textContent = locale.topicSearchLabel;
    nodes.topicQuery.placeholder = locale.topicSearchPlaceholder;
    nodes.themeLabel.textContent = locale.themeLabel;

    nodes.emptyTitle.textContent = locale.emptyTitle;
    nodes.emptyDescription.textContent = locale.emptyDescription;

    nodes.signatureTitle.textContent = locale.signatureTitle;
    nodes.descriptionTitle.textContent = locale.descriptionTitle;
    nodes.seeAlsoTitle.textContent = locale.seeAlsoTitle;

    nodes.footerStats.textContent = locale.footerStats(data.stats.entryCount, data.stats.sectionCount);
    nodes.footerDate.textContent = `${locale.footerDatePrefix} ${new Date(data.generatedAt).toLocaleString(state.lang === 'fr' ? 'fr-FR' : 'en-US')}`;

    renderThemeFilter();
  }

  function renderAll() {
    applyStaticTexts();
    renderFavorites();
    renderFunctionResults();
    renderTopicResults();
    renderEntryDetail();
  }

  nodes.langToggle.addEventListener('click', () => {
    state.lang = state.lang === 'en' ? 'fr' : 'en';
    state.translatedTopicQueryEn = '';
    state.topicTranslationInProgress = false;
    renderAll();
    updateTopicQueryTranslation();
  });

  nodes.functionQuery.addEventListener('input', () => {
    renderFunctionResults();
  });

  nodes.topicQuery.addEventListener('input', () => {
    state.translatedTopicQueryEn = '';
    renderTopicResults();
    updateTopicQueryTranslation();
  });

  nodes.themeFilter.addEventListener('change', () => {
    renderTopicResults();
  });

  nodes.translateDescriptionBtn.addEventListener('click', () => {
    const entry = state.selectedId ? entriesById.get(state.selectedId) : null;
    if (entry) {
      ensureFrenchDescription(entry);
    }
  });

  nodes.pinEntryBtn.addEventListener('click', () => {
    if (state.selectedId) {
      toggleFavorite(state.selectedId);
    }
  });

  state.favorites = loadFavorites().filter((entryId) => entriesById.has(entryId));
  renderAll();
})();
