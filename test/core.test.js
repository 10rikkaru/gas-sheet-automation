// node --test で実行する(外部ライブラリは使わない)
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateOrders, summarizeByMonthAndStaff } = require('../src/core.js');

const d = (y, m, day) => new Date(y, m - 1, day);
const row = (date, id, staff, customer, qty, price) => [date, id, staff, customer, '商品A', qty, price];

test('正常なデータには問題が出ない', () => {
  const rows = [row(d(2026, 10, 1), 'A-001', '佐藤', '山田商店', 2, 1000)];
  assert.deepEqual(validateOrders(rows), []);
});

test('データが0件でもエラーにならない', () => {
  assert.deepEqual(validateOrders([]), []);
  assert.deepEqual(summarizeByMonthAndStaff([]), []);
});

test('空行は無視する', () => {
  const rows = [row(d(2026, 10, 1), 'A-001', '佐藤', '山田商店', 1, 500), ['', '', '', '', '', '', '']];
  assert.deepEqual(validateOrders(rows), []);
});

test('必須項目の空欄を、項目ごとに報告する', () => {
  const issues = validateOrders([row(d(2026, 10, 1), 'A-001', '', '', 1, 500)]);
  assert.deepEqual(issues.map((x) => x.field), ['担当者', '顧客名']);
  assert.equal(issues[0].row, 2);
});

test('受注番号の重複は、2件目以降を最初の行番号つきで報告する', () => {
  const rows = [
    row(d(2026, 10, 1), 'A-001', '佐藤', '山田商店', 1, 500),
    row(d(2026, 10, 2), 'A-002', '佐藤', '山田商店', 1, 500),
    row(d(2026, 10, 3), ' A-001 ', '鈴木', '川口工業', 1, 500),
  ];
  assert.deepEqual(validateOrders(rows), [{ row: 4, field: '受注番号', message: '2行目と重複しています' }]);
});

test('数量・単価の誤りを見つける(文字、0以下、小数の数量)', () => {
  const rows = [
    row(d(2026, 10, 1), 'A-001', '佐藤', '山田商店', 'abc', 500),
    row(d(2026, 10, 1), 'A-002', '佐藤', '山田商店', 0, -1),
    row(d(2026, 10, 1), 'A-003', '佐藤', '山田商店', 1.5, 500),
  ];
  assert.deepEqual(validateOrders(rows).map((x) => `${x.row}:${x.field}:${x.message}`), [
    '2:数量:数値ではありません',
    '3:数量:0以下です',
    '3:単価:0以下です',
    '4:数量:整数ではありません',
  ]);
});

test('カンマ付きの文字列の数値と、文字列の日付を受け付ける', () => {
  const rows = [row('2026/10/05', 'A-001', '佐藤', '山田商店', '3', '1,200')];
  assert.deepEqual(validateOrders(rows), []);
  assert.deepEqual(summarizeByMonthAndStaff(rows), [{ month: '2026-10', staff: '佐藤', orders: 1, amount: 3600 }]);
});

test('存在しない日付は誤りとして扱う', () => {
  const issues = validateOrders([row('2026-02-30', 'A-001', '佐藤', '山田商店', 1, 500)]);
  assert.deepEqual(issues, [{ row: 2, field: '受注日', message: '日付として読めません' }]);
});

test('月別・担当者別に集計し、月→担当者の順に並べる', () => {
  const rows = [
    row(d(2026, 11, 3), 'A-004', '鈴木', '川口工業', 1, 5000),
    row(d(2026, 10, 1), 'A-001', '佐藤', '山田商店', 2, 1000),
    row(d(2026, 10, 31), 'A-002', '佐藤', '川口工業', 1, 300),
    row(d(2026, 10, 15), 'A-003', '鈴木', '山田商店', 3, 100),
  ];
  assert.deepEqual(summarizeByMonthAndStaff(rows), [
    { month: '2026-10', staff: '佐藤', orders: 2, amount: 2300 },
    { month: '2026-10', staff: '鈴木', orders: 1, amount: 300 },
    { month: '2026-11', staff: '鈴木', orders: 1, amount: 5000 },
  ]);
});

test('問題のある行は集計に含めない', () => {
  const rows = [
    row(d(2026, 10, 1), 'A-001', '佐藤', '山田商店', 2, 1000),
    row(d(2026, 10, 2), 'A-001', '佐藤', '山田商店', 5, 1000), // 重複
    row(d(2026, 10, 3), 'A-003', '佐藤', '', 1, 1000), // 顧客名が空欄
  ];
  assert.deepEqual(summarizeByMonthAndStaff(rows), [{ month: '2026-10', staff: '佐藤', orders: 1, amount: 2000 }]);
});
