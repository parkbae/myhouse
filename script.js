'use strict';

// ─────────────────────────────────────────
//  전역 상태
// ─────────────────────────────────────────
var POLICY = null;       // policy_rules.json
var policyLoadState = {
  loadedFrom: 'unknown',
  loadedAt: null,
  error: null
};
var state = {
  profile: null,
  loanResult: null,
  scenarioResult: null,
  properties: [],
  additionalIncomes: [
    {
      id: 'additional_income_platform_sales_2025',
      label: '플랫폼 판매 수입',
      category: 'platform_sales',
      sourceName: '아이디어스/네이버',
      amount: 10000000,
      periodType: 'annual',
      incomeYear: 2025,
      isRecurring: false,
      isReportedToTax: false,
      isPlannedToReport: false,
      hasBankStatementProof: true,
      hasTransferRecord: true,
      hasSalesRecord: true,
      hasTaxCertificateProof: false,
      memo: '현재는 자금출처 및 세무 리스크 관리 항목으로만 사용'
    }
  ]
};

var ADDITIONAL_INCOME_CATEGORIES = {
  platform_sales: '플랫폼 판매 수입',
  used_goods_sales: '중고거래/개인물품 판매',
  overseas_sales: '해외 플랫폼 판매 수입',
  freelance: '프리랜서 부업',
  business: '사업소득',
  cash_income: '현금성 수입',
  other_income: '기타소득',
  asset_disposal: '자산 처분/일시 판매',
  family_support: '가족 지원금',
  loan_or_borrowing: '차용금',
  gift: '증여',
  unknown: '분류 미정'
};

var ADDITIONAL_INCOME_RISK_THRESHOLDS = {
  largeUnreportedIncome: 10000000
};

var INCOME_RECOGNITION_SCENARIOS = {
  businessConservativeRate: 0.75,
  businessFullRate: 1.0
};

var RISK_FLAG_LABELS = {
  unreported_income: '미신고 소득',
  large_unreported_income: '고액 미신고 소득',
  cash_income_without_proof: '현금성 수입 증빙 부족',
  not_usable_for_loan_income: '대출소득 인정 불가',
  fund_source_only_not_income: '자금출처 설명 가능 / 대출소득 별도',
  tax_review_required: '세무 확인 필요'
};

var POLICY_STATUS_LABELS = {
  not_available: '제외',
  candidate: '검토 가능',
  future_candidate: '미래 후보',
  not_primary: '비주력',
  policy_data_missing: '판정 보류',
  check_required: '확인 필요',
  bank_discretion: '은행 확인 필요',
  tax_review_required: '세무 확인 필요'
};

var POLICY_DATA_STATUS = {
  OFFICIAL_CONFIRMED: 'official_confirmed',
  POLICY_DATA_MISSING: 'policy_data_missing',
  CHECK_REQUIRED: 'check_required',
  CONFLICTING_DATA: 'conflicting_data',
  BANK_DISCRETION: 'bank_discretion',
  TAX_REVIEW_REQUIRED: 'tax_review_required'
};

var POLICY_SOURCE_KEY_ALIASES = {
  didimdol: 'didimdol',
  bogeumjari: 'bogeumjari',
  newbornSpecial: 'newbornSpecial',
  newborn_didimdol: 'newbornSpecial',
  newbornDidimdol: 'newbornSpecial',
  newborn: 'newbornSpecial',
  buttimmokJeonse: 'buttimmokJeonse',
  buttimmok: 'buttimmokJeonse',
  newlywed_jeonse: 'buttimmokJeonse',
  newborn_jeonse: 'buttimmokJeonse',
  mortgageRegulation: 'mortgageRegulation',
  mortgage_regulation: 'mortgageRegulation'
};

var UI_STATUS_LABELS = {
  safe: '안전권',
  recommended: '우선 검토',
  possible: '가능성 있음',
  caution: '주의',
  danger: '위험',
  not_available: '제외',
  future_candidate: '미래 후보',
  check_required: '확인 필요',
  unavailable: '판정 불가',
  pending: '입력 필요',
  info: '참고'
};

var DECISION_CARD_STATUS_LABELS = UI_STATUS_LABELS;

var POLICY_FIELD_LABELS = {
  incomeLimits: '소득요건',
  dualIncomeLimits: '맞벌이 소득요건',
  assetLimit: '자산요건',
  housePriceLimit: '주택가격요건',
  depositLimits: '보증금요건',
  loanLimit: '대출한도',
  loanLimits: '대출한도',
  ltv: 'LTV',
  dti: 'DTI',
  dsrExempt: 'DSR 적용 여부',
  ltvOrGuaranteeRatio: '보증비율',
  singleHouseholdRestrictions: '단독세대주 제한',
  newlywedConditions: '신혼 요건',
  newlywedLimits: '신혼 한도',
  expectedMarriageConditions: '결혼예정자 요건',
  childrenIncomeRelaxation: '자녀 우대요건',
  newPurchaseRules: '신규 구입 조건',
  refinancingRules: '대환 조건'
};

var AFFORDABILITY_RISK_THRESHOLDS = {
  cautionRatio: 1.0,
  dangerRatio: 1.2
};

var NET_INCOME_ESTIMATE_RATE = 0.78;
var MANWON = 10000;

var MANWON_INPUT_IDS = {
  income1: true,
  income2: true,
  cash: true,
  support: true,
  existing_debt: true,
  monthly_debt: true,
  wedding_cost: true,
  monthly_living: true,
  target_property_price: true,
  purchase_costs: true,
  existing_debt_annual_payment: true,
  partner_recognized_income: true,
  'prop-price': true,
  'prop-deposit': true,
  'prop-monthly': true,
  'prop-maint': true
};

function policyFieldLabel(field) {
  return POLICY_FIELD_LABELS[field] || field;
}

function getPolicySourceMeta(policyKey) {
  var registryKey = POLICY_SOURCE_KEY_ALIASES[policyKey] || policyKey;
  var registry = POLICY && POLICY.policy_source_registry ? POLICY.policy_source_registry : {};
  return registry[registryKey] || null;
}

function policySourceDisplayName(source) {
  if (source && source.officialSourceName) return source.officialSourceName;
  return policyLoadState.loadedFrom === 'fallback'
    ? '정책 파일 로드 실패로 출처 확인 제한'
    : '공식 출처 정보 미등록';
}

function policySourcePathDisplay(source) {
  if (source && source.sourcePathHint) return source.sourcePathHint;
  return policyLoadState.loadedFrom === 'fallback'
    ? '정책 파일 로드 실패로 경로 확인 제한'
    : '공식 확인 경로 미등록';
}

// ─────────────────────────────────────────
//  초기화
// ─────────────────────────────────────────
window.addEventListener('DOMContentLoaded', function () {
  renderAdditionalIncomeInputs();
  renderFileProtocolWarning();
  loadPolicy();
});

function loadPolicy() {
  fetch('policy_rules.json')
    .then(function (r) {
      if (!r.ok) throw new Error('policy_rules.json HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      POLICY = data;
      policyLoadState.loadedFrom = 'json';
      policyLoadState.loadedAt = new Date().toISOString();
      policyLoadState.error = null;
      renderPolicyMeta(data);
      checkPolicyExpiry(data);
    })
    .catch(function (err) {
      POLICY = getDefaultPolicy();
      policyLoadState.loadedFrom = 'fallback';
      policyLoadState.loadedAt = new Date().toISOString();
      policyLoadState.error = String(err && err.message ? err.message : err);
      renderPolicyMeta(POLICY);
      renderPolicyLoadWarning(policyLoadState);
      checkPolicyExpiry(POLICY);
    });
}

function renderPolicyMeta(data) {
  var badge = document.getElementById('policy-date-badge');
  if (badge) badge.textContent = '정책 기준일: ' + (data._updated || '확인 필요') + (policyLoadState.loadedFrom === 'fallback' ? ' (내장 fallback)' : '');
  var rd = document.getElementById('report-policy-date');
  if (rd) rd.textContent = data._updated || '확인 필요';
  var rn = document.getElementById('report-policy-note');
  if (rn) rn.textContent = (data._updated || '확인 필요') + ' 기준 · ' + (data._source || '출처 확인 필요');
  var card = document.getElementById('policy-meta-card');
  if (!card) return;
  var loadedFromLabel = policyLoadState.loadedFrom === 'json' ? 'policy_rules.json 기준' : '내장 fallback 기준';
  card.innerHTML = '<section class="policy-meta-card">' +
    '<div class="decision-title-row"><h3>정책 기준 정보</h3><span class="policy-load-badge ' + escapeHTML(policyLoadState.loadedFrom) + '">' + escapeHTML(loadedFromLabel) + '</span></div>' +
    '<div class="policy-meta-grid">' +
    '<div><span>정책 기준일</span><strong>' + escapeHTML(data._updated || '확인 필요') + '</strong></div>' +
    '<div><span>정책 출처</span><strong>' + escapeHTML(data._source || '출처 확인 필요') + '</strong></div>' +
    '<div><span>정책 파일 로드</span><strong>' + escapeHTML(loadedFromLabel) + '</strong></div>' +
    '<div><span>마지막 로드 시각</span><strong>' + escapeHTML(policyLoadState.loadedAt || '확인 필요') + '</strong></div>' +
    '<div><span>다음 검토 예정일</span><strong>' + escapeHTML(data._next_review || '확인 필요') + '</strong></div>' +
    '</div>' +
    (policyLoadState.loadedFrom === 'fallback' ? '<p class="policy-meta-warning">주의: policy_rules.json을 불러오지 못해 내장 기준값으로 계산 중입니다.</p>' : '') +
    '</section>';
}

function renderPolicyLoadWarning(loadState) {
  var container = document.getElementById('policy-load-warning');
  if (!container) return;
  container.innerHTML = '<div class="policy-load-warning"><strong>정책 파일 로드 실패</strong><br>' +
    'policy_rules.json을 불러오지 못해 내장 기준값으로 계산 중입니다.<br>' +
    '로컬에서는 http://localhost 방식으로 실행하거나 GitHub Pages 배포본에서 확인하세요.' +
    (loadState.error ? '<br><small>오류: ' + escapeHTML(loadState.error) + '</small>' : '') + '</div>';
}

function renderFileProtocolWarning() {
  if (typeof location === 'undefined' || location.protocol !== 'file:') return;
  var container = document.getElementById('policy-load-warning');
  if (!container) return;
  container.innerHTML = '<div class="policy-load-warning"><strong>현재 file:// 방식으로 실행 중입니다.</strong><br>' +
    '일부 브라우저에서는 policy_rules.json을 불러오지 못해 내장 기준값으로 계산될 수 있습니다.<br>' +
    '정확한 정책 기준일과 공식 출처 표시를 확인하려면 로컬 서버 또는 GitHub Pages에서 실행하세요.</div>';
}

// 정책 만료/변경 임박 항목을 감지해 배너로 경고
function checkPolicyExpiry(data) {
  var warnings = (data.policy_change_alerts || []).filter(function (item) {
    return item.title && item.effectiveDate && item.source && item.sourcePathHint && item.status;
  }).map(function (item) {
    return '[' + item.status + '] ' + item.title + ' · 적용/확인일: ' + item.effectiveDate + ' · 출처: ' + item.source + ' · 확인처: ' + item.sourcePathHint;
  });

  // JSON 기준일이 90일 이상 오래됐으면 갱신 권고
  var today = new Date();
  if (data._updated) {
    var updated = new Date(data._updated);
    var ageDays = Math.ceil((today - updated) / (1000 * 60 * 60 * 24));
    if (ageDays > 90) {
      warnings.push('🔄 정책 기준일(' + data._updated + ')로부터 ' + ageDays + '일 경과 — 최신 고시 확인 후 policy_rules.json 업데이트를 권장합니다.');
    }
  }

  if (warnings.length > 0) {
    renderPolicyWarningBanner(warnings, data._update_checklist);
  }
}

function renderPolicyWarningBanner(warnings, checklist) {
  // 기존 배너 제거
  var existing = document.getElementById('policy-warning-banner');
  if (existing) existing.parentNode.removeChild(existing);

  var banner = document.createElement('div');
  banner.id = 'policy-warning-banner';
  banner.style.cssText = 'background:#fff8e6;border:1.5px solid #ffd666;border-radius:10px;padding:12px 16px;margin-bottom:1.25rem;font-size:13px;line-height:1.7;';

  var html = '<div style="font-weight:700;color:#8a5700;margin-bottom:6px;">⚠️ 정책 변경 감지</div>';
  warnings.forEach(function (w) {
    html += '<div style="color:#5a3a00;margin-bottom:4px;">' + w + '</div>';
  });

  if (checklist && checklist.length > 0) {
    html += '<details style="margin-top:8px;"><summary style="cursor:pointer;font-weight:600;color:#8a5700;">업데이트 체크리스트 보기</summary>';
    html += '<ul style="margin:8px 0 0 16px;">';
    checklist.forEach(function (item) {
      html += '<li style="margin-bottom:3px;color:#5a3a00;">' + item + '</li>';
    });
    html += '</ul></details>';
  }

  banner.innerHTML = html;

  // 탭1 폼 위에 삽입
  var formGrid = document.querySelector('#tab-profile .form-grid');
  if (formGrid) {
    formGrid.parentNode.insertBefore(banner, formGrid);
  }
}

function getDefaultPolicy() {
  return {
    _updated: '2026-05-31',
    _source: '금융위원회 고시 기준 (내장 fallback)',
    _next_review: null,
    policy_source_registry: {
      didimdol: {
        label: '내집마련 디딤돌대출',
        officialSourceName: '마이홈포털 내집마련 디딤돌대출',
        officialAgency: '국토교통부 / 주택도시기금 / 마이홈',
        sourcePathHint: '마이홈포털 > 금융지원 > 내집마련 디딤돌대출',
        lastCheckedAt: null
      },
      bogeumjari: {
        label: '보금자리론',
        officialSourceName: '한국주택금융공사 보금자리론 상품소개',
        officialAgency: '한국주택금융공사',
        sourcePathHint: 'HF 한국주택금융공사 > 주택담보대출 > 보금자리론',
        lastCheckedAt: null
      },
      newbornSpecial: {
        label: '신생아 특례 디딤돌대출',
        officialSourceName: '마이홈포털 신생아 특례 디딤돌대출',
        officialAgency: '국토교통부 / 주택도시기금 / 마이홈',
        sourcePathHint: '마이홈포털 > 금융지원 > 신생아 특례 디딤돌대출',
        lastCheckedAt: null
      },
      buttimmokJeonse: {
        label: '버팀목전세자금대출',
        officialSourceName: '주택도시기금 또는 마이홈포털 버팀목전세대출',
        officialAgency: '국토교통부 / 주택도시기금',
        sourcePathHint: '주택도시기금 또는 마이홈포털 > 금융지원 > 버팀목전세대출',
        lastCheckedAt: null
      },
      mortgageRegulation: {
        label: '일반 주택담보대출 규제',
        officialSourceName: '금융위원회 주택담보대출 규제 FAQ / 보도자료',
        officialAgency: '금융위원회',
        sourcePathHint: '금융위원회 > 정책마당 > 정책자료 > 주요정책문답',
        lastCheckedAt: null
      }
    },
    dsr: {
      bank_limit: 0.40,
      non_bank_limit: 0.50,
      stress: {
        metro_or_regulated: { base_rate: 0.030 },
        local_non_regulated: { base_rate: 0.015, multiplier: 0.50, effective_rate: 0.0075, expires: '2026-06-30' }
      }
    },
    ltv: {
      regulated_general: 0.40,
      regulated_first_buyer: 0.70,
      regulated_real_demand: 0.60,
      metro_non_regulated_general: 0.70,
      metro_non_regulated_first_buyer: 0.70,
      local_non_regulated_general: 0.70,
      local_non_regulated_first_buyer: 0.80
    },
    purchase_mortgage_cap: {
      tiers: [
        { price_max: 1500000000, cap: 600000000 },
        { price_max: 2500000000, cap: 400000000 },
        { price_max: 999999999999, cap: 200000000 }
      ]
    },
    policy_loans: {
      didimdol: {
        name: '내집마련 디딤돌대출',
        income_single_max: 60000000,
        income_first_or_two_children_max: 70000000,
        income_newlywed_max: 85000000,
        asset_max: 511000000,
        loan_max_general: 200000000,
        loan_max_first_buyer: 240000000,
        loan_max_newlywed_or_two_children: 320000000,
        ltv_max: 0.70, dti_max: 0.60,
        rate_range: '연 2.35~3.95%'
      },
      newlywed_jeonse: {
        name: '신혼부부전용 버팀목전세자금',
        income_newlywed_max: 75000000,
        income_newlywed_max_note: '2026년 하반기 1억 완화 예정',
        asset_max: 345000000,
        loan_max_metro: 250000000,
        loan_max_metro_note: '2025.06.27 대책: 수도권 3억→2.5억',
        loan_max_other: 160000000,
        rate_range: '연 1.5~2.9%'
      },
      newborn_didimdol: {
        name: '신생아특례 디딤돌대출 (구입)',
        income_max_single: 130000000,
        income_max_dual: 200000000,
        asset_max: 511000000,
        price_max: 900000000,
        loan_max: 400000000,
        ltv_max: 0.70, dti_max: 0.60,
        dsr_exempt: true,
        rate_range: '연 1.6~3.3%'
      },
      newborn_jeonse: {
        name: '신생아특례 버팀목전세자금',
        income_max_dual: 200000000,
        loan_max_metro: 300000000,
        dsr_exempt: true,
        rate_range: '연 1.1~3.0%'
      }
    },
    regulated_areas: { seoul: '서울 25개 자치구 전역', gyeonggi: ['과천시','광명시','성남시 분당구','성남시 수정구','성남시 중원구','수원시 영통구','수원시 장안구','수원시 팔달구','안양시 동안구','용인시 수지구','의왕시','하남시'] },
    market_rates: {
      base_rate: 0.025,
      mortgage: { conservative: 0.050, base: 0.043, optimistic: 0.040 },
      jeonse: { conservative: 0.045, base: 0.040, optimistic: 0.037 }
    }
  };
}

// ─────────────────────────────────────────
//  탭 전환
// ─────────────────────────────────────────
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(function (el) {
    el.classList.remove('active');
  });
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.classList.remove('active');
  });
  var target = document.getElementById(tabId);
  if (target) target.classList.add('active');
  var btn = document.querySelector('[data-tab="' + tabId + '"]');
  if (btn) btn.classList.add('active');
  window.scrollTo(0, 0);
}

// ─────────────────────────────────────────
//  유틸
// ─────────────────────────────────────────
function won(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (Math.abs(n) >= 100000000) {
    var eok = (n / 100000000);
    var rounded = Math.round(eok * 10) / 10;
    return rounded + '억원';
  }
  if (Math.abs(n) >= 10000) {
    return Math.round(n / 10000) + '만원';
  }
  return Math.round(n).toLocaleString() + '원';
}

function wonM(n) {
  if (isNaN(n)) return '—';
  return Math.round(n / 10000).toLocaleString() + '만원';
}

function pct(n) {
  return Math.round(n * 1000) / 10 + '%';
}

