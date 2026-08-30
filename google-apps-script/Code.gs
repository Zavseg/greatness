/**
 * GREATNESS Contracts API
 *
 * Google Apps Script Web App used as the shared backend for the GREATNESS site.
 * The Google Sheet is the source of truth. Website visitors do not need access
 * to the spreadsheet and do not need to sign in to Google.
 */

const CONFIG = {
  SPREADSHEET_ID: '1Ju6jq8ehrc8n-xwM1jQoa1d65LY2mVvIAiFmI1HP3aE',
  SHEET_NAME: 'Contracts',
  CATALOG_SHEET_NAME: 'Contract Catalog'
};

const CATALOG_HEADERS = [
  'Contract',
  'Base Name',
  'Level',
  'Compensation',
  'Reputation',
  'Experience',
  'Confirmed Count',
  'Last Seen',
  'Source',
  'OCR Aliases'
];

const VERIFIED_CATALOG_SEED = [
  ['Продаж трофеїв II', 'Продаж трофеїв', 'II', 140000, 150, 130, 1, new Date(), 'verified-screenshot', ''],
  ["Переробка м'яса II", "Переробка м'яса", 'II', 230000, 210, 160, 1, new Date(), 'verified-screenshot', '']
];

const HEADERS = [
  'Entry ID',
  'Completed At',
  'Display Date',
  'Contract',
  'Compensation',
  'Reputation',
  'Experience',
  'Participants JSON',
  'Contract Share',
  'Payout Per Player',
  'Paid By Player JSON',
  'Source',
  'Created At',
  'Updated At'
];

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'health');
    if (action === 'health') {
      return apiResponse({ ok: true, service: 'GREATNESS Contracts API', version: '1.12.1' }, e);
    }
    return apiResponse({ ok: false, error: 'POST required' }, e);
  } catch (error) {
    return apiResponse({ ok: false, error: String(error) }, e);
  }
}

function doPost(e) {
  // Vision remains a separate server-to-server path with its own proxy token.
  if (e && e.parameter && String(e.parameter.action || '') === 'vision') {
    return handleVisionRequest(e);
  }

  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!verifyGasServiceToken(String(payload.serviceToken || ''))) {
      return jsonResponse({ ok: false, error: 'Unauthorized' });
    }

    const action = String(payload.action || '');

    if (action === 'list') {
      return jsonResponse({ ok: true, entries: readAllEntries() });
    }
    if (action === 'catalog') {
      return jsonResponse({ ok: true, catalog: readContractCatalog() });
    }

    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(20000);

      if (action === 'upsert') {
        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        if (entries.length !== 1) return jsonResponse({ ok: false, error: 'Exactly one entry is required' });
        const result = upsertEntries(entries);
        learnCatalogFromEntries(entries);
        auditMutation('upsert', entries.map(x => String(x.id || '')));
        return jsonResponse({ ok: true, ...result });
      }

      if (action === 'delete') {
        const ids = Array.isArray(payload.ids) ? payload.ids.map(String) : [];
        if (ids.length !== 1) return jsonResponse({ ok: false, error: 'Exactly one id is required' });
        const deleted = deleteEntries(ids);
        auditMutation('delete', ids);
        return jsonResponse({ ok: true, deleted });
      }

      return jsonResponse({ ok: false, error: 'Unknown POST action' });
    } finally {
      try { lock.releaseLock(); } catch (_) {}
    }
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) });
  }
}

function verifyGasServiceToken(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('GAS_SERVICE_TOKEN') || '';
  return Boolean(expected) && constantTimeEquals(String(token || ''), expected);
}

function constantTimeEquals(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function auditMutation(action, ids) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName('Contract Audit Log');
  if (!sheet) {
    sheet = ss.insertSheet('Contract Audit Log');
    sheet.appendRow(['Timestamp', 'Action', 'Entry IDs']);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([new Date(), String(action), (ids || []).join(', ')]);
}

function getContractsSheet() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
  }

  ensureHeaders(sheet);
  return sheet;
}


