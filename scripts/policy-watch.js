'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const POLICY_RULES_PATH = path.join(ROOT_DIR, 'policy_rules.json');
const REPORT_PATH = path.join(ROOT_DIR, 'policy_watch_report.json');
const CANDIDATE_PATH = path.join(ROOT_DIR, 'policy_rules_candidate.json');

const SOURCE_TYPES = Object.freeze({
  API: 'api',
  OFFICIAL_HTML: 'official_html',
  OFFICIAL_NOTICE_LIST: 'official_notice_list',
  MANUAL_ONLY: 'manual_only'
});

const POLICY_CONFIDENCE = Object.freeze({
  OFFICIAL_CONFIRMED: 'official_confirmed',
  AUTO_WATCHED_UNCHANGED: 'auto_watched_unchanged',
  CHANGED_REVIEW_REQUIRED: 'changed_review_required',
  MANUAL_CHECK_REQUIRED: 'manual_check_required',
  STALE: 'stale'
});

const FETCH_TIMEOUT_MS = Number(process.env.POLICY_WATCH_FETCH_TIMEOUT_MS) || 15000;
const USER_AGENT = 'myhouse-policy-watch/1.0 (+official-policy-change-monitor)';

const POLICY_WATCH_TARGETS = [
  {
    key: 'bok_base_rate',
    label: '한국은행 기준금리',
    type: SOURCE_TYPES.OFFICIAL_HTML,
    officialAgency: '한국은행',
    url: 'https://www.bok.or.kr',
    sourcePathHint: '한국은행 기준금리 / 금융통화위원회 발표',
    watchedFields: ['market_rates.base_rate'],
    keywords: ['기준금리', '금융통화위원회', '통화정책방향'],
    updateAction: 'market_rates.base_rate 후보값 확인'
  },
  {
    key: 'bok_mortgage_average_rate',
    label: '은행권 주담대 평균금리',
    type: SOURCE_TYPES.OFFICIAL_HTML,
    officialAgency: '한국은행',
    url: 'https://www.bok.or.kr',
    sourcePathHint: '한국은행 > 보도자료 > 금융기관 가중평균금리',
    watchedFields: ['market_rates.mortgage.actual_avg'],
    keywords: ['금융기관 가중평균금리', '주택담보대출', '신규취급액'],
    updateAction: '은행권 주담대 신규취급 평균금리 후보값 확인'
  },
  {
    key: 'fsc_dsr_stress',
    label: 'DSR / 스트레스 DSR',
    type: SOURCE_TYPES.OFFICIAL_HTML,
    officialAgency: '금융위원회',
    url: 'https://www.fsc.go.kr',
    sourcePathHint: '금융위원회 > 보도자료 / 정책자료 / 주요정책문답',
    watchedFields: ['dsr', 'purchase_mortgage_cap', 'ltv'],
    keywords: ['DSR', '스트레스 DSR', '가계부채', '주택담보대출', 'LTV'],
    updateAction: 'DSR/LTV/주담대 cap 변경 여부 확인'
  },
  {
    key: 'molit_regulated_area',
    label: '규제지역',
    type: SOURCE_TYPES.OFFICIAL_HTML,
    officialAgency: '국토교통부',
    url: 'https://www.molit.go.kr',
    sourcePathHint: '국토교통부 > 뉴스·소식 > 보도자료 / 고시',
    watchedFields: ['regulated_areas', 'ltv'],
    keywords: ['규제지역', '조정대상지역', '투기과열지구', '토지거래허가구역'],
    updateAction: 'regulated_areas 후보값 확인'
  },
  {
    key: 'myhome_policy_loans',
    label: '디딤돌 / 버팀목 / 신생아특례',
    type: SOURCE_TYPES.OFFICIAL_HTML,
    officialAgency: '마이홈 / 주택도시기금',
    url: 'https://www.myhome.go.kr',
    sourcePathHint: '마이홈포털 > 금융지원 > 디딤돌대출 / 버팀목대출 / 신생아특례',
    watchedFields: ['policy_loans'],
    keywords: ['디딤돌', '버팀목', '신생아특례', '소득', '자산', '한도', 'LTV', 'DTI'],
    updateAction: 'policy_loans 후보값 확인'
  },
  {
    key: 'hf_bogeumjari',
    label: '보금자리론',
    type: SOURCE_TYPES.OFFICIAL_HTML,
    officialAgency: '한국주택금융공사',
    url: 'https://www.hf.go.kr/ko/sub01/sub01_01_01.do',
    sourcePathHint: 'HF 한국주택금융공사 > 주택담보대출 > 보금자리론',
    watchedFields: ['policy_loans.bogeumjari'],
    keywords: ['보금자리론', '소득', '주택가격', '대출한도', 'LTV', 'DTI'],
    updateAction: '보금자리론 policy_rules.json 추가 후보 생성'
  },
  {
    key: 'tax_family_support',
    label: '가족 증여·차용 세무 확인',
    type: SOURCE_TYPES.MANUAL_ONLY,
    officialAgency: '국세청',
    sourcePathHint: '국세청 > 세금신고 > 증여세 / 금전소비대차 관련 공식 안내',
    watchedFields: ['tax_review_required'],
    keywords: ['증여세', '차용증', '금전소비대차'],
    updateAction: '세무 전문가 또는 국세청 공식 안내 확인 후 tax_review_required로 관리'
  }
];

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`[policy-watch] Could not read ${path.basename(filePath)}: ${error.message}`);
    }
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function hashText(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function htmlToText(html) {
  return decodeHtmlEntities(String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function inferTitle(html) {
  const match = String(html || '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? htmlToText(match[1]).slice(0, 160) : '';
}

function uniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean).map((value) => String(value).trim()))];
}

