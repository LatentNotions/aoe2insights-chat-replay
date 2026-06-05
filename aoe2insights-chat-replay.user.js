// ==UserScript==
// @name         AoE2 Insights Chat Replay and Translator
// @namespace    local.aoe2insights.chat
// @version      0.8.1
// @description  Extract replay chat, normalize replay events, seek from transcript rows, translate locally, and route Pinyin to Google Translate when Chrome local translation cannot handle it.
// @match        https://www.aoe2insights.com/*
// @license      MIT
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const CFG = {
    pollMs: 1000,
    dedupeMs: 700,
    seekLeadMs: 2000,
    autoOpen: true,
    target: 'en',
    minConfidence: 0.30,
    minCorpusLength: 8,
    prewarm: ['es'],
    nativeOverlayStorageKey: 'aoe-chat-show-native-overlay',
  };

  const AGES = ['Dark Age', 'Feudal Age', 'Castle Age', 'Imperial Age'];

  const PLAYER_COLORS = new Map([
    [1, '#0000FF'],
    [2, '#FF0000'],
    [3, '#00FF00'],
    [4, '#FFFF00'],
    [5, '#00FFFF'],
    [6, '#FF00FF'],
    [7, '#808080'],
    [8, '#FF8000'],
  ]);

  const TAUNTS = new Map([
    [1, 'Yes.'],
    [2, 'No.'],
    [3, 'Food please.'],
    [4, 'Wood please.'],
    [5, 'Gold please.'],
    [6, 'Stone please.'],
    [7, 'Ahh!'],
    [8, 'All hail, king of the losers!'],
    [9, 'Ooh!'],
    [10, "I'll beat you back to Age of Empires."],
    [11, 'Laugh'],
    [12, 'Ah! Being rushed.'],
    [13, 'Sure, blame it on your ISP.'],
    [14, 'Start the game already!'],
    [15, "Don't point that thing at me!"],
    [16, 'Enemy sighted!'],
    [17, 'It is good to be the king.'],
    [18, 'Monk! I need a monk!'],
    [19, 'Long time, no siege.'],
    [20, 'My granny could scrap better than that.'],
    [21, "Nice town, I'll take it."],
    [22, 'Quit touching me!'],
    [23, 'Raiding party!'],
    [24, 'Dadgum.'],
    [25, 'Eh, smite me.'],
    [26, 'The wonder, the wonder, the... no!'],
    [27, 'You played two hours to die like this?'],
    [28, 'Yeah, well, you should see the other guy.'],
    [29, 'Roggan.'],
    [30, 'Wololo.'],
    [31, 'Attack an enemy now.'],
    [32, 'Cease creating extra villagers.'],
    [33, 'Create extra villagers.'],
    [34, 'Build a navy.'],
    [35, 'Stop building a navy.'],
    [36, 'Wait for my signal to attack.'],
    [37, 'Build a wonder.'],
    [38, 'Give me your extra resources.'],
    [39, 'Ally sound'],
    [40, 'Enemy sound'],
    [41, 'Neutral sound'],
    [42, 'What age are you in?'],
    [43, 'What is your strategy?'],
    [44, 'How many resources do you have?'],
    [45, 'Retreat now!'],
    [46, 'Flare the location of your army.'],
    [47, 'Attack in direction of the flared location.'],
    [48, "I'm being attacked, please help!"],
    [49, 'Build a forward base at the flared location.'],
    [50, 'Build a fortification at the flared location.'],
    [51, 'Keep your army close to mine and fight with me.'],
    [52, 'Build a market at the flared location.'],
    [53, 'Rebuild your base at the flared location.'],
    [54, 'Build a wall between the two flared locations.'],
    [55, 'Build a wall around your town.'],
    [56, "Train units which counter the enemy's army."],
    [57, 'Stop training counter units.'],
    [58, 'Prepare to send me all your resources so I can vanquish our foes!'],
    [59, 'Stop sending me extra resources.'],
    [60, 'Prepare to train a large army, I will send you as many resources as I can spare.'],
    [61, 'Attack player 1! (Blue)'],
    [62, 'Attack player 2! (Red)'],
    [63, 'Attack player 3! (Green)'],
    [64, 'Attack player 4! (Yellow)'],
    [65, 'Attack player 5! (Cyan)'],
    [66, 'Attack player 6! (Purple)'],
    [67, 'Attack player 7! (Gray)'],
    [68, 'Attack player 8! (Orange)'],
    [69, 'Delete the object on the flared location.'],
    [70, 'Delete your excess villagers.'],
    [71, 'Delete excess warships.'],
    [72, 'Focus on training infantry units.'],
    [73, 'Focus on training cavalry units.'],
    [74, 'Focus on training ranged units.'],
    [75, 'Focus on training warships.'],
    [76, 'Attack the enemy with Militia.'],
    [77, 'Attack the enemy with Archers.'],
    [78, 'Attack the enemy with Skirmishers.'],
    [79, 'Attack the enemy with a mix of Archers and Skirmishers.'],
    [80, 'Attack the enemy with Scout Cavalry.'],
    [81, 'Attack the enemy with Men-at-Arms.'],
    [82, 'Attack the enemy with Eagle Scouts.'],
    [83, 'Attack the enemy with Towers.'],
    [84, 'Attack the enemy with Crossbowmen.'],
    [85, 'Attack the enemy with Cavalry Archers.'],
    [86, 'Attack the enemy with Unique Units.'],
    [87, 'Attack the enemy with Knights.'],
    [88, 'Attack the enemy with Battle Elephants.'],
    [89, 'Attack the enemy with Scorpions.'],
    [90, 'Attack the enemy with Monks.'],
    [91, 'Attack the enemy with Monks and Mangonels.'],
    [92, 'Attack the enemy with Eagle Warriors.'],
    [93, 'Attack the enemy with Halberdiers and Rams.'],
    [94, 'Attack the enemy with Elite Eagle Warriors.'],
    [95, 'Attack the enemy with Arbalests.'],
    [96, 'Attack the enemy with Champions.'],
    [97, 'Attack the enemy with Galleys.'],
    [98, 'Attack the enemy with Fire Galleys.'],
    [99, 'Attack the enemy with Demolition Rafts.'],
    [100, 'Attack the enemy with War Galleys.'],
    [101, 'Attack the enemy with Fire Ships.'],
    [102, 'Attack the enemy with Unique Warships.'],
    [103, 'Use an Onager to cut down trees at the flared location.'],
    [104, "Don't resign!"],
    [105, 'You can resign again.'],
  ]);

  const TRANSLATABLE = new Set([
    'es',
    'pt',
    'fr',
    'de',
    'it',
    'zh',
    'zh-Hant',
  ]);

  const LANGUAGE_NAMES = new Map([
    ['es', 'Spanish'],
    ['pt', 'Portuguese'],
    ['fr', 'French'],
    ['de', 'German'],
    ['it', 'Italian'],
    ['zh', 'Chinese'],
    ['zh-Hant', 'Traditional Chinese'],
    ['zh-Latn', 'Romanized Chinese (Pinyin)'],
  ]);

  const COMMON_SHORT_NON_ASCII_WORDS = new Set([
    'sí', 'él', 'tú', 'mí', 'sé', 'dé',
    'é', 'já', 'só', 'lá',
    'ça', 'où', 'là',
    'è', 'sì', 'più',
  ]);

  /*
    Chrome's Language Detector natively reports romanized Chinese as
    "zh-Latn". We only need a small English false-positive guard for ambiguous
    short lines such as "you dian" versus ordinary English such as
    "going down".
  */
  const COMMON_ENGLISH_CHAT_WORDS = new Set([
    'a', 'an', 'and', 'are', 'at', 'back', 'bad', 'base', 'can', 'castle',
    'come', 'coming', 'down', 'enemy', 'fast', 'food', 'forward', 'gg', 'go',
    'going', 'gold', 'good', 'help', 'here', 'i', 'in', 'is', 'it', 'left',
    'lol', 'market', 'me', 'mid', 'my', 'need', 'no', 'now', 'on', 'one',
    'out', 'push', 'raid', 'ready', 'right', 'rush', 'scout', 'send', 'stone',
    'stop', 'tc', 'team', 'thanks', 'that', 'the', 'there', 'they', 'this',
    'to', 'tower', 'up', 'wait', 'wall', 'we', 'wood', 'yes', 'you', 'your',
  ]);

    const SHARED_TRANSLATION_TOKENS = new Set([
    /*
      Tokens that may legitimately remain unchanged across languages.
      Keep this small and practical.
    */
    'gg',
    'tc',
    'afk',
    'lol',
    'ok',
    'no',
    'yes',
    'red',
    'blue',
    'green',
    'yellow',
    'cyan',
    'purple',
    'orange',
  ]);

  const state = {
    analysisUrl: null,
    loadingUrl: null,
    players: {},
    rows: [],
    ui: {},
    showNativeOverlay: readStoredBoolean(CFG.nativeOverlayStorageKey, true),

    filter: {
      system: true,
      allChat: true,
      team: 'all',
      mode: 'both', // both | english | original
      hideTaunts: false,
    },

    ai: {
      busy: false,
      detector: null,
      detectorPromise: null,
      translators: new Map(),
      translatorPromises: new Map(),
      cache: new Map(),
      playerLanguages: new Map(),
      messageLanguages: new Map(),
      detectionCache: new Map(),
      chineseProfiles: new Map(),
      fallbackLanguage: null,
      summary: '',
    },
  };

  addStyles();
  applyNativeOverlayVisibility();
  scan();
  setInterval(scan, CFG.pollMs);

  async function scan() {
    if (!document.querySelector('minimap-replay')) return;

    ensureLauncher();
    ensureNativeOverlayToggle();

    const url = findAnalysisUrl();
    if (!url || url === state.analysisUrl || url === state.loadingUrl) return;

    state.loadingUrl = url;
    setLauncher('AoE Chat: loading…');

    try {
      const response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

      const analysis = await response.json();

      state.analysisUrl = url;
      state.players = analysis.player ?? {};
      state.rows = extractRows(analysis);

      state.ai.playerLanguages.clear();
      state.ai.messageLanguages.clear();
      state.ai.detectionCache.clear();
      state.ai.chineseProfiles = buildChineseProfiles(state.rows);
      state.ai.fallbackLanguage = null;
      state.ai.summary = '';

      ensurePanel();
      render();

      const playerMessages = state.rows.filter((row) => row.kind === 'player').length;
      setLauncher(`AoE Chat (${playerMessages})`);

      if (CFG.autoOpen) state.ui.panel.classList.add('open');
    } catch (error) {
      console.debug('[AoE Chat] Analysis JSON is not ready:', error);
      setLauncher('AoE Chat: waiting…');
    } finally {
      state.loadingUrl = null;
    }
  }

  function findAnalysisUrl() {
    const minimaps = [
      ...document.querySelectorAll(
        'img.minimap-replay-bg[src*="/media/matches/minimaps/minimap-"]'
      ),
    ];

    const minimap = minimaps.find((img) => img.offsetParent !== null) ?? minimaps.at(-1);
    const id = minimap?.src.match(/minimap-(\d+)\.svg(?:\?|$)/)?.[1];

    if (id) {
      return new URL(`/media/matches/analysis/analysis-${id}.json`, location.origin).href;
    }

    return (
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .reverse()
        .find((resourceUrl) =>
          /\/media\/matches\/analysis\/analysis-\d+\.json(?:\?|$)/.test(resourceUrl)
        ) ?? null
    );
  }

  function extractRows(analysis) {
    const players = analysis.player ?? {};
    const actions = analysis.replay?.actions ?? {};
    const nextAge = new Map();
    const lastPlayer = new Map();
    const lastSystem = new Map();
    const startAge = startingAgeIndex(analysis.lobby?.starting_age);
    const rows = [];

    const timeline = Object.entries(actions).sort(
      ([left], [right]) => Number(left) - Number(right)
    );

    for (const [stamp, events] of timeline) {
      const timeMs = Number(stamp);

      for (const event of events ?? []) {
        if (event.type === 'resign') {
          const player = getPlayer(players, event.player);
          const disconnected = Boolean(event.payload?.disconnected);
          const playerName = String(player.name ?? `Player ${event.player}`);

          rows.push({
            kind: 'system',
            systemType: disconnected ? 'disconnect' : 'resign',
            timeMs,
            playerId: event.player,
            playerName,
            playerColor: getPlayerColor(players, event.player),
            team: player.team ?? null,
            channel: 'system',
            text: `${playerName} ${disconnected ? 'disconnected' : 'resigned'}.`,
          });

          continue;
        }

        if (event.type !== 'chat') continue;

        const raw = String(event.payload?.message ?? '');
        const playerMessage = parsePlayerMessage(raw, event, players);

        if (playerMessage) {
          const signature =
            `${playerMessage.playerId}|${playerMessage.channel}|${playerMessage.text}`;
          const prior = lastPlayer.get(signature);

          if (prior !== undefined && timeMs - prior <= CFG.dedupeMs) continue;
          lastPlayer.set(signature, timeMs);

          rows.push({
            kind: 'player',
            timeMs,
            ...playerMessage,
            taunt: parseTauntMessage(playerMessage.text),
            translation: null,
            translationSource: null,
            translationRoute: null,
            translationAttempted: false,
            translationWarning: null,
            detectedLanguage: null,
          });

          continue;
        }

        const signature = `${event.player}|${raw}`;
        const prior = lastSystem.get(signature);
        if (prior !== undefined && timeMs - prior <= CFG.dedupeMs) continue;
        lastSystem.set(signature, timeMs);

        const player = getPlayer(players, event.player);

        rows.push({
          kind: 'system',
          systemType: looksLikeAgeUp(raw) ? 'age-up' : 'system',
          timeMs,
          playerId: event.player,
          playerName: String(player.name ?? `Player ${event.player}`),
          playerColor: getPlayerColor(players, event.player),
          team: player.team ?? null,
          channel: 'system',
          text: normalizeSystem(raw, event, players, nextAge, startAge),
        });
      }
    }

    return rows;
  }

  function parsePlayerMessage(raw, event, players) {
    const prefix = raw.match(/^(<All>)?\s*\d+\s+(?:🌐|<platform_icon_[^>]+>)\s+/u);
    if (!prefix) return null;

    const player = getPlayer(players, event.player);
    const playerName = String(player.name ?? `Player ${event.player}`);

    let text = raw.slice(prefix[0].length);
    text = text.startsWith(`${playerName}:`)
      ? text.slice(playerName.length + 1)
      : text.replace(/^.*?:\s*/, '');

    return {
      playerId: event.player,
      playerName,
      playerColor: getPlayerColor(players, event.player),
      team: player.team ?? null,
      channel: prefix[1] || event.payload?.channel === 1 ? 'all' : 'team',
      text: text.trim(),
      raw,
    };
  }

  function parseTauntMessage(text) {
    const raw = String(text ?? '').trim();
    const match = raw.match(/^(\d+)(?:\s*:\s*\([^)]*\))?(?:\s+|$)(.*)$/u);
    if (!match) return null;

    const number = Number(match[1]);
    const label = TAUNTS.get(number);
    if (!label) return null;

    return {
      number,
      label,
      raw,
      remainder: String(match[2] ?? '').trim(),
    };
  }

  function normalizeSystem(raw, event, players, nextAge, startAge) {
    if (!looksLikeAgeUp(raw)) return raw.trim();

    const id = String(event.player);
    const index = nextAge.get(id) ?? startAge + 1;
    const age = AGES[index];
    if (!age) return raw.trim();

    nextAge.set(id, index + 1);

    const playerName = getPlayer(players, event.player).name ?? `Player ${event.player}`;
    return `${playerName} reached ${age}.`;
  }

    function looksLikeAgeUp(text) {
    const normalized =
      fold(text)
        .replace(
          /[._-]+/gu,
          ' '
        )
        .replace(
          /\s+/gu,
          ' '
        )
        .trim();

    /*
      Full words and common abbreviations for "age".
    */
    const hasAgeMarker =
      /\b(?:age|edad|ed|idade|eta|zeitalter|tijdperk|wiek|era|epoca|epoque|zeit)\b|时代|時代|시대|эпох|çağ/iu.test(
        normalized
      );

    /*
      Known age names across several common localizations.

      This acts as a fallback for replay strings that abbreviate or omit
      the language's word for "age".
    */
    const hasKnownAgeName =
      /\b(?:dark|feudal|feodale|feodal|castle|castillo|castillos|castelo|castelos|imperial|oscura|oscuras)\b/iu.test(
        normalized
      );

    /*
      Common forms of "advanced" or "reached".

      fold() already removes accents, so:
        avanzó → avanzo
        avançou → avancou
    */
    const hasAdvanceVerb =
      /\b(?:reached|advanced|advance|avanzo|avancou|avanzo|atteint|erreichte|alcanz|llego|subio)\b/iu.test(
        normalized
      );

    return (
      hasAgeMarker ||
      (
        hasKnownAgeName &&
        hasAdvanceVerb
      )
    );
  }

  function startingAgeIndex(label) {
    const text = fold(label ?? '');
    if (text.includes('imperial')) return 3;
    if (text.includes('castle')) return 2;
    if (text.includes('feudal')) return 1;
    return 0;
  }

  function fold(text) {
    return String(text)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  }

  function getPlayer(players, id) {
    return players[String(id)] ?? players[id] ?? {};
  }

  function getPlayerColor(players, id) {
    const player = getPlayer(players, id);
    return PLAYER_COLORS.get(Number(player.color)) ?? '#7E8A99';
  }

  function ensureNativeOverlayToggle() {
    const toggles = document.querySelector('minimap-replay .minimap-replay-toggles');
    if (!toggles || toggles.querySelector('[data-aoe-native-chat-overlay-toggle]')) return;

    const label = document.createElement('label');
    label.className = 'minimap-replay-toggle';
    label.dataset.aoeNativeChatOverlayToggle = 'true';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = state.showNativeOverlay;

    input.addEventListener('change', () => {
      state.showNativeOverlay = input.checked;
      localStorage.setItem(CFG.nativeOverlayStorageKey, String(input.checked));
      applyNativeOverlayVisibility();
    });

    label.append(input, document.createTextNode(' Chat overlay'));
    toggles.append(label);
  }

  function applyNativeOverlayVisibility() {
    document.documentElement.classList.toggle(
      'aoe-hide-native-chat-overlay',
      !state.showNativeOverlay
    );
  }

  function readStoredBoolean(key, fallback) {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  }

  async function translateLocally() {
    if (state.ai.busy) return;

    if (!('Translator' in self) || !('LanguageDetector' in self)) {
      setStatus('Chrome native translation is unavailable in this browser.');
      return;
    }

    const rows = state.rows.filter(
      (row) => row.kind === 'player' && translationInput(row).trim()
    );

    if (!rows.length) {
      setStatus('No player-written messages need translation.');
      return;
    }

    state.ai.busy = true;
    updateTranslateButton();

    try {
      setStatus('Preparing local translation…');

      state.ai.chineseProfiles = buildChineseProfiles(rows);

      const earlyLanguages = getSynchronousPrewarmLanguages(rows);
      const earlyPromises = [...earlyLanguages]
        .filter((language) => language !== CFG.target)
        .map((language) => getTranslator(language).catch(() => null));

      const detector = await getDetector();

      /*
        Cache ranked detector results once per unique message. This is the key
        to robust Pinyin handling: Chrome natively reports romanized Chinese as
        "zh-Latn", even though Chrome's local Translator does not transliterate it.
      */
      await populateDetectionCache(detector, rows);
      enrichChineseProfiles(rows);

      state.ai.playerLanguages = await detectPlayerLanguages(detector, rows);
      await Promise.allSettled(earlyPromises);

      const jobs = new Map();

      for (const row of rows) {
        const input = translationInput(row).trim();
        const decision = await chooseSourceLanguage(detector, row, input);

        row.detectedLanguage = decision.language;
        row.translationRoute = decision.reason;
        row.translationAttempted = false;
        row.translationWarning = null;

        /*
          Chrome can detect Pinyin as zh-Latn but its local translation model
          cannot resolve it. Do not display a fake pass-through translation.
          Route these rows to the persistent Google fallback instead.
        */
        if (decision.reason === 'pinyin-google') {
          row.translation = null;
          row.translationSource = null;
          row.translationWarning = {
            reasons: [
              'Chrome detected romanized Chinese, but its local translator does not support Pinyin transliteration',
            ],
            message: 'Use Google Translate for this Pinyin message.',
          };
          continue;
        }

        if (
          !decision.language ||
          decision.language === CFG.target ||
          !TRANSLATABLE.has(decision.language)
        ) {
          row.translation = null;
          row.translationSource = null;
          continue;
        }

        const key = `${decision.language}|${CFG.target}|${input}`;

        if (!jobs.has(key)) {
          jobs.set(key, {
            language: decision.language,
            text: input,
            rows: [],
          });
        }

        jobs.get(key).rows.push(row);
      }

      let done = 0;
      let translated = 0;
      const failed = new Set();

      for (const job of jobs.values()) {
        setStatus(`Translating locally… ${++done}/${jobs.size}`);

        try {
          const english = await translateCached(job.language, job.text);

          for (const row of job.rows) {
            row.translationAttempted = true;

            if (isEffectivelySame(job.text, english)) {
              row.translation = null;
              row.translationSource = null;
              row.translationWarning = unresolvedTranslationWarning(row);
              continue;
            }

            row.translation = english;
            row.translationSource = 'native';
            row.translationWarning = assessTranslationUncertainty(
              job.text,
              english,
              row
            );

            translated += 1;
          }
        } catch (error) {
          failed.add(job.language);

          console.warn(
            `[AoE Chat] ${job.language} translation failed:`,
            error
          );
        }
      }

      state.ai.summary = buildTranslationSummary(
        rows,
        translated,
        failed
      );

      render();
      setStatus(state.ai.summary);
    } catch (error) {
      console.error(
        '[AoE Chat] Local translation failed:',
        error
      );

      setStatus(
        `Local translation failed: ${error.message}`
      );
    } finally {
      state.ai.busy = false;
      updateTranslateButton();
    }
  }

  function getSynchronousPrewarmLanguages(rows) {
    const languages = new Set(CFG.prewarm);

    for (const row of rows) {
      const input = translationInput(row).trim();

      /*
        Prewarm Chinese only for actual Han-script text. Pinyin is deliberately
        routed to Google Translate because the local Chinese model merely
        echoes it back.
      */
      if (containsHan(input)) {
        languages.add('zh');
      }

      const hinted = hintedNonChineseLanguage(input);
      if (hinted) {
        languages.add(hinted);
      }
    }

    return languages;
  }

  function translationInput(row) {
    return row.taunt
      ? row.taunt.remainder
      : row.text;
  }

  async function populateDetectionCache(detector, rows) {
    const uniqueInputs = new Set(
      rows
        .map((row) => translationInput(row).trim())
        .filter(Boolean)
    );

    for (const input of uniqueInputs) {
      await getCachedDetectionCandidates(detector, input);
    }
  }

  async function getCachedDetectionCandidates(detector, text) {
    const key = String(text ?? '').trim().toLowerCase();

    if (!key) {
      return [];
    }

    if (state.ai.detectionCache.has(key)) {
      return state.ai.detectionCache.get(key);
    }

    const candidates = await detectCandidates(detector, text);
    state.ai.detectionCache.set(key, candidates);

    return candidates;
  }

  async function chooseSourceLanguage(detector, row, input) {
    const text = String(input ?? '').trim();

    if (!text) {
      return {
        language: null,
        reason: 'empty',
      };
    }

    const cacheKey = `${row.playerId}|${text.toLowerCase()}`;

    if (state.ai.messageLanguages.has(cacheKey)) {
      return state.ai.messageLanguages.get(cacheKey);
    }

    const remember = (language, reason) => {
      const decision = {
        language,
        reason,
      };

      state.ai.messageLanguages.set(cacheKey, decision);
      return decision;
    };

    /*
      Real Chinese characters are handled by Chrome's local zh → en model.
    */
    if (containsHan(text)) {
      return remember(
        'zh',
        'han-script'
      );
    }

    const hinted = hintedNonChineseLanguage(text);

    if (hinted) {
      return remember(
        hinted,
        'language-hint'
      );
    }

    const candidates = await getCachedDetectionCandidates(
      detector,
      text
    );

    const direct = candidates[0] ?? null;

    const englishCandidate =
      candidates.find(
        (candidate) =>
          candidate.language === CFG.target
      ) ??
      null;

    const pinyinCandidate =
      candidates.find(
        (candidate) =>
          candidate.language === 'zh-Latn'
      ) ??
      null;

    const profile =
      state.ai.chineseProfiles.get(
        String(row.playerId)
      );

    /*
      Confident zh-Latn detection is enough by itself.

      This catches messages such as:
        duimian buhui zuhequang ba
    */
    if (
      pinyinCandidate &&
      pinyinCandidate.confidence >= 0.55
    ) {
      return remember(
        'zh-Latn',
        'pinyin-google'
      );
    }

    /*
      Short Pinyin can rank behind English. Use the Chinese-character player
      name or other Chinese messages as supporting context, but only when:
        - zh-Latn still appears as a plausible detector candidate;
        - the text is not composed entirely of common English chat words.

      This catches:
        you dian

      while leaving:
        going down
    */
    if (
      profile?.hasChineseContext &&
      pinyinCandidate &&
      pinyinCandidate.confidence >= 0.18 &&
      hasNonEnglishLookingLatinToken(text)
    ) {
      return remember(
        'zh-Latn',
        'pinyin-google'
      );
    }

    /*
      Critical English guard: do not translate English messages into
      themselves merely because a player wrote foreign-language messages
      elsewhere in the match.
    */
    if (
      direct?.language ===
      CFG.target
    ) {
      return remember(
        CFG.target,
        'detected-english'
      );
    }

    /*
      Short messages often produce unstable rankings. If English is reasonably
      plausible and close behind the highest-ranked guess, leave the line alone.
    */
    if (
      englishCandidate &&
      direct &&
      englishCandidate.confidence >= 0.20 &&
      direct.confidence -
        englishCandidate.confidence <
        0.15
    ) {
      return remember(
        CFG.target,
        'plausibly-english'
      );
    }

    if (
      direct &&
      direct.language !== CFG.target &&
      direct.language !== 'zh-Latn' &&
      direct.confidence >= 0.40 &&
      TRANSLATABLE.has(direct.language)
    ) {
      return remember(
        direct.language,
        'detected-message-language'
      );
    }

    const player =
      state.ai.playerLanguages.get(
        String(row.playerId)
      );

    if (
      !englishCandidate &&
      player &&
      player.language !== CFG.target &&
      player.language !== 'zh-Latn' &&
      player.confidence >= 0.60 &&
      TRANSLATABLE.has(player.language)
    ) {
      return remember(
        player.language,
        'player-language-fallback'
      );
    }

    const fallback =
      state.ai.fallbackLanguage;

    if (
      !englishCandidate &&
      fallback &&
      fallback.language !== CFG.target &&
      fallback.language !== 'zh-Latn' &&
      fallback.confidence >= 0.80 &&
      TRANSLATABLE.has(fallback.language)
    ) {
      return remember(
        fallback.language,
        'lobby-language-fallback'
      );
    }

    return remember(
      null,
      'unknown'
    );
  }

  function hintedNonChineseLanguage(text) {
    const original = String(text);
    const normalized = fold(original);

    if (/[ñ¿¡]/u.test(original)) {
      return 'es';
    }

    if (
      /\b(?:bien|maciso|pelar|izquierda|derecha|arriba|abajo|mande|manda|dale|gracias|tengo|tienes|tiene|aca|ahi|vamos|voy|enemigo|ataca|ayuda)\b/u.test(
        normalized
      )
    ) {
      return 'es';
    }

    if (/[ãõç]/u.test(original)) {
      return 'pt';
    }

    if (
      /\b(?:voce|obrigado|madeira|ouro|pedra|comida|agora|aqui|esquerda|direita|inimigo|ataca|ajuda)\b/u.test(
        normalized
      )
    ) {
      return 'pt';
    }

    return null;
  }

  function buildChineseProfiles(rows) {
    const profiles = new Map();

    for (const row of rows) {
      if (row.kind !== 'player') {
        continue;
      }

      const id = String(row.playerId);

      const profile =
        profiles.get(id) ??
        {
          playerName: row.playerName,
          hasHanName: hasStrongHanName(row.playerName),
          hanMessageCount: 0,
          confidentPinyinCount: 0,
          hasChineseContext: false,
        };

      const input = translationInput(row).trim();

      if (containsHan(input)) {
        profile.hanMessageCount += 1;
      }

      profiles.set(id, profile);
    }

    for (const profile of profiles.values()) {
      profile.hasChineseContext =
        profile.hasHanName ||
        profile.hanMessageCount > 0;
    }

    return profiles;
  }

  function enrichChineseProfiles(rows) {
    for (const row of rows) {
      if (row.kind !== 'player') {
        continue;
      }

      const id = String(row.playerId);

      const profile =
        state.ai.chineseProfiles.get(id) ??
        {
          playerName: row.playerName,
          hasHanName: hasStrongHanName(row.playerName),
          hanMessageCount: 0,
          confidentPinyinCount: 0,
          hasChineseContext: false,
        };

      const input = translationInput(row).trim();

      const candidates =
        state.ai.detectionCache.get(
          input.toLowerCase()
        ) ??
        [];

      const pinyinCandidate =
        candidates.find(
          (candidate) =>
            candidate.language === 'zh-Latn'
        );

      if (
        pinyinCandidate &&
        pinyinCandidate.confidence >= 0.55
      ) {
        profile.confidentPinyinCount += 1;
      }

      profile.hasChineseContext =
        profile.hasHanName ||
        profile.hanMessageCount > 0 ||
        profile.confidentPinyinCount > 0;

      state.ai.chineseProfiles.set(id, profile);
    }
  }

  function containsHan(text) {
    return /\p{Script=Han}/u.test(
      String(text ?? '')
    );
  }

  function hasStrongHanName(name) {
    const meaningful =
      [...String(name ?? '')].filter(
        (character) =>
          /[\p{L}\p{N}]/u.test(
            character
          )
      );

    if (meaningful.length < 2) {
      return false;
    }

    const hanCount =
      meaningful.filter(
        (character) =>
          /\p{Script=Han}/u.test(
            character
          )
      ).length;

    return (
      hanCount >= 2 &&
      hanCount /
        meaningful.length >=
        0.70
    );
  }

  function hasNonEnglishLookingLatinToken(text) {
    const tokens =
      fold(text).match(
        /[a-z]+/g
      ) ??
      [];

    if (tokens.length < 2) {
      return false;
    }

    return tokens.some(
      (token) =>
        !COMMON_ENGLISH_CHAT_WORDS.has(
          token
        )
    );
  }

  async function getDetector() {
    if (state.ai.detector) return state.ai.detector;

    if (!state.ai.detectorPromise) {
      state.ai.detectorPromise = LanguageDetector.create({
        monitor(monitor) {
          monitor.addEventListener('downloadprogress', (event) => {
            setStatus(`Downloading language detector… ${Math.floor(event.loaded * 100)}%`);
          });
        },
      });
    }

    try {
      state.ai.detector = await state.ai.detectorPromise;
      return state.ai.detector;
    } catch (error) {
      state.ai.detectorPromise = null;
      throw error;
    }
  }

  async function detectPlayerLanguages(detector, rows) {
    const corpora = new Map();

    for (const row of rows) {
      const input = translationInput(row).trim();
      if (!input) continue;

      const id = String(row.playerId);
      if (!corpora.has(id)) corpora.set(id, []);
      corpora.get(id).push(input);
    }

    state.ai.fallbackLanguage = await detectBest(
      detector,
      [...corpora.values()].flat().join('\n')
    );

    const result = new Map();

    for (const [id, lines] of corpora) {
      const detected = await detectBest(detector, lines.join('\n'));
      result.set(
        id,
        detected?.confidence >= CFG.minConfidence
          ? detected
          : state.ai.fallbackLanguage
      );
    }

    return result;
  }

  async function detectCandidates(detector, corpus) {
    const text = String(corpus ?? '').trim();
    if (text.length < CFG.minCorpusLength) return [];

    const results = await detector.detect(text);

    return results
      .map((candidate) => ({
        language: normalizeLanguage(candidate.detectedLanguage),
        confidence: Number(candidate.confidence ?? 0),
      }))
      .filter((candidate) => candidate.language && candidate.language !== 'und');
  }

  async function detectBest(detector, corpus) {
    const candidates = await detectCandidates(detector, corpus);
    return candidates[0] ?? null;
  }

  function normalizeLanguage(code) {
    const text = String(code ?? '').trim();
    if (!text) return null;
    if (/^zh-latn/i.test(text)) return 'zh-Latn';
    if (/^zh-(tw|hant)/i.test(text)) return 'zh-Hant';
    if (/^zh/i.test(text)) return 'zh';
    if (/^he(?:-|$)/i.test(text)) return 'iw';
    return text.split('-')[0].toLowerCase();
  }

  async function getTranslator(source) {
    if (state.ai.translators.has(source)) return state.ai.translators.get(source);
    if (state.ai.translatorPromises.has(source)) return state.ai.translatorPromises.get(source);

    const promise = Translator.create({
      sourceLanguage: source,
      targetLanguage: CFG.target,
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          setStatus(
            `Downloading ${languageName(source)} → English model… ${Math.floor(
              event.loaded * 100
            )}%`
          );
        });
      },
    });

    state.ai.translatorPromises.set(source, promise);

    try {
      const translator = await promise;
      state.ai.translators.set(source, translator);
      return translator;
    } catch (error) {
      state.ai.translatorPromises.delete(source);
      throw error;
    }
  }

  async function translateCached(source, text) {
    const key = `${source}|${CFG.target}|${text}`;
    if (state.ai.cache.has(key)) return state.ai.cache.get(key);

    const translator = await getTranslator(source);
    const english = String(await translator.translate(text)).trim();
    state.ai.cache.set(key, english);
    return english;
  }

    function findSuspiciousUntranslatedTokens(
    source,
    translation,
    row
  ) {
    if (
      !row.detectedLanguage ||
      row.detectedLanguage === CFG.target ||
      row.detectedLanguage === 'zh-Latn'
    ) {
      return [];
    }

    const sourceTokens =
      String(source ?? '')
        .toLowerCase()
        .match(/[\p{L}\p{N}]+/gu) ??
      [];

    const translatedTokens =
      new Set(
        String(translation ?? '')
          .toLowerCase()
          .match(/[\p{L}\p{N}]+/gu) ??
        []
      );

    return sourceTokens.filter(
      (token) =>
        token.length >= 3 &&
        translatedTokens.has(token) &&
        !SHARED_TRANSLATION_TOKENS.has(token) &&
        !looksLikePlayerNameToken(
          token,
          row.playerName
        )
    );
  }

  function looksLikePlayerNameToken(
    token,
    playerName
  ) {
    return String(playerName ?? '')
      .toLowerCase()
      .includes(token);
  }

  function assessTranslationUncertainty(source, translation, row) {
    const original = String(source ?? '').trim();
    const english = String(translation ?? '').trim();
    if (!original || !english) return null;

    const words = original.match(/[\p{L}\p{N}]+/gu) ?? [];
    const reasons = [];

    const suspiciousTokens = words.filter((word) => {
      const lower = word.toLowerCase();

      const suspiciousShortAccentedToken =
        word.length <= 2 &&
        containsNonAscii(word) &&
        !COMMON_SHORT_NON_ASCII_WORDS.has(lower);

      const mixedLettersAndNumbers = /(?:\p{L}\d|\d\p{L})/u.test(word);
      const excessiveRepeatedCharacters = /(.)\1{3,}/iu.test(word);

      return (
        suspiciousShortAccentedToken ||
        mixedLettersAndNumbers ||
        excessiveRepeatedCharacters
      );
    });

    const possibleEncodingIssue = /(?:�|Ã|Â)/u.test(original);
    const isShort = words.length <= 4 || original.length <= 24;

    const untranslatedTokens =
      findSuspiciousUntranslatedTokens(
        original,
        english,
        row
      );

    if (suspiciousTokens.length) reasons.push('Possible typo or shorthand');
    if (possibleEncodingIssue) reasons.push('Possible text encoding issue');
    if (untranslatedTokens.length) {
      reasons.push(
        `Possible untranslated slang or shorthand: ${untranslatedTokens.join(', ')}`
      );
    }

    if (row.translationRoute === 'romanized-chinese') {
      reasons.push('Romanized Chinese can be ambiguous');
    }

    if (isShort && reasons.length) reasons.unshift('Short informal message');
    if (!reasons.length) return null;

    return {
      reasons,
      message: 'Local translation may be unreliable.',
    };
  }

  function unresolvedTranslationWarning(row) {
    if (
      row.translationRoute === 'pinyin-google'
    ) {
      return {
        reasons: [
          'Chrome detected romanized Chinese, but its local translator does not support Pinyin transliteration',
        ],
        message: 'Use Google Translate for this Pinyin message.',
      };
    }

    return null;
  }

  function isEffectivelySame(left, right) {
    return normalizeForComparison(left) === normalizeForComparison(right);
  }

  function containsNonAscii(text) {
    return [...String(text)].some((character) => character.codePointAt(0) > 127);
  }

  function normalizeForComparison(text) {
    return String(text)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^\p{L}\p{N}]+/gu, '')
      .toLowerCase();
  }

  function googleTranslateUrl(text, sourceLanguage = 'auto') {
    const url = new URL('https://translate.google.com/');
    url.searchParams.set('sl', sourceLanguage);
    url.searchParams.set('tl', 'en');
    url.searchParams.set('text', String(text ?? ''));
    url.searchParams.set('op', 'translate');
    return url.href;
  }

  function isChineseFallbackCandidate(row) {
    if (!row || row.kind !== 'player') return false;

    const input = translationInput(row).trim();

    return (
      containsHan(input) ||
      row.translationRoute === 'pinyin-google' ||
      row.detectedLanguage === 'zh-Latn'
    );
  }

  function googleTranslateSourceForRow(row) {
    return isChineseFallbackCandidate(row)
      ? 'zh-CN'
      : 'auto';
  }

  function buildTranslationSummary(rows, translatedCount, failed) {
    const counts = new Map();

    for (const row of rows) {
      if (row.translationSource !== 'native' || !row.detectedLanguage) continue;
      counts.set(row.detectedLanguage, (counts.get(row.detectedLanguage) ?? 0) + 1);
    }

    const languageParts = [...counts].map(
      ([language, count]) =>
        `${count} ${languageName(language)} message${count === 1 ? '' : 's'}`
    );

    const tauntCount = state.rows.filter((row) => row.taunt).length;
    const unresolvedCount = rows.filter(
      (row) => row.translationAttempted && !row.translation && row.translationWarning
    ).length;

    const parts = [
      translatedCount
        ? `Translated ${translatedCount} message${translatedCount === 1 ? '' : 's'} locally`
        : 'No non-English messages were confidently translated',
    ];

    if (languageParts.length) parts.push(languageParts.join(', '));
    if (unresolvedCount) {
      parts.push(`${unresolvedCount} message${unresolvedCount === 1 ? '' : 's'} need review`);
    }
    if (tauntCount) parts.push(`${tauntCount} taunt${tauntCount === 1 ? '' : 's'} decoded`);
    if (failed.size) {
      parts.push(`Retry model download: ${[...failed].map(languageName).join(', ')}`);
    }

    return parts.join(' · ');
  }

  function languageName(code) {
    return LANGUAGE_NAMES.get(code) ?? code;
  }

  function seekReplay(timeMs) {
    const scrubber = document.querySelector('minimap-replay .minimap-replay-scrubber');

    if (!scrubber) {
      setStatus('Could not find the replay timeline.');
      return;
    }

    const safeTime = Math.max(
      Number(scrubber.min) || 0,
      Math.min(Number(scrubber.max) || timeMs, timeMs)
    );

    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;

    valueSetter?.call(scrubber, String(safeTime));
    scrubber.dispatchEvent(new Event('input', { bubbles: true }));
    scrubber.dispatchEvent(new Event('change', { bubbles: true }));

    setStatus(`Replay moved to ${formatTime(safeTime)}.`);
  }

  function ensureLauncher() {
    if (state.ui.launcher) return;

    const button = document.createElement('button');
    button.id = 'aoe-chat-launcher';
    button.textContent = 'AoE Chat: waiting…';
    button.onclick = () => {
      ensurePanel();
      state.ui.panel.classList.toggle('open');
    };

    document.body.append(button);
    state.ui.launcher = button;
  }

  function ensurePanel() {
    if (state.ui.panel) return;

    const panel = document.createElement('section');
    panel.id = 'aoe-chat-panel';
    panel.innerHTML = `
      <div class="aoe-head">
        <div>
          <strong>AoE2 Chat Replay</strong>
          <div class="aoe-subtitle">Click any row to jump to that moment</div>
        </div>
        <button class="aoe-close" title="Close">×</button>
      </div>
      <div class="aoe-controls"></div>
      <div class="aoe-actions"></div>
      <div class="aoe-status"></div>
      <div class="aoe-list"></div>
    `;

    panel.querySelector('.aoe-close').onclick = () => panel.classList.remove('open');

    const controls = panel.querySelector('.aoe-controls');
    controls.append(
      controlGroup(
        'Include',
        checkbox('System messages', state.filter.system, (value) => {
          state.filter.system = value;
          render();
        }),
        checkbox('All-chat', state.filter.allChat, (value) => {
          state.filter.allChat = value;
          render();
        }),
        checkbox('Hide pure taunts', state.filter.hideTaunts, (value) => {
          state.filter.hideTaunts = value;
          render();
        })
      ),
      controlGroup(
        'Team',
        select(
          [
            ['all', 'Both teams'],
            ['1', 'Team 1'],
            ['2', 'Team 2'],
          ],
          state.filter.team,
          (value) => {
            state.filter.team = value;
            render();
          }
        )
      ),
      controlGroup(
        'Display',
        select(
          [
            ['both', 'Original + English'],
            ['english', 'English only'],
            ['original', 'Original only'],
          ],
          state.filter.mode,
          (value) => {
            state.filter.mode = value;
            render();
          }
        )
      )
    );

    const actions = panel.querySelector('.aoe-actions');
    const translate = button('Translate locally', translateLocally, 'primary');
    actions.append(translate);

    document.body.append(panel);

    state.ui = {
      ...state.ui,
      panel,
      list: panel.querySelector('.aoe-list'),
      status: panel.querySelector('.aoe-status'),
      translate,
    };

    updateTranslateButton();
  }

  function render() {
    if (!state.ui.list) return;

    const rows = visibleRows();
    state.ui.list.replaceChildren();

    for (const row of rows) {
      const article = document.createElement('article');
      article.className =
        `aoe-row ${row.kind}` +
        `${row.taunt ? ' has-taunt' : ''}` +
        `${row.systemType === 'resign' || row.systemType === 'disconnect' ? ' is-resign' : ''}`;

      article.style.setProperty('--aoe-player-color', row.playerColor ?? '#7E8A99');
      article.tabIndex = 0;
      article.title = `Jump replay to ${formatTime(row.timeMs)}`;

      const jump = () => seekReplay(Math.max(0, row.timeMs - CFG.seekLeadMs));
      article.onclick = jump;
      article.onkeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          jump();
        }
      };

      const meta = document.createElement('div');
      meta.className = 'aoe-meta';
      meta.append(span(formatTime(row.timeMs)), badge(row));

      if (row.kind === 'player') {
        meta.append(strong(row.playerName), googleFallbackLink(row));
      }

      if (row.taunt) meta.append(tag('TAUNT', 'taunt-tag'));
      if (row.translationRoute === 'pinyin-google') {
        meta.append(tag('PINYIN', 'pinyin-tag'));
      }
      if (row.systemType === 'resign') meta.append(tag('RESIGNED', 'event-tag'));
      if (row.systemType === 'disconnect') meta.append(tag('DISCONNECTED', 'event-tag'));

      article.append(meta);

      if (row.kind === 'system') article.append(messageLine(row.text));
      else appendPlayerLines(article, row);

      state.ui.list.append(article);
    }

    if (!state.ai.busy) {
      setStatus(
        state.ai.summary ||
          `${rows.length} visible entries · ${state.rows.length} total after deduplication`
      );
    }
  }

  function visibleRows() {
    return state.rows.filter((row) => {
      if (!state.filter.system && row.kind === 'system') return false;
      if (!state.filter.allChat && row.channel === 'all') return false;
      if (state.filter.team !== 'all' && String(row.team) !== state.filter.team) return false;
      if (state.filter.hideTaunts && row.taunt && !row.taunt.remainder) return false;
      return true;
    });
  }

  function appendPlayerLines(article, row) {
    const mode = state.filter.mode;

    if (state.filter.hideTaunts && row.taunt) {
      article.append(messageLine(row.text));
      appendTranslationWarning(article, row);
      return;
    }

    if (mode === 'original') {
      article.append(messageLine(row.text));
      return;
    }

    if (mode === 'both') article.append(messageLine(row.text));

    if (row.taunt) {
      article.append(tauntLine(row, mode === 'both'));
      appendTranslationWarning(article, row);
      return;
    }

    if (row.translation) {
      article.append(
        messageLine(`${mode === 'both' ? '→ ' : ''}${row.translation}`, 'translation')
      );
      appendTranslationWarning(article, row);
      return;
    }

    if (mode === 'english') article.append(messageLine(row.text));
    appendTranslationWarning(article, row);
  }

  function appendTranslationWarning(article, row) {
    if (!row.translationWarning) return;

    const details = document.createElement('details');
    details.className = 'aoe-translation-warning';
    details.addEventListener('click', (event) => event.stopPropagation());
    details.addEventListener('keydown', (event) => event.stopPropagation());

    const summary = document.createElement('summary');
    summary.className = 'aoe-warning-summary';
    summary.title = 'Translation may be unreliable';
    summary.setAttribute('aria-label', 'Show translation warning');
    summary.textContent = '⚠';

    const body = document.createElement('div');
    body.className = 'aoe-warning-body';

    const message = document.createElement('div');
    message.className = 'aoe-warning-message';
    message.textContent = row.translationWarning.message;

    const reasons = document.createElement('div');
    reasons.className = 'aoe-warning-details';
    reasons.textContent = row.translationWarning.reasons.join(' · ');

    const link = document.createElement('a');
    link.className = 'aoe-google-translate-link';
    link.href = googleTranslateUrl(
      translationInput(row),
      googleTranslateSourceForRow(row)
    );
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Check with Google Translate';
    link.addEventListener('click', (event) => event.stopPropagation());

    body.append(message, reasons, link);
    details.append(summary, body);
    article.append(details);
  }

  function googleFallbackLink(row) {
    const link = document.createElement('a');
    const chineseFallback = isChineseFallbackCandidate(row);

    link.className =
      'aoe-google-fallback' +
      (chineseFallback ? ' is-recommended' : '');

    link.href = googleTranslateUrl(
      row.text,
      googleTranslateSourceForRow(row)
    );

    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    link.title = chineseFallback
      ? 'Check likely romanized Chinese with Google Translate'
      : 'Check original message with Google Translate';

    link.setAttribute(
      'aria-label',
      link.title
    );

    link.textContent =
      row.translationRoute === 'pinyin-google'
        ? 'Translate Pinyin with Google ↗'
        : chineseFallback
          ? 'Check Google (Chinese) ↗'
          : 'Check Google ↗';

    link.addEventListener('click', (event) => event.stopPropagation());
    link.addEventListener('keydown', (event) => event.stopPropagation());

    return link;
  }

  function tauntLine(row, withArrow) {
    const line = document.createElement('div');
    line.className = 'aoe-message translation taunt-message';

    if (withArrow) line.append(document.createTextNode('→ '));

    const code = document.createElement('span');
    code.className = 'taunt-code';
    code.textContent = `${row.taunt.number}:`;

    const label = document.createElement('em');
    label.className = 'taunt-label';
    label.textContent = `(${row.taunt.label})`;

    line.append(code, document.createTextNode(' '), label);

    const remainder = row.translation ?? row.taunt.remainder;
    if (remainder) line.append(document.createTextNode(` ${remainder}`));

    return line;
  }

  function controlGroup(labelText, ...children) {
    const group = document.createElement('div');
    group.className = 'aoe-control-group';

    const label = document.createElement('div');
    label.className = 'aoe-control-label';
    label.textContent = labelText;

    const body = document.createElement('div');
    body.className = 'aoe-control-body';
    body.append(...children);

    group.append(label, body);
    return group;
  }

  function checkbox(labelText, checked, onchange) {
    const wrapper = document.createElement('label');
    wrapper.className = 'aoe-checkbox';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.onchange = () => onchange(input.checked);

    const text = document.createElement('span');
    text.textContent = labelText;

    wrapper.append(input, text);
    return wrapper;
  }

  function select(options, value, onchange) {
    const element = document.createElement('select');

    for (const [key, label] of options) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = label;
      element.append(option);
    }

    element.value = value;
    element.onchange = () => onchange(element.value);
    return element;
  }

  function button(labelText, onclick, className = '') {
    const element = document.createElement('button');
    element.textContent = labelText;
    element.className = className;
    element.onclick = onclick;
    return element;
  }

  function span(text) {
    const element = document.createElement('span');
    element.textContent = text;
    return element;
  }

  function strong(text) {
    const element = document.createElement('strong');
    element.textContent = text;
    return element;
  }

  function tag(text, className) {
    const element = document.createElement('span');
    element.className = className;
    element.textContent = text;
    return element;
  }

  function messageLine(text, className = '') {
    const div = document.createElement('div');
    div.className = `aoe-message ${className}`.trim();
    div.textContent = text;
    return div;
  }

  function badge(row) {
    const element = span(badgeText(row));
    element.className = `aoe-badge ${row.channel}`;
    return element;
  }

  function badgeText(row) {
    if (row.kind === 'system') return 'SYSTEM';
    if (row.channel === 'all') return 'ALL';
    return `T${row.team ?? '?'}`;
  }

  function formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function setLauncher(text) {
    if (state.ui.launcher) state.ui.launcher.textContent = text;
  }

  function setStatus(text) {
    if (state.ui.status) state.ui.status.textContent = text;
  }

  function updateTranslateButton() {
    if (!state.ui.translate) return;
    state.ui.translate.disabled = state.ai.busy;
    state.ui.translate.textContent = state.ai.busy ? 'Translating…' : 'Translate locally';
  }

  function addStyles() {
    const style = document.createElement('style');

    style.textContent = `
      .aoe-hide-native-chat-overlay .minimap-replay-chat-overlay {
        display: none !important;
      }

      #aoe-chat-launcher {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483646;
        border: 1px solid #5e6878;
        border-radius: 8px;
        padding: 10px 14px;
        background: #20252d;
        color: #f5f7fa;
        font: 600 14px system-ui, sans-serif;
        cursor: pointer;
        box-shadow: 0 8px 24px #0006;
      }

      #aoe-chat-panel {
        display: none;
        position: fixed;
        top: 18px;
        right: 18px;
        bottom: 72px;
        z-index: 2147483647;
        width: min(620px, calc(100vw - 36px));
        overflow: hidden;
        border: 1px solid #5e6878;
        border-radius: 12px;
        background: #20252d;
        color: #f5f7fa;
        font: 14px/1.45 system-ui, sans-serif;
        box-shadow: 0 14px 38px #0008;
      }

      #aoe-chat-panel.open {
        display: flex;
        flex-direction: column;
      }

      .aoe-head,
      .aoe-controls,
      .aoe-actions,
      .aoe-status {
        padding: 11px 13px;
        border-bottom: 1px solid #3d4654;
      }

      .aoe-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .aoe-head strong {
        font-size: 17px;
      }

      .aoe-subtitle {
        margin-top: 2px;
        color: #9ea9b7;
        font-size: 12px;
      }

      .aoe-close {
        border: 0;
        background: transparent;
        color: #f5f7fa;
        font-size: 26px;
        line-height: 1;
        cursor: pointer;
      }

      .aoe-controls {
        display: grid;
        gap: 10px;
        background: #282f39;
      }

      .aoe-control-group {
        display: grid;
        grid-template-columns: 72px minmax(0, 1fr);
        gap: 10px;
        align-items: center;
      }

      .aoe-control-label {
        color: #9ea9b7;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .aoe-control-body {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 12px;
        align-items: center;
      }

      .aoe-checkbox {
        display: inline-flex;
        gap: 6px;
        align-items: center;
        cursor: pointer;
      }

      .aoe-checkbox input {
        accent-color: #3f8bd1;
      }

      .aoe-actions {
        display: flex;
        gap: 8px;
        background: #252b34;
      }

      .aoe-actions button,
      .aoe-controls select {
        border: 1px solid #5e6878;
        border-radius: 6px;
        padding: 7px 9px;
        background: #171b21;
        color: #f5f7fa;
      }

      .aoe-actions button {
        cursor: pointer;
      }

      .aoe-actions button:disabled {
        cursor: wait;
        opacity: 0.65;
      }

      .aoe-actions .primary {
        background: #244f78;
      }

      .aoe-status {
        color: #b9c2cf;
        font-size: 12px;
      }

      .aoe-list {
        overflow: auto;
        flex: 1;
      }

      .aoe-row {
        position: relative;
        padding: 10px 13px 10px 15px;
        border-bottom: 1px solid #323a46;
        border-left: 3px solid var(--aoe-player-color, #7E8A99);
        cursor: pointer;
        transition: background 120ms ease, box-shadow 120ms ease;
      }

      .aoe-row:hover,
      .aoe-row:focus-visible {
        background: #303946;
        box-shadow: inset 3px 0 0 var(--aoe-player-color, #5ca7e8);
        outline: none;
      }

      .aoe-row.system {
        color: #b9c2cf;
        background: #252b34;
      }

      .aoe-row.system:hover,
      .aoe-row.system:focus-visible {
        background: #303946;
      }

      .aoe-row.has-taunt {
        background: linear-gradient(90deg, #3a312055, transparent 62%);
      }

      .aoe-row.has-taunt:hover,
      .aoe-row.has-taunt:focus-visible {
        background: linear-gradient(90deg, #4b402b, #303946 72%);
      }

      .aoe-row.is-resign {
        background: linear-gradient(90deg, #4b252544, transparent 72%);
      }

      .aoe-meta {
        display: flex;
        gap: 8px;
        align-items: baseline;
        margin-bottom: 3px;
        color: #b9c2cf;
        font-size: 12px;
      }

      .aoe-meta strong {
        color: var(--aoe-player-color, #f5f7fa);
      }

      .aoe-badge,
      .taunt-tag,
      .pinyin-tag,
      .event-tag {
        border-radius: 4px;
        padding: 1px 5px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.04em;
      }

      .aoe-badge.team {
        background: #224a76;
        color: #d6ebff;
      }

      .aoe-badge.all {
        background: #6a4820;
        color: #ffe6b8;
      }

      .aoe-badge.system {
        background: #414a57;
        color: #dae0e8;
      }

      .taunt-tag {
        background: #65491f;
        color: #ffe4a1;
      }

      .pinyin-tag {
        background: #3e5f72;
        color: #cceeff;
      }

      .event-tag {
        background: #693434;
        color: #ffd0d0;
      }

      .aoe-message {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        user-select: text;
      }

      .aoe-message.translation {
        margin-top: 2px;
        color: #b8e1b8;
      }

      .taunt-message {
        color: #f1d79a;
      }

      .taunt-code {
        font-weight: 800;
      }

      .taunt-label {
        color: #ffe2a7;
      }

      .aoe-translation-warning {
        display: inline-block;
        margin-top: 6px;
      }

      .aoe-warning-summary {
        display: inline-flex;
        width: 22px;
        height: 22px;
        align-items: center;
        justify-content: center;
        border: 1px solid #6d5a31;
        border-radius: 50%;
        background: #3b321f;
        color: #ffd66b;
        cursor: pointer;
        font-size: 13px;
        line-height: 1;
        list-style: none;
        user-select: none;
      }

      .aoe-warning-summary::-webkit-details-marker {
        display: none;
      }

      .aoe-warning-summary:hover,
      .aoe-warning-summary:focus-visible {
        border-color: #a58a4c;
        background: #4a3f28;
        outline: none;
      }

      .aoe-warning-body {
        display: grid;
        gap: 5px;
        max-width: 460px;
        margin-top: 6px;
        padding: 8px 9px;
        border: 1px solid #6d5a31;
        border-radius: 6px;
        background: #3b321f;
        color: #f4d991;
        font-size: 12px;
        line-height: 1.4;
      }

      .aoe-warning-message {
        font-weight: 700;
      }

      .aoe-warning-details {
        color: #c9b787;
        font-size: 11px;
      }

      .aoe-google-translate-link {
        width: fit-content;
        color: #9fc8ff;
        font-weight: 700;
        text-decoration: none;
      }

      .aoe-google-translate-link:hover,
      .aoe-google-translate-link:focus-visible {
        color: #d0e4ff;
        text-decoration: underline;
      }

      .aoe-google-fallback {
        margin-left: auto;
        color: #9fc8ff;
        font-size: 11px;
        font-weight: 700;
        opacity: 0;
        text-decoration: none;
        transition: opacity 120ms ease, color 120ms ease;
      }

      .aoe-row:hover .aoe-google-fallback,
      .aoe-row:focus-within .aoe-google-fallback,
      .aoe-google-fallback.is-recommended {
        opacity: 1;
      }

      .aoe-google-fallback.is-recommended {
        color: #ffd66b;
      }

      .aoe-google-fallback:hover,
      .aoe-google-fallback:focus-visible {
        color: #d0e4ff;
        text-decoration: underline;
      }
    `;

    document.head.append(style);
  }
})();