function getContractCatalogSheet() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(CONFIG.CATALOG_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.CATALOG_SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, CATALOG_HEADERS.length).setValues([CATALOG_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(2, 1, VERIFIED_CATALOG_SEED.length, CATALOG_HEADERS.length).setValues(VERIFIED_CATALOG_SEED);
  } else {
    const current = sheet.getRange(1, 1, 1, CATALOG_HEADERS.length).getValues()[0];
    const differs = CATALOG_HEADERS.some((header, index) => current[index] !== header);
    if (differs) {
      sheet.getRange(1, 1, 1, CATALOG_HEADERS.length).setValues([CATALOG_HEADERS]);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function readContractCatalog() {
  const sheet = getContractCatalogSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, CATALOG_HEADERS.length).getValues()
    .filter(row => String(row[0] || '').trim())
    .map(row => ({
      contractName: String(row[0] || ''),
      baseName: String(row[1] || ''),
      level: String(row[2] || ''),
      compensation: Number(row[3] || 0),
      reputation: Number(row[4] || 0),
      experience: Number(row[5] || 0),
      confirmedCount: Number(row[6] || 0),
      lastSeen: row[7] instanceof Date ? row[7].toISOString() : String(row[7] || ''),
      source: String(row[8] || ''),
      aliases: String(row[9] || '').split('||').map(value => value.trim()).filter(Boolean)
    }));
}

function splitContractName(name) {
  const match = String(name || '').trim().match(/^(.*?)(?:\s+([IV]{1,3}))$/i);
  return {
    baseName: String((match && match[1]) || name || '').trim(),
    level: String((match && match[2]) || '').toUpperCase()
  };
}

/**
 * Every real saved contract teaches the OCR catalog. We keep one row per exact contract name
 * and preserve the latest confirmed reward tuple. No value is generated unless it came from
 * a saved journal entry or the two explicitly verified seed screenshots.
 */
function learnCatalogFromEntries(entries) {
  const validEntries = (Array.isArray(entries) ? entries : []).filter(entry =>
    String(entry.contractName || '').trim() && Number(entry.compensation || 0) > 0
  );
  if (!validEntries.length) return;

  const sheet = getContractCatalogSheet();
  const rows = sheet.getLastRow() >= 2
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, CATALOG_HEADERS.length).getValues()
    : [];
  const catalogKey = name => {
    const parts = splitContractName(name);
    return `${String(parts.baseName || '').trim().toLowerCase()}::${String(parts.level || '').toUpperCase()}`;
  };

  const byName = new Map();
  rows.forEach((row, index) => {
    const name = String(row[0] || '').trim();
    if (name) byName.set(catalogKey(name), { rowNumber: index + 2, row });
  });

  validEntries.forEach(entry => {
    const rawContractName = String(entry.contractName || '').trim();
    const parts = splitContractName(rawContractName);
    // Store a canonical Roman suffix so I / II / III stay separate and predictable in the catalog.
    const contractName = parts.level ? `${parts.baseName} ${parts.level}`.trim() : rawContractName;
    const current = byName.get(catalogKey(contractName));
    const compensation = Number(entry.compensation || 0);
    const reputation = Number(entry.reputation || 0);
    const experience = Number(entry.experience || 0);
    const currentCompensation = Number((current && current.row[3]) || 0);
    const compensationConflict = Boolean(current && currentCompensation > 0 && compensation > 0 && currentCompensation !== compensation);
    // Never let one questionable OCR save silently rewrite a known I/II/III price.
    // The journal entry is still saved, but the shared learning catalog keeps the confirmed price.
    if (compensationConflict) {
      console.warn(`Catalog price conflict ignored for ${contractName}: known=${currentCompensation}, incoming=${compensation}`);
      return;
    }

    const nextCount = Number((current && current.row[6]) || 0) + 1;
    const existingAliases = String((current && current.row[9]) || '').split('||').map(value => value.trim()).filter(Boolean);
    const incomingAlias = String(entry.ocrAlias || '').trim();
    const aliases = [...new Set([...existingAliases, incomingAlias].filter(value => value && value !== contractName))];
    const row = [
      contractName,
      parts.baseName,
      parts.level,
      compensation,
      reputation,
      experience,
      nextCount,
      new Date(),
      'journal-confirmed',
      aliases.join('||')
    ];
    if (current) {
      sheet.getRange(current.rowNumber, 1, 1, CATALOG_HEADERS.length).setValues([row]);
      current.row = row;
    } else {
      sheet.appendRow(row);
      byName.set(catalogKey(contractName), { rowNumber: sheet.getLastRow(), row });
    }
  });
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    return;
  }

  const current = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const differs = HEADERS.some((header, index) => current[index] !== header);

  if (differs) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
}

