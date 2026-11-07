const TABLE = 'tracker_state';
const ROW_ID = 'shared';

function toMs(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIso(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Date(value).toISOString()
    : null;
}

function normalizeInputs(value) {
  let candidate = value;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(candidate)) return [];
  return candidate.filter((line) => typeof line === 'string');
}

/**
 * Single-row shared state store backed by the site database.
 * Business errors are surfaced as throws; routes.mjs maps them to safe codes.
 */
export function createStateStore(db) {
  return {
    async read() {
      const result = await db
        .from(TABLE)
        .select('inputs,version,last_updated,last_tracking_fetch_at')
        .eq('id', ROW_ID)
        .limit(1);

      if (result.error) throw new Error('database_read_failed');

      const row = Array.isArray(result.data) ? result.data[0] : null;
      return {
        exists: Boolean(row),
        inputs: normalizeInputs(row?.inputs),
        version: Number.isInteger(row?.version) ? row.version : 0,
        lastUpdated: toMs(row?.last_updated) ?? Date.now(),
        lastTrackingFetchAt: toMs(row?.last_tracking_fetch_at),
      };
    },

    async write(state) {
      const values = {
        inputs: state.inputs,
        version: state.version,
        last_updated: toIso(state.lastUpdated) ?? new Date().toISOString(),
        last_tracking_fetch_at: toIso(state.lastTrackingFetchAt),
      };

      const result = state.exists
        ? await db.from(TABLE).update(values).eq('id', ROW_ID).select('version')
        : await db.from(TABLE).insert({ id: ROW_ID, ...values }).select('version');

      if (result.error) throw new Error('database_write_failed');
      if (!Array.isArray(result.data) || result.data.length === 0) {
        throw new Error('database_write_failed');
      }

      const row = result.data[0];
      return Number.isInteger(row?.version) ? row.version : state.version;
    },
  };
}