function parseNonNegativeNumber(value, fallback) {
  var parsed = Number(value);
  return isFinite(parsed) && parsed >= 0 ? parsed : (fallback || 0);
}

function parseManwonToWon(value, fallback) {
  var parsed = Number(value);
  return isFinite(parsed) && parsed >= 0 ? Math.round(parsed * MANWON) : (fallback || 0);
}

function wonToManwon(value, fallback) {
  var parsed = Number(value);
  return isFinite(parsed) && parsed >= 0 ? Math.round(parsed / MANWON) : (fallback || 0);
}

function getInput(id) {
  var el = document.getElementById(id);
  if (!el) return 0;
  return MANWON_INPUT_IDS[id]
    ? parseManwonToWon(el.value, 0)
    : parseNonNegativeNumber(el.value, 0);
}

function getSelect(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}

function escapeHTML(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeAdditionalIncomes(additionalIncomes) {
  return (Array.isArray(additionalIncomes) ? additionalIncomes : []).map(function (item, index) {
    var category = ADDITIONAL_INCOME_CATEGORIES[item.category] ? item.category : 'unknown';
    return {
      id: item.id || ('additional_income_' + Date.now() + '_' + index),
      label: item.label || ADDITIONAL_INCOME_CATEGORIES[category],
      category: category,
      sourceName: item.sourceName || '',
      amount: parseNonNegativeNumber(item.amount, 0),
      periodType: item.periodType || 'annual',
      incomeYear: Number(item.incomeYear) || new Date().getFullYear(),
      isRecurring: item.isRecurring === true,
      isReportedToTax: item.isReportedToTax === true,
      isPlannedToReport: item.isPlannedToReport === true,
      hasBankStatementProof: item.hasBankStatementProof === true,
      hasTransferRecord: item.hasTransferRecord === true,
      hasSalesRecord: item.hasSalesRecord === true,
      hasTaxCertificateProof: item.hasTaxCertificateProof === true,
      memo: item.memo || ''
    };
  });
}

function evaluateAdditionalIncomeForLoan(incomeItem) {
  if (incomeItem.isReportedToTax && incomeItem.hasTaxCertificateProof && incomeItem.isRecurring) return true;
  if (incomeItem.isReportedToTax && incomeItem.hasTaxCertificateProof) return 'limited_or_bank_discretion';
  return false;
}

function evaluateAdditionalIncomeForFundSource(incomeItem) {
  return incomeItem.hasBankStatementProof || incomeItem.hasTransferRecord || incomeItem.hasSalesRecord;
}

function evaluateAdditionalIncomeItem(incomeItem) {
  var item = normalizeAdditionalIncomes([incomeItem])[0];
  var riskFlags = [];
  item.canBeUsedForLoanIncome = evaluateAdditionalIncomeForLoan(item);
  item.canBeUsedForFundSourceExplanation = evaluateAdditionalIncomeForFundSource(item);
  if (!item.isReportedToTax) riskFlags.push('unreported_income');
  if (item.amount >= ADDITIONAL_INCOME_RISK_THRESHOLDS.largeUnreportedIncome && !item.isReportedToTax) riskFlags.push('large_unreported_income');
  if (item.category === 'cash_income' && !item.hasBankStatementProof) riskFlags.push('cash_income_without_proof');
  if (item.canBeUsedForLoanIncome === false && item.amount > 0) riskFlags.push('not_usable_for_loan_income');
  if (item.canBeUsedForFundSourceExplanation && item.canBeUsedForLoanIncome === false) riskFlags.push('fund_source_only_not_income');
  item.riskFlags = riskFlags;
  item.riskLevel = riskFlags.indexOf('large_unreported_income') !== -1 || riskFlags.indexOf('cash_income_without_proof') !== -1
    ? 'danger'
    : (riskFlags.length > 0 ? 'caution' : 'none');
  return item;
}

function evaluateAdditionalIncomes(additionalIncomes) {
  return normalizeAdditionalIncomes(additionalIncomes).map(evaluateAdditionalIncomeItem);
}

function calculateRecognizedAdditionalIncome(additionalIncomes) {
  return evaluateAdditionalIncomes(additionalIncomes).reduce(function (sum, item) {
    return sum + (item.canBeUsedForLoanIncome === true ? item.amount : 0);
  }, 0);
}

function calculateReportedAdditionalIncome(additionalIncomes) {
  return evaluateAdditionalIncomes(additionalIncomes).reduce(function (sum, item) {
    return sum + (item.isReportedToTax ? item.amount : 0);
  }, 0);
}

function calculateUnreportedAdditionalIncome(additionalIncomes) {
  return evaluateAdditionalIncomes(additionalIncomes).reduce(function (sum, item) {
    return sum + (!item.isReportedToTax ? item.amount : 0);
  }, 0);
}

function collectAdditionalIncomeRiskFlags(additionalIncomes) {
  return evaluateAdditionalIncomes(additionalIncomes).reduce(function (flags, item) {
    item.riskFlags.forEach(function (flag) {
      if (flags.indexOf(flag) === -1) flags.push(flag);
    });
    return flags;
  }, []);
}

function buildAdditionalIncomeReview(additionalIncomes) {
  var items = evaluateAdditionalIncomes(additionalIncomes);
  var riskFlags = collectAdditionalIncomeRiskFlags(items);
  var fundSourceExplainableAmount = items.reduce(function (sum, item) {
    return sum + (item.canBeUsedForFundSourceExplanation ? item.amount : 0);
  }, 0);
  var riskLevel = items.some(function (item) { return item.riskLevel === 'danger'; })
    ? 'danger'
    : (riskFlags.length > 0 ? 'caution' : 'none');
  var warnings = [];
  var nextActions = [];
  if (riskFlags.indexOf('unreported_income') !== -1) {
    warnings.push('미신고 부수입은 DSR 인정소득에 반영하지 않습니다.');
    nextActions.push('세무 신고 필요 여부를 세무 전문가와 확인하세요.');
  }
  if (riskFlags.indexOf('fund_source_only_not_income') !== -1) {
    warnings.push('입금 또는 판매 기록은 자금출처 설명에는 도움이 되지만 대출소득 증빙을 대신하지 않습니다.');
  }
  if (riskFlags.indexOf('cash_income_without_proof') !== -1) {
    nextActions.push('현금성 수입의 입금 내역 또는 거래 증빙을 준비하세요.');
  }
  if (items.some(function (item) { return item.canBeUsedForLoanIncome === 'limited_or_bank_discretion'; })) {
    warnings.push('일시성 신고소득은 은행 판단에 따라 제한적으로만 인정될 수 있습니다.');
  }
  return {
    items: items,
    totalAdditionalIncome: items.reduce(function (sum, item) { return sum + item.amount; }, 0),
    recurringCashflowIncome: items.reduce(function (sum, item) { return sum + (item.isRecurring ? item.amount : 0); }, 0),
    recognizedForLoanIncome: calculateRecognizedAdditionalIncome(items),
    reportedIncome: calculateReportedAdditionalIncome(items),
    unreportedIncome: calculateUnreportedAdditionalIncome(items),
    fundSourceExplainableAmount: fundSourceExplainableAmount,
    riskLevel: riskLevel,
    riskFlags: riskFlags,
    warnings: warnings,
    nextActions: nextActions
  };
}

function addAdditionalIncome() {
  state.additionalIncomes.push({
    id: 'additional_income_' + Date.now(),
    label: '기타 부수입',
    category: 'other_income',
    sourceName: '',
    amount: 0,
    periodType: 'annual',
    incomeYear: new Date().getFullYear(),
    isRecurring: false,
    isReportedToTax: false,
    isPlannedToReport: false,
    hasBankStatementProof: false,
    hasTransferRecord: false,
    hasSalesRecord: false,
    hasTaxCertificateProof: false,
    memo: ''
  });
  renderAdditionalIncomeInputs();
}

function removeAdditionalIncome(id) {
  state.additionalIncomes = state.additionalIncomes.filter(function (item) { return item.id !== id; });
  renderAdditionalIncomeInputs();
  updateProfileSummary();
}

function updateAdditionalIncomeField(id, field, element) {
  var item = state.additionalIncomes.find(function (candidate) { return candidate.id === id; });
  if (!item) return;
  item[field] = element.type === 'checkbox'
    ? element.checked
    : (element.type === 'number'
      ? (field === 'amount' ? parseManwonToWon(element.value, 0) : parseNonNegativeNumber(element.value, 0))
      : element.value);
  if (field === 'category' && (!item.label || Object.keys(ADDITIONAL_INCOME_CATEGORIES).some(function (key) {
    return item.label === ADDITIONAL_INCOME_CATEGORIES[key];
  }))) {
    item.label = ADDITIONAL_INCOME_CATEGORIES[item.category];
  }
  renderAdditionalIncomeInputs();
  updateProfileSummary();
}

function renderAdditionalIncomeInputs() {
  var container = document.getElementById('additional-income-list');
  if (!container) return;
  state.additionalIncomes = normalizeAdditionalIncomes(state.additionalIncomes);
  if (state.additionalIncomes.length === 0) {
    container.innerHTML = '<div class="additional-income-empty">등록된 부수입이 없습니다.</div>';
    return;
  }
  container.innerHTML = state.additionalIncomes.map(function (item) {
    var categories = Object.keys(ADDITIONAL_INCOME_CATEGORIES).map(function (key) {
      return '<option value="' + key + '"' + (item.category === key ? ' selected' : '') + '>' + ADDITIONAL_INCOME_CATEGORIES[key] + '</option>';
    }).join('');
    function checked(value) { return value ? ' checked' : ''; }
    function field(name) { return "updateAdditionalIncomeField('" + item.id + "','" + name + "',this)"; }
    return '<div class="additional-income-item">' +
      '<div class="additional-income-head"><strong>' + escapeHTML(item.label) + '</strong>' +
      '<button class="btn-danger" type="button" onclick="removeAdditionalIncome(\'' + item.id + '\')">삭제</button></div>' +
      '<div class="additional-income-grid">' +
      '<label>분류<select onchange="' + field('category') + '">' + categories + '</select></label>' +
      '<label>표시명<input value="' + escapeHTML(item.label) + '" onchange="' + field('label') + '" /></label>' +
      '<label>출처<input value="' + escapeHTML(item.sourceName) + '" placeholder="예: 판매 채널" onchange="' + field('sourceName') + '" /></label>' +
      '<label>연간 금액 (만원)<input type="number" min="0" value="' + wonToManwon(item.amount) + '" onchange="' + field('amount') + '" /></label>' +
      '</div><div class="additional-income-checks">' +
      '<label><input type="checkbox"' + checked(item.isRecurring) + ' onchange="' + field('isRecurring') + '" /> 반복 수입</label>' +
      '<label><input type="checkbox"' + checked(item.isReportedToTax) + ' onchange="' + field('isReportedToTax') + '" /> 세무 신고</label>' +
      '<label><input type="checkbox"' + checked(item.hasTaxCertificateProof) + ' onchange="' + field('hasTaxCertificateProof') + '" /> 소득금액증명</label>' +
      '<label><input type="checkbox"' + checked(item.hasBankStatementProof) + ' onchange="' + field('hasBankStatementProof') + '" /> 계좌 내역</label>' +
      '<label><input type="checkbox"' + checked(item.hasTransferRecord) + ' onchange="' + field('hasTransferRecord') + '" /> 이체 기록</label>' +
      '<label><input type="checkbox"' + checked(item.hasSalesRecord) + ' onchange="' + field('hasSalesRecord') + '" /> 판매 기록</label>' +
      '</div></div>';
  }).join('');
}

// 세후 월소득 추정 (간이 계산)
function monthlyNetIncome(annualGross, jobType) {
  var net = annualGross;
  if (jobType === 'employee') {
    // 간이 4대보험+소득세 약 15%
    net = annualGross * 0.85;
  } else if (jobType === 'self' || jobType === 'freelance') {
    // 자영업자: 인정소득 70~80% 적용 후 세후
    net = annualGross * INCOME_RECOGNITION_SCENARIOS.businessConservativeRate * 0.90;
  }
  return net / 12;
}

// DSR 계산용 인정소득
function recognizedIncome(annualGross, jobType) {
  if (jobType === 'self' || jobType === 'freelance') {
    return annualGross * INCOME_RECOGNITION_SCENARIOS.businessConservativeRate; // 보수적 70~80% 중간값
  }
  return annualGross;
}

function recognizedIncomeFullScenario(annualGross) {
  return annualGross * INCOME_RECOGNITION_SCENARIOS.businessFullRate;
}

function determinePropertyPriceBand(price) {
  var value = Number(price || 0);
  if (value <= 0) return 'unknown';
  if (value <= 300000000) return 'under_300m';
  if (value <= 600000000) return 'under_600m';
  if (value <= 900000000) return 'under_900m';
  if (value <= 1500000000) return 'under_1500m';
  if (value <= 2500000000) return 'under_2500m';
  return 'over_2500m';
}

function determinePrimaryLoanPath(input) {
  var targetProperty = input.targetProperty || {};
  var band = determinePropertyPriceBand(targetProperty.price);
  if (targetProperty.transactionType !== 'purchase') {
    return { primaryPath: 'jeonse_or_rent_logic', priceBand: band, reason: '매매가 아닌 거래유형이므로 전세/월세 판단으로 이동' };
  }
  if (band === 'unknown') {
    return { primaryPath: 'pending_target_price', priceBand: band, reason: '목표 주택가격 입력 필요' };
  }
  if (band === 'under_300m') {
    return { primaryPath: 'cash_or_small_loan', priceBand: band, reason: '3억 이하 주택은 현금매수 또는 소액대출 검토 영역' };
  }
  if (band === 'under_600m') {
    return { primaryPath: 'policy_loan_comparison', priceBand: band, reason: '디딤돌/보금자리론/일반주담대 비교 가능 구간' };
  }
  if (band === 'under_900m') {
    return { primaryPath: 'general_mortgage', priceBand: band, futureOptionalPath: 'newborn_special_refinance_if_child', reason: '일반 주담대 중심이며, 출산 후 신생아특례는 미래 후보' };
  }
  return { primaryPath: 'general_mortgage_only', priceBand: band, futureOptionalPath: 'limited_or_none', reason: '정책대출보다는 일반 시중은행 주담대 중심 구간' };
}

function isMetroArea(regionSido) {
  return ['서울', '경기', '인천'].indexOf(regionSido) !== -1;
}

function getPurchaseMortgageCapResult(price, isMetroOrRegulated) {
  if (!isMetroOrRegulated) return { amount: Infinity, status: 'not_applicable', label: '수도권·규제지역 외 cap 미적용' };
  var tiers = POLICY && POLICY.purchase_mortgage_cap && POLICY.purchase_mortgage_cap.tiers;
  if (!Array.isArray(tiers) || tiers.length === 0) return { amount: null, status: 'policy_data_missing', label: '주담대 cap 정책 데이터 없음' };
  var value = Number(price || 0);
  var matched = tiers.find(function (tier) {
    var min = Number(tier.price_min || 0);
    var max = Number(tier.price_max === undefined ? Infinity : tier.price_max);
    return value >= min && value <= max;
  });
  if (!matched) return { amount: null, status: 'policy_data_missing', label: '해당 가격 구간의 주담대 cap 정책 데이터 없음' };
  var amount = Number(matched.loan_cap === undefined ? matched.cap : matched.loan_cap);
  return isFinite(amount)
    ? { amount: amount, status: 'available', label: matched.label || won(amount) }
    : { amount: null, status: 'policy_data_missing', label: '주담대 cap 금액 데이터 없음' };
}

function getPurchaseMortgageCap(price, isMetroOrRegulated) {
  var result = getPurchaseMortgageCapResult(price, isMetroOrRegulated);
  return result.amount === null ? 0 : result.amount;
}

function getApplicableLtv(input) {
  var property = input.targetProperty || {};
  var buyerStatus = input.buyerStatus || {};
  var isFirstTimeBuyer = buyerStatus.isFirstTimeBuyer === true;
  var metro = property.isMetro === true || isMetroArea(property.regionSido) || property.regionType === 'metro';
  var regulated = property.isRegulatedArea === true || property.regionType === 'metro_regulated';
  var ltv = POLICY && POLICY.ltv ? POLICY.ltv : {};
  if (regulated) return Number(isFirstTimeBuyer ? ltv.regulated_first_buyer : ltv.regulated_general) || (isFirstTimeBuyer ? 0.70 : 0.40);
  if (metro) return Number(isFirstTimeBuyer ? ltv.metro_non_regulated_first_buyer : ltv.metro_non_regulated_general) || 0.70;
  return Number(isFirstTimeBuyer ? ltv.local_non_regulated_first_buyer : ltv.local_non_regulated_general) || (isFirstTimeBuyer ? 0.80 : 0.70);
}

function policyCandidate(status, reason, blockers) {
  return { status: status, reason: reason, blockers: blockers || [] };
}

function enrichPolicyCandidate(key, candidate) {
  var source = getPolicySourceMeta(key) || {};
  candidate.key = key;
  candidate.label = source.label || key;
  candidate.eligibilityStatus = candidate.status;
  candidate.dataStatus = candidate.status === 'policy_data_missing'
    ? POLICY_DATA_STATUS.POLICY_DATA_MISSING
    : (candidate.status === 'check_required' || !source.officialSourceName ? POLICY_DATA_STATUS.CHECK_REQUIRED : POLICY_DATA_STATUS.OFFICIAL_CONFIRMED);
  candidate.source = {
    officialSourceName: source.officialSourceName || '',
    officialAgency: source.officialAgency || '',
    sourcePathHint: source.sourcePathHint || '',
    lastCheckedAt: source.lastCheckedAt || null
  };
  candidate.missingFields = candidate.status === 'policy_data_missing' ? (source.requiredFields || []) : [];
  candidate.updateAction = candidate.status === 'policy_data_missing'
    ? '공식 확인처에서 필요한 값을 확인한 뒤 policy_rules.json에 반영하면 자동판정이 가능합니다.'
    : '';
  return candidate;
}

function evaluatePolicyLoanCandidates(input) {
  var property = input.targetProperty || {};
  var household = input.household || {};
  var loans = POLICY && POLICY.policy_loans ? POLICY.policy_loans : {};
  var price = Number(property.price || 0);
  var income = Number(household.combinedIncome || 0);
  var householdAssets = Number(household.assets || 0);
  var isNewlywed = household.isNewlywed === true;
  var hasNewborn = household.hasNewbornWithin2Years === true;
  var isFirstTimeBuyer = input.buyerStatus && input.buyerStatus.isFirstTimeBuyer === true;
  var result = {};
  var didimdol = loans.didimdol;
  if (!didimdol) {
    result.didimdol = policyCandidate('policy_data_missing', '디딤돌 정책 데이터 없음');
  } else if (property.transactionType !== 'purchase') {
    result.didimdol = policyCandidate('not_primary', '매매 거래가 아니므로 구입자금대출은 비주력');
  } else {
    var didimdolPriceMax = Number(isNewlywed ? didimdol.price_max_newlywed_or_two_children : didimdol.price_max_general) || 0;
    var didimdolIncomeMax = Number(isNewlywed ? didimdol.income_newlywed_max : didimdol.income_first_or_two_children_max) || 0;
    var didimdolBlockers = [];
    if (price > didimdolPriceMax) didimdolBlockers.push('주택가격 요건 초과');
    if (income > didimdolIncomeMax) didimdolBlockers.push('소득요건 초과');
    if (householdAssets > Number(didimdol.asset_max || Infinity)) didimdolBlockers.push('자산요건 초과');
    if (!isFirstTimeBuyer) didimdolBlockers.push('생애최초 여부 확인 필요');
    result.didimdol = didimdolBlockers.length
      ? policyCandidate('not_available', didimdolBlockers.join(', '), didimdolBlockers)
      : (isNewlywed
        ? policyCandidate('candidate', '주택가격, 소득, 자산요건 기준 검토 가능')
        : policyCandidate('check_required', '미혼 단독세대주 제한과 세대주 요건을 별도 확인해야 함', ['세대주 요건 확인']));
  }
  var bogeumjari = loans.bogeumjari;
  result.bogeumjari = bogeumjari
    ? policyCandidate('not_primary', '정책 데이터는 있으나 세부 자격 판정 로직 보강 필요')
    : policyCandidate('policy_data_missing', '보금자리론 정책 데이터가 없어 자동 판정하지 않음');
  var newborn = loans.newborn_didimdol;
  if (!newborn) {
    result.newbornSpecial = policyCandidate('policy_data_missing', '신생아특례 정책 데이터 없음');
  } else if (property.transactionType !== 'purchase') {
    result.newbornSpecial = policyCandidate('not_primary', '매매 거래가 아니므로 구입 신생아특례는 비주력');
  } else if (price > Number(newborn.price_max || 0)) {
    result.newbornSpecial = policyCandidate('not_available', '주택가격 요건 초과', ['주택가격 요건 초과']);
    result.newbornSpecial.nextAction = '목표 주택가격을 정책 요건 안으로 조정하는 경우 출산 후 미래 후보로 다시 검토';
  } else if (!hasNewborn) {
    result.newbornSpecial = policyCandidate('future_candidate', '출산 전이므로 현재 불가, 향후 출산 후 재검토');
  } else {
    result.newbornSpecial = policyCandidate('candidate', '출산 후 2년 이내 및 주택가격 요건 기준 검토 가능');
  }
  result.newbornSpecial.loanPurpose = property.loanPurpose || 'new_purchase';
  result.newbornSpecial.refinancingStatus = 'check_required';
  result.newbornSpecial.refinancingReason = '대환 조건은 정책 데이터에 명확한 자동 판정 기준이 없어 별도 확인 필요';
  var buttimmok = loans.newlywed_jeonse;
  if (!buttimmok) {
    result.buttimmokJeonse = policyCandidate('policy_data_missing', '버팀목 전세자금 정책 데이터 없음');
  } else if (property.transactionType !== 'jeonse') {
    result.buttimmokJeonse = policyCandidate('not_primary', '매매 거래유형이므로 전세대출은 비주력/비적용');
  } else {
    var depositMax = isMetroArea(property.regionSido) ? buttimmok.deposit_max_metro : buttimmok.deposit_max_other;
    var buttimmokBlockers = [];
    if (price > Number(depositMax || 0)) buttimmokBlockers.push('보증금 요건 초과');
    if (income > Number(buttimmok.income_newlywed_max || 0)) buttimmokBlockers.push('소득요건 초과');
    result.buttimmokJeonse = buttimmokBlockers.length
      ? policyCandidate('not_available', buttimmokBlockers.join(', '), buttimmokBlockers)
      : policyCandidate('candidate', '보증금과 소득요건 기준 검토 가능');
  }
  result.buttimmokJeonse.limitStatus = buttimmok && buttimmok.source && buttimmok.loan_max_metro && buttimmok.loan_max_other
    ? 'available'
    : 'policy_data_missing';
  if (result.buttimmokJeonse.limitStatus === 'policy_data_missing') {
    result.buttimmokJeonse.limitReason = '신혼부부 전용 버팀목 한도는 최신 주택도시기금 기준 확인이 필요합니다. 공식 정책 데이터가 입력되기 전까지 자동 한도 판정을 보류합니다.';
  }
  Object.keys(result).forEach(function (key) {
    result[key] = enrichPolicyCandidate(key, result[key]);
  });
  return result;
}

function buildPolicyResearchBacklog(policyLoanStatus) {
  if (policyLoadState.loadedFrom === 'fallback') return [];
  return Object.keys(policyLoanStatus || {}).reduce(function (items, key) {
    var item = policyLoanStatus[key];
    var source = getPolicySourceMeta(key) || item.source || {};
    var isNormalEligibilityResult = item.status === 'not_available' ||
      item.status === 'future_candidate' ||
      item.status === 'not_primary' ||
      item.status === 'candidate' ||
      item.status === 'possible';
    var needsUpdate = item.dataStatus === POLICY_DATA_STATUS.POLICY_DATA_MISSING ||
      item.dataStatus === POLICY_DATA_STATUS.CHECK_REQUIRED ||
      item.dataStatus === POLICY_DATA_STATUS.CONFLICTING_DATA ||
      item.missingFields.length > 0 ||
      !source.officialSourceName ||
      (!isNormalEligibilityResult && !source.lastCheckedAt);
    if (!needsUpdate) return items;
    items.push({
      key: key,
      label: item.label,
      reason: item.reason,
      officialSourceName: policySourceDisplayName(source),
      officialAgency: source.officialAgency,
      sourcePathHint: policySourcePathDisplay(source),
      missingFields: item.missingFields,
      priority: item.dataStatus === POLICY_DATA_STATUS.POLICY_DATA_MISSING ? 'P1' : 'P2',
      codeTarget: 'policy_rules.json',
      updateAction: item.updateAction || '공식 확인처에서 최신값을 확인하고 policy_rules.json을 갱신하세요.'
    });
    return items;
  }, []);
}

function buildFamilySupportReview(amount, type) {
  var value = parseNonNegativeNumber(amount, 0);
  var confirmed = value > 0 && type === 'gift_confirmed';
  return {
    amount: value,
    type: type || 'unknown',
    dsrIncomeIncluded: false,
    fundSourceIncluded: value > 0,
    status: value > 0 ? (confirmed ? 'confirmed' : 'tax_review_required') : 'none',
    warnings: value > 0 && !confirmed
      ? ['부모 지원금, 차용금, 증여는 자금출처 및 세무 검토가 필요한 항목입니다.', '실제 주택 취득 전 세무 전문가 확인이 필요합니다.']
      : []
  };
}

function buildCapitalSummary(cash, supportReview, weddingCost, purchaseCosts) {
  var confirmedCash = parseNonNegativeNumber(cash, 0);
  var conditionalSupport = supportReview.status === 'confirmed' ? 0 : supportReview.amount;
  var confirmedSupport = supportReview.status === 'confirmed' ? supportReview.amount : 0;
  var costs = parseNonNegativeNumber(weddingCost, 0) + parseNonNegativeNumber(purchaseCosts, 0);
  return {
    confirmedCash: confirmedCash,
    conditionalSupport: conditionalSupport,
    confirmedUsableCapital: Math.max(confirmedCash + confirmedSupport - costs, 0),
    conditionalUsableCapital: conditionalSupport,
    totalPotentialCapital: Math.max(confirmedCash + confirmedSupport + conditionalSupport - costs, 0)
  };
}

function buildFinancingStrategy(loanResult) {
  var manualIncomeKnown = loanResult.incomeSummary.dsrIncomeJointManual !== null;
  var soloSufficient = loanResult.primarySingleDsrLimit >= loanResult.requiredLoanAmount && loanResult.requiredLoanAmount <= loanResult.safeLoanAmount;
  var adjustmentRecommended = loanResult.requiredLoanAmount > loanResult.finalRecommendedLoan;
  return [
    {
      key: 'solo_primary_mortgage', label: '본인 단독 주담대', status: soloSufficient ? 'possible' : 'caution', priority: 1,
      reason: soloSufficient ? '본인 단독 DSR 한도와 생활안전 기준 안에서 필요대출액을 검토할 수 있습니다.' : '본인 단독 DSR 한도만으로는 현재 필요대출액을 충족하기 어렵습니다.',
      expectedBenefit: '차주 구조가 단순합니다.', blockers: soloSufficient ? [] : ['dsr_limit'], requiredChecks: ['보유현금 추가', '목표가격 조정', '공동차주 가능성 확인'], warnings: []
    },
    {
      key: 'joint_borrower', label: '공동차주 주담대', status: manualIncomeKnown ? 'possible' : 'check_required', priority: 2,
      reason: '소득 합산 효과가 있을 수 있으나 상대방의 기존 대출과 은행 인정소득도 함께 반영될 수 있습니다.',
      expectedBenefit: '은행 인정소득 확인 후 DSR 한도가 달라질 수 있습니다.', blockers: manualIncomeKnown ? [] : ['파트너 은행 인정소득 미확인'], requiredChecks: ['공동차주 인정소득 및 기존 부채 확인'], warnings: []
    },
    {
      key: 'before_marriage_registration', label: '혼인신고 전 신청', status: 'check_required', priority: 3,
      reason: '혼인신고 전후에 따라 세대 구성, 소득 합산, 무주택 판단, 정책대출 요건이 달라질 수 있습니다.',
      expectedBenefit: '조건 비교가 필요합니다.', blockers: [], requiredChecks: ['은행 및 세무 확인'], warnings: []
    },
    {
      key: 'after_marriage_registration', label: '혼인신고 후 신청', status: 'check_required', priority: 4,
      reason: '혼인신고 전후에 따라 세대 구성, 소득 합산, 무주택 판단, 정책대출 요건이 달라질 수 있습니다.',
      expectedBenefit: '조건 비교가 필요합니다.', blockers: [], requiredChecks: ['은행 및 세무 확인'], warnings: []
    },
    {
      key: 'newborn_future', label: '신생아특례 미래 후보', status: 'pending', priority: 5,
      reason: '출산 후 신청 시점과 주택가격 요건을 다시 확인해야 합니다.',
      expectedBenefit: '향후 비교 후보입니다.', blockers: [], requiredChecks: ['신규 구입 또는 대환 조건 확인'], warnings: []
    },
    {
      key: 'wait_or_adjust_budget', label: '매수 보류 / 현금 추가 / 가격 조정', status: adjustmentRecommended ? 'recommended' : 'pending', priority: 6,
      reason: adjustmentRecommended ? '현재 필요대출액이 권장 대출액을 초과합니다. 목표가격 조정, 확정 자기자본 추가, 공동차주 인정소득 확인이 필요합니다.' : '대출한도와 생활 감당 가능성을 함께 비교합니다.',
      expectedBenefit: '월 상환 부담을 낮출 수 있습니다.', blockers: [], requiredChecks: [], warnings: []
    }
  ];
}

function createDecisionCard(input) {
  var card = input || {};
  return {
    key: card.key || '',
    title: card.title || '',
    status: card.status || 'info',
    statusLabel: DECISION_CARD_STATUS_LABELS[card.status] || DECISION_CARD_STATUS_LABELS.info,
    summary: card.summary || '',
    reason: card.reason || '',
    evidence: card.evidence || [],
    blockers: card.blockers || [],
    requiredChecks: card.requiredChecks || [],
    nextActions: card.nextActions || [],
    warning: card.warning || ''
  };
}

function decisionStatusFromPolicyStatus(status) {
  if (status === 'candidate') return 'possible';
  if (status === 'future_candidate') return 'future_candidate';
  if (status === 'not_available') return 'not_available';
  if (status === 'policy_data_missing' || status === 'check_required') return 'check_required';
  return 'info';
}

function buildPolicyExitDecisionCards(loanResult) {
  var alternatives = {
    didimdol: '일반 주담대와 자기자본 구조를 우선 비교하세요.',
    bogeumjari: '공식 상품 기준을 확인한 뒤 일반 주담대와 다시 비교하세요.',
    newbornSpecial: '향후 조건 충족 시 신규 구입 또는 대환 후보로 다시 확인하세요.',
    buttimmokJeonse: '매매 대신 전세를 비교할 때 별도 경로로 검토하세요.'
  };
  return Object.keys(loanResult.policyLoanStatus || {}).map(function (key) {
    var item = loanResult.policyLoanStatus[key];
    var source = getPolicySourceMeta(key) || item.source || {};
    return createDecisionCard({
      key: 'policy_exit_' + key,
      title: item.label,
      status: decisionStatusFromPolicyStatus(item.status),
      summary: POLICY_STATUS_LABELS[item.status] || '확인 필요',
      reason: item.reason,
      evidence: [
        '공식 확인처: ' + policySourceDisplayName(source),
        '정책대출 판단용 소득: ' + won(loanResult.incomeSummary.policyEligibilityIncome),
        '목표 주택가격: ' + won(loanResult.targetProperty.price)
      ],
      blockers: item.blockers || [],
      requiredChecks: (item.missingFields || []).map(policyFieldLabel),
      nextActions: [item.nextAction || alternatives[key] || '공식자료를 확인한 뒤 대안 경로와 비교하세요.'],
      warning: item.status === 'policy_data_missing' ? '정책 데이터가 비어 있어 자동으로 결론내리지 않습니다.' : ''
    });
  });
}

function buildDecisionCards(loanResult) {
  var income = loanResult.incomeSummary;
  var capital = loanResult.capitalSummary;
  var ownershipInput = loanResult.ownershipInput;
  var partnerIncomeIsVariable = loanResult.job2 === 'self' || loanResult.job2 === 'freelance';
  var soloCanCoverRequired = loanResult.primarySingleDsrLimit >= loanResult.requiredLoanAmount;
  var affordabilityCanCoverRequired = loanResult.affordabilitySummary.selectedAffordabilityLoanLimit >= loanResult.requiredLoanAmount;
  var jointReferenceCanCoverRequired = loanResult.jointConservativeDsrLimit >= loanResult.requiredLoanAmount;
  var partnerManualIncomeKnown = income.dsrIncomeJointManual !== null;
  var policyExitCards = buildPolicyExitDecisionCards(loanResult);
  var unresolvedItems = [];

  if (!partnerManualIncomeKnown && loanResult.income2 > 0) unresolvedItems.push('파트너 은행 인정소득 확인');
  if (capital.conditionalSupport > 0) unresolvedItems.push('조건부 자금의 지원·차용·증여 성격 확인');
  if (ownershipInput.intendedOwnershipType === 'undecided') unresolvedItems.push('명의 구조와 실제 자금 기여비율 확인');
  if (loanResult.policyResearchBacklog.length > 0) unresolvedItems.push('최신화가 필요한 정책 데이터 공식자료 확인');

  var caseSummary = createDecisionCard({
    key: 'case_summary',
    title: '현재 입력값 요약',
    status: 'info',
    summary: '현재 입력값 기준으로 정책대출, 일반 주담대, 자기자본, DSR, 생활감당 가능성을 분리해 비교해야 하는 케이스입니다.',
    reason: loanResult.primaryPathReason,
    evidence: [
      '정책대출 판단용 소득: ' + won(income.policyEligibilityIncome),
      'DSR 공동차주 보수 시나리오 소득: ' + won(income.dsrIncomeJointConservative),
      '목표 주택가격: ' + won(loanResult.targetProperty.price),
      '확정 자기자본: ' + won(capital.confirmedUsableCapital),
      '조건부 자금: ' + won(capital.conditionalSupport)
    ],
    nextActions: ['정책대출 적격성과 일반 주담대 실행 가능성을 별도 축으로 확인하세요.']
  });

  var incomeSeparationCard = createDecisionCard({
    key: 'income_basis_separation',
    title: '소득 기준 분리',
    status: partnerManualIncomeKnown ? 'possible' : 'check_required',
    summary: '정책대출 판단용 소득과 DSR 보수 시나리오 소득을 혼용하지 않습니다.',
    reason: '정책대출 판단에는 입력 세전 합산소득을 사용하고, 보수 인정률은 DSR 시뮬레이션 참고값에만 적용합니다.',
    evidence: [
      '정책대출 판단용 소득: ' + won(income.policyEligibilityIncome),
      'DSR 보수 시나리오: ' + won(income.dsrIncomeJointConservative),
      'DSR 100% 인정 가정: ' + won(income.dsrIncomeJointFull),
      '파트너 은행 인정소득 직접입력 기준: ' + (income.dsrIncomeJointManual === null ? '확인 필요' : won(income.dsrIncomeJointManual))
    ],
    requiredChecks: partnerManualIncomeKnown ? [] : ['파트너 은행 인정소득 직접입력'],
    warning: '75%는 공식 정책대출 소득 기준이 아니라 자영업자·프리랜서 DSR 보수 시나리오의 기본 가정입니다.'
  });

  var mortgagePathCard = createDecisionCard({
    key: 'general_mortgage_path',
    title: '일반 주담대 실행 경로',
    status: loanResult.finalRecommendedLoan >= loanResult.requiredLoanAmount ? 'possible' : 'caution',
    summary: '현재 입력값 기준으로 일반 주담대의 제도상 한도와 생활감당 한도를 함께 비교합니다.',
    reason: 'LTV, 주택가격별 cap, DSR, 생활감당 역산 한도 중 낮은 값이 실제 검토 범위를 제한합니다.',
    evidence: [
      '생애최초 여부: ' + (loanResult.firstBuyer === 'yes' ? '예' : '아니오 / 확인 필요'),
      'LTV 기준 한도: ' + won(loanResult.ltvLimit),
      '주택가격별 cap: ' + (isFinite(loanResult.purchaseMortgageCap) ? won(loanResult.purchaseMortgageCap) : 'cap 미적용 또는 확인 필요'),
      'DSR 한도: ' + won(loanResult.loanByDsr),
      '생활감당 역산 한도: ' + won(loanResult.affordabilitySummary.selectedAffordabilityLoanLimit),
      '최종 권장 대출액 병목: ' + loanResult.loanLimitBottleneck.label,
      '확정 자기자본 기준 필요대출: ' + won(loanResult.requiredLoanAmount),
      '조건부 자금 포함 기준 필요대출: ' + won(loanResult.conditionalRequiredLoanAmount)
    ],
    blockers: loanResult.finalRecommendedLoan >= loanResult.requiredLoanAmount ? [] : [loanResult.loanLimitBottleneck.label],
    nextActions: ['8억·9억·10억 등 목표가격별 생활감당 결과를 비교하세요.'],
    warning: '은행 승인 가능액을 확정하는 카드가 아닙니다.'
  });

  var borrowerStructureCards = [
    createDecisionCard({
      key: 'borrower_primary_only',
      title: '본인 단독차주',
      status: soloCanCoverRequired && affordabilityCanCoverRequired ? 'possible' : 'caution',
      summary: soloCanCoverRequired ? '본인 단독 DSR 한도 안에서 필요대출액 비교가 가능합니다.' : '본인 단독 DSR 한도만으로는 현재 필요대출액 충족이 어려울 수 있습니다.',
      reason: '단독차주는 구조가 단순하지만 DSR과 생활감당 기준을 함께 통과해야 합니다.',
      evidence: ['본인 단독 DSR 한도: ' + won(loanResult.primarySingleDsrLimit), '확정 자기자본 기준 필요대출: ' + won(loanResult.requiredLoanAmount)],
      blockers: soloCanCoverRequired ? [] : ['본인 단독 DSR 한도 부족 가능성'],
      requiredChecks: ['조건부 자금 없이 가능한지 확인', '생활감당 한도 안에 들어오는지 확인'],
      nextActions: soloCanCoverRequired ? [] : ['자기자본 추가, 목표가격 조정, 공동차주 가능성을 비교하세요.']
    }),
    createDecisionCard({
      key: 'borrower_joint',
      title: '공동차주',
      status: partnerManualIncomeKnown ? (jointReferenceCanCoverRequired ? 'possible' : 'caution') : 'check_required',
      summary: '공동차주는 소득 합산 효과가 있을 수 있으나 자동으로 정답이 되지는 않습니다.',
      reason: '파트너의 은행 인정소득과 기존 부채, 소득 단절 시 상환 가능성을 함께 확인해야 합니다.',
      evidence: [
        '공동차주 보수 DSR 한도: ' + won(loanResult.jointConservativeDsrLimit),
        '공동차주 100% 인정 가정 한도: ' + won(loanResult.jointFullDsrLimit),
        '은행 인정소득 직접입력 한도: ' + (loanResult.jointManualDsrLimit === null ? '확인 필요' : won(loanResult.jointManualDsrLimit))
      ],
      blockers: partnerManualIncomeKnown ? [] : ['파트너 은행 인정소득 미확인'],
      requiredChecks: ['파트너 기존 부채 확인', '파트너 소득 단절 시나리오 확인'],
      nextActions: ['은행 인정소득을 확인한 뒤 공동차주 한도를 다시 계산하세요.']
    })
  ];

  var ownershipStructureCards = [
    createDecisionCard({
      key: 'ownership_contribution_review',
      title: '명의·자금기여 구조',
      status: 'check_required',
      summary: '명의 구조는 실제 자금 기여비율, 차용·증여 여부, 대출 구조에 따라 달라질 수 있습니다.',
      reason: '현재 화면에는 당사자별 기여금과 예정 명의비율을 입력받지 않으므로 확정 권고를 만들지 않습니다.',
      evidence: [
        '본인 측 확인 자금: ' + won(ownershipInput.primaryContribution),
        '파트너 기여금: ' + (ownershipInput.partnerContribution === null ? '미입력' : won(ownershipInput.partnerContribution)),
        '가족 지원 예정액: ' + won(ownershipInput.familySupportAmount),
        '예정 명의 구조: ' + ownershipInput.intendedOwnershipType
      ],
      requiredChecks: ['당사자별 실제 자금 기여비율', '차용·증여 여부', '예정 명의비율', '대출 명의와 상환 흐름'],
      nextActions: ['실제 계약 전 세무 전문가에게 명의와 자금출처 구조를 확인하세요.']
    })
  ];

  var incomeRiskCards = [incomeSeparationCard];
  if (partnerIncomeIsVariable) {
    incomeRiskCards.push(createDecisionCard({
      key: 'partner_variable_income_risk',
      title: '파트너 프리랜서·자영업자 소득 리스크',
      status: partnerManualIncomeKnown ? 'caution' : 'check_required',
      summary: '프리랜서·자영업자 소득은 실제 은행 인정소득이 입력값과 다를 수 있습니다.',
      reason: '보수 인정 시나리오와 100% 인정 가정은 참고값이며 실제 실행 전 은행 확인이 필요합니다.',
      evidence: [
        '입력 소득: ' + won(income.partnerGrossIncome),
        '보수 인정 시나리오: ' + won(income.partnerConservativeRecognizedIncome),
        '100% 인정 가정: ' + won(income.partnerFullRecognizedIncome),
        '은행 인정소득 직접입력: ' + (income.partnerManualBankRecognizedIncome === null ? '미입력' : won(income.partnerManualBankRecognizedIncome)),
        '파트너 소득 제외 시 본인 단독 DSR 충족 여부: ' + (soloCanCoverRequired ? '검토 가능' : '부족 가능성')
      ],
      blockers: partnerManualIncomeKnown ? [] : ['은행 인정소득 미확인'],
      requiredChecks: ['소득증빙 기준', '은행 인정소득', '파트너 소득 단절 시 생활감당 가능성'],
      nextActions: soloCanCoverRequired ? ['파트너 소득을 여유분으로 보는 보수 시나리오를 비교하세요.'] : ['주택가격 하향, 시점 조정, 확정 자기자본 추가를 비교하세요.']
    }));
  }

  var complianceRiskCards = [
    createDecisionCard({
      key: 'compliance_reported_income',
      title: '신고소득 왜곡 경로 차단',
      status: 'danger',
      summary: '신고소득을 사실과 다르게 구성해 정책대출 요건을 맞추는 경로는 계산하지 않습니다.',
      reason: '정상 신고와 공식 소득증빙을 기준으로만 대안 경로를 비교해야 합니다.',
      nextActions: ['정상 신고소득 기준으로 일반 주담대와 정책대출 후보를 다시 비교하세요.'],
      warning: '사실과 다른 신고소득 구성은 법적·세무상 중대한 리스크가 있습니다.'
    }),
    createDecisionCard({
      key: 'compliance_ownership_mismatch',
      title: '명의비율과 자금기여 불일치 확인',
      status: 'check_required',
      summary: '명의비율과 실제 자금 기여비율이 크게 다르면 세무 검토가 필요할 수 있습니다.',
      reason: '현재 당사자별 기여비율 입력값이 없어 자동 판정하지 않습니다.',
      requiredChecks: ['실제 자금 기여비율', '명의비율', '자금출처'],
      warning: '증여세 등 세무 리스크는 실제 자금흐름 기준으로 전문가 확인이 필요합니다.'
    }),
    createDecisionCard({
      key: 'compliance_loan_document',
      title: '차용증 안전 단정 금지',
      status: loanResult.familySupportType === 'loan' ? 'caution' : 'info',
      summary: '차용증은 자금관계 설명에 도움이 될 수 있으나 그 자체로 세무상 안전을 보장하지 않습니다.',
      reason: '상환능력, 이자, 송금흐름 등 별도 사실관계를 함께 확인해야 합니다.',
      requiredChecks: ['상환능력', '이자 조건', '실제 송금 및 상환 흐름']
    })
  ];

  var futureOptionCards = [
    createDecisionCard({
      key: 'future_newborn_special',
      title: '신생아특례 미래 후보',
      status: 'future_candidate',
      summary: '현재 실행 가능 여부와 별개로 향후 조건 충족 시 신규 구입 또는 대환 후보로 재검토할 수 있습니다.',
      reason: '신청 시점의 출산, 주택가격, 소득, 자산, 신규·대환 조건을 공식자료로 다시 확인해야 합니다.',
      requiredChecks: ['신청 시점 공식 정책', '신규 구입과 대환 조건 차이'],
      warning: '미래의 적용 가능성을 확정하지 않습니다.'
    }),
    createDecisionCard({
      key: 'future_capital',
      title: '확정 자기자본 추가 확보',
      status: 'future_candidate',
      summary: '확정 자기자본이 늘어나면 필요대출액과 월 상환 부담이 함께 낮아집니다.',
      evidence: ['현재 확정 자기자본: ' + won(capital.confirmedUsableCapital), '조건부 자금: ' + won(capital.conditionalSupport)]
    }),
    createDecisionCard({
      key: 'future_region_compare',
      title: '지역 조건 재탐색',
      status: 'future_candidate',
      summary: '규제지역과 비규제지역을 나누어 LTV와 cap 적용 여부를 다시 비교할 수 있습니다.',
      requiredChecks: ['신청 시점 규제지역 목록', '주택별 실제 담보평가']
    })
  ];

  var actionPlanCards = [
    ['파트너 은행 인정소득 확인', !partnerManualIncomeKnown && loanResult.income2 > 0],
    ['확정 자기자본과 조건부 자금 분리 확인', true],
    ['가족 지원금의 지원·차용·증여 성격 확인', capital.conditionalSupport > 0],
    ['목표 주택가격별 생활감당 비교', true],
    ['규제지역·비규제지역별 LTV와 cap 재계산', true],
    ['혼인신고 시점에 따른 세대·정책대출 요건 확인', true],
    ['출산 계획이 있다면 신생아특례를 미래 후보로 관리', true]
  ].filter(function (item) { return item[1]; }).map(function (item, index) {
    return createDecisionCard({
      key: 'action_plan_' + (index + 1),
      title: (index + 1) + '. ' + item[0],
      status: index === 0 ? 'recommended' : 'check_required',
      summary: '확정 조언이 아니라 현재 입력값 기준의 확인 순서입니다.'
    });
  });

  return {
    caseSummary: caseSummary,
    policyExitCards: policyExitCards,
    mortgagePathCard: mortgagePathCard,
    borrowerStructureCards: borrowerStructureCards,
    ownershipStructureCards: ownershipStructureCards,
    incomeRiskCards: incomeRiskCards,
    complianceRiskCards: complianceRiskCards,
    futureOptionCards: futureOptionCards,
    actionPlanCards: actionPlanCards,
    unresolvedItems: unresolvedItems
  };
}

function calculateLoanPrincipalFromPayment(monthlyPayment, annualRate, years) {
  if (monthlyPayment <= 0 || years <= 0) return 0;
  var monthlyRate = annualRate / 12;
  var months = years * 12;
  if (monthlyRate === 0) return monthlyPayment * months;
  return monthlyPayment * (Math.pow(1 + monthlyRate, months) - 1) / (monthlyRate * Math.pow(1 + monthlyRate, months));
}

function calculateEqualPaymentMonthlyPayment(principal, annualRate, years) {
  var loan = parseNonNegativeNumber(principal, 0);
  var rate = parseNonNegativeNumber(annualRate, 0);
  var term = parseNonNegativeNumber(years, 0);
  var r = rate / 12;
  var n = term * 12;
  if (loan <= 0 || term <= 0) return 0;
  if (r <= 0) return loan / n;
  return loan * r / (1 - Math.pow(1 + r, -n));
}

function reverseLoanFromEqualPayment(monthlyPayment, annualRate, years) {
  var payment = parseNonNegativeNumber(monthlyPayment, 0);
  var rate = parseNonNegativeNumber(annualRate, 0);
  var term = parseNonNegativeNumber(years, 0);
  var r = rate / 12;
  var n = term * 12;
  if (payment <= 0 || term <= 0) return 0;
  if (r <= 0) return payment * n;
  return payment * (1 - Math.pow(1 + r, -n)) / r;
}

function calculateEqualPrincipalFirstMonthPayment(principal, annualRate, years) {
  var loan = parseNonNegativeNumber(principal, 0);
  var rate = parseNonNegativeNumber(annualRate, 0);
  var term = parseNonNegativeNumber(years, 0);
  var n = term * 12;
  var r = rate / 12;
  if (loan <= 0 || term <= 0) return 0;
  return (loan / n) + (loan * r);
}

function reverseLoanFromEqualPrincipalFirstMonth(monthlyPayment, annualRate, years) {
  var payment = parseNonNegativeNumber(monthlyPayment, 0);
  var rate = parseNonNegativeNumber(annualRate, 0);
  var term = parseNonNegativeNumber(years, 0);
  var n = term * 12;
  var r = rate / 12;
  if (payment <= 0 || term <= 0) return 0;
  return payment / ((1 / n) + r);
}

// 원리금 균등상환 월납입액
function calcMonthlyPayment(principal, annualRate, years) {
  return calculateEqualPaymentMonthlyPayment(principal, annualRate, years);
}

// ─────────────────────────────────────────
//  프로필 입력 감지
// ─────────────────────────────────────────
function onProfileChange() {
  var job1 = getSelect('job1');
  var job2 = getSelect('job2');
  var note1 = document.getElementById('row-income1-note');
  var note2 = document.getElementById('row-income2-note');
  if (note1) note1.style.display = (job1 !== 'employee') ? 'flex' : 'none';
  if (note2) note2.style.display = (job2 !== 'employee') ? 'flex' : 'none';

  updateProfileSummary();
}

function updateProfileSummary() {
  var income1 = getInput('income1');
  var income2 = getInput('income2');
  var job1 = getSelect('job1');
  var job2 = getSelect('job2');
  var cash = getInput('cash');
  var support = getInput('support');
  var familySupportType = getSelect('family_support_type') || 'unknown';
  var weddingCost = getInput('wedding_cost');
  var purchaseCosts = getInput('purchase_costs');
  var monthlyLiving = getInput('monthly_living');

  var totalIncome = income1 + income2;
  var familySupportReview = buildFamilySupportReview(support, familySupportType);
  var equity = buildCapitalSummary(cash, familySupportReview, weddingCost, purchaseCosts).confirmedUsableCapital;
  var netM1 = monthlyNetIncome(income1, job1);
  var netM2 = monthlyNetIncome(income2, job2);
  var recurringAdditionalIncome = buildAdditionalIncomeReview(state.additionalIncomes).recurringCashflowIncome / 12;
  var disposable = netM1 + netM2 + recurringAdditionalIncome - monthlyLiving;

  document.getElementById('psb-income').textContent = totalIncome > 0 ? won(totalIncome) : '—';
  document.getElementById('psb-equity').textContent = equity > 0 ? won(equity) : '—';
  document.getElementById('psb-disposable').textContent = disposable > 0 ? (won(disposable) + '/월') : '—';

  // 정책대출 가능 여부 간단 체크
  var married = getSelect('married');
  var policyEl = document.getElementById('psb-policy');
  if (policyEl && POLICY) {
    var dl = POLICY.policy_loans.didimdol;
    var incomeLimit = married === 'yes' ? dl.income_newlywed_max : dl.income_first_or_two_children_max;
    if (totalIncome > 0 && totalIncome <= incomeLimit) {
      policyEl.textContent = '디딤돌 적격 가능';
      policyEl.style.color = '#4caf50';
    } else if (totalIncome > 0) {
      policyEl.textContent = '일반 주담대';
      policyEl.style.color = '#ff9800';
    } else {
      policyEl.textContent = '—';
      policyEl.style.color = '#fff';
    }
  }
}

function togglePropFields() {
  var type = getSelect('prop-type');
  var monthlyRows = document.querySelectorAll('.prop-monthly-row');
  var priceRow = document.getElementById('prop-price-row');
  if (type === 'monthly') {
    monthlyRows.forEach(function (r) { r.style.display = 'flex'; });
    if (priceRow) priceRow.style.display = 'none';
  } else {
    monthlyRows.forEach(function (r) { r.style.display = 'none'; });
    if (priceRow) priceRow.style.display = 'flex';
  }
}

// ─────────────────────────────────────────
//  대출 한도 계산 (탭2)
// ─────────────────────────────────────────
function calcLoan() {
  if (!POLICY) { alert('정책 데이터 로딩 중입니다. 잠시 후 다시 시도해주세요.'); return; }

  var income1 = getInput('income1');
  var income2 = getInput('income2');
  var job1 = getSelect('job1');
  var job2 = getSelect('job2');
  var cash = getInput('cash');
  var support = getInput('support');
  var familySupportType = getSelect('family_support_type') || 'unknown';
  var weddingCost = getInput('wedding_cost');
  var existingDebt = getInput('existing_debt');
  var monthlyDebt = getInput('monthly_debt');
  var monthlyLiving = getInput('monthly_living');
  var regionType = getSelect('region_type');
  var firstBuyer = getSelect('first_buyer');
  var married = getSelect('married');
  var transactionType = getSelect('target_transaction_type') || 'purchase';
  var targetPrice = getInput('target_property_price');
  var regionSido = (document.getElementById('region_sido').value || '').trim();
  var regionSigungu = (document.getElementById('region_sigungu').value || '').trim();
  var regulatedValue = getSelect('target_is_regulated');
  var isRegulatedArea = regulatedValue === 'yes' || (regulatedValue === 'auto' && regionType === 'metro_regulated');
  var purchaseCosts = getInput('purchase_costs');
  var loanTermYears = getInput('loan_term_years') || 30;
  var mortgageRateInput = getInput('mortgage_rate');
  var repaymentType = getSelect('repayment_type') || 'equal_payment';
  var existingDebtAnnualPayment = getInput('existing_debt_annual_payment');
  var partnerRecognizedInput = getInput('partner_recognized_income');
  var hasNewbornWithin2Years = getSelect('has_newborn_within_2_years') === 'yes';
  var isLandTransactionPermitZone = getSelect('is_land_transaction_permit_zone') === 'yes';

  if (income1 <= 0 && income2 <= 0) {
    alert('소득 정보를 입력해주세요.');
    return;
  }

  var recIncome1 = recognizedIncome(income1, job1);
  var estimatedRecIncome2 = recognizedIncome(income2, job2);
  var fullRecIncome2 = recognizedIncomeFullScenario(income2);
  var isPartnerIncomeUnknown = income2 > 0 && (job2 === 'self' || job2 === 'freelance') && partnerRecognizedInput <= 0;
  var additionalIncomeReview = buildAdditionalIncomeReview(state.additionalIncomes);
  var recognizedAdditionalIncome = additionalIncomeReview.recognizedForLoanIncome;
  var primarySingleRecognizedIncome = recIncome1;
  var dsrIncomeJointConservative = recIncome1 + estimatedRecIncome2 + recognizedAdditionalIncome;
  var dsrIncomeJointFull = recIncome1 + fullRecIncome2 + recognizedAdditionalIncome;
  var dsrIncomeJointManual = partnerRecognizedInput > 0 ? recIncome1 + partnerRecognizedInput + recognizedAdditionalIncome : null;
  var totalRecognizedIncome = dsrIncomeJointManual === null ? dsrIncomeJointConservative : dsrIncomeJointManual;
  var monthlyRecognized = totalRecognizedIncome / 12;
  var policyEligibilityIncome = income1 + income2;
  var incomeSummary = {
    grossHouseholdIncome: policyEligibilityIncome,
    policyEligibilityIncome: policyEligibilityIncome,
    primaryGrossIncome: income1,
    partnerGrossIncome: income2,
    partnerConservativeRecognizedIncome: estimatedRecIncome2,
    partnerFullRecognizedIncome: fullRecIncome2,
    partnerManualBankRecognizedIncome: partnerRecognizedInput > 0 ? partnerRecognizedInput : null,
    dsrIncomeSingle: primarySingleRecognizedIncome,
    dsrIncomeJointConservative: dsrIncomeJointConservative,
    dsrIncomeJointFull: dsrIncomeJointFull,
    dsrIncomeJointManual: dsrIncomeJointManual,
    recognizedAdditionalIncome: recognizedAdditionalIncome,
    activeDsrIncome: totalRecognizedIncome,
    activeDsrScenario: dsrIncomeJointManual === null ? 'joint_conservative' : 'joint_manual'
  };

  var isMetro = isMetroArea(regionSido) || regionType !== 'other';
  var isRegulated = isRegulatedArea;
  var profileInput = {
    targetProperty: {
      transactionType: transactionType,
      price: targetPrice,
      regionSido: regionSido,
      regionSigungu: regionSigungu,
      regionType: regionType,
      isMetro: isMetro,
      isRegulatedArea: isRegulated,
      isLandTransactionPermitZone: isLandTransactionPermitZone,
      loanPurpose: 'new_purchase'
    },
    buyerStatus: { isFirstTimeBuyer: firstBuyer === 'yes' },
    household: {
      isNewlywed: married === 'yes',
      hasNewbornWithin2Years: hasNewbornWithin2Years,
      combinedIncome: policyEligibilityIncome,
      assets: cash + support
    }
  };
  var primaryLoanPath = determinePrimaryLoanPath(profileInput);
  var policyLoanStatus = evaluatePolicyLoanCandidates(profileInput);

  // 스트레스 금리 — 새 JSON 구조 반영
  var stressInfo = (isMetro || isRegulated)
    ? POLICY.dsr.stress.metro_or_regulated
    : POLICY.dsr.stress.local_non_regulated;
  var stressRate = stressInfo.effective_rate !== undefined
    ? stressInfo.effective_rate          // 지방: 1.5%×50% = 0.75%
    : stressInfo.base_rate;              // 수도권: 3.0%

  // 기준 금리 — 시나리오 base 사용 (한국은행 기준금리 + 스프레드 반영)
  var baseRate = mortgageRateInput > 0 ? mortgageRateInput / 100 : POLICY.market_rates.mortgage.base;
  var effectiveRate = baseRate + stressRate;

  // DSR 40% 기준 최대 월 상환 가능액 (기존 부채 차감)
  var dsrLimit = POLICY.dsr.bank_limit;
  var annualDebtPayment = existingDebtAnnualPayment > 0 ? existingDebtAnnualPayment : monthlyDebt * 12;
  monthlyDebt = annualDebtPayment / 12;
  var dsrMonthlyMax = monthlyRecognized * dsrLimit - monthlyDebt;
  dsrMonthlyMax = Math.max(dsrMonthlyMax, 0);

  function dsrLoanLimit(recognizedAnnualIncome, rate) {
    if (recognizedAnnualIncome === null) return null;
    return calculateLoanPrincipalFromPayment(Math.max(recognizedAnnualIncome / 12 * dsrLimit - monthlyDebt, 0), rate, loanTermYears);
  }
  var primarySingleDsrLimit = dsrLoanLimit(primarySingleRecognizedIncome, effectiveRate);
  var jointConservativeDsrLimit = dsrLoanLimit(dsrIncomeJointConservative, effectiveRate);
  var jointFullDsrLimit = dsrLoanLimit(dsrIncomeJointFull, effectiveRate);
  var jointManualDsrLimit = dsrLoanLimit(dsrIncomeJointManual, effectiveRate);
  var jointDsrLimit = jointManualDsrLimit === null ? jointConservativeDsrLimit : jointManualDsrLimit;
  var loanByDsr = dsrLoanLimit(totalRecognizedIncome, effectiveRate);
  var loanByDsrNoStress = dsrLoanLimit(totalRecognizedIncome, baseRate);

  // 확정 자금과 세무 확인이 필요한 조건부 자금을 분리
  var familySupportReview = buildFamilySupportReview(support, familySupportType);
  var capitalSummary = buildCapitalSummary(cash, familySupportReview, weddingCost, purchaseCosts);
  var availableCash = capitalSummary.confirmedCash;
  var equity = capitalSummary.confirmedUsableCapital;

  // LTV와 수도권·규제지역 가격 구간별 cap을 각각 적용
  var ltvRate = getApplicableLtv(profileInput);
  var ltvLimit = transactionType === 'purchase' ? Math.max(targetPrice * ltvRate, 0) : 0;
  var capResult = getPurchaseMortgageCapResult(targetPrice, isMetro || isRegulated);
  var purchaseMortgageCap = capResult.amount;
  var systemMaxLoanBeforeDsr = purchaseMortgageCap === null ? 0 : Math.min(ltvLimit, purchaseMortgageCap);
  var finalLoanLimit = Math.min(loanByDsr, systemMaxLoanBeforeDsr);
  var requiredLoanAmount = transactionType === 'purchase' ? Math.max(targetPrice - capitalSummary.confirmedUsableCapital, 0) : 0;
  var conditionalRequiredLoanAmount = transactionType === 'purchase' ? Math.max(targetPrice - capitalSummary.totalPotentialCapital, 0) : 0;
  var loanLimitShortage = transactionType === 'purchase' ? Math.max(requiredLoanAmount - finalLoanLimit, 0) : 0;
  var requiredMonthlyPayment = calcMonthlyPayment(requiredLoanAmount, baseRate, loanTermYears);

  // 생활 감당 가능성: 월 50만원 완충액을 남기는 보수적 권장액
  var monthlyNet = monthlyNetIncome(income1, job1) + monthlyNetIncome(income2, job2) + additionalIncomeReview.recurringCashflowIncome / 12;
  var safeMonthlyPayment = Math.max(Math.min(monthlyRecognized * 0.25 - monthlyDebt, monthlyNet - monthlyLiving - monthlyDebt - 500000), 0);
  var affordabilityLoanLimitEqualPayment = reverseLoanFromEqualPayment(safeMonthlyPayment, baseRate, loanTermYears);
  var affordabilityLoanLimitEqualPrincipal = reverseLoanFromEqualPrincipalFirstMonth(safeMonthlyPayment, baseRate, loanTermYears);
  var selectedAffordabilityLoanLimit = repaymentType === 'equal_principal'
    ? affordabilityLoanLimitEqualPrincipal
    : affordabilityLoanLimitEqualPayment;
  var requiredMonthlyPaymentEqualPayment = calculateEqualPaymentMonthlyPayment(requiredLoanAmount, baseRate, loanTermYears);
  var requiredFirstMonthPaymentEqualPrincipal = calculateEqualPrincipalFirstMonthPayment(requiredLoanAmount, baseRate, loanTermYears);
  var selectedRequiredPayment = repaymentType === 'equal_principal'
    ? requiredFirstMonthPaymentEqualPrincipal
    : requiredMonthlyPaymentEqualPayment;
  var affordabilityGapMonthly = Math.max(selectedRequiredPayment - safeMonthlyPayment, 0);
  var affordabilityRatio = safeMonthlyPayment > 0 ? selectedRequiredPayment / safeMonthlyPayment : Infinity;
  var affordabilityRiskLevel = affordabilityRatio <= AFFORDABILITY_RISK_THRESHOLDS.cautionRatio
    ? 'safe'
    : (affordabilityRatio <= AFFORDABILITY_RISK_THRESHOLDS.dangerRatio ? 'caution' : 'danger');
  var affordabilitySummary = {
    monthlyNetIncome: monthlyNet,
    monthlyLivingCost: monthlyLiving,
    monthlyDebtPayment: monthlyDebt,
    monthlySavingTarget: 0,
    emergencyBuffer: 500000,
    safeMonthlyPayment: safeMonthlyPayment,
    repaymentType: repaymentType,
    affordabilityLoanLimitEqualPayment: affordabilityLoanLimitEqualPayment,
    affordabilityLoanLimitEqualPrincipal: affordabilityLoanLimitEqualPrincipal,
    selectedAffordabilityLoanLimit: selectedAffordabilityLoanLimit,
    requiredMonthlyPaymentEqualPayment: requiredMonthlyPaymentEqualPayment,
    requiredFirstMonthPaymentEqualPrincipal: requiredFirstMonthPaymentEqualPrincipal,
    selectedRequiredPayment: selectedRequiredPayment,
    affordabilityGapMonthly: affordabilityGapMonthly,
    affordabilityRiskLevel: affordabilityRiskLevel
  };
  var safeLoanAmount = Math.min(selectedAffordabilityLoanLimit, finalLoanLimit);
  var finalRecommendedLoan = Math.min(systemMaxLoanBeforeDsr, loanByDsr, selectedAffordabilityLoanLimit, requiredLoanAmount);
  var affordabilityShortage = Math.max(requiredLoanAmount - finalRecommendedLoan, 0);
  var loanLimitBottleneckCandidates = [
    { type: 'ltv_or_cap', label: 'LTV / 주담대 cap', amount: systemMaxLoanBeforeDsr, reason: 'LTV와 주담대 cap 중 더 낮은 제도상 한도' },
    { type: 'dsr', label: 'DSR', amount: loanByDsr, reason: '선택된 공동차주 인정소득 기준 DSR 한도' },
    { type: 'affordability', label: '생활감당', amount: selectedAffordabilityLoanLimit, reason: '안전 월 상환 가능액에서 역산한 한도' },
    { type: 'cash', label: '필요대출', amount: requiredLoanAmount, reason: '확정 자기자본 기준 실제 필요대출액' }
  ];
  var loanLimitBottleneck = loanLimitBottleneckCandidates.reduce(function (lowest, item) {
    return item.amount < lowest.amount ? item : lowest;
  });
  var totalBuyingPower = equity + finalLoanLimit;

  var riskLevel = 'safe';
  var blocker = 'none';
  var nextActions = additionalIncomeReview.nextActions.slice();
  familySupportReview.warnings.forEach(function (warning) { nextActions.push(warning); });
  if (isLandTransactionPermitZone) {
    nextActions.push('토지거래허가구역 여부가 입력되었습니다. 허가, 실거주 및 대출 취급 조건을 별도 확인하세요.');
  }
  if (isPartnerIncomeUnknown) {
    nextActions.push('파트너의 은행 인정소득이 아직 확인되지 않았습니다. 실제 실행 전 은행 심사 기준 소득을 확인하세요.');
  }
  if (primaryLoanPath.priceBand === 'unknown') {
    riskLevel = 'pending'; blocker = 'missing_target_price';
    nextActions.push('목표 주택가격을 입력하세요.');
  } else if (capResult.status === 'policy_data_missing') {
    riskLevel = 'unavailable'; blocker = 'policy';
    nextActions.push('주담대 cap 정책 데이터를 확인하세요.');
  } else if (isPartnerIncomeUnknown && requiredLoanAmount > primarySingleDsrLimit) {
    riskLevel = 'caution'; blocker = 'unknown_partner_income';
    nextActions.push('보수 인정 및 100% 인정 가정은 참고용입니다. 파트너의 은행 인정소득을 확인하고 공동차주 한도를 다시 계산하세요.');
  } else if (loanLimitShortage > 0) {
    riskLevel = 'danger'; blocker = finalLoanLimit < systemMaxLoanBeforeDsr ? 'dsr' : 'cash';
    nextActions.push('필요 현금을 줄이거나 목표가격을 조정하세요.');
  } else if (requiredLoanAmount > safeLoanAmount) {
    riskLevel = 'caution'; blocker = 'affordability';
    nextActions.push('제도상 가능액과 별개로 월 상환 부담을 낮추는 구조를 검토하세요.');
  }

  // 결과 저장
  state.loanResult = {
    primaryPath: primaryLoanPath.primaryPath,
    primaryPathReason: primaryLoanPath.reason,
    priceBand: primaryLoanPath.priceBand,
    policyLoanStatus: policyLoanStatus,
    ltvLimit: ltvLimit,
    purchaseMortgageCap: purchaseMortgageCap,
    purchaseMortgageCapStatus: capResult.status,
    purchaseMortgageCapLabel: capResult.label,
    systemMaxLoanBeforeDsr: systemMaxLoanBeforeDsr,
    primarySingleDsrLimit: primarySingleDsrLimit,
    jointConservativeDsrLimit: jointConservativeDsrLimit,
    jointFullDsrLimit: jointFullDsrLimit,
    jointManualDsrLimit: jointManualDsrLimit,
    jointDsrLimit: jointDsrLimit,
    requiredLoanAmount: requiredLoanAmount,
    conditionalRequiredLoanAmount: conditionalRequiredLoanAmount,
    requiredMonthlyPayment: requiredMonthlyPayment,
    cashShortage: loanLimitShortage,
    loanLimitShortage: loanLimitShortage,
    affordabilityShortage: affordabilityShortage,
    affordabilitySummary: affordabilitySummary,
    loanLimitBottleneck: loanLimitBottleneck,
    safeMonthlyPayment: safeMonthlyPayment,
    safeLoanAmount: safeLoanAmount,
    finalRecommendedLoan: finalRecommendedLoan,
    riskLevel: riskLevel,
    blocker: blocker,
    nextActions: nextActions,
    additionalIncomeReview: additionalIncomeReview,
    familySupportReview: familySupportReview,
    capitalSummary: capitalSummary,
    policyResearchBacklog: buildPolicyResearchBacklog(policyLoanStatus),
    incomeSummary: incomeSummary,
    isPartnerIncomeUnknown: isPartnerIncomeUnknown,
    partnerRecognizedIncome: partnerRecognizedInput > 0 ? partnerRecognizedInput : null,
    targetProperty: profileInput.targetProperty,
    availableCash: availableCash,
    purchaseCosts: purchaseCosts,
    loanTermYears: loanTermYears,
    repaymentType: repaymentType,
    annualDebtPayment: annualDebtPayment,
    monthlyNetAdditionalIncome: additionalIncomeReview.recurringCashflowIncome / 12,
    totalRecognizedIncome: totalRecognizedIncome,
    monthlyRecognized: monthlyRecognized,
    dsrMonthlyMax: dsrMonthlyMax,
    loanByDsr: loanByDsr,
    loanByDsrNoStress: loanByDsrNoStress,
    finalLoanLimit: finalLoanLimit,
    equity: equity,
    totalBuyingPower: totalBuyingPower,
    ltvRate: ltvRate,
    effectiveRate: effectiveRate,
    baseRate: baseRate,
    stressRate: stressRate,
    isMetro: isMetro,
    isRegulated: isRegulated,
    isLandTransactionPermitZone: isLandTransactionPermitZone,
    firstBuyer: firstBuyer,
    married: married,
    monthlyDebt: monthlyDebt,
    monthlyLiving: monthlyLiving,
    income1: income1, income2: income2, job1: job1, job2: job2,
    cash: cash, support: support, familySupportType: familySupportType, weddingCost: weddingCost
  };
  state.loanResult.financingStrategy = buildFinancingStrategy(state.loanResult);
  state.loanResult.ownershipInput = {
    primaryContribution: capitalSummary.confirmedCash,
    partnerContribution: null,
    familySupportAmount: familySupportReview.amount,
    intendedOwnershipType: 'undecided',
    intendedOwnershipRatio: null
  };
  state.loanResult.decisionCards = buildDecisionCards(state.loanResult);

  state.profile = {
    income1: income1, income2: income2, job1: job1, job2: job2,
    cash: cash, support: support, familySupportType: familySupportType, weddingCost: weddingCost, purchaseCosts: purchaseCosts,
    existingDebt: existingDebt, existingDebtAnnualPayment: annualDebtPayment, monthlyDebt: monthlyDebt,
    monthlyLiving: monthlyLiving, regionType: regionType, firstBuyer: firstBuyer, married: married,
    targetProperty: profileInput.targetProperty,
    buyerStatus: profileInput.buyerStatus,
    incomeSummary: incomeSummary,
    additionalIncomes: additionalIncomeReview.items
  };

  renderLoanResult();
  switchTab('tab-loan');
}

function renderLoanResult() {
  var r = state.loanResult;
  if (!r) return;

  document.getElementById('loan-no-data').style.display = 'none';
  document.getElementById('loan-result').style.display = 'block';

  document.getElementById('res-dsr-limit').textContent = won(r.primarySingleDsrLimit);
  document.getElementById('res-dsr-note').textContent = '주 차주 1명의 소득만 반영 · 현재 정책 데이터와 입력값 기준 추정';

  document.getElementById('res-stress-limit').textContent = won(r.jointConservativeDsrLimit);
  document.getElementById('res-stress-note').textContent = '파트너 소득 보수 인정 · 실제 은행 인정소득 확인 필요';

  document.getElementById('res-equity').textContent = won(r.equity);
  document.getElementById('res-equity-note').textContent = '보유 현금/저축 중심 · 부모 지원 예정액 등 조건부 자금 별도 ' + won(r.capitalSummary.conditionalSupport);

  renderLoanOverview(r);
  renderLoanKeyEvidence(r);
  renderLoanLimitExplanation(r);

  // 수도권 절대 한도 안내
  var capBox = document.getElementById('res-cap-box');
  if (r.purchaseMortgageCapStatus === 'policy_data_missing') {
    capBox.innerHTML = '<strong>⚠️ 주담대 cap 정책 데이터 확인 필요</strong><br>' + r.purchaseMortgageCapLabel;
    capBox.style.display = 'block';
  } else if (r.isMetro || r.targetProperty.isRegulatedArea) {
    var capTiers = POLICY && POLICY.purchase_mortgage_cap && Array.isArray(POLICY.purchase_mortgage_cap.tiers)
      ? POLICY.purchase_mortgage_cap.tiers.map(function (tier) { return tier.label; }).join(' / ')
      : '가격 구간별 cap 정책 데이터 확인 필요';
    capBox.innerHTML = '<strong>📌 수도권/규제지역 주담대 절대 한도 · 현재 정책 데이터 기준</strong><br>' +
      escapeHTML(capTiers) + '<br>' +
      '입력 가격 구간 cap: <strong>' + won(r.purchaseMortgageCap) + '</strong> · DSR 반영 후 상한: <strong>' + won(r.finalLoanLimit) + '</strong>';
    capBox.style.display = 'block';
  } else {
    capBox.style.display = 'none';
  }

  renderLoanAffordability(r);
  renderLoanDecisionSummary(r);
  renderLoanFinancingStrategy(r);
  renderDecisionCards(r.decisionCards);
  renderAdditionalIncomeDecision(r.additionalIncomeReview);
  renderMarriageStrategy(r);
  renderLoanNextActions(r);
  setLoanQuickNavActive('loan-overview');
}

function setLoanQuickNavActive(sectionId) {
  var buttons = document.querySelectorAll('.loan-quick-nav-btn');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.toggle('active', buttons[i].getAttribute('data-loan-section') === sectionId);
  }
}

