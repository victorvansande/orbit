const mem = {}; globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
globalThis.window = globalThis;
const { mergeStates, sameState } = await import('/home/user/orbit/src/sync/sync.js');
const { mergeArchive } = await import('/home/user/orbit/src/data/store.js');
const { mergeScores } = await import('/home/user/orbit/src/data/scores.js');
const { mergeFeats } = await import('/home/user/orbit/src/data/feats.js');
let fail = 0, pass = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FOUT:', m); } };
const now = Date.now(), H = 3600e3, D = 24 * H;
const T = (id, u, extra = {}) => ({ id, title: 't' + id, level: 2, createdAt: u, updatedAt: u, ...extra });
const full = s => ({ tasks: [], gone: {}, done: {}, ...s });

// 1 commutatief en idempotent
{
  const a = full({ tasks: [T('1', now - 5e3), T('2', now - 4e3)], done: { x: now - D }, skyCuts: [now - 9 * D], feats: { log: { x: { t: now - D } }, unlocked: { f1: now - D }, focus: {}, ev: {}, rev: {} }, archive: [{ id: 'x', title: 'X', doneAt: now - D }], archDel: {}, timer: { dur: 25, at: now - 1e3 }, scores: { snake: { best: 12, at: 1 } } });
  const b = full({ tasks: [T('2', now - 3e3, { title: 'b' }), T('3', now - 2e3)], gone: { '1': now - 1e3 }, done: { '1': now - 1e3 }, feats: { log: {}, unlocked: { f2: now }, focus: {}, ev: {}, rev: {} }, archive: [{ id: '1', title: 't1', doneAt: now - 1e3 }], timer: { dur: 50, at: now }, scores: { snake: { best: 30, at: 2 }, breakout: { top: [{ s: 5, at: 3 }] } } });
  const ab = mergeStates(a, b), ba = mergeStates(b, a);
  ok(sameState(ab, ba), 'commutatief');
  ok(sameState(mergeStates(ab, ab), ab), 'idempotent');
  ok(ab.tasks.map(t => t.id).sort().join() === '2,3', 'afgevinkte 1 weg, 2 en 3 blijven: ' + ab.tasks.map(t => t.id));
  ok(ab.tasks.find(t => t.id === '2').title === 'b', 'recentste wijziging wint');
  ok(ab.archive.some(x => x.id === '1') && ab.archive.some(x => x.id === 'x'), 'archief van beide kanten');
  ok(ab.timer.dur === 50, 'recentste zandloper');
  ok(ab.scores.snake.best === 30 && ab.scores.breakout.top.length === 1, 'scores samen');
  ok(ab.feats.unlocked.f1 && ab.feats.unlocked.f2, 'prestaties samen');
}
// 2 oud formaat: enkel tasks, taken zonder levelAt/due/repeat, geen gone/done
{
  const old = { tasks: [{ id: 'o1', title: 'oud', level: 1, createdAt: 1 }, { id: 'o2', title: 'oud2', level: 4 }] };
  const cur = full({ tasks: [T('n1', now)] });
  let m; try { m = mergeStates(cur, old); } catch (e) { ok(false, 'oud formaat crasht: ' + e.message); }
  if (m) { ok(m.tasks.length === 3, 'oud formaat: alle taken blijven (' + m.tasks.length + ')'); ok(m.feats === undefined && m.archive === undefined && m.scores === undefined, 'oud formaat: geen lege velden verzonnen'); }
  let m2; try { m2 = mergeStates(old, cur); ok(sameState(m, m2), 'oud formaat commutatief'); } catch (e) { ok(false, 'oud formaat als a crasht: ' + e.message); }
}
// 3 afgevinkt op A, ouder bewerkt op B: blijft weg; later bewerkt (ongedaan maken): komt terug
{
  const a = full({ tasks: [], gone: { k: now - 10e3 }, done: { k: now - 10e3 } });
  ok(mergeStates(a, full({ tasks: [T('k', now - 20e3)] })).tasks.length === 0, 'afgevinkt blijft afgevinkt');
  const m = mergeStates(a, full({ tasks: [T('k', now - 5e3)] }));
  ok(m.tasks.length === 1 && !m.done.k, 'ongedaan maken: taak terug, logboekregel weg');
}
// 4 lang offline: gone opgeruimd na 60 dagen, done houdt de taak weg
{
  const a = full({ gone: { z: now - 70 * D }, done: { z: now - 70 * D } });
  const m = mergeStates(a, full({ tasks: [T('z', now - 80 * D)] }));
  ok(m.tasks.length === 0 && !m.gone.z, 'oude afgevinkte taak komt niet terug');
}
// 5 archief: teruggezet valt eruit, voorgoed verwijderd blijft weg, rommel genegeerd
{
  const arch = [{ id: 'r', title: 'R', doneAt: now - D }, { id: 'd', title: 'D', doneAt: now - D }, null, { id: 5 }, { id: 'old', title: 'O', doneAt: now - 90 * D }, 'rommel'];
  const m = mergeArchive(arch, [], new Set(['r']), { d: now });
  ok(m.length === 0, 'archief: teruggezet en verwijderd weg, rommel genegeerd: ' + JSON.stringify(m));
  const m2 = mergeArchive([{ id: 'q', title: 'Q', doneAt: now - D, by: 'elders' }], [{ id: 'q', title: 'Q', doneAt: now - 2 * D }]);
  ok(m2[0].by === undefined, 'archief: exemplaar van het afvinkende toestel wint');
}
// 6 scores: onbekend spel blijft, verkeerde vorm verdringt niets
{
  const m = mergeScores({ nieuw: { best: 3, at: 1 }, snake: { best: 'x' } }, { snake: { best: 4, at: 1 }, breakout: { top: [{ s: -1 }, { s: 9, at: 1 }] } });
  ok(m.nieuw?.best === 3 && m.snake.best === 4 && m.breakout.top.length === 1, 'scores robuust: ' + JSON.stringify(m));
  ok(JSON.stringify(mergeScores(null, null)) === '{}', 'scores leeg');
}
// 7 feats: ingetrokken telt niet meer
{
  const m = mergeFeats({ log: {}, unlocked: { f: now - 5e3 }, focus: {}, ev: {}, rev: {} }, { log: {}, unlocked: {}, focus: {}, ev: {}, rev: { f: now - 1e3 } });
  ok(!m.unlocked.f, 'ingetrokken prestatie blijft weg');
  const m2 = mergeFeats({ unlocked: { f: 5 } }, undefined);
  ok(m2.unlocked.f === 5, 'feats oud formaat zonder rev/ev/focus');
}
// 8 gelijk tijdstip, andere inhoud: convergeert het?
{
  const a = full({ tasks: [T('s', now, { title: 'A' })] }), b = full({ tasks: [T('s', now, { title: 'B' })] });
  const ab = mergeStates(a, b), ba = mergeStates(b, a);
  ok(sameState(ab, ba), 'sameState zegt gelijk');
  console.log('INFO gelijk tijdstip: A ziet', ab.tasks[0].title, ', B ziet', ba.tasks[0].title, '(blijvend verschil)');
}
// 9 handmatig- en rommel in done
{
  const m = mergeStates(full({ done: { 'handmatig-1': now, a: 'x', b: NaN, c: now } }), full({}));
  ok(Object.keys(m.done).join() === 'c', 'done gefilterd: ' + Object.keys(m.done));
}
// 10 schaal: 2000 taken, 500 archief
{
  const big = n => Array.from({ length: n }, (_, i) => T('b' + i, now - i * 1e3));
  const a = full({ tasks: big(2000), archive: Array.from({ length: 600 }, (_, i) => ({ id: 'a' + i, title: 'x', doneAt: now - i * 1e4 })) });
  const t0 = performance.now(); const m = mergeStates(a, full({ tasks: big(2000).map(t => ({ ...t, updatedAt: t.updatedAt + 1 })) })); const ms = performance.now() - t0;
  ok(m.tasks.length === 2000 && m.archive.length === 500, 'schaal: 2000 taken, archief begrensd op 500');
  console.log('INFO 2000 taken samenvoegen:', ms.toFixed(1), 'ms');
}
// 11 a zonder tasks (beschadigde toestand van de andere kant)
{
  try { mergeStates(full({}), { gone: {} }); ok(true, ''); } catch (e) { ok(false, 'b zonder tasks crasht: ' + e.message); }
  try { mergeStates(full({}), { tasks: [null] }); ok(true, ''); } catch (e) { ok(false, 'b met null-taak crasht: ' + e.message); }
  try { const m = mergeStates(full({}), { tasks: [{ title: 'zonder id' }] }); console.log('INFO taak zonder id na merge:', m.tasks.length); } catch (e) { ok(false, 'taak zonder id crasht: ' + e.message); }
  try { sameState(full({}), { gone: {} }); } catch (e) { ok(false, 'sameState zonder tasks crasht: ' + e.message); }
}
console.log(`\n${pass} geslaagd, ${fail} fout`);
