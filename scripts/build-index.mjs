#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const cachePath = path.join(dataDir, 'translation-cache.json');

const SOURCE_URL = 'https://liballeg.org/stabledocs/en/allegro.html';
const TRANSLATE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const TRANSLATION_DELAY_MS = 60;
const ENABLE_METADATA_TRANSLATION = process.env.TRANSLATE_METADATA === '1';

const ENTITY_MAP = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: ' - ',
  ndash: ' - ',
  hellip: '...',
  copy: '(c)',
  reg: '(r)',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeEntities(input) {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (full, name) => ENTITY_MAP[name] ?? full);
}

function stripTags(input) {
  const normalized = input
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*p\s*>/gi, '\n\n')
    .replace(/<\s*\/\s*li\s*>/gi, '\n')
    .replace(/<\s*(?:p|li|h1|h2|h3|h4|h5|h6|div|blockquote|ul|ol|pre|table|tr|td)\b[^>]*>/gi, '\n')
    .replace(/<\s*\/\s*(?:h1|h2|h3|h4|h5|h6|div|blockquote|ul|ol|pre|table|tr|td)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return decodeEntities(normalized)
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function compactText(input) {
  return input.replace(/\s+/g, ' ').trim();
}

function sanitizeForSearch(input) {
  return input.toLowerCase();
}

async function readHtml(fileName) {
  return fs.readFile(path.join(rootDir, fileName), 'utf8');
}

async function listApiFiles() {
  const files = await fs.readdir(rootDir);
  return files
    .filter((f) => /^alleg\d{3}\.html$/.test(f))
    .sort((a, b) => Number(a.slice(5, 8)) - Number(b.slice(5, 8)));
}

function parseApiOrder(allegroHtml) {
  const order = [];
  const regex = /<li><a href="(alleg\d{3}\.html)">([^<]+)<\/a>/gi;
  let match;
  while ((match = regex.exec(allegroHtml)) !== null) {
    order.push({ file: match[1], title: stripTags(match[2]) });
  }
  return order;
}

function parseTocEntries(firstUlHtml) {
  const map = new Map();
  const regex = /<li><a href="#([^"]+)">([^<]+)<\/a>\s*&mdash;\s*([\s\S]*?)(?=<li>|$)/gi;
  let match;
  while ((match = regex.exec(firstUlHtml)) !== null) {
    const anchor = decodeEntities(match[1].trim());
    const name = decodeEntities(match[2].trim());
    const summary = stripTags(match[3]).replace(/\s+/g, ' ').trim();
    map.set(anchor, { name, summary });
  }
  return map;
}

function extractSeeAlso(bodyHtml) {
  const xrefBlock = bodyHtml.match(/<blockquote class="xref">([\s\S]*?)<\/blockquote>/i);
  if (!xrefBlock) {
    return [];
  }

  const links = [];
  const linkRegex = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let link;
  while ((link = linkRegex.exec(xrefBlock[1])) !== null) {
    links.push({
      href: decodeEntities(link[1].trim()),
      label: decodeEntities(link[2].trim()),
    });
  }
  return links;
}

function detectKind(signature) {
  if (signature.startsWith('#define') || signature.startsWith('Macro ')) {
    return 'macro';
  }
  if (signature.startsWith('extern ')) {
    return 'variable';
  }
  if (signature.startsWith('typedef ')) {
    return 'typedef';
  }
  if (signature.includes('(') && signature.includes(')')) {
    return 'function';
  }
  return 'symbol';
}

