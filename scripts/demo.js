// sample/orders.csv を読み、Apps Script と同じロジックでチェックと集計を表示する。
// 使い方: npm run demo
const fs = require('node:fs');
const path = require('node:path');
const { validateOrders, summarizeByMonthAndStaff } = require('../src/core.js');

const csv = fs.readFileSync(path.join(__dirname, '..', 'sample', 'orders.csv'), 'utf8');
// サンプルはカンマや改行を含む値がないため、単純に分割する
const rows = csv.trim().split(/\r?\n/).slice(1).map((line) => line.split(','));

console.log('■ チェック結果');
console.table(validateOrders(rows).map((x) => ({ 行: x.row, 項目: x.field, 内容: x.message })));
console.log('■ 月次集計(問題のある行を除く)');
console.table(summarizeByMonthAndStaff(rows).map((s) => ({ 月: s.month, 担当者: s.staff, 件数: s.orders, 金額: s.amount })));
