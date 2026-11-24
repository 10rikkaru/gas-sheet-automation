/**
 * スプレッドシートとのやりとり(Apps Script 専用)。
 * 計算は core.js の関数に任せ、ここでは読み書きと表示だけを行う。
 */

var SHEET_ORDERS = '受注';
var SHEET_ISSUES = 'チェック結果';
var SHEET_SUMMARY = '月次集計';
var ISSUE_COLOR = '#fde2e1';

/** スプレッドシートを開いたときに、メニューを追加する。 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('自動化')
    .addItem('チェックと集計を実行', 'runCheckAndSummary')
    .addSeparator()
    .addItem('毎朝8時に自動実行する', 'installDailyTrigger')
    .addItem('自動実行を止める', 'removeTriggers')
    .addToUi();
}

/** 受注シートを検査し、問題の一覧と月次集計を書き出す。 */
function runCheckAndSummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_ORDERS);
  if (!sheet) throw new Error('「' + SHEET_ORDERS + '」シートが見つかりません');

  var lastRow = sheet.getLastRow();
  var width = Object.keys(COLUMNS).length;
  var rows = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, width).getValues() : [];

  var issues = validateOrders(rows);
  var summary = summarizeByMonthAndStaff(rows);

  // 問題のある行に色を付ける(前回の色はいったん消す)
  if (rows.length > 0) sheet.getRange(2, 1, rows.length, width).setBackground(null);
  issues.forEach(function (x) { sheet.getRange(x.row, 1, 1, width).setBackground(ISSUE_COLOR); });

  writeTable_(ss, SHEET_ISSUES, ['行', '項目', '内容'],
    issues.map(function (x) { return [x.row, x.field, x.message]; }));
  writeTable_(ss, SHEET_SUMMARY, ['月', '担当者', '件数', '金額'],
    summary.map(function (s) { return [s.month, s.staff, s.orders, s.amount]; }));
  ss.getSheetByName(SHEET_SUMMARY).getRange('D:D').setNumberFormat('#,##0');

  ss.toast('問題 ' + issues.length + ' 件 / 集計 ' + summary.length + ' 行', '完了', 5);
}

function writeTable_(ss, name, header, body) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (body.length > 0) sheet.getRange(2, 1, body.length, header.length).setValues(body);
  sheet.setFrozenRows(1);
}

/** 毎朝8時台に runCheckAndSummary を実行するトリガーを作る(重複しないよう先に消す)。 */
function installDailyTrigger() {
  removeTriggers();
  ScriptApp.newTrigger('runCheckAndSummary').timeBased().everyDays(1).atHour(8).create();
  SpreadsheetApp.getActiveSpreadsheet().toast('毎朝8時台に実行します', '設定しました', 5);
}

function removeTriggers() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'runCheckAndSummary'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
}