function makeKeywords(name, summary, sectionTitle) {
  const raw = `${name} ${summary} ${sectionTitle}`
    .toLowerCase()
    .replace(/[^a-z0-9_ ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  return [...new Set(raw)].slice(0, 40);
}

function extractIntro(html, ulEndIndex, firstApiIndex) {
  if (ulEndIndex < 0 || firstApiIndex < 0 || firstApiIndex <= ulEndIndex) {
    return '';
  }
  return stripTags(html.slice(ulEndIndex, firstApiIndex));
}

function parsePage(fileName, html, sectionOrder) {
  const sectionMatch = html.match(/<h1><a name="[^"]+">([\s\S]*?)<\/a><\/h1>/i);
  const sectionTitleEn = sectionMatch ? stripTags(sectionMatch[1]) : fileName;

  const afterH1 = sectionMatch ? html.slice(sectionMatch.index + sectionMatch[0].length) : html;
  const firstUlMatch = afterH1.match(/<ul>([\s\S]*?)<\/ul>/i);
  const tocEntries = firstUlMatch ? parseTocEntries(firstUlMatch[1]) : new Map();

  const firstUlEndIndex = firstUlMatch
    ? (sectionMatch ? sectionMatch.index + sectionMatch[0].length : 0) + firstUlMatch.index + firstUlMatch[0].length
    : -1;

  const firstApiIndex = html.search(/<div class="al-api"><b>/i);
  const introEn = extractIntro(html, firstUlEndIndex, firstApiIndex);

  const entries = [];
  const blockRegex = /<div class="al-api"><b>([\s\S]*?)<\/b><\/div><br>\s*([\s\S]*?)(?=(?:<div class="al-api"><b>|<\/body>))/gi;
  let block;
  while ((block = blockRegex.exec(html)) !== null) {
    const signatureHtml = block[1];
    const bodyHtml = block[2];
    const anchorMatch = signatureHtml.match(/<a name="([^"]+)">([^<]+)<\/a>/i);
    if (!anchorMatch) {
      continue;
    }

    const anchor = decodeEntities(anchorMatch[1].trim());
    const name = decodeEntities(anchorMatch[2].trim());
    const signatureEn = compactText(stripTags(signatureHtml));
    const descriptionHtml = bodyHtml.split(/<blockquote class="(?:xref|eref)">/i)[0] ?? bodyHtml;
    const descriptionEn = stripTags(descriptionHtml);

    const toc = tocEntries.get(anchor);
    const summaryEn = toc?.summary || descriptionEn.split('\n')[0] || '';

    const entry = {
      id: `${fileName}#${anchor}`,
      name,
      anchor,
      file: fileName,
      docUrl: `${fileName}#${anchor}`,
      sectionId: fileName.replace('.html', ''),
      sectionEn: sectionTitleEn,
      summaryEn,
      signatureEn,
      descriptionEn,
      kind: detectKind(signatureEn),
      seeAlso: extractSeeAlso(bodyHtml),
      keywords: makeKeywords(name, summaryEn, sectionTitleEn),
      searchTextEn: sanitizeForSearch(
        [
          name,
          signatureEn,
          summaryEn,
          descriptionEn,
          sectionTitleEn,
          introEn,
        ].join('\n')
      ),
    };

    entries.push(entry);
  }

  return {
    id: fileName.replace('.html', ''),
    file: fileName,
    titleEn: sectionTitleEn,
    order: sectionOrder,
    introEn,
    entryCount: entries.length,
    entries,
  };
}

async function loadTranslationCache() {
  try {
    const raw = await fs.readFile(cachePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveTranslationCache(cache) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf8');
}

async function translateText(text, cache) {
  const normalized = text.trim();
  if (!normalized) {
    return '';
  }
  if (cache[normalized]) {
    return cache[normalized];
  }

  const params = new URLSearchParams({
    client: 'gtx',
    sl: 'en',
    tl: 'fr',
    dt: 't',
    q: normalized,
  });

  const url = `${TRANSLATE_ENDPOINT}?${params.toString()}`;
  let attempts = 0;
  while (attempts < 3) {
    attempts += 1;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const payload = await res.json();
      const translated = Array.isArray(payload?.[0])
        ? payload[0].map((chunk) => chunk?.[0] ?? '').join('')
        : normalized;
      cache[normalized] = translated || normalized;
      await sleep(TRANSLATION_DELAY_MS);
      return cache[normalized];
    } catch (error) {
      if (attempts >= 3) {
        cache[normalized] = normalized;
        return normalized;
      }
      await sleep(250 * attempts);
    }
  }

  return normalized;
}

async function translateMetadata(indexData) {
  const cache = await loadTranslationCache();

  for (const section of indexData.sections) {
    section.titleFr = await translateText(section.titleEn, cache);
    section.introFr = section.introEn ? await translateText(section.introEn, cache) : '';
  }

  for (const entry of indexData.entries) {
    entry.sectionFr = indexData.sectionById[entry.sectionId]?.titleFr ?? entry.sectionEn;
    entry.summaryFr = entry.summaryEn ? await translateText(entry.summaryEn, cache) : '';
    entry.searchTextFr = sanitizeForSearch(
      [entry.name, entry.summaryFr, entry.sectionFr, entry.keywords.join(' ')].join('\n')
    );
  }

  await saveTranslationCache(cache);
}

async function build() {
  await fs.mkdir(dataDir, { recursive: true });

  const allegroHtml = await readHtml('allegro.html');
  const apiOrder = parseApiOrder(allegroHtml);
  const apiFiles = await listApiFiles();
  const sectionOrderMap = new Map(apiOrder.map((item, idx) => [item.file, idx]));

  const sections = [];
  const entries = [];

  for (const fileName of apiFiles) {
    const html = await readHtml(fileName);
    const page = parsePage(fileName, html, sectionOrderMap.get(fileName) ?? Number.MAX_SAFE_INTEGER);
    sections.push({
      id: page.id,
      file: page.file,
      titleEn: page.titleEn,
      order: page.order,
      introEn: page.introEn,
      entryCount: page.entryCount,
    });
    entries.push(...page.entries);
  }

  sections.sort((a, b) => a.order - b.order || a.file.localeCompare(b.file));

  const indexData = {
    generatedAt: new Date().toISOString(),
    source: {
      url: SOURCE_URL,
      localRoot: '.',
    },
    stats: {
      sectionCount: sections.length,
      entryCount: entries.length,
    },
    sections,
    entries,
  };

  indexData.sectionById = Object.fromEntries(sections.map((s) => [s.id, s]));

  if (ENABLE_METADATA_TRANSLATION) {
    await translateMetadata(indexData);
  } else {
    for (const section of indexData.sections) {
      section.titleFr = section.titleEn;
      section.introFr = section.introEn;
    }
    for (const entry of indexData.entries) {
      entry.sectionFr = entry.sectionEn;
      entry.summaryFr = entry.summaryEn;
    }
  }

  for (const entry of indexData.entries) {
    delete entry.searchTextEn;
    delete entry.searchTextFr;
  }

  const indexForUi = {
    generatedAt: indexData.generatedAt,
    source: indexData.source,
    stats: indexData.stats,
    sections: indexData.sections,
    entries: indexData.entries,
  };

  const searchIndex = {
    entries: indexData.entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      sectionId: entry.sectionId,
      kind: entry.kind,
      searchTextEn: sanitizeForSearch(
        [entry.name, entry.signatureEn, entry.summaryEn, entry.descriptionEn, entry.sectionEn, entry.keywords.join(' ')].join('\n')
      ),
      searchTextFr: sanitizeForSearch(
        [entry.name, entry.summaryFr, entry.sectionFr, entry.keywords.join(' ')].join('\n')
      ),
    })),
  };

  await fs.writeFile(path.join(dataDir, 'index.js'), `window.ALLEGRO_INDEX = ${JSON.stringify(indexForUi)};\n`, 'utf8');
  await fs.writeFile(path.join(dataDir, 'search-index.js'), `window.ALLEGRO_SEARCH_INDEX = ${JSON.stringify(searchIndex)};\n`, 'utf8');

  console.log(`Indexed ${indexForUi.stats.entryCount} API entries in ${indexForUi.stats.sectionCount} sections.`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
