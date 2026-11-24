/**
 * 受注データのチェックと集計(純粋な関数だけを置く)。
 * Google Apps Script でもそのまま動き、Node.js でテストできるようにしている。
 */

/** 受注シートの列(0始まり)。シートの列を入れ替えたら、ここだけ直す。 */
var COLUMNS = {
  orderDate: 0, // 受注日
  orderId: 1, // 受注番号
  staff: 2, // 担当者
  customer: 3, // 顧客名
  product: 4, // 商品
  quantity: 5, // 数量
  unitPrice: 6, // 単価
};

var REQUIRED_FIELDS = [
  ['orderDate', '受注日'],
  ['orderId', '受注番号'],
  ['staff', '担当者'],
  ['customer', '顧客名'],
  ['quantity', '数量'],
  ['unitPrice', '単価'],
];

function isBlank_(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function toDate_(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(value.trim())) {
    var p = value.trim().split(/[-/]/).map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    // 2026-02-30 のような存在しない日付を弾く
    return d.getMonth() === p[1] - 1 ? d : null;
  }
  return null;
}

function toNumber_(value) {
  if (typeof value === 'number') return isFinite(value) ? value : null;
  if (typeof value === 'string') {
    var s = value.replace(/[,，\s]/g, '');
    if (s === '' || !/^-?\d+(\.\d+)?$/.test(s)) return null;
    return Number(s);
  }
  return null;
}

/**
 * 受注データを検査する。
 * @param {Array<Array<*>>} rows 見出しを除いたデータ行
 * @return {Array<{row: number, field: string, message: string}>} 問題の一覧(row はシート上の行番号)
 */
function validateOrders(rows) {
  var issues = [];
  var firstRowById = {};
  rows.forEach(function (r, i) {
    var sheetRow = i + 2; // 1行目は見出し
    if (r.every(isBlank_)) return; // 空行は無視する

    REQUIRED_FIELDS.forEach(function (f) {
      if (isBlank_(r[COLUMNS[f[0]]])) issues.push({ row: sheetRow, field: f[1], message: '空欄です' });
    });

    var date = r[COLUMNS.orderDate];
    if (!isBlank_(date) && toDate_(date) === null) {
      issues.push({ row: sheetRow, field: '受注日', message: '日付として読めません' });
    }
    [['quantity', '数量'], ['unitPrice', '単価']].forEach(function (f) {
      var v = r[COLUMNS[f[0]]];
      if (isBlank_(v)) return;
      var n = toNumber_(v);
      if (n === null) issues.push({ row: sheetRow, field: f[1], message: '数値ではありません' });
      else if (n <= 0) issues.push({ row: sheetRow, field: f[1], message: '0以下です' });
      else if (f[0] === 'quantity' && Math.floor(n) !== n) {
        issues.push({ row: sheetRow, field: f[1], message: '整数ではありません' });
      }
    });

    var id = r[COLUMNS.orderId];
    if (!isBlank_(id)) {
      var key = String(id).trim();
      if (firstRowById[key] !== undefined) {
        issues.push({ row: sheetRow, field: '受注番号', message: firstRowById[key] + '行目と重複しています' });
      } else {
        firstRowById[key] = sheetRow;
      }
    }
  });
  return issues;
}

/**
 * 問題のない行だけを、月別・担当者別に集計する。
 * @param {Array<Array<*>>} rows 見出しを除いたデータ行
 * @return {Array<{month: string, staff: string, orders: number, amount: number}>} 月、担当者の順に並べた集計
 */
function summarizeByMonthAndStaff(rows) {
  var badRows = {};
  validateOrders(rows).forEach(function (x) { badRows[x.row] = true; });

  var totals = {};
  rows.forEach(function (r, i) {
    if (badRows[i + 2] || r.every(isBlank_)) return;
    var d = toDate_(r[COLUMNS.orderDate]);
    var month = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
    var staff = String(r[COLUMNS.staff]).trim();
    var key = month + '\u0000' + staff;
    if (!totals[key]) totals[key] = { month: month, staff: staff, orders: 0, amount: 0 };
    totals[key].orders += 1;
    totals[key].amount += toNumber_(r[COLUMNS.quantity]) * toNumber_(r[COLUMNS.unitPrice]);
  });

  return Object.keys(totals)
    .map(function (k) { return totals[k]; })
    .sort(function (a, b) {
      return a.month < b.month ? -1 : a.month > b.month ? 1 : a.staff < b.staff ? -1 : a.staff > b.staff ? 1 : 0;
    });
}

// Node.js でテストするときだけ公開する(Apps Script では module が存在しない)
if (typeof module !== 'undefined') {
  module.exports = { COLUMNS: COLUMNS, validateOrders: validateOrders, summarizeByMonthAndStaff: summarizeByMonthAndStaff };
}
