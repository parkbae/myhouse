const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');

function makeElement(id, value = '') {
  return {
    id,
    value,
    style: {},
    classList: { toggle() {} },
    getAttribute() { return null; },
    setAttribute() {},
    scrollIntoView() {},
    textContent: '',
    innerHTML: ''
  };
}

function createContext() {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  const context = {
    console,
    document,
    window: { addEventListener() {} },
    alert(message) { throw new Error(`Unexpected alert: ${message}`); },
    fetch() { throw new Error('fetch should not run in smoke tests'); },
    setTimeout(fn) { if (typeof fn === 'function') fn(); },
    clearTimeout() {}
  };
  vm.createContext(context);
  const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
  vm.runInContext(script, context, { filename: 'script.js' });
  context.POLICY = JSON.parse(fs.readFileSync(path.join(root, 'policy_rules.json'), 'utf8'));
  return { context, elements, document };
}

function setValues(document, overrides) {
  const defaults = {
    income1: '8000',
    income2: '6000',
    job1: 'employee',
    job2: 'employee',
    cash: '30000',
    support: '10000',
    family_support_type: 'gift_confirmed',
    wedding_cost: '0',
    existing_debt: '0',
    monthly_debt: '0',
    monthly_living: '300',
    region_type: 'metro',
    first_buyer: 'yes',
    married: 'yes',
    target_transaction_type: 'purchase',
    target_property_price: '85000',
    region_sido: '서울',
    region_sigungu: '마포구',
    target_is_regulated: 'no',
    purchase_costs: '0',
    loan_term_years: '30',
    mortgage_rate: '4',
    repayment_type: 'equal_payment',
    existing_debt_annual_payment: '0',
    partner_recognized_income: '0',
    has_newborn_within_2_years: 'no',
    is_land_transaction_permit_zone: 'no',
    primary_contribution: '',
    partner_contribution: '',
    primary_family_support: '',
    partner_family_support: '',
    shared_family_support: '',
    primary_repayment_ratio: '',
    partner_repayment_ratio: '',
    primary_ownership_ratio: '',
    partner_ownership_ratio: '',
    loan_borrower_type: 'undecided'
  };
  Object.entries({ ...defaults, ...overrides }).forEach(([id, value]) => {
    document.getElementById(id).value = value;
  });
}

function runCalc(context, document, overrides) {
  setValues(document, overrides);
  context.renderLoanResult = function () {};
  context.switchTab = function () {};
  context.calcLoan();
  return context.state.loanResult;
}

function assertNoPurchaseMainCopy(html) {
  assert(!html.includes('LTV 기준 한도'), 'non-purchase main result must not show LTV limit');
  assert(!html.includes('주담대 cap 병목'), 'non-purchase main result must not show mortgage cap bottleneck');
  assert(!html.includes('최종 권장 대출액 0원'), 'non-purchase main result must not show zero final recommendation');
}

function testPurchase() {
  const { context, document } = createContext();
  const result = runCalc(context, document, { target_transaction_type: 'purchase', target_property_price: '85000' });
  assert.strictEqual(result.dealType, 'purchase');
  assert(result.purchase, 'purchase result should exist');
  assert.strictEqual(result.jeonse, null);
  assert.strictEqual(result.monthly, null);
  assert.strictEqual(Math.round(result.purchase.ltvLimit), 595000000);
  assert.strictEqual(result.purchase.purchaseMortgageCap, 600000000);
  assert(result.purchase.finalRecommendedLoan > 0, 'purchase finalRecommendedLoan should not regress to zero');
  assert.strictEqual(result.policyLoanStatus.buttimmokJeonse.status, 'not_primary');
}

function testJeonse() {
  const { context, document } = createContext();
  const result = runCalc(context, document, { target_transaction_type: 'jeonse', target_property_price: '96000' });
  assert.strictEqual(result.dealType, 'jeonse');
  assert.strictEqual(result.purchase, null);
  assert(result.jeonse, 'jeonse result should exist');
  assert.strictEqual(result.monthly, null);
  assert(result.jeonse.requiredJeonseLoanByConfirmedCapital > 0, 'jeonse required loan should be shown');
  assert(result.jeonse.estimatedJeonseMonthlyInterest > 0, 'jeonse monthly interest should be estimated');

  context.renderLoanResult = context.renderJeonseResult;
  context.renderJeonseResult(result);
  const html = document.getElementById('loan-overview').innerHTML;
  assert(html.includes('필요 전세대출'), 'jeonse overview should show required jeonse loan');
  assert(html.includes('예상 월 이자'), 'jeonse overview should show monthly interest');
  assertNoPurchaseMainCopy(html);

  context.state.loanResult = result;
  context.calcScenario();
  assert.strictEqual(context.state.scenarioResult, null);
  assert(document.getElementById('scenario-no-data').innerHTML.includes('전세/월세 거래유형은 별도 요약이 필요합니다'));
  context.renderReport();
  const reportHtml = document.getElementById('report-body').innerHTML;
  assert(reportHtml.includes('전세 요약'), 'jeonse report should show jeonse summary');
  assert(!reportHtml.includes('안전 권장 대출액'), 'jeonse report must not show purchase final recommendation row');
  assert(!reportHtml.includes('확정자금 기준 매수 가능가'), 'jeonse report must not show purchase scenario rows');
}

function testMonthly() {
  const { context, document } = createContext();
  const result = runCalc(context, document, { target_transaction_type: 'monthly', target_property_price: '50000' });
  assert.strictEqual(result.dealType, 'monthly');
  assert.strictEqual(result.purchase, null);
  assert.strictEqual(result.jeonse, null);
  assert(result.monthly, 'monthly result should exist');
  assert.strictEqual(result.monthly.status, 'needs_input');

  context.renderMonthlyResult(result);
  const html = document.getElementById('loan-overview').innerHTML;
  assert(html.includes('월세는 보증금, 월세, 관리비, 월 고정 주거비 중심으로 별도 판단이 필요합니다.'));
  assertNoPurchaseMainCopy(html);

  context.state.loanResult = result;
  context.calcScenario();
  assert.strictEqual(context.state.scenarioResult, null);
  assert(document.getElementById('scenario-no-data').innerHTML.includes('전세/월세 거래유형은 별도 요약이 필요합니다'));
}

testPurchase();
testJeonse();
testMonthly();
console.log('smoke-test: ok');