function sanitizeKey(value) {
  return String(value || 'source')
    .replace(/[^\w가-힣-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function collectMatchedKeywords(text, keywords) {
  const normalized = String(text || '').toLowerCase();
  return uniqueStrings((keywords || []).filter((keyword) => normalized.includes(String(keyword).toLowerCase())));
}

function collectMatchedSnippets(text, keywords) {
  const sourceText = String(text || '');
  const snippets = [];

  for (const keyword of keywords || []) {
    const index = sourceText.toLowerCase().indexOf(String(keyword).toLowerCase());
    if (index === -1) continue;
    const start = Math.max(0, index - 90);
    const end = Math.min(sourceText.length, index + String(keyword).length + 150);
    snippets.push(sourceText.slice(start, end).trim());
    if (snippets.length >= 5) break;
  }

  return uniqueStrings(snippets);
}

function collectNumericMentions(snippets) {
  const mentions = [];
  const pattern = /(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?:%|억원|만원|원|년|개월|일|bp|%p)?/g;

  for (const snippet of snippets || []) {
    const matches = snippet.match(pattern) || [];
    mentions.push(...matches.map((match) => match.trim()));
  }

  return uniqueStrings(mentions).slice(0, 30);
}

function collectPreviousHashes(previousReport) {
  const hashes = new Map();
  for (const source of previousReport.sources || []) {
    if (source.key && source.contentHash) hashes.set(source.key, source.contentHash);
  }
  return hashes;
}

function addTarget(targets, seenKeys, target) {
  const key = sanitizeKey(target.key);
  if (!key || seenKeys.has(key)) return;
  seenKeys.add(key);
  targets.push({
    key,
    label: target.label || key,
    type: target.type || (target.url ? SOURCE_TYPES.OFFICIAL_HTML : SOURCE_TYPES.MANUAL_ONLY),
    officialAgency: target.officialAgency || '',
    url: target.url || '',
    sourcePathHint: target.sourcePathHint || '',
    watchedFields: uniqueStrings(target.watchedFields || []),
    keywords: uniqueStrings(target.keywords || []),
    updateAction: target.updateAction || '공식자료 확인 후 policy_rules.json에 수동 반영'
  });
}

function buildWatchTargets(policyRules, extraTargets = []) {
  const targets = [];
  const seenKeys = new Set();

  for (const target of POLICY_WATCH_TARGETS) addTarget(targets, seenKeys, target);

  for (const [label, url] of Object.entries(policyRules._verify_urls || {})) {
    addTarget(targets, seenKeys, {
      key: `verify_url_${label}`,
      label: `공식 확인 URL: ${label}`,
      type: SOURCE_TYPES.OFFICIAL_HTML,
      officialAgency: policyRules._source || '공식기관',
      url,
      sourcePathHint: `${label} 공식 확인 시작점`,
      watchedFields: [],
      keywords: [label.replace(/_/g, ' ')],
      updateAction: `${label} 관련 공식자료 변경 여부 확인`
    });
  }

  for (const [key, registry] of Object.entries(policyRules.policy_source_registry || {})) {
    addTarget(targets, seenKeys, {
      key: `registry_${key}`,
      label: registry.label || key,
      type: registry.url ? SOURCE_TYPES.OFFICIAL_HTML : SOURCE_TYPES.MANUAL_ONLY,
      officialAgency: registry.officialAgency || '',
      url: registry.url || '',
      sourcePathHint: registry.sourcePathHint || registry.officialSourceName || '',
      watchedFields: [`policy_source_registry.${key}`],
      keywords: [registry.label, registry.officialSourceName],
      updateAction: `${registry.label || key} 필수 필드 확인: ${(registry.requiredFields || []).join(', ')}`
    });
  }

  for (const [index, alert] of (policyRules.policy_change_alerts || []).entries()) {
    addTarget(targets, seenKeys, {
      key: `policy_alert_${index + 1}`,
      label: alert.title,
      type: SOURCE_TYPES.MANUAL_ONLY,
      officialAgency: alert.source,
      sourcePathHint: alert.sourcePathHint,
      watchedFields: ['policy_change_alerts'],
      keywords: [alert.title],
      updateAction: `${alert.effectiveDate || '시행일 미확인'} 기준 변경 여부 수동 확인`
    });
  }

  for (const [index, checklist] of (policyRules._update_checklist || []).entries()) {
    addTarget(targets, seenKeys, {
      key: `update_checklist_${index + 1}`,
      label: `정책 체크리스트 ${index + 1}`,
      type: SOURCE_TYPES.MANUAL_ONLY,
      officialAgency: policyRules._source || '공식기관',
      sourcePathHint: checklist,
      watchedFields: ['_update_checklist'],
      keywords: [],
      updateAction: checklist
    });
  }

  for (const target of extraTargets) addTarget(targets, seenKeys, target);
  return targets;
}

async function fetchOfficialSource(target, fetchImpl) {
  if (!target.url || target.type === SOURCE_TYPES.MANUAL_ONLY) {
    return {
      status: 'manual_check_required',
      httpStatus: null,
      finalUrl: target.url || '',
      warning: '정확한 공식 URL이 없거나 자동 확인에 적합하지 않아 사람이 공식자료를 확인해야 합니다.'
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetchImpl(target.url, {
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal
    });
    const body = await response.text();

    if (!response.ok) {
      return {
        status: 'failed',
        httpStatus: response.status,
        finalUrl: response.url || target.url,
        warning: `공식자료 요청 실패: HTTP ${response.status}`
      };
    }

    return {
      status: 'ok',
      httpStatus: response.status,
      finalUrl: response.url || target.url,
      title: inferTitle(body),
      text: htmlToText(body)
    };
  } catch (error) {
    return {
      status: 'failed',
      httpStatus: null,
      finalUrl: target.url,
      warning: `공식자료 요청 실패: ${error.name === 'AbortError' ? 'timeout' : error.message}`
    };
  } finally {
    clearTimeout(timeout);
  }
}

function candidateForSource(target, sourceResult, snippets, numericMentions) {
  const status = sourceResult.status === 'manual_check_required'
    ? 'manual_check_required'
    : sourceResult.status === 'failed'
      ? 'failed'
      : snippets.length || numericMentions.length
        ? 'candidate_extracted'
        : 'manual_check_required';

  return {
    key: target.key,
    field: target.watchedFields.join(', '),
    status,
    officialAgency: target.officialAgency,
    sourceUrl: target.url || '',
    sourcePathHint: target.sourcePathHint,
    candidateOnly: true,
    candidateValues: {
      numericMentions
    },
    matchedSnippets: snippets,
    missingFields: target.watchedFields,
    recommendation: target.updateAction || '공식 상품 페이지 확인 후 policy_rules.json에 수동 반영'
  };
}

async function inspectTarget(target, previousHashes, fetchImpl, checkedAt) {
  const fetchResult = await fetchOfficialSource(target, fetchImpl);
  const previousHash = previousHashes.get(target.key) || '';
  const contentHash = fetchResult.text ? hashText(fetchResult.text) : '';
  const hasChanged = Boolean(previousHash && contentHash && previousHash !== contentHash);
  const matchedKeywords = collectMatchedKeywords(fetchResult.text, target.keywords);
  const matchedSnippets = collectMatchedSnippets(fetchResult.text, matchedKeywords);
  const numericMentions = collectNumericMentions(matchedSnippets);
  const status = fetchResult.status === 'ok' && hasChanged ? 'changed' : fetchResult.status;
  const policyConfidence = status === 'changed'
    ? POLICY_CONFIDENCE.CHANGED_REVIEW_REQUIRED
    : status === 'ok'
      ? POLICY_CONFIDENCE.AUTO_WATCHED_UNCHANGED
      : POLICY_CONFIDENCE.MANUAL_CHECK_REQUIRED;

  return {
    report: {
      key: target.key,
      label: target.label,
      type: target.type,
      officialAgency: target.officialAgency,
      checkedAt,
      status,
      policyConfidence,
      sourceUrl: target.url || '',
      finalUrl: fetchResult.finalUrl || '',
      httpStatus: fetchResult.httpStatus,
      pageTitle: fetchResult.title || '',
      contentHash,
      previousHash,
      hasChanged,
      matchedKeywords,
      sourcePathHint: target.sourcePathHint,
      watchedFields: target.watchedFields,
      updateAction: target.updateAction,
      warning: fetchResult.warning || ''
    },
    candidate: candidateForSource(target, fetchResult, matchedSnippets, numericMentions)
  };
}

function summarizeSources(sources) {
  return sources.reduce((summary, source) => {
    summary.total += 1;
    summary[source.status] = (summary[source.status] || 0) + 1;
    if (source.status !== 'ok') summary.requiresHumanReview += 1;
    return summary;
  }, {
    total: 0,
    ok: 0,
    changed: 0,
    failed: 0,
    manual_check_required: 0,
    requiresHumanReview: 0
  });
}

async function runPolicyWatch(options = {}) {
  const checkedAt = options.checkedAt || new Date().toISOString();
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('Node.js 18 이상 fetch 지원이 필요합니다.');

  const policyRules = options.policyRules || readJson(POLICY_RULES_PATH, {});
  const previousReport = options.previousReport || readJson(REPORT_PATH, {});
  const previousHashes = collectPreviousHashes(previousReport);
  const targets = buildWatchTargets(policyRules, options.extraTargets || []);
  const inspected = [];

  for (const target of targets) {
    inspected.push(await inspectTarget(target, previousHashes, fetchImpl, checkedAt));
  }

  const sources = inspected.map((item) => item.report);
  const candidates = inspected.map((item) => item.candidate);
  const report = {
    generatedAt: checkedAt,
    sourcePolicyUpdatedAt: policyRules._updated || null,
    policyRulesAutoModified: false,
    policyConfidence: POLICY_CONFIDENCE,
    summary: summarizeSources(sources),
    sources
  };
  const candidateReport = {
    generatedAt: checkedAt,
    candidateOnly: true,
    requiresHumanReview: true,
    warning: '이 파일의 후보값은 자동 확정값이 아닙니다. 공식자료를 사람이 확인한 뒤 policy_rules.json에 수동 반영하세요.',
    candidates
  };

  if (options.writeFiles !== false) {
    writeJson(REPORT_PATH, report);
    writeJson(CANDIDATE_PATH, candidateReport);
  }

  return { report, candidateReport };
}

if (require.main === module) {
  runPolicyWatch()
    .then(({ report }) => {
      console.log(`[policy-watch] complete: ${JSON.stringify(report.summary)}`);
      console.log('[policy-watch] policy_rules.json was not modified.');
    })
    .catch((error) => {
      console.error(`[policy-watch] fatal error: ${error.stack || error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  POLICY_CONFIDENCE,
  POLICY_WATCH_TARGETS,
  SOURCE_TYPES,
  buildWatchTargets,
  hashText,
  runPolicyWatch
};