function scrollLoanSection(sectionId) {
  var section = document.getElementById(sectionId);
  if (!section) return;
  setLoanQuickNavActive(sectionId);
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderLoanOverview(r) {
  var container = document.getElementById('loan-overview');
  if (!container) return;
  var gap = Math.max(r.affordabilityShortage, r.loanLimitShortage);
  var summary = r.riskLevel === 'safe'
    ? '현재 입력값 기준으로 목표 주택가격을 비교 가능한 범위 안에서 검토할 수 있습니다.'
    : '현재 입력값 기준으로 목표 주택가격은 ' + (r.blocker === 'affordability' || r.affordabilityShortage > 0 ? '생활감당 기준에서' : '대출 구조에서') + ' 부담이 큽니다.';
  container.innerHTML = '<section class="loan-overview-card status-' + escapeHTML(r.riskLevel) + '">' +
    '<div class="loan-overview-main"><div><span class="loan-section-kicker">결론 먼저 보기</span>' +
    '<div class="loan-overview-title-row"><h3>' + escapeHTML(summary) + '</h3><span class="decision-risk ' + escapeHTML(r.riskLevel) + '">' + escapeHTML(UI_STATUS_LABELS[r.riskLevel] || UI_STATUS_LABELS.check_required) + '</span></div>' +
    '<p>최종 권장 대출액은 <strong>' + won(r.finalRecommendedLoan) + '</strong>이며, 제한 요인은 <strong>' + escapeHTML(r.loanLimitBottleneck.label) + '</strong>입니다.</p>' +
    '<p>우선 파트너 은행 인정소득, 확정 자기자본, 목표가격 조정 여부를 확인하세요.</p></div>' +
    '<button class="btn-primary loan-overview-cta" onclick="calcScenario(); switchTab(\'tab-scenario\')">시나리오 비교하기 →</button></div>' +
    '<div class="loan-overview-kpis">' +
    '<div><span>최종 권장 대출액</span><strong>' + won(r.finalRecommendedLoan) + '</strong></div>' +
    '<div><span>목표 주택가격</span><strong>' + won(r.targetProperty.price) + '</strong></div>' +
    '<div><span>생활안전 기준 부족액</span><strong>' + won(gap) + '</strong></div>' +
    '<div><span>최종 병목</span><strong>' + escapeHTML(r.loanLimitBottleneck.label) + '</strong></div>' +
    '</div></section>';
}

function renderLoanKeyEvidence(r) {
  var container = document.getElementById('loan-key-evidence');
  if (!container) return;
  container.innerHTML = '<div class="loan-key-evidence-grid">' +
    '<div><span>조건부 자금 (부모 지원 예정액 등)</span><strong>' + won(r.capitalSummary.conditionalSupport) + '</strong><small>세무·자금출처 확인 전에는 확정자금과 분리</small></div>' +
    '<div><span>생활감당 한도 (우리 지갑 기준)</span><strong>' + won(r.affordabilitySummary.selectedAffordabilityLoanLimit) + '</strong><small>월 생활비를 남기고 갚을 수 있는 범위</small></div>' +
    '<div><span>최종 병목 요인</span><strong>' + escapeHTML(r.loanLimitBottleneck.label) + '</strong><small>여러 기준 중 가장 낮아 최종 금액을 제한하는 기준</small></div>' +
    '</div>';
}

function renderLoanLimitExplanation(r) {
  var container = document.getElementById('loan-limit-explanation');
  if (!container) return;
  var capText = r.purchaseMortgageCap === null
    ? '정책 데이터 확인 필요'
    : (isFinite(r.purchaseMortgageCap) ? won(r.purchaseMortgageCap) : 'cap 미적용');
  var manualLimitText = r.jointManualDsrLimit === null ? '확인 필요' : won(r.jointManualDsrLimit);
  var dsrRate = POLICY && POLICY.dsr ? POLICY.dsr.bank_limit : null;
  var dsrRateText = isFinite(dsrRate) ? pct(dsrRate) : '정책 데이터 확인 필요';
  var confirmedRange = r.capitalSummary.confirmedUsableCapital + r.finalRecommendedLoan;
  var conditionalRange = r.capitalSummary.totalPotentialCapital + r.finalRecommendedLoan;
  var capReason = r.purchaseMortgageCapLabel || '입력 주택가격 구간의 cap 정책 데이터 확인 필요';
  var bottleneckSummary = '제도상 LTV 한도 ' + won(r.ltvLimit) + ', 가격 구간 cap ' + capText +
    '을 통과한 뒤 DSR 기준에서는 ' + won(r.loanByDsr) + ', 생활감당 기준에서는 ' +
    won(r.affordabilitySummary.selectedAffordabilityLoanLimit) + '까지 낮아집니다.';
  var walletVsBankSummary = r.affordabilitySummary.selectedAffordabilityLoanLimit < r.loanByDsr
    ? '현재 입력값에서는 DSR보다 생활감당 한도가 더 낮아 최종 판단을 더 강하게 제한합니다.'
    : '현재 입력값에서는 생활감당 한도보다 DSR 한도가 더 낮거나 같아 은행 소득 기준을 먼저 확인해야 합니다.';
  container.innerHTML = '<details class="loan-limit-explanation" open><summary>왜 이 금액까지만 빌릴 수 있나요?</summary>' +
    '<div class="loan-limit-explanation-body">' +
    '<p><strong>대출한도는 한 가지 기준으로 정해지지 않습니다.</strong> 집값 기준 LTV, 은행이 보는 소득 기준 DSR, 정책상 정해진 절대 대출 상한인 cap을 차례로 비교합니다. 이 앱은 여기에 우리 가계 현금흐름 기준인 생활감당 한도도 추가로 봅니다. 아래 값은 현재 정책 데이터와 입력값 기준 추정입니다.</p>' +
    '<div class="loan-beginner-callout"><strong>DSR은 은행 기준, 생활감당은 우리 지갑 기준입니다.</strong><span>DSR은 은행이 “이 소득이면 얼마까지 빌려줄 수 있나”를 보는 기준입니다. 생활감당은 은행이 빌려준다고 해도 실제 생활이 무너지지 않는지 따로 보는 기준입니다.</span><small>' + escapeHTML(walletVsBankSummary) + '</small></div>' +
    '<div class="loan-limit-rule-grid">' +
    '<article><strong>1단계 LTV</strong><span>집값 대비 빌릴 수 있는 비율</span><small>목표 주택가격 ' + won(r.targetProperty.price) + ' × 현재 적용 LTV ' + pct(r.ltvRate) + ' = ' + won(r.ltvLimit) + '</small></article>' +
    '<article><strong>2단계 cap</strong><span>정책상 정해진 절대 대출 상한</span><small>' + escapeHTML(capReason) + ' · 현재 적용값 ' + capText + '</small></article>' +
    '<article><strong>3단계 DSR</strong><span>은행이 보는 소득 기준 한도</span><small>현재 정책 데이터 기준 은행권 DSR ' + dsrRateText + '와 스트레스 금리를 반영한 범위 ' + won(r.loanByDsr) + '</small></article>' +
    '<article><strong>4단계 생활감당</strong><span>우리 가계 현금흐름 기준 한도</span><small>월 생활비와 안전 월 상환 가능액에서 역산한 범위 ' + won(r.affordabilitySummary.selectedAffordabilityLoanLimit) + '</small></article>' +
    '</div>' +
    '<div class="loan-limit-compare"><h4>한도 비교</h4>' +
    '<div><span>LTV 기준 한도</span><strong>' + won(r.ltvLimit) + '</strong><small>목표 주택가격 × 현재 적용 LTV</small></div>' +
    '<div><span>주택가격별 cap</span><strong>' + capText + '</strong><small>' + escapeHTML(capReason) + '</small></div>' +
    '<div><span>공동차주 보수 DSR 한도</span><strong>' + won(r.jointConservativeDsrLimit) + '</strong><small>실제 은행에서 소득이 낮게 인정될 가능성을 반영한 참고 시나리오</small></div>' +
    '<div><span>DSR 반영 후 제도상 상한</span><strong>' + won(r.finalLoanLimit) + '</strong><small>LTV, cap, 선택된 DSR 기준을 차례로 적용한 범위</small></div>' +
    '<div><span>생활감당 한도</span><strong>' + won(r.affordabilitySummary.selectedAffordabilityLoanLimit) + '</strong><small>월 생활비와 안전 월 상환 가능액 기준</small></div>' +
    '<p><strong>현재 병목: ' + escapeHTML(r.loanLimitBottleneck.label) + '</strong><br>' + escapeHTML(bottleneckSummary) + '</p></div>' +
    '<div class="loan-dsr-help"><h4>DSR 시나리오 해석</h4>' +
    '<div><strong>본인 단독 DSR 한도 · ' + won(r.primarySingleDsrLimit) + '</strong><small>본인 또는 주 차주 1명의 소득만 반영한 대출 원금 추정치입니다. 집값 기준 한도가 아닙니다.</small></div>' +
    '<div><strong>공동차주 보수 인정 DSR · ' + won(r.jointConservativeDsrLimit) + '</strong><small>두 사람 소득을 함께 보되 프리랜서·자영업자 소득은 낮게 인정될 가능성을 반영한 참고값입니다. 실제 은행 인정소득 확인이 필요합니다.</small></div>' +
    '<div><strong>공동차주 100% 인정 가정 · ' + won(r.jointFullDsrLimit) + '</strong><small>파트너 소득이 전액 인정된다고 가정한 참고값이며 실제 은행 심사에서는 달라질 수 있습니다.</small></div>' +
    '<div><strong>은행 인정소득 직접입력 기준 · ' + manualLimitText + '</strong><small>은행에서 인정하는 파트너 소득을 입력하면 공동차주 한도를 더 현실적으로 비교할 수 있습니다.</small></div>' +
    '</div>' +
    '<div class="loan-viewable-range"><h4>우리가 실제로 봐야 할 집값 범위</h4>' +
    '<p><strong>지금 확실한 돈만 기준으로 보면:</strong> ' + won(confirmedRange) + ' 안팎부터 비교하는 것이 안전합니다.</p>' +
    '<p><strong>부모 지원 예정액까지 실제로 사용할 수 있다면:</strong> ' + won(conditionalRange) + ' 안팎까지 비교 범위가 넓어질 수 있습니다.</p>' +
    '<small>부모 지원 예정액은 증여·차용·지원 성격과 자금출처 확인이 필요합니다. 표시 금액은 매수 가능 확정값이 아니라 비교를 시작하기 위한 입력값 기준 추정입니다.</small></div>' +
    '<details class="loan-inline-help"><summary>핵심 용어 도움말 보기</summary><div class="loan-term-help-grid">' +
    '<p><strong>DSR</strong> 은행이 보는 소득 기준 한도입니다.</p><p><strong>LTV</strong> 집값 대비 빌릴 수 있는 비율입니다.</p>' +
    '<p><strong>주택가격별 cap</strong> 지역·가격 구간에 따라 정책상 정해진 절대 대출 상한입니다.</p><p><strong>생활감당 한도</strong> 월 생활비를 남기고 무리 없이 갚을 수 있는 우리 가계 기준입니다.</p>' +
    '<p><strong>확정 자기자본</strong> 지금 바로 본인 자금으로 볼 수 있는 돈입니다.</p><p><strong>조건부 자금</strong> 부모 지원 예정액 등 아직 세무·자금출처 확인이 필요한 돈입니다.</p>' +
    '<p><strong>공동차주</strong> 두 사람의 인정소득을 함께 반영해 심사받는 구조입니다.</p><p><strong>보수 인정 소득</strong> 실제 은행에서 소득이 낮게 인정될 가능성을 반영한 참고값입니다.</p>' +
    '<p><strong>정책대출 판단용 소득</strong> 정책대출 자격을 볼 때 사용하는 입력 세전 합산소득입니다.</p><p><strong>최종 병목</strong> 여러 기준 중 가장 낮아 최종 금액을 제한하는 기준입니다.</p>' +
    '</div></details>' +
    '<details class="loan-inline-help"><summary>내가 입력한 값은 어디에 반영되나요?</summary><div class="loan-input-map">' +
    '<p><strong>보유 현금/저축</strong><span>확정 자기자본으로 반영</span></p><p><strong>부모 지원 예정액</strong><span>조건부 자금으로 분리</span></p>' +
    '<p><strong>월 생활비</strong><span>생활감당 한도 계산에 반영</span></p><p><strong>파트너 소득</strong><span>공동차주 보수/100% DSR 시나리오에 반영</span></p>' +
    '<p><strong>파트너 은행 인정소득</strong><span>은행 직접입력 DSR에 반영</span></p><p><strong>부수입</strong><span>신고·증빙 여부에 따라 DSR 반영 가능액과 자금출처 설명액을 분리</span></p>' +
    '</div></details>' +
    '</div></details>';
}

function renderLoanDecisionSummary(r) {
  var container = document.getElementById('loan-decision-summary');
  if (!container) return;
  var policyLabels = {
    didimdol: '디딤돌',
    bogeumjari: '보금자리론',
    newbornSpecial: '신생아특례',
    buttimmokJeonse: '버팀목 전세'
  };
  var policies = Object.keys(r.policyLoanStatus || {}).map(function (key) {
    var item = r.policyLoanStatus[key];
    var source = getPolicySourceMeta(key) || item.source || {};
    return '<div class="decision-policy-item"><strong>' + policyLabels[key] + '</strong><span>' + POLICY_STATUS_LABELS[item.status] + '</span>' +
      '<small>' + escapeHTML(item.reason) + '<br>확인처: ' + escapeHTML(policySourceDisplayName(source)) + '</small></div>';
  }).join('');
  var income = r.incomeSummary;
  var manualIncomeText = income.dsrIncomeJointManual === null ? '확인 필요' : won(income.dsrIncomeJointManual);
  var manualLimitText = r.jointManualDsrLimit === null ? '확인 필요' : won(r.jointManualDsrLimit);
  var capText = r.purchaseMortgageCap === null ? '정책 데이터 확인 필요' : (isFinite(r.purchaseMortgageCap) ? won(r.purchaseMortgageCap) : 'cap 미적용');
  container.innerHTML = '<details class="loan-detail-accordion"><summary><span>세부 근거 자세히 보기</span><small>소득, LTV, cap, DSR, 자기자본 상세</small></summary><div class="decision-section compact-detail">' +
    '<div class="decision-title-row"><h3>현재 판단 경로</h3><span class="decision-risk ' + r.riskLevel + '">' + escapeHTML(UI_STATUS_LABELS[r.riskLevel] || UI_STATUS_LABELS.check_required) + '</span></div>' +
    '<p><strong>' + escapeHTML(r.primaryPathReason) + '</strong></p>' +
    '<div class="income-scenario-note"><strong>소득 기준 분리</strong><br>' +
    '입력 세전 합산소득과 정책대출 판단용 소득은 보수 인정률을 적용하지 않습니다. ' +
    '파트너 은행 인정소득이 미입력인 경우 보수 인정 및 100% 인정 가정은 참고용이며 실제 은행 심사 결과와 다를 수 있습니다.</div>' +
    '<div class="decision-grid">' +
    '<div><span>입력 세전 합산소득</span><strong>' + won(income.grossHouseholdIncome) + '</strong></div>' +
    '<div><span>정책대출 판단용 소득</span><strong>' + won(income.policyEligibilityIncome) + '</strong></div>' +
    '<div><span>수도권 여부</span><strong>' + (r.targetProperty.isMetro ? '예' : '아니오') + '</strong></div>' +
    '<div><span>규제지역 여부</span><strong>' + (r.targetProperty.isRegulatedArea ? '예' : '아니오') + '</strong></div>' +
    '<div><span>토지거래허가구역</span><strong>' + (r.targetProperty.isLandTransactionPermitZone ? '확인 필요' : '아니오') + '</strong></div>' +
    '<div><span>DSR 소득 · 본인 단독</span><strong>' + won(income.dsrIncomeSingle) + '</strong></div>' +
    '<div><span>DSR 소득 · 공동 보수 인정</span><strong>' + won(income.dsrIncomeJointConservative) + '</strong></div>' +
    '<div><span>DSR 소득 · 공동 100% 인정 가정</span><strong>' + won(income.dsrIncomeJointFull) + '</strong></div>' +
    '<div><span>DSR 소득 · 은행 직접입력</span><strong>' + manualIncomeText + '</strong></div>' +
    '<div><span>목표 주택가격</span><strong>' + won(r.targetProperty.price) + '</strong></div>' +
    '<div><span>LTV 기준 한도</span><strong>' + won(r.ltvLimit) + '</strong></div>' +
    '<div><span>가격 구간 cap</span><strong>' + capText + '</strong></div>' +
    '<div><span>DSR 전 제도상 최대</span><strong>' + won(r.systemMaxLoanBeforeDsr) + '</strong></div>' +
    '<div><span>본인 단독 DSR</span><strong>' + won(r.primarySingleDsrLimit) + '</strong></div>' +
    '<div><span>공동차주 DSR · 보수 인정</span><strong>' + won(r.jointConservativeDsrLimit) + '</strong></div>' +
    '<div><span>공동차주 DSR · 100% 인정 가정</span><strong>' + won(r.jointFullDsrLimit) + '</strong></div>' +
    '<div><span>공동차주 DSR · 은행 직접입력</span><strong>' + manualLimitText + '</strong></div>' +
    '<div><span>확정 자기자본</span><strong>' + won(r.capitalSummary.confirmedUsableCapital) + '</strong></div>' +
    '<div><span>조건부 자금 (부모 지원 예정액 등)</span><strong>' + won(r.capitalSummary.conditionalSupport) + '</strong></div>' +
    '<div><span>총 잠재 자기자본</span><strong>' + won(r.capitalSummary.totalPotentialCapital) + '</strong></div>' +
    '<div><span>확정 자기자본 기준 필요대출</span><strong>' + won(r.requiredLoanAmount) + '</strong></div>' +
    '<div><span>조건부 자금 포함 기준 필요대출</span><strong>' + won(r.conditionalRequiredLoanAmount) + '</strong></div>' +
    '<div><span>예상 취득 부대비용</span><strong>' + won(r.purchaseCosts) + '</strong></div>' +
    '<div><span>대출한도 대비 부족액</span><strong>' + won(r.loanLimitShortage) + '</strong></div>' +
    '<div><span>생활안전 기준 부족액</span><strong>' + won(r.affordabilityShortage) + '</strong></div>' +
    '<div><span>필요대출 월 상환액</span><strong>' + won(r.requiredMonthlyPayment) + '</strong></div>' +
    '<div><span>안전 월 상환액</span><strong>' + won(r.safeMonthlyPayment) + '</strong></div>' +
    '<div><span>최종 권장 대출액</span><strong>' + won(r.finalRecommendedLoan) + '</strong></div>' +
    '</div></div></details>' +
    '<section class="loan-section loan-policy-section" id="loan-policy-section"><div class="loan-section-heading"><span class="loan-section-kicker">정책대출</span><h3>정책대출 후보</h3><p>핵심 상태와 확인처만 먼저 보여드립니다. 상세 사유는 실행 판단 카드에서 확인할 수 있습니다.</p></div>' +
    '<div class="decision-policy-grid">' + policies + '</div>' +
    (r.policyResearchBacklog.length ? '<details class="loan-supporting-details"><summary>정책 데이터 점검 필요</summary>' + renderPolicyResearchBacklog(r.policyResearchBacklog) + '</details>' : '') + '</section>';
}

function renderLoanAffordability(r) {
  var container = document.getElementById('loan-affordability');
  if (!container) return;
  container.innerHTML = '<section class="loan-section loan-affordability-section"><div class="loan-section-heading"><span class="loan-section-kicker">버틸 수 있나?</span><h3>생활감당 역산 · 우리 지갑 기준</h3><p>생활감당은 은행 기준이 아닙니다. 월 소득에서 생활비와 기존 지출을 빼고도 무리 없이 갚을 수 있는 대출 규모를 역산합니다.</p></div>' +
    renderAffordabilitySummary(r.affordabilitySummary, r.loanLimitBottleneck) + '</section>';
}

function renderLoanFinancingStrategy(r) {
  var container = document.getElementById('loan-financing-strategy');
  if (!container) return;
  container.innerHTML = '<section class="loan-section loan-strategy-section"><div class="loan-section-heading"><span class="loan-section-kicker">비교 판단</span><h3>자금조달 구조 비교</h3><p>단독차주, 공동차주, 시점 조정과 예산 조정을 나란히 비교합니다.</p></div>' +
    renderFinancingStrategy(r.financingStrategy) + '</section>';
}

function renderLoanNextActions(r) {
  var container = document.getElementById('loan-next-actions');
  if (!container) return;
  var items = r.nextActions.length ? r.nextActions : ['추가 조치 없이 시나리오 비교로 진행할 수 있습니다.'];
  container.innerHTML = '<section class="loan-section loan-actions-section"><div class="loan-section-heading"><span class="loan-section-kicker">다음 행동</span><h3>지금 확인할 순서</h3><p>확정 조언이 아니라 실행 전 점검 순서입니다.</p></div><ol>' +
    items.map(function (item) { return '<li>' + escapeHTML(item) + '</li>'; }).join('') + '</ol></section>';
}

function renderDecisionCard(card) {
  if (!card) return '';
  function renderList(title, items) {
    if (!items || items.length === 0) return '';
    return '<div class="execution-card-list"><strong>' + title + '</strong><ul>' +
      items.map(function (item) { return '<li>' + escapeHTML(item) + '</li>'; }).join('') +
      '</ul></div>';
  }
  return '<article class="execution-card status-' + escapeHTML(card.status) + '">' +
    '<div class="execution-card-head"><h5>' + escapeHTML(card.title) + '</h5>' +
    '<span>' + escapeHTML(card.statusLabel) + '</span></div>' +
    (card.summary ? '<p class="execution-card-summary">' + escapeHTML(card.summary) + '</p>' : '') +
    (card.reason ? '<p>' + escapeHTML(card.reason) + '</p>' : '') +
    renderList('근거', card.evidence) +
    renderList('막힌 기준', card.blockers) +
    renderList('확인 필요', card.requiredChecks) +
    renderList('다음 행동', card.nextActions) +
    (card.warning ? '<p class="execution-card-warning">' + escapeHTML(card.warning) + '</p>' : '') +
    '</article>';
}

function renderDecisionCardGroup(title, cards, open) {
  if (!cards || cards.length === 0) return '';
  return '<details class="execution-card-group"' + (open ? ' open' : '') + '>' +
    '<summary>' + escapeHTML(title) + '</summary>' +
    '<div class="execution-card-grid">' + cards.map(renderDecisionCard).join('') + '</div></details>';
}

function renderDecisionCards(cards) {
  var container = document.getElementById('decision-cards-container');
  if (!container || !cards) return;
  container.innerHTML = '<section class="execution-decision-section">' +
    '<div class="decision-title-row"><h3>실행 판단 카드</h3><span class="execution-card-guide">현재 입력값 기준</span></div>' +
    '<p>자동 확정 조언이 아니라, 필요한 판단축을 골라 펼쳐보는 상세 영역입니다.</p>' +
    renderDecisionCardGroup('현재 입력값 요약', [cards.caseSummary], true) +
    renderDecisionCardGroup('일반 주담대 실행 경로', [cards.mortgagePathCard], true) +
    renderDecisionCardGroup('정책대출 탈락·보류 사유', cards.policyExitCards, false) +
    '<div id="loan-borrower-section" class="execution-card-cluster">' +
      renderDecisionCardGroup('단독차주 / 공동차주 비교', cards.borrowerStructureCards, false) +
      renderDecisionCardGroup('명의·자금기여 구조', cards.ownershipStructureCards, false) +
    '</div>' +
    '<div id="loan-risk-section" class="execution-card-cluster">' +
      renderDecisionCardGroup('소득 기준 분리와 소득 리스크', cards.incomeRiskCards, false) +
      renderDecisionCardGroup('위험 시도 차단', cards.complianceRiskCards, false) +
    '</div>' +
    renderDecisionCardGroup('미래 카드', cards.futureOptionCards, false) +
    renderDecisionCardGroup('다음 액션 플랜', cards.actionPlanCards, true) +
    (cards.unresolvedItems.length ? '<div class="execution-unresolved"><strong>아직 확인할 항목</strong><ul>' +
      cards.unresolvedItems.map(function (item) { return '<li>' + escapeHTML(item) + '</li>'; }).join('') + '</ul></div>' : '') +
    '</section>';
}

function renderAffordabilitySummary(summary, bottleneck) {
  if (!summary) return '';
  var repaymentLabel = summary.repaymentType === 'equal_principal' ? '원금균등상환' : '원리금균등상환';
  return '<div class="affordability-result">' +
    '<p>월 실수령액은 직종별 세후 비율을 적용한 단순 추정값입니다. 급여명세서와 실제 사업소득 현금흐름 기준으로 다시 확인하면 정확도가 높아집니다.</p>' +
    '<div class="affordability-headline"><div><span>생활감당 위험도</span><strong class="affordability-risk ' + escapeHTML(summary.affordabilityRiskLevel) + '">' + escapeHTML(UI_STATUS_LABELS[summary.affordabilityRiskLevel] || UI_STATUS_LABELS.check_required) + '</strong></div>' +
    '<div><span>안전 월 상환 가능액</span><strong>' + won(summary.safeMonthlyPayment) + '</strong></div>' +
    '<div><span>선택 기준 월 상환 초과액</span><strong>' + won(summary.affordabilityGapMonthly) + '</strong></div></div>' +
    '<div class="affordability-compare-grid">' +
    '<article><span>원리금균등</span><strong>' + won(summary.affordabilityLoanLimitEqualPayment) + '</strong><small>감당 가능 대출액</small><p>필요대출 월 상환액 ' + won(summary.requiredMonthlyPaymentEqualPayment) + '</p></article>' +
    '<article><span>원금균등 · 첫 달 기준</span><strong>' + won(summary.affordabilityLoanLimitEqualPrincipal) + '</strong><small>감당 가능 대출액</small><p>필요대출 첫 달 상환액 ' + won(summary.requiredFirstMonthPaymentEqualPrincipal) + '</p></article>' +
    '</div><p><strong>선택 상환방식:</strong> ' + repaymentLabel + '</p><p><strong>최종 병목:</strong> ' + escapeHTML(bottleneck.label) + ' · ' + escapeHTML(bottleneck.reason) + '</p>' +
    '<p>최종 권장 대출액은 LTV, 주담대 cap, DSR, 생활감당 한도 중 가장 낮은 값을 기준으로 계산했습니다.</p></div>';
}

function renderFamilySupportReview(review) {
  if (!review || review.amount <= 0) return '';
  if (review.status === 'confirmed') {
    return '<div class="review-note"><h4>부모 지원금 / 차용 / 증여 검토</h4>' +
      '<p><strong>' + won(review.amount) + '</strong> · 증여 신고 완료 · 확정 자기자본 반영</p>' +
      '<p>DSR 소득에는 포함하지 않습니다. 실제 취득 신고 자료와 일치하는지 최종 확인하세요.</p></div>';
  }
  return '<div class="review-note"><h4>부모 지원금 / 차용 / 증여 검토</h4>' +
    '<p><strong>' + won(review.amount) + '</strong> · ' + escapeHTML(review.type) + ' · 세무 확인 필요</p>' +
    '<p>부모 지원금, 차용금, 증여는 자금출처 및 세무 검토가 필요한 항목입니다. 본 결과는 참고용이며, 실제 주택 취득 전 세무 전문가 확인이 필요합니다.</p></div>';
}

function renderFinancingStrategy(strategies) {
  if (!strategies || strategies.length === 0) return '';
  return '<div class="strategy-grid">' + strategies.map(function (strategy) {
    return '<div class="strategy-item"><strong>' + escapeHTML(strategy.label) + '</strong>' +
      '<span class="strategy-status status-' + escapeHTML(strategy.status) + '">' + escapeHTML(DECISION_CARD_STATUS_LABELS[strategy.status] || DECISION_CARD_STATUS_LABELS.info) + '</span><small>' + escapeHTML(strategy.reason) + '</small></div>';
  }).join('') + '</div>';
}

function renderPolicyResearchBacklog(items) {
  if (!items || items.length === 0) return '';
  return '<div class="research-backlog"><h4>최신 확인이 필요한 정책 정보</h4>' + items.map(function (item) {
    var missing = item.missingFields.length ? '<br>추가 필요: ' + item.missingFields.map(policyFieldLabel).map(escapeHTML).join(', ') : '';
    return '<div class="research-item"><strong>' + escapeHTML(item.label) + '</strong><span>' + item.priority + '</span>' +
      '<small>이유: ' + escapeHTML(item.reason) + '<br>확인처: ' + escapeHTML(item.officialSourceName) +
      '<br>경로: ' + escapeHTML(item.sourcePathHint) + missing + '<br>반영 위치: ' + item.codeTarget + '</small></div>';
  }).join('') + '</div>';
}

function renderAdditionalIncomeDecision(additionalIncomeResult) {
  var container = document.getElementById('additional-income-decision');
  if (!container || !additionalIncomeResult) return;
  var flags = additionalIncomeResult.riskFlags.length
    ? additionalIncomeResult.riskFlags.map(function (flag) { return '<span class="risk-flag">' + escapeHTML(RISK_FLAG_LABELS[flag] || flag) + '</span>'; }).join('')
    : '<span class="risk-flag none">없음</span>';
  var warnings = additionalIncomeResult.warnings.length
    ? '<ul>' + additionalIncomeResult.warnings.map(function (warning) { return '<li>' + escapeHTML(warning) + '</li>'; }).join('') + '</ul>'
    : '<p>추가 경고가 없습니다.</p>';
  container.innerHTML = '<details class="loan-supporting-details additional-income-details"><summary>고급 판단 · 부수입 / 기타소득</summary><div class="decision-section additional-income-result"><h3>부수입 / 기타소득 판단</h3>' +
    '<div class="decision-grid">' +
    '<div><span>부수입 총액</span><strong>' + won(additionalIncomeResult.totalAdditionalIncome) + '</strong></div>' +
    '<div><span>반복 현금흐름</span><strong>' + won(additionalIncomeResult.recurringCashflowIncome) + '</strong></div>' +
    '<div><span>대출소득 반영 가능액</span><strong>' + won(additionalIncomeResult.recognizedForLoanIncome) + '</strong></div>' +
    '<div><span>신고된 부수입</span><strong>' + won(additionalIncomeResult.reportedIncome) + '</strong></div>' +
    '<div><span>미신고 부수입</span><strong>' + won(additionalIncomeResult.unreportedIncome) + '</strong></div>' +
    '<div><span>자금출처 설명 가능액</span><strong>' + won(additionalIncomeResult.fundSourceExplainableAmount) + '</strong></div>' +
    '</div><div class="risk-flags">' + flags + '</div>' + warnings + '</div></details>';
}

function renderPolicyGrid(r) {
  var container = document.getElementById('policy-grid');
  if (!container) return;
  var labels = { didimdol: '디딤돌', bogeumjari: '보금자리론', newbornSpecial: '신생아특례', buttimmokJeonse: '버팀목 전세' };
  container.innerHTML = Object.keys(r.policyLoanStatus).map(function (key) {
    var item = r.policyLoanStatus[key];
    var cls = item.status === 'candidate' ? 'ok' : (item.status === 'not_available' ? 'fail' : 'warn');
    var source = getPolicySourceMeta(key) || item.source || {};
    var missing = item.missingFields.length ? '<br><small>추가 필요: ' + item.missingFields.map(policyFieldLabel).map(escapeHTML).join(', ') + '</small>' : '';
    var update = item.updateAction ? '<br><small>' + escapeHTML(item.updateAction) + '</small>' : '';
    return '<div class="policy-card ' + cls + '"><span class="policy-badge">' + POLICY_STATUS_LABELS[item.status] + '</span>' +
      '<div class="policy-name">' + labels[key] + '</div><div class="policy-reason">사유: ' + escapeHTML(item.reason) +
      '<br><small>확인처: ' + escapeHTML(policySourceDisplayName(source)) + '</small>' +
      (source.lastCheckedAt ? '<br><small>최종 확인일: ' + escapeHTML(source.lastCheckedAt) + '</small>' : '') +
      missing + update + '</div></div>';
  }).join('');
}

function renderMarriageStrategy(r) {
  var box = document.getElementById('marriage-strategy-box');
  if (!box) return;
  box.innerHTML = '<details class="loan-supporting-details marriage-details"><summary>추가 확인 포인트 · 혼인신고 전후 조건</summary><div class="marriage-box"><h4>혼인신고 전후 조건 비교 필요</h4>' +
    '혼인신고 전후에 따라 세대 구성, 소득 합산, 무주택 판단, 정책대출 요건이 달라질 수 있습니다. ' +
    '실제 신청 전 은행 및 세무 확인이 필요합니다.</div></details>';
}

// ─────────────────────────────────────────
//  시나리오 계산 (탭3)
// ─────────────────────────────────────────
function calcScenario() {
  if (!state.loanResult) return;
  var r = state.loanResult;

  var baseRate = r.baseRate;
  var loanMax = r.finalLoanLimit;
  var confirmedCapital = r.capitalSummary.confirmedUsableCapital;
  var conditionalCapital = r.capitalSummary.conditionalUsableCapital;
  var totalPotentialCapital = r.capitalSummary.totalPotentialCapital;

  // 안전 = DSR 25% 수준, 현실 = 33%, 영끌 = 40%
  var safeRatio = 0.25;
  var realRatio = 0.33;
  var yoloRatio = 0.40;

  function loanByRatio(ratio) {
    var mMax = r.monthlyRecognized * ratio - r.monthlyDebt;
    mMax = Math.max(mMax, 0);
    var rr = baseRate / 12;
    var n = r.loanTermYears * 12;
    if (rr <= 0 || mMax <= 0) return 0;
    return Math.min(mMax * (Math.pow(1 + rr, n) - 1) / (rr * Math.pow(1 + rr, n)), loanMax);
  }

  var safeLoan = loanByRatio(safeRatio);
  var realLoan = loanByRatio(realRatio);
  var yoloLoan = loanMax;

  function buildScenario(loan) {
    return {
      loan: loan,
      purchaseLimitConfirmed: confirmedCapital + loan,
      purchaseLimitWithConditional: totalPotentialCapital + loan
    };
  }

  state.scenarioResult = {
    safe: buildScenario(safeLoan),
    real: buildScenario(realLoan),
    yolo: buildScenario(yoloLoan),
    equity: confirmedCapital,
    capitalSummary: {
      confirmedCapital: confirmedCapital,
      conditionalCapital: conditionalCapital,
      totalPotentialCapital: totalPotentialCapital
    },
    realAndYoloSame: Math.abs(realLoan - yoloLoan) < 1,
    baseRate: baseRate
  };

  renderScenario();
  renderStressTest();
}

function renderScenario() {
  var s = state.scenarioResult;
  var r = state.loanResult;
  if (!s) return;

  document.getElementById('scenario-no-data').style.display = 'none';
  document.getElementById('scenario-result').style.display = 'block';

  var baseRate = s.baseRate;
  var ml = r.monthlyLiving;

  function monthlyPayment(loan) { return calcMonthlyPayment(loan, baseRate, r.loanTermYears); }

  var rows = [
    { label: '대출 규모', safe: won(s.safe.loan), real: won(s.real.loan), yolo: won(s.yolo.loan), highlight: true },
    { label: '확정자금 기준 매수 가능가', safe: won(s.safe.purchaseLimitConfirmed), real: won(s.real.purchaseLimitConfirmed), yolo: won(s.yolo.purchaseLimitConfirmed) },
    { label: '조건부 포함 매수 가능가', safe: won(s.safe.purchaseLimitWithConditional), real: won(s.real.purchaseLimitWithConditional), yolo: won(s.yolo.purchaseLimitWithConditional), highlight: true },
    { label: '월 대출 상환액', safe: wonM(monthlyPayment(s.safe.loan)), real: wonM(monthlyPayment(s.real.loan)), yolo: wonM(monthlyPayment(s.yolo.loan)) },
    { label: 'DSR 비율', safe: pct(s.safe.loan > 0 ? calcMonthlyPayment(s.safe.loan, baseRate, r.loanTermYears) / r.monthlyRecognized : 0), real: pct(s.real.loan > 0 ? calcMonthlyPayment(s.real.loan, baseRate, r.loanTermYears) / r.monthlyRecognized : 0), yolo: pct(s.yolo.loan > 0 ? calcMonthlyPayment(s.yolo.loan, baseRate, r.loanTermYears) / r.monthlyRecognized : 0) },
    { label: '자기자본', safe: '확정 ' + won(s.capitalSummary.confirmedCapital) + ' / 조건부 ' + won(s.capitalSummary.conditionalCapital), real: '확정 ' + won(s.capitalSummary.confirmedCapital) + ' / 조건부 ' + won(s.capitalSummary.conditionalCapital), yolo: '확정 ' + won(s.capitalSummary.confirmedCapital) + ' / 조건부 ' + won(s.capitalSummary.conditionalCapital) }
  ];

  var monthlyNet = monthlyNetIncome(r.income1, r.job1) + monthlyNetIncome(r.income2, r.job2) + r.monthlyNetAdditionalIncome;

  function surplusLabel(loan) {
    var mp = monthlyPayment(loan);
    var surplus = monthlyNet - mp - ml;
    var verdict = surplus >= 500000 ? '안정' : (surplus >= 0 ? '보통' : '위험');
    return won(Math.abs(surplus)) + ' ' + (surplus >= 0 ? '여유' : '부족') + ' (' + verdict + ')';
  }

  rows.push({ label: '생활 후 잔여 현금', safe: surplusLabel(s.safe.loan), real: surplusLabel(s.real.loan), yolo: surplusLabel(s.yolo.loan), highlight: true });

  var tbody = document.getElementById('scenario-budget-body');
  if (!tbody) return;
  tbody.innerHTML = rows.map(function (row) {
    var cls = row.highlight ? ' class="row-highlight"' : '';
    return '<tr' + cls + '><td>' + row.label + '</td>' +
      '<td class="col-safe">' + row.safe + '</td>' +
      '<td class="col-real">' + row.real + '</td>' +
      '<td class="col-yolo">' + row.yolo + '</td></tr>';
  }).join('');

  var capitalNote = document.getElementById('scenario-capital-note');
  if (capitalNote) {
    var supportNeedsReview = r.familySupportReview && r.familySupportReview.status === 'tax_review_required';
    var sameLimitNote = s.realAndYoloSame
      ? '<p><strong>현실·영끌 동일 산출:</strong> 현재 입력값에서는 DSR 또는 제도상 대출한도 병목 때문에 두 시나리오의 대출 규모가 같습니다.</p>'
      : '';
    capitalNote.innerHTML = '<p><strong>조건부 자금 (부모 지원 예정액 등) 안내:</strong> 확정자금 기준은 지금 바로 본인 자금으로 볼 수 있는 금액만 반영합니다. 조건부 포함 기준은 부모 지원 예정액 등 실제 사용 가능성이 있는 자금을 함께 본 비교값입니다.' +
      (supportNeedsReview ? ' 현재 입력된 조건부 자금은 증여·차용·지원 성격과 자금출처 확인이 필요합니다.' : '') + '</p>' + sameLimitNote;
  }

  // 현금흐름 카드
  var cfGrid = document.getElementById('cashflow-grid');
  if (!cfGrid) return;
  var scenarios = [
    { title: '🟢 안전 시나리오', loan: s.safe.loan, label: '안전' },
    { title: '🟡 현실 시나리오', loan: s.real.loan, label: '현실' },
    { title: '🔴 영끌 시나리오', loan: s.yolo.loan, label: '영끌' }
  ];

  cfGrid.innerHTML = scenarios.map(function (sc) {
    var mp = monthlyPayment(sc.loan);
    var surplus = monthlyNet - mp - ml;
    var cls = surplus >= 500000 ? 'ok' : (surplus >= 0 ? 'warn' : 'fail');
    return '<div class="cashflow-card">' +
      '<div class="cf-title">' + sc.title + '</div>' +
      '<div class="cf-row"><span class="cf-label">세후 합산 월소득</span><span class="cf-val">' + wonM(monthlyNet) + '</span></div>' +
      '<div class="cf-row"><span class="cf-label">월 대출 상환</span><span class="cf-val">- ' + wonM(mp) + '</span></div>' +
      '<div class="cf-row"><span class="cf-label">월 생활비</span><span class="cf-val">- ' + wonM(ml) + '</span></div>' +
      '<div class="cf-row"><span class="cf-label">잔여 현금</span><span class="cf-val ' + cls + '">' + wonM(surplus) + '</span></div>' +
      '<div class="cf-surplus ' + cls + '">' + (surplus >= 0 ? '월 ' + wonM(surplus) + ' 여유' : '월 ' + wonM(Math.abs(surplus)) + ' 부족') + '</div>' +
      '</div>';
  }).join('');

  renderReport();
}

function renderStressTest() {
  var s = state.scenarioResult;
  var r = state.loanResult;
  if (!s || !r) return;

  var stressAdd = parseFloat(document.getElementById('stress-rate-select').value) || 0;
  var stressRate = r.baseRate + stressAdd;
  var monthlyNet = monthlyNetIncome(r.income1, r.job1) + monthlyNetIncome(r.income2, r.job2) + r.monthlyNetAdditionalIncome;
  var ml = r.monthlyLiving;

  var scenarios = [
    { label: '🟢 안전', loan: s.safe.loan },
    { label: '🟡 현실', loan: s.real.loan },
    { label: '🔴 영끌', loan: s.yolo.loan }
  ];

  var html = '<table class="scenario-table"><thead><tr><th>구분</th><th>월 상환 (현재)</th><th>월 상환 (금리 +' + pct(stressAdd) + ')</th><th>잔여 현금</th><th>판정</th></tr></thead><tbody>';
  scenarios.forEach(function (sc) {
    var mpNow = calcMonthlyPayment(sc.loan, r.baseRate, r.loanTermYears);
    var mpStress = calcMonthlyPayment(sc.loan, stressRate, r.loanTermYears);
    var surplus = monthlyNet - mpStress - ml;
    var verdict = surplus >= 500000 ? '<span class="verdict-ok">안정</span>' : (surplus >= 0 ? '<span class="verdict-warn">주의</span>' : '<span class="verdict-fail">위험</span>');
    html += '<tr><td>' + sc.label + '</td><td>' + wonM(mpNow) + '</td><td>' + wonM(mpStress) + '</td><td>' + wonM(surplus) + '</td><td>' + verdict + '</td></tr>';
  });
  html += '</tbody></table>';

  var el = document.getElementById('stress-result');
  if (el) el.innerHTML = html;
}

// ─────────────────────────────────────────
//  후보 매물 (탭4)
// ─────────────────────────────────────────
function addProperty() {
  var name = (document.getElementById('prop-name').value || '').trim();
  var type = getSelect('prop-type');
  var price = getInput('prop-price');
  var deposit = getInput('prop-deposit');
  var monthly = getInput('prop-monthly');
  var maint = getInput('prop-maint');
  var commute = getInput('prop-commute');
  var region = getSelect('prop-region');
  var memo = (document.getElementById('prop-memo').value || '').trim();

  if (!name) { alert('매물명을 입력해주세요.'); return; }
  if (type !== 'monthly' && price <= 0) { alert('매매가 또는 전세보증금을 입력해주세요.'); return; }

  var prop = { id: Date.now(), name: name, type: type, price: price, deposit: deposit, monthly: monthly, maint: maint, commute: commute, region: region, memo: memo };
  prop.score = scoreProp(prop);
  state.properties.push(prop);

  // 폼 초기화
  document.getElementById('prop-name').value = '';
  document.getElementById('prop-price').value = '';
  document.getElementById('prop-deposit').value = '';
  document.getElementById('prop-monthly').value = '';
  document.getElementById('prop-maint').value = '';
  document.getElementById('prop-commute').value = '';
  document.getElementById('prop-memo').value = '';

  renderPropertyList();
}

function scoreProp(prop) {
  if (!state.loanResult) return { verdict: 'warn', reasons: ['대출 한도 계산 후 정확한 판정이 가능합니다.'] };

  var r = state.loanResult;
  var s = state.scenarioResult;
  var reasons = [];
  var failCount = 0;
  var warnCount = 0;

  // 1. 자기자본 충분한가
  var equity = r.equity;
  var price = prop.price;
  var ltvRate = r.ltvRate;

  if (prop.type === 'buy') {
    var priceBand = determinePropertyPriceBand(price);
    var minEquity = price * (1 - ltvRate);
    if (equity < minEquity) {
      reasons.push('❌ 자기자본 ' + won(equity) + ' < 최소 필요 ' + won(minEquity) + ' (LTV ' + pct(ltvRate) + ' 기준)');
      failCount++;
    } else {
      reasons.push('✅ 자기자본 충족 (' + won(equity) + ')');
    }

    // 2. 총 구매력
    var neededLoan = price - equity;
    if (neededLoan > r.finalLoanLimit) {
      reasons.push('❌ 필요 대출 ' + won(neededLoan) + ' > 한도 ' + won(r.finalLoanLimit));
      failCount++;
    } else if (neededLoan > 0) {
      reasons.push('✅ 대출 범위 내 (' + won(neededLoan) + ')');
    }

    // 3. 월 현금흐름
    if (s) {
      var monthlyNet = monthlyNetIncome(r.income1, r.job1) + monthlyNetIncome(r.income2, r.job2) + r.monthlyNetAdditionalIncome;
      var mp = calcMonthlyPayment(neededLoan, r.baseRate, r.loanTermYears);
      var surplus = monthlyNet - mp - r.monthlyLiving - prop.maint;
      if (surplus < 0) {
        reasons.push('❌ 월 현금흐름 ' + wonM(surplus) + ' 부족');
        failCount++;
      } else if (surplus < 500000) {
        reasons.push('⚠️ 월 잔여 ' + wonM(surplus) + ' (빠듯함)');
        warnCount++;
      } else {
        reasons.push('✅ 월 잔여 ' + wonM(surplus));
      }
    }

    // 4. 수도권 한도 체크
    if (r.isMetro) {
      var capInfo = getPurchaseMortgageCapResult(price, true);
      if (capInfo.status === 'policy_data_missing') {
        reasons.push('⚠️ 수도권 주담대 cap 정책 데이터 확인 필요 (' + priceBand + ')');
        warnCount++;
      } else if (neededLoan > capInfo.amount) {
        reasons.push('❌ 수도권 주담대 한도 (' + won(capInfo.amount) + ') 초과');
        failCount++;
      }
    }

    // 5. 통근
    if (prop.commute > 60) {
      reasons.push('⚠️ 편도 통근 ' + prop.commute + '분 (몸테크 수준)');
      warnCount++;
    }

  } else if (prop.type === 'jeonse') {
    var jLoan = Math.min(price * 0.80, r.isMetro ? 300000000 : 200000000);
    var jEquityNeeded = price - jLoan;
    if (equity < jEquityNeeded) {
      reasons.push('❌ 자기자본 ' + won(equity) + ' < 필요 ' + won(jEquityNeeded));
      failCount++;
    } else {
      reasons.push('✅ 전세 보증금 조달 가능');
    }
    reasons.push('ℹ️ 전세대출 최대 약 ' + won(jLoan) + ' (80% 기준)');
    if (prop.commute > 60) { reasons.push('⚠️ 편도 통근 ' + prop.commute + '분'); warnCount++; }

  } else {
    var monthlyNet2 = monthlyNetIncome(r.income1, r.job1) + monthlyNetIncome(r.income2, r.job2) + r.monthlyNetAdditionalIncome;
    var totalMonthly = prop.monthly + prop.maint;
    var surplus2 = monthlyNet2 - totalMonthly - r.monthlyLiving;
    reasons.push('ℹ️ 월세+관리비: ' + wonM(totalMonthly) + '/월');
    if (surplus2 < 0) {
      reasons.push('❌ 월 현금흐름 부족 (' + wonM(surplus2) + ')');
      failCount++;
    } else {
      reasons.push('✅ 월 잔여 ' + wonM(surplus2));
    }
    if (prop.deposit > equity) {
      reasons.push('⚠️ 보증금 ' + won(prop.deposit) + ' > 자기자본');
      warnCount++;
    }
  }

  var verdict = failCount > 0 ? 'fail' : (warnCount > 0 ? 'warn' : 'ok');
  var verdictLabel = failCount > 0 ? '탈락' : (warnCount > 0 ? '주의' : '합격');
  return { verdict: verdict, verdictLabel: verdictLabel, reasons: reasons };
}

function removeProperty(id) {
  state.properties = state.properties.filter(function (p) { return p.id !== id; });
  renderPropertyList();
}

function renderPropertyList() {
  var container = document.getElementById('property-list');
  if (!container) return;
  if (state.properties.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>아직 입력된 매물이 없습니다.</p></div>';
    return;
  }
  var typeLabel = { buy: '매매', jeonse: '전세', monthly: '월세' };
  container.innerHTML = state.properties.map(function (p) {
    var sc = p.score;
    var priceStr = p.type === 'monthly'
      ? '보증금 ' + won(p.deposit) + ' / ' + wonM(p.monthly) + '/월'
      : won(p.price);
    return '<div class="property-list-item ' + sc.verdict + '">' +
      '<div class="prop-header">' +
      '<div><div class="prop-name">' + p.name + '</div>' +
      '<small style="color:#888">' + (typeLabel[p.type] || p.type) + (p.memo ? ' · ' + p.memo : '') + '</small></div>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
      '<span class="prop-verdict ' + sc.verdict + '">' + sc.verdictLabel + '</span>' +
      '<button class="btn-danger" onclick="removeProperty(' + p.id + ')">삭제</button>' +
      '</div></div>' +
      '<div class="prop-details">' +
      '<div class="prop-detail-item"><span class="prop-detail-label">가격</span>' + priceStr + '</div>' +
      '<div class="prop-detail-item"><span class="prop-detail-label">관리비</span>' + wonM(p.maint) + '/월</div>' +
      '<div class="prop-detail-item"><span class="prop-detail-label">통근(편도)</span>' + (p.commute || '—') + '분</div>' +
      '<div class="prop-detail-item"><span class="prop-detail-label">지역</span>' + (p.region === 'metro_regulated' ? '규제지역' : p.region === 'metro' ? '수도권' : '지방') + '</div>' +
      '</div>' +
      '<div class="prop-reasons">' +
      sc.reasons.map(function (r2) { return '<div class="prop-reason-item">' + r2 + '</div>'; }).join('') +
      '</div></div>';
  }).join('');
}

// ─────────────────────────────────────────
//  리포트 (탭5)
// ─────────────────────────────────────────
function renderReport() {
  var r = state.loanResult;
  var s = state.scenarioResult;
  if (!r) return;

  document.getElementById('report-no-data').style.display = 'none';
  document.getElementById('report-content').style.display = 'block';

  var today = new Date();
  var dateStr = today.getFullYear() + '.' + String(today.getMonth() + 1).padStart(2, '0') + '.' + String(today.getDate()).padStart(2, '0');
  var dateEl = document.getElementById('report-date');
  if (dateEl) dateEl.textContent = dateStr;

  var monthlyNet = monthlyNetIncome(r.income1, r.job1) + monthlyNetIncome(r.income2, r.job2) + r.monthlyNetAdditionalIncome;

  var body = '';

  // 1. 소득/자산 요약
  body += '<div class="report-section"><h3>📊 소득 & 자산 현황</h3>' +
    '<table style="width:100%;font-size:13px"><tbody>' +
    '<tr><td style="color:#888;padding:6px 0;width:40%">입력 세전 합산소득</td><td style="font-weight:600">' + won(r.incomeSummary.grossHouseholdIncome) + '</td></tr>' +
    '<tr><td style="color:#888;padding:6px 0">정책대출 판단용 소득</td><td style="font-weight:600">' + won(r.incomeSummary.policyEligibilityIncome) + '</td></tr>' +
    '<tr><td style="color:#888;padding:6px 0">DSR 공동차주 보수 인정소득</td><td style="font-weight:600">' + won(r.incomeSummary.dsrIncomeJointConservative) + '</td></tr>' +
    '<tr><td style="color:#888;padding:6px 0">DSR 공동차주 100% 인정 가정</td><td style="font-weight:600">' + won(r.incomeSummary.dsrIncomeJointFull) + '</td></tr>' +
    '<tr><td style="color:#888;padding:6px 0">목표 주택가격</td><td style="font-weight:600">' + won(r.targetProperty.price) + '</td></tr>' +
    '<tr><td style="color:#888;padding:6px 0">판단 경로</td><td style="font-weight:600">' + escapeHTML(r.primaryPathReason) + '</td></tr>' +
    '<tr><td style="color:#888;padding:6px 0">확정 자기자본</td><td style="font-weight:600">' + won(r.capitalSummary.confirmedUsableCapital) + '</td></tr>' +
    '<tr><td style="color:#888;padding:6px 0">조건부 자금</td><td style="font-weight:600">' + won(r.capitalSummary.conditionalSupport) + '</td></tr>' +
    '<tr><td style="color:#888;padding:6px 0">세후 합산 월소득 (추정)</td><td style="font-weight:600">' + wonM(monthlyNet) + '/월</td></tr>' +
    '<tr><td style="color:#888;padding:6px 0">대출 가능 상한 (스트레스DSR)</td><td style="font-weight:600">' + won(r.finalLoanLimit) + '</td></tr>' +
    '<tr><td style="color:#888;padding:6px 0">안전 권장 대출액</td><td style="font-weight:600">' + won(r.finalRecommendedLoan) + '</td></tr>' +
    '<tr><td style="color:#888;padding:6px 0">선택 상환방식</td><td style="font-weight:600">' + (r.repaymentType === 'equal_principal' ? '원금균등상환' : '원리금균등상환') + '</td></tr>' +
    '<tr><td style="color:#888;padding:6px 0">권장액 제한 요인</td><td style="font-weight:600">' + escapeHTML(r.loanLimitBottleneck.label) + '</td></tr>' +
    '</tbody></table></div>';

  var additionalReview = r.additionalIncomeReview;
  body += '<div class="report-section"><h3>🧾 부수입 / 기타소득 판단</h3>' +
    '<table style="width:100%;font-size:13px"><tbody>' +
    '<tr><td style="color:#888;padding:6px 0;width:40%">부수입 총액</td><td style="font-weight:600">' + won(additionalReview.totalAdditionalIncome) + '</td></tr>' +
    '<tr><td style="color:#888;padding:6px 0">반복 현금흐름</td><td style="font-weight:600">' + won(additionalReview.recurringCashflowIncome) + '</td></tr>' +
    '<tr><td style="color:#888;padding:6px 0">DSR 인정 가능액</td><td style="font-weight:600">' + won(additionalReview.recognizedForLoanIncome) + '</td></tr>' +
    '<tr><td style="color:#888;padding:6px 0">미신고 부수입</td><td style="font-weight:600">' + won(additionalReview.unreportedIncome) + '</td></tr>' +
    '<tr><td style="color:#888;padding:6px 0">자금출처 설명 가능액</td><td style="font-weight:600">' + won(additionalReview.fundSourceExplainableAmount) + '</td></tr>' +
    '</tbody></table></div>';

  // 2. 시나리오 요약
  if (s) {
    var mp_safe = calcMonthlyPayment(s.safe.loan, r.baseRate, r.loanTermYears);
    var mp_real = calcMonthlyPayment(s.real.loan, r.baseRate, r.loanTermYears);
    var mp_yolo = calcMonthlyPayment(s.yolo.loan, r.baseRate, r.loanTermYears);
    body += '<div class="report-section"><h3>🏠 주거 예산 시나리오</h3>' +
      '<table style="width:100%;font-size:13px;border-collapse:collapse"><thead><tr style="background:#f5f4f0"><th style="padding:8px;text-align:left">구분</th><th style="padding:8px;text-align:right">안전</th><th style="padding:8px;text-align:right">현실</th><th style="padding:8px;text-align:right">영끌</th></tr></thead><tbody>' +
      '<tr style="border-bottom:1px solid #f0efea"><td style="padding:8px;color:#888">확정자금 기준 매수 가능가</td><td style="padding:8px;text-align:right">' + won(s.safe.purchaseLimitConfirmed) + '</td><td style="padding:8px;text-align:right">' + won(s.real.purchaseLimitConfirmed) + '</td><td style="padding:8px;text-align:right">' + won(s.yolo.purchaseLimitConfirmed) + '</td></tr>' +
      '<tr style="border-bottom:1px solid #f0efea"><td style="padding:8px;color:#888">조건부 포함 매수 가능가</td><td style="padding:8px;text-align:right">' + won(s.safe.purchaseLimitWithConditional) + '</td><td style="padding:8px;text-align:right">' + won(s.real.purchaseLimitWithConditional) + '</td><td style="padding:8px;text-align:right">' + won(s.yolo.purchaseLimitWithConditional) + '</td></tr>' +
      '<tr style="border-bottom:1px solid #f0efea"><td style="padding:8px;color:#888">월 대출 상환</td><td style="padding:8px;text-align:right">' + wonM(mp_safe) + '</td><td style="padding:8px;text-align:right">' + wonM(mp_real) + '</td><td style="padding:8px;text-align:right">' + wonM(mp_yolo) + '</td></tr>' +
      '<tr><td style="padding:8px;color:#888">월 잔여 현금</td><td style="padding:8px;text-align:right">' + wonM(monthlyNet - mp_safe - r.monthlyLiving) + '</td><td style="padding:8px;text-align:right">' + wonM(monthlyNet - mp_real - r.monthlyLiving) + '</td><td style="padding:8px;text-align:right">' + wonM(monthlyNet - mp_yolo - r.monthlyLiving) + '</td></tr>' +
      '</tbody></table></div>';
  }

  // 3. 매물 판정 요약
  if (state.properties.length > 0) {
    body += '<div class="report-section"><h3>🏢 후보 매물 판정</h3>';
    state.properties.forEach(function (p) {
      var sc = p.score;
      var verdictColor = sc.verdict === 'ok' ? '#2e7d32' : (sc.verdict === 'warn' ? '#e65100' : '#c62828');
      body += '<div style="border-left:4px solid ' + verdictColor + ';padding:8px 12px;margin-bottom:8px;">' +
        '<strong>' + p.name + '</strong> — <span style="color:' + verdictColor + ';font-weight:700">' + sc.verdictLabel + '</span><br>' +
        '<span style="font-size:12px;color:#888">' + sc.reasons.slice(0, 3).join(' · ') + '</span>' +
        '</div>';
    });
    body += '</div>';
  }

  var reportBody = document.getElementById('report-body');
  if (reportBody) reportBody.innerHTML = body;
}