function readAllEntries() {
  const sheet = getContractsSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  return rows
    .filter(row => String(row[0] || '').trim())
    .map(rowToEntry);
}

function upsertEntries(entries) {
  const sheet = getContractsSheet();
  const existing = readIndex(sheet);
  const now = new Date();
  let inserted = 0;
  let updated = 0;

  entries.forEach(entry => {
    const id = String(entry.id || '').trim();
    if (!id) throw new Error('Entry without id');

    const current = existing.get(id);
    const createdAt = current ? current.createdAt : now;
    const row = entryToRow(entry, createdAt, now);

    if (current) {
      sheet.getRange(current.rowNumber, 1, 1, HEADERS.length).setValues([row]);
      updated += 1;
    } else {
      sheet.appendRow(row);
      existing.set(id, { rowNumber: sheet.getLastRow(), createdAt });
      inserted += 1;
    }
  });

  return { inserted, updated, received: entries.length };
}

function deleteEntries(ids) {
  const sheet = getContractsSheet();
  const idSet = new Set(ids.map(String));
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const kept = rows.filter(row => !idSet.has(String(row[0] || '')));
  const deleted = rows.length - kept.length;

  if (!deleted) return 0;

  sheet.getRange(2, 1, lastRow - 1, HEADERS.length).clearContent();
  if (kept.length) {
    sheet.getRange(2, 1, kept.length, HEADERS.length).setValues(kept);
  }

  return deleted;
}

function readIndex(sheet) {
  const map = new Map();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return map;

  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  rows.forEach((row, index) => {
    const id = String(row[0] || '').trim();
    if (!id) return;
    map.set(id, {
      rowNumber: index + 2,
      createdAt: row[12] || new Date()
    });
  });
  return map;
}

function entryToRow(entry, createdAt, updatedAt) {
  const participants = Array.isArray(entry.participants) ? entry.participants : [];
  const paidByPlayer = entry.paidByPlayer && typeof entry.paidByPlayer === 'object'
    ? entry.paidByPlayer
    : Object.fromEntries(participants.map(nick => [nick, false]));

  return [
    String(entry.id || ''),
    entry.completedAt ? new Date(entry.completedAt) : '',
    String(entry.dateStr || ''),
    String(entry.contractName || ''),
    Number(entry.compensation || 0),
    Number(entry.reputation || 0),
    Number(entry.experience || 0),
    JSON.stringify(participants),
    Number(entry.sharePerPerson || (participants.length ? 1 / participants.length : 0)),
    Number(entry.payoutPerPerson || 0),
    JSON.stringify(paidByPlayer),
    String(entry.source || 'GREATNESS'),
    createdAt || new Date(),
    updatedAt || new Date()
  ];
}

