'use strict';

// ─────────────────────────────────────────
//  전역 상태
// ─────────────────────────────────────────
var POLICY = null;       // policy_rules.json
var state = {
  profile: null,
  loanResult: null,
  scenarioResult: null,
  properties: []
};

// ─────────────────────────────────────────
//  초기화
// ─────────────────────────────────────────
window.addEventListener('DOMContentLoaded', function () {
  loadPolicy();
});

function loadPolicy() {
  fetch('policy_rules.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      POLICY = data;
      var badge = document.getElementById('policy-date-badge');
      if (badge) badge.textContent = '정책 기준일: ' + data._updated;
      var rd = document.getElementById('report-policy-date');
      if (rd) rd.textContent = data._updated;
      var rn = document.getElementById('report-policy-note');
      if (rn) rn.textContent = data._updated + ' 기준 · ' + data._source;
      checkPolicyExpiry(data);
    })
    .catch(function () {
      POLICY = getDefaultPolicy();
      var badge = document.getElementById('policy-date-badge');
      if (badge) badge.textContent = '정책 기준일: 2026-05-27 (내장)';
      checkPolicyExpiry(POLICY);
    });
}

// 정책 만료/변경 임박 항목을 감지해 배너로 경고
function checkPolicyExpiry(data) {
  var today = new Date();
  var warnings = [];

  // 지방 스트레스DSR 만료일 체크 — 새 JSON 키 경로
  var localStress = data.dsr && data.dsr.stress && data.dsr.stress.local_non_regulated;
  if (localStress && localStress.expires) {
    var exp = new Date(localStress.expires);
    var daysLeft = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 0) {
      warnings.push('⚠️ 지방 스트레스DSR 유예기간 만료 — 3단계 전환됐을 수 있습니다. policy_rules.json을 업데이트하세요.');
    } else if (daysLeft <= 30) {
      warnings.push('📅 지방 스트레스DSR 유예 ' + daysLeft + '일 후 만료 (' + localStress.expires + ') — 이후 3단계 전환 예정');
    }
  }

  // 버팀목 소득기준 변경 예정 안내 — 새 JSON 키 경로
  var jeonse = data.policy_loans && data.policy_loans.newlywed_jeonse;
  if (jeonse && jeonse.income_newlywed_max_note && jeonse.income_newlywed_max_note.indexOf('예정') !== -1) {
    warnings.push('📋 버팀목 소득기준 변경 예정: ' + jeonse.income_newlywed_max_note);
  }

  // JSON 기준일이 90일 이상 오래됐으면 갱신 권고
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

function getInput(id) {
  var el = document.getElementById(id);
  if (!el) return 0;
  var v = parseFloat(el.value);
  return isNaN(v) ? 0 : v;
}

function getSelect(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}

// 세후 월소득 추정 (간이 계산)
function monthlyNetIncome(annualGross, jobType) {
  var net = annualGross;
  if (jobType === 'employee') {
    // 간이 4대보험+소득세 약 15%
    net = annualGross * 0.85;
  } else if (jobType === 'self' || jobType === 'freelance') {
    // 자영업자: 인정소득 70~80% 적용 후 세후
    net = annualGross * 0.75 * 0.90;
  }
  return net / 12;
}

// DSR 계산용 인정소득
function recognizedIncome(annualGross, jobType) {
  if (jobType === 'self' || jobType === 'freelance') {
    return annualGross * 0.75; // 보수적 70~80% 중간값
  }
  return annualGross;
}

