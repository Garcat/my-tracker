import { createStateStore } from '../functions/store.mjs';

function memoryDb(rows) {
  return {
    from() {
      const query = {
        mode: 'read',
        filters: [],
        values: null,
        select() {
          return query;
        },
        eq(key, value) {
          query.filters.push([key, value]);
          return query;
        },
        limit() {
          return query;
        },
        insert(values) {
          query.mode = 'insert';
          query.values = values;
          return query;
        },
        update(values) {
          query.mode = 'update';
          query.values = values;
          return query;
        },
        then(fulfilled, rejected) {
          return Promise.resolve()
            .then(() => {
              if (query.mode === 'insert') {
                if (rows.some((row) => row.id === query.values.id)) {
                  return { data: null, error: { code: 'duplicate' } };
                }
                const row = { ...query.values };
                rows.push(row);
                return { data: [row], error: null };
              }
              const matched = rows.filter((row) =>
                query.filters.every(([key, value]) => row[key] === value),
              );
              if (query.mode === 'update') {
                if (matched.length === 0) return { data: [], error: null };
                matched.forEach((row) => Object.assign(row, query.values));
                return { data: matched, error: null };
              }
              return { data: matched.slice(0, 1), error: null };
            })
            .then(fulfilled, rejected);
        },
      };
      return query;
    },
  };
}

const failures = [];
function check(name, condition, detail) {
  if (condition) console.log(`ok - ${name}`);
  else {
    failures.push(name);
    console.error(`not ok - ${name}`, detail ?? '');
  }
}

const rows = [];
const store = createStateStore(memoryDb(rows));

const empty = await store.read();
check(
  'empty read',
  empty.exists === false && empty.version === 0 && Object.keys(empty.parcels).length === 0,
  empty,
);

const firstVersion = await store.write({
  exists: empty.exists,
  inputs: ['A'],
  results: [],
  parcels: {},
  version: 1,
  lastUpdated: Date.now(),
  lastTrackingFetchAt: null,
});
check('first write inserts', firstVersion === 1 && rows.length === 1, { firstVersion, rows });

const afterFirst = await store.read();
check(
  'read after insert',
  afterFirst.exists === true &&
    afterFirst.version === 1 &&
    afterFirst.inputs[0] === 'A',
  afterFirst,
);

const secondVersion = await store.write({
  exists: afterFirst.exists,
  inputs: ['A', 'B'],
  results: [{ result: true, data: { hisList: [] } }, null],
  parcels: { A: { content: '鞋子', address: '招商', expressCode: 'EWE123', status: '已签收' } },
  version: 2,
  lastUpdated: Date.now(),
  lastTrackingFetchAt: 1762460000000,
});
check('second write updates', secondVersion === 2 && rows.length === 1, { secondVersion, rows });

const afterSecond = await store.read();
check(
  'read after update',
  afterSecond.version === 2 &&
    afterSecond.inputs.length === 2 &&
    Array.isArray(afterSecond.results) &&
    afterSecond.results.length === 2 &&
    afterSecond.results[1] === null &&
    afterSecond.parcels.A?.content === '鞋子' &&
    afterSecond.parcels.A?.address === '招商' &&
    afterSecond.lastTrackingFetchAt === 1762460000000,
  afterSecond,
);

const clearedVersion = await store.write({
  exists: afterSecond.exists,
  inputs: ['A', 'B'],
  results: afterSecond.results,
  parcels: {},
  version: 3,
  lastUpdated: Date.now(),
  lastTrackingFetchAt: afterSecond.lastTrackingFetchAt,
});
const afterCleared = await store.read();
check(
  'parcels can be emptied',
  clearedVersion === 3 && Object.keys(afterCleared.parcels).length === 0,
  afterCleared,
);

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall store checks passed');