function rowToEntry(row) {
  const participants = parseJsonArray(row[7]);
  const paidByPlayer = parseJsonObject(row[10]);
  const completedAt = row[1] instanceof Date ? row[1].toISOString() : String(row[1] || '');

  participants.forEach(nick => {
    if (!(nick in paidByPlayer)) paidByPlayer[nick] = false;
  });

  return {
    id: String(row[0] || ''),
    completedAt,
    isoDate: completedAt,
    dateStr: String(row[2] || ''),
    contractName: String(row[3] || ''),
    compensation: Number(row[4] || 0),
    reputation: Number(row[5] || 0),
    experience: Number(row[6] || 0),
    participants,
    sharePerPerson: Number(row[8] || (participants.length ? 1 / participants.length : 0)),
    payoutPerPerson: Number(row[9] || 0),
    paidByPlayer,
    source: String(row[11] || 'GREATNESS')
  };
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function parseJsonParameter(e, name, fallback) {
  try {
    const raw = e && e.parameter ? e.parameter[name] : '';
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function apiResponse(payload, e) {
  const callback = String((e && e.parameter && e.parameter.callback) || '').trim();
  if (callback && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
    return ContentService
      .createTextOutput(`${callback}(${JSON.stringify(payload)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonResponse(payload);
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * Multimodal screenshot reader. GEMINI_API_KEY must be stored in Script Properties,
 * never in the website bundle. The browser POSTs the image to this Apps Script web app;
 * the response page sends the structured result back to the parent with postMessage.
 */
function handleVisionRequest(e) {
  const requestId = String((e.parameter && e.parameter.requestId) || '');
  const proxyMode = String((e.parameter && e.parameter.proxyMode) || '');
  const expectedProxyToken = PropertiesService.getScriptProperties().getProperty('VISION_PROXY_TOKEN') || '';
  try {
    if (proxyMode === 'json' && String((e.parameter && e.parameter.proxyToken) || '') !== expectedProxyToken) {
      return jsonResponse({ ok: false, requestId: requestId, error: 'Unauthorized Vision proxy' });
    }
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured in Apps Script Properties');

    const parseImage = function(value, label) {
      const dataUrl = String(value || '');
      const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) throw new Error('Invalid ' + label + ' image payload');
      return { mimeType: match[1], data: match[2] };
    };

    const contextImage = parseImage(e.parameter && e.parameter.imageData, 'context');
    // Compatibility guard: an older/cached frontend may POST only imageData.
    // In that case do NOT fail the whole Vision request. Reuse the full image as
    // the detail source so date/title/compensation can still be extracted.
    const detailRaw = String((e.parameter && e.parameter.detailData) || '').trim();
    const legacyDetailRaw = String((e.parameter && e.parameter.compensationData) || '').trim();
    const detailImage = detailRaw
      ? parseImage(detailRaw, 'detail')
      : (legacyDetailRaw ? parseImage(legacyDetailRaw, 'legacy detail') : contextImage);

    const prompt = [
      'Read one GREATNESS organization contract screenshot and extract four fields.',
      'Use IMAGE 1 for the device date/time and overall context.',
      'Use IMAGE 2 for the active RIGHT contract details panel.',
      'date: visible Ukrainian weekday + day + month from the device status bar, or empty string.',
      'time: visible HH:MM from the device status bar, or empty string.',
      'contractName: exact LARGE BOLD title from the active RIGHT details panel, including Roman suffix I, II or III.',
      'compensation: digits only from the money value aligned with the label "Грошова компенсація" in that same RIGHT panel.',
      'Ignore account balance, progress, reputation, XP, timers, quantities, and every title in the center list.',
      'Do not explain anything. Return only the requested structured result.'
    ].join('\\n');

    const payload = {
      contents: [{ parts: [
        { text: prompt },
        { text: 'IMAGE 1 - complete screenshot:' },
        { inlineData: contextImage },
        { text: 'IMAGE 2 - active RIGHT details panel:' },
        { inlineData: detailImage }
      ] }],
      generationConfig: {
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingLevel: 'low' },
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            date: { type: 'STRING' },
            time: { type: 'STRING' },
            contractName: { type: 'STRING' },
            compensation: { type: 'INTEGER' }
          },
          required: ['date', 'time', 'contractName', 'compensation']
        }
      }
    };

    // Multi-model Vision fallback. Each Gemini model has its own free-tier quota,
    // so an exhausted or temporarily overloaded model should not block OCR.
    // Order is quality-first, then high-throughput Lite models.
    const models = [
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-3-flash-preview',
      'gemini-2.5-flash-lite'
    ];
    const retryableStatuses = { 429: true, 500: true, 502: true, 503: true, 504: true };
    const modelCache = CacheService.getScriptCache();
    let body = null;
    let lastModelError = '';
    let usedModel = '';

    for (let modelIndex = 0; modelIndex < models.length && !body; modelIndex++) {
      const model = models[modelIndex];
      const cacheKey = 'vision-model-blocked:' + model;

      // Avoid wasting calls on a model that just returned quota/high-demand errors.
      if (modelCache.get(cacheKey)) {
        continue;
      }

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(apiKey);

      // One quick retry for transient 5xx failures, then move to the next model.
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = UrlFetchApp.fetch(url, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });

        const status = response.getResponseCode();
        const responseText = response.getContentText();

        if (status >= 200 && status < 300) {
          body = JSON.parse(responseText);
          usedModel = model;
          break;
        }

        lastModelError = 'Gemini ' + model + ' HTTP ' + status + ': ' + responseText.slice(0, 700);

        if (status === 429) {
          // Could be RPM or RPD. Skip it for a few minutes so batch OCR does not
          // repeatedly hit the same exhausted model.
          modelCache.put(cacheKey, '429', 300);
          break;
        }

        if (status === 404) {
          // Model unavailable for this project/API version - just continue chain.
          modelCache.put(cacheKey, '404', 1800);
          break;
        }

        if (status >= 500 && status <= 504) {
          if (attempt === 0) {
            Utilities.sleep(1200);
            continue;
          }
          modelCache.put(cacheKey, String(status), 60);
          break;
        }

        // 4xx other than 429/404 usually means a real payload/config problem,
        // so do not hide it by cycling through every model.
        throw new Error(lastModelError);
      }
    }

    if (!body) {
      throw new Error(lastModelError || 'Gemini models returned no response');
    }
    const candidate = body && body.candidates && body.candidates[0];
    const parts = candidate && candidate.content && candidate.content.parts;
    const raw = (parts || [])
      .filter(function(part) { return part && !part.thought && part.text; })
      .map(function(part) { return String(part.text); })
      .join('\\n')
      .trim();
    if (!raw) {
      throw new Error('Gemini returned no final text. finishReason=' + String(candidate && candidate.finishReason || 'unknown'));
    }

    const parseStructured = function(rawText) {
      let cleaned = String(rawText || '').trim()
        .replace(/^```(?:json)?\\s*/i, '')
        .replace(/\\s*```$/i, '')
        .trim();
      try { return JSON.parse(cleaned); } catch (_) {}

      const startBrace = cleaned.indexOf('{');
      const endBrace = cleaned.lastIndexOf('}');
      if (startBrace >= 0 && endBrace > startBrace) {
        try { return JSON.parse(cleaned.slice(startBrace, endBrace + 1)); } catch (_) {}
      }

      // Last-resort parser for model prose around field/value lines.
      const value = function(names) {
        for (let i = 0; i < names.length; i++) {
          const re = new RegExp('(?:^|\\n)\\s*' + names[i] + '\\s*[:=]\\s*(.*?)(?=\\n|$)', 'i');
          const m = cleaned.match(re);
          if (m) return String(m[1] || '').trim().replace(/^['\"]|['\"]$/g, '');
        }
        return '';
      };
      const date = value(['date']);
      const time = value(['time']);
      const contractName = value(['contractName', 'title']);
      const compText = value(['compensation', 'comp']);
      const compDigits = compText.replace(/[^0-9]/g, '');
      if (date || time || contractName || compDigits) {
        return { date: date, time: time, contractName: contractName, compensation: compDigits ? Number(compDigits) : 0 };
      }
      throw new Error('Gemini returned unparseable final text: ' + cleaned.slice(0, 500));
    };

    const parsed = parseStructured(raw);
    const result = {
      date: String(parsed.date || '').trim(),
      time: String(parsed.time || '').trim(),
      contractName: String(parsed.contractName || '').trim(),
      compensation: Number(parsed.compensation || 0)
    };

    if (!result.date && !result.time && !result.contractName && !result.compensation) {
      throw new Error('Gemini returned empty structured result: ' + raw.slice(0, 500));
    }

    return proxyMode === 'json'
      ? jsonResponse({ ok: true, requestId: requestId, result: result })
      : visionBridgeResponse({ ok: true, requestId: requestId, result: result });
  } catch (error) {
    return proxyMode === 'json' ? jsonResponse({ ok: false, requestId: requestId, error: String(error) }) : visionBridgeResponse({ ok: false, requestId: requestId, error: String(error) });
  }
}

function visionBridgeResponse(payload) {
  const safe = JSON.stringify(payload).replace(/</g, '\\u003c');
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8"><script>' +
    '(function(){var m=' + safe + ';try{window.parent.postMessage(m,"*");}catch(e){}try{window.top.postMessage(m,"*");}catch(e){}})();' +
    '<\\/script>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