// 원리금 균등상환 월납입액
function calcMonthlyPayment(principal, annualRate, years) {
  if (principal <= 0) return 0;
  var r = annualRate / 12;
  var n = years * 12;
  if (r === 0) return principal / n;
  return principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
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
  var weddingCost = getInput('wedding_cost');
  var monthlyLiving = getInput('monthly_living');

  var totalIncome = recognizedIncome(income1, job1) + recognizedIncome(income2, job2);
  var equity = cash + support - weddingCost;
  var netM1 = monthlyNetIncome(income1, job1);
  var netM2 = monthlyNetIncome(income2, job2);
  var disposable = netM1 + netM2 - monthlyLiving;

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
  var weddingCost = getInput('wedding_cost');
  var existingDebt = getInput('existing_debt');
  var monthlyDebt = getInput('monthly_debt');
  var monthlyLiving = getInput('monthly_living');
  var regionType = getSelect('region_type');
  var firstBuyer = getSelect('first_buyer');
  var married = getSelect('married');

  if (income1 <= 0 && income2 <= 0) {
    alert('소득 정보를 입력해주세요.');
    return;
  }

  var recIncome1 = recognizedIncome(income1, job1);
  var recIncome2 = recognizedIncome(income2, job2);
  var totalRecognizedIncome = recIncome1 + recIncome2;
  var monthlyRecognized = totalRecognizedIncome / 12;

  var isMetro = (regionType !== 'other');
  var isRegulated = (regionType === 'metro_regulated');

  // 스트레스 금리 — 새 JSON 구조 반영
  var stressInfo = (isMetro || isRegulated)
    ? POLICY.dsr.stress.metro_or_regulated
    : POLICY.dsr.stress.local_non_regulated;
  var stressRate = stressInfo.effective_rate !== undefined
    ? stressInfo.effective_rate          // 지방: 1.5%×50% = 0.75%
    : stressInfo.base_rate;              // 수도권: 3.0%

  // 기준 금리 — 시나리오 base 사용 (한국은행 기준금리 + 스프레드 반영)
  var baseRate = POLICY.market_rates.mortgage.base;
  var effectiveRate = baseRate + stressRate;

  // DSR 40% 기준 최대 월 상환 가능액 (기존 부채 차감)
  var dsrLimit = POLICY.dsr.bank_limit;
  var dsrMonthlyMax = monthlyRecognized * dsrLimit - monthlyDebt;
  dsrMonthlyMax = Math.max(dsrMonthlyMax, 0);

  // 최대 대출금액 (30년 기준, 스트레스 금리 적용)
  var loanByDsr = 0;
  var r = effectiveRate / 12;
  var n = 30 * 12;
  if (r > 0 && dsrMonthlyMax > 0) {
    loanByDsr = dsrMonthlyMax * (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
  }

  // 스트레스 없는 순수 DSR 한도 (참고용)
  var r0 = baseRate / 12;
  var loanByDsrNoStress = 0;
  if (r0 > 0 && dsrMonthlyMax > 0) {
    var dsrMonthlyMaxNoStress = monthlyRecognized * dsrLimit - monthlyDebt;
    loanByDsrNoStress = Math.max(dsrMonthlyMaxNoStress, 0) * (Math.pow(1 + r0, n) - 1) / (r0 * Math.pow(1 + r0, n));
  }

  // 자기자본 (결혼비용 차감)
  var equity = cash + support - weddingCost;

  // 수도권 주담대 절대한도 — 새 JSON purchase_mortgage_cap 사용 (최대 6억 기준)
  var capMetro = (isMetro || isRegulated) ? 600000000 : 999999999999;

  // 최종 대출 한도 (DSR 한도 vs 수도권 절대 한도 중 작은 값)
  var finalLoanLimit = Math.min(loanByDsr, capMetro);

  // 총 구매력
  var totalBuyingPower = equity + finalLoanLimit;

  // LTV — 새 JSON 구조 반영 (규제지역 일반 40%로 강화)
  var ltvRate;
  if (isRegulated) {
    ltvRate = firstBuyer === 'yes'
      ? POLICY.ltv.regulated_first_buyer    // 70%
      : POLICY.ltv.regulated_general;       // 40% (2025.10.15 강화)
  } else if (isMetro) {
    ltvRate = firstBuyer === 'yes'
      ? POLICY.ltv.metro_non_regulated_first_buyer  // 70%
      : POLICY.ltv.metro_non_regulated_general;     // 70%
  } else {
    ltvRate = firstBuyer === 'yes'
      ? POLICY.ltv.local_non_regulated_first_buyer  // 80%
      : POLICY.ltv.local_non_regulated_general;     // 70%
  }

  // 결과 저장
  state.loanResult = {
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
    firstBuyer: firstBuyer,
    married: married,
    monthlyDebt: monthlyDebt,
    monthlyLiving: monthlyLiving,
    income1: income1, income2: income2, job1: job1, job2: job2,
    cash: cash, support: support, weddingCost: weddingCost
  };

  state.profile = { income1, income2, job1, job2, cash, support, weddingCost, existingDebt, monthlyDebt, monthlyLiving, regionType, firstBuyer, married };

  renderLoanResult();
  switchTab('tab-loan');
}

function renderLoanResult() {
  var r = state.loanResult;
  if (!r) return;

  document.getElementById('loan-no-data').style.display = 'none';
  document.getElementById('loan-result').style.display = 'block';

  document.getElementById('res-dsr-limit').textContent = won(r.loanByDsrNoStress);
  document.getElementById('res-dsr-note').textContent = 'DSR 40% · 금리 ' + pct(r.baseRate) + ' · 30년';

  document.getElementById('res-stress-limit').textContent = won(r.finalLoanLimit);
  document.getElementById('res-stress-note').textContent = '스트레스 (' + pct(r.stressRate) + ' 가산) 적용 후';

  document.getElementById('res-equity').textContent = won(r.equity);
  document.getElementById('res-equity-note').textContent = '현금+지원 ' + won(r.cash + r.support) + ' - 결혼비용 ' + won(r.weddingCost);

  // 수도권 절대 한도 안내
  var capBox = document.getElementById('res-cap-box');
  if (r.isMetro) {
    capBox.innerHTML = '<strong>📌 수도권/규제지역 주담대 절대 한도 (2025.10~ 기준)</strong><br>' +
      '매매가 15억 이하 → 최대 6억 / 15~25억 → 최대 4억 / 25억 초과 → 최대 2억<br>' +
      '현재 조건 기준 대출 상한: <strong>' + won(r.finalLoanLimit) + '</strong> (매매가에 따라 낮아질 수 있음)';
    capBox.style.display = 'block';
  } else {
    capBox.style.display = 'none';
  }

  // 정책대출 판별
  renderPolicyGrid(r);

  // 혼인신고 전략
  renderMarriageStrategy(r);
}

function renderPolicyGrid(r) {
  var container = document.getElementById('policy-grid');
  if (!container) return;
  var loans = POLICY.policy_loans;
  var income = r.totalRecognizedIncome;
  var married = r.married;
  var equity = r.equity;
  var html = '';

  // 디딤돌 (구입) — 신혼: 한도 3.2억/주택가 6억, 일반생애최초: 한도 2.4억/주택가 5억
  var dl = loans.didimdol;
  var dlIncomeLimit = married === 'yes' ? dl.income_newlywed_max : dl.income_first_or_two_children_max;
  var dlLoanMax = married === 'yes' ? dl.loan_max_newlywed_or_two_children : dl.loan_max_first_buyer;
  var dlOk = income <= dlIncomeLimit && r.firstBuyer === 'yes';
  var dlAssetOk = equity <= dl.asset_max;
  var dlStatus = (dlOk && dlAssetOk) ? 'ok' : ((dlOk && !dlAssetOk) ? 'warn' : 'fail');
  var dlReason = '';
  if (!dlOk) dlReason = '합산소득 ' + won(income) + ' > 기준 ' + won(dlIncomeLimit);
  else if (!dlAssetOk) dlReason = '순자산 ' + won(equity) + ' > 기준 ' + won(dl.asset_max);
  else dlReason = '최대 ' + won(dlLoanMax) + ' · LTV ' + pct(dl.ltv_max) + '<br><small>' + dl.rate_range + '</small>';
  var dlLabel = dlStatus === 'ok' ? '✅ 적격' : (dlStatus === 'warn' ? '⚠️ 조건부' : '❌ 탈락');
  html += '<div class="policy-card ' + dlStatus + '">' +
    '<span class="policy-badge">' + dlLabel + '</span>' +
    '<div class="policy-name">' + dl.name + '</div>' +
    '<div class="policy-reason">' + dlReason + '</div></div>';

  // 신혼 버팀목 (전세) — 키명: newlywed_jeonse
  var bl = loans.newlywed_jeonse;
  var blOk = income <= bl.income_newlywed_max && r.firstBuyer === 'yes';
  var blStatus = blOk ? 'ok' : 'fail';
  var blReason = blOk
    ? '수도권 최대 ' + won(bl.loan_max_metro) + ' · ' + bl.rate_range +
      '<br><small>' + bl.loan_max_metro_note + '</small>'
    : '합산소득 ' + won(income) + ' > 기준 ' + won(bl.income_newlywed_max) +
      '<br><small>' + (bl.income_newlywed_max_note || '') + '</small>';
  var blLabel = blOk ? '✅ 적격' : '❌ 탈락';
  html += '<div class="policy-card ' + blStatus + '">' +
    '<span class="policy-badge">' + blLabel + '</span>' +
    '<div class="policy-name">' + bl.name + '</div>' +
    '<div class="policy-reason">' + blReason + '</div></div>';

  // 신생아특례 디딤돌 (구입) — 키명: newborn_didimdol
  var nl = loans.newborn_didimdol;
  var nlOk = income <= nl.income_max_dual;
  var nlStatus = nlOk ? 'warn' : 'fail';
  var nlReason = nlOk
    ? '소득 조건 충족 · 출산(예정) 후 2년 이내 신청<br>' +
      'DSR 미적용 · 최대 ' + won(nl.loan_max) + ' · ' + nl.rate_range
    : '합산소득 ' + won(income) + ' > 기준 ' + won(nl.income_max_dual);
  var nlLabel = nlOk ? '⚠️ 출산 후 가능' : '❌ 탈락';
  html += '<div class="policy-card ' + nlStatus + '">' +
    '<span class="policy-badge">' + nlLabel + '</span>' +
    '<div class="policy-name">' + nl.name + '</div>' +
    '<div class="policy-reason">' + nlReason + '</div></div>';

  container.innerHTML = html;
}

function renderMarriageStrategy(r) {
  var box = document.getElementById('marriage-strategy-box');
  if (!box) return;
  var income = r.totalRecognizedIncome;
  var dl = POLICY.policy_loans.didimdol;
  var html = '';

  if (r.married === 'no') {
    var overByMarriage = income > dl.income_newlywed_max;
    var firstLimit = dl.income_first_or_two_children_max;
    if (overByMarriage) {
      html = '<div class="marriage-box"><h4>⚠️ 혼인신고 타이밍 전략</h4>' +
        '합산소득 ' + won(income) + '로 혼인신고 후 디딤돌 기준(' + won(dl.income_newlywed_max) + ') 초과합니다. ' +
        '잔금 납부일 이전에 혼인신고를 완료하면 신혼가구 기준이 적용됩니다. ' +
        '단, 혼인신고 전 공동명의 취득 시 증여세 리스크가 발생할 수 있으니 세무사 확인을 권장합니다.' +
        '</div>';
    } else {
      html = '<div class="marriage-box"><h4>✅ 혼인신고 후 정책대출 유리</h4>' +
        '혼인신고 완료 시 신혼가구 소득 기준(' + won(dl.income_newlywed_max) + ') 내에 있어 정책대출이 유리합니다.' +
        '</div>';
    }
  }
  box.innerHTML = html;
}

// ─────────────────────────────────────────
//  시나리오 계산 (탭3)
// ─────────────────────────────────────────
function calcScenario() {
  if (!state.loanResult) return;
  var r = state.loanResult;

  var baseRate = r.baseRate;
  var loanMax = r.finalLoanLimit;
  var equity = r.equity;

  // 안전 = DSR 25% 수준, 현실 = 33%, 영끌 = 40%
  var safeRatio = 0.25;
  var realRatio = 0.33;
  var yoloRatio = 0.40;

  function loanByRatio(ratio) {
    var mMax = r.monthlyRecognized * ratio - r.monthlyDebt;
    mMax = Math.max(mMax, 0);
    var rr = baseRate / 12;
    var n = 30 * 12;
    if (rr <= 0 || mMax <= 0) return 0;
    return Math.min(mMax * (Math.pow(1 + rr, n) - 1) / (rr * Math.pow(1 + rr, n)), loanMax);
  }

  var safeLoan = loanByRatio(safeRatio);
  var realLoan = loanByRatio(realRatio);
  var yoloLoan = loanMax;

  state.scenarioResult = {
    safe: { loan: safeLoan, buy: equity + safeLoan },
    real: { loan: realLoan, buy: equity + realLoan },
    yolo: { loan: yoloLoan, buy: equity + yoloLoan },
    equity: equity,
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

  function monthlyPayment(loan) { return calcMonthlyPayment(loan, baseRate, 30); }

  var rows = [
    { label: '매수 가능 상한가', safe: won(s.safe.buy), real: won(s.real.buy), yolo: won(s.yolo.buy) },
    { label: '대출 규모', safe: won(s.safe.loan), real: won(s.real.loan), yolo: won(s.yolo.loan), highlight: true },
    { label: '월 대출 상환액', safe: wonM(monthlyPayment(s.safe.loan)), real: wonM(monthlyPayment(s.real.loan)), yolo: wonM(monthlyPayment(s.yolo.loan)) },
    { label: 'DSR 비율', safe: pct(s.safe.loan > 0 ? calcMonthlyPayment(s.safe.loan, baseRate, 30) / r.monthlyRecognized : 0), real: pct(s.real.loan > 0 ? calcMonthlyPayment(s.real.loan, baseRate, 30) / r.monthlyRecognized : 0), yolo: pct(s.yolo.loan > 0 ? calcMonthlyPayment(s.yolo.loan, baseRate, 30) / r.monthlyRecognized : 0) },
    { label: '자기자본', safe: won(s.equity), real: won(s.equity), yolo: won(s.equity) }
  ];

  var monthlyNet = (monthlyNetIncome(r.income1, r.job1) + monthlyNetIncome(r.income2, r.job2));

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
  var monthlyNet = monthlyNetIncome(r.income1, r.job1) + monthlyNetIncome(r.income2, r.job2);
  var ml = r.monthlyLiving;

  var scenarios = [
    { label: '🟢 안전', loan: s.safe.loan },
    { label: '🟡 현실', loan: s.real.loan },
    { label: '🔴 영끌', loan: s.yolo.loan }
  ];

  var html = '<table class="scenario-table"><thead><tr><th>구분</th><th>월 상환 (현재)</th><th>월 상환 (금리 +' + pct(stressAdd) + ')</th><th>잔여 현금</th><th>판정</th></tr></thead><tbody>';
  scenarios.forEach(function (sc) {
    var mpNow = calcMonthlyPayment(sc.loan, r.baseRate, 30);
    var mpStress = calcMonthlyPayment(sc.loan, stressRate, 30);
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
      var monthlyNet = monthlyNetIncome(r.income1, r.job1) + monthlyNetIncome(r.income2, r.job2);
      var mp = calcMonthlyPayment(neededLoan, r.baseRate, 30);
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
      var capInfo = POLICY.loan_cap_metro.find(function (c) { return price <= c.price_max; });
      if (capInfo && neededLoan > capInfo.cap) {
        reasons.push('❌ 수도권 주담대 한도 (' + won(capInfo.cap) + ') 초과');
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
    var monthlyNet2 = monthlyNetIncome(r.income1, r.job1) + monthlyNetIncome(r.income2, r.job2);
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

  var monthlyNet = monthlyNetIncome(r.income1, r.job1) + monthlyNetIncome(r.income2, r.job2);

  var body = '';

  // 1. 소득/자산 요약
  body += '<div class="report-section"><h3>📊 소득 & 자산 현황</h3>' +
    '<table style="width:100%;font-size:13px"><tbody>' +
    '<tr><td style="color:#888;padding:6px 0;width:40%">합산 연소득 (인정기준)</td><td style="font-weight:600">' + won(r.totalRecognizedIncome) + '</td></tr>' +
    '<tr><td style="color:#888;padding:6px 0">자기자본 (실사용 가능)</td><td style="font-weight:600">' + won(r.equity) + '</td></tr>' +
    '<tr><td style="color:#888;padding:6px 0">세후 합산 월소득 (추정)</td><td style="font-weight:600">' + wonM(monthlyNet) + '/월</td></tr>' +
    '<tr><td style="color:#888;padding:6px 0">대출 가능 상한 (스트레스DSR)</td><td style="font-weight:600">' + won(r.finalLoanLimit) + '</td></tr>' +
    '</tbody></table></div>';

  // 2. 시나리오 요약
  if (s) {
    var mp_safe = calcMonthlyPayment(s.safe.loan, r.baseRate, 30);
    var mp_real = calcMonthlyPayment(s.real.loan, r.baseRate, 30);
    var mp_yolo = calcMonthlyPayment(s.yolo.loan, r.baseRate, 30);
    body += '<div class="report-section"><h3>🏠 주거 예산 시나리오</h3>' +
      '<table style="width:100%;font-size:13px;border-collapse:collapse"><thead><tr style="background:#f5f4f0"><th style="padding:8px;text-align:left">구분</th><th style="padding:8px;text-align:right">안전</th><th style="padding:8px;text-align:right">현실</th><th style="padding:8px;text-align:right">영끌</th></tr></thead><tbody>' +
      '<tr style="border-bottom:1px solid #f0efea"><td style="padding:8px;color:#888">매수 상한가</td><td style="padding:8px;text-align:right">' + won(s.safe.buy) + '</td><td style="padding:8px;text-align:right">' + won(s.real.buy) + '</td><td style="padding:8px;text-align:right">' + won(s.yolo.buy) + '</td></tr>' +
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
