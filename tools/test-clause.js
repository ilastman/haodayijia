const clause = require('../utils/clause');
const seed = require('../cloudfunctions/clauseCRUD/seed');

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}

console.log('== 默认模板与云函数种子一致 ==');
ok(JSON.stringify(clause.defaults().map(t => ({ id: t.id, kind: t.kind, name: t.name, lines: t.lines, tips: t.tips, gear: t.gear })))
  === JSON.stringify(seed.map(t => ({ id: t.id, kind: t.kind, name: t.name, lines: t.lines || [], tips: t.tips || [], gear: t.gear || [] }))),
  '客户端默认与 clauseCRUD/seed 一致');

console.log('== 快照不跟随后台改名以外的空覆盖 ==');
const snap = clause.normalizeClauses({
  include: { templateId: 'clause_include_std', name: '标准费用包含', kind: 'include', lines: ['只保留这一条'] }
});
ok(snap.include.lines.length === 1 && snap.include.lines[0] === '只保留这一条', '已选费用包含用快照');
ok(snap.exclude.lines[0].indexOf('大交通') >= 0, '未选的费用不含仍是默认文案');
ok(snap.notice.gear.length === 4, '出行须知装备建议仍是默认四条');

const view = clause.view(snap);
ok(view.include[0] === '只保留这一条' && view.refund.length === 3, '预览视图读取快照和默认退改');

console.log('\n通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
