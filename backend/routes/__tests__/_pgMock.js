// Shared mock factory for backend/db/pg.js. Used by route tests to swap
// the connection layer for a per-test in-memory client without spinning
// up a real Postgres pool.
//
// Pass to `vi.mock` as the second argument:
//
//   vi.mock('../../db/pg.js', () => pgMock(vi))
//
// Then access `getClient` from the mocked module to wire up per-test
// behaviour via `getClient.mockResolvedValue(client)`.

export function pgMock(vi) {
  const getClient = vi.fn();

  return {
    getClient,

    async query(sql, params) {
      const client = await getClient();
      try {
        const result = await client.query(sql, params);
        return result.rows;
      } finally {
        client.release();
      }
    },

    async queryOne(sql, params) {
      const client = await getClient();
      try {
        const result = await client.query(sql, params);
        return result.rows[0];
      } finally {
        client.release();
      }
    },

    async transaction(fn) {
      const client = await getClient();
      try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  };
}
