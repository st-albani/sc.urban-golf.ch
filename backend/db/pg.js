import pkg from 'pg';
const { Pool } = pkg;

let pool = null;

// Lazy initialization - create pool only when first needed
function getPool() {
  if (!pool) {
    const poolConfig = {
      connectionString: process.env.DATABASE_URL,
      // Release idle clients after 30s to avoid leaking long-lived connections
      idleTimeoutMillis: 30_000,
      // Fail fast if a new connection can't be acquired in 5s
      connectionTimeoutMillis: 5_000,
      // Per-statement timeout — protects against runaway queries
      statement_timeout: 30_000,
      // Cap pool size to prevent saturating the database
      max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
    };

    // Only enable SSL for production external databases (e.g., managed services)
    if (process.env.NODE_ENV === 'production' && process.env.DATABASE_SSL === 'true') {
      poolConfig.ssl = {
        rejectUnauthorized: false
      };
    }

    pool = new Pool(poolConfig);

    // Log idle client errors instead of crashing the process
    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
    });
  }
  return pool;
}

// Graceful shutdown
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, async () => {
    console.log(`Received ${signal}, closing database pool...`);
    if (pool) {
      await pool.end();
    }
    process.exit(0);
  });
}

// Funktion zum Abrufen eines DB-Clients
export const getClient = () => getPool().connect();

/**
 * Run a query and return all rows. Connection lifecycle is managed
 * internally — handlers don't have to remember release().
 */
export async function query(sql, params) {
  const client = await getClient();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Run a query and return the first row, or undefined if no rows.
 */
export async function queryOne(sql, params) {
  const client = await getClient();
  try {
    const result = await client.query(sql, params);
    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Run `fn` inside a transaction. Commits on success, rolls back on throw,
 * always releases the client. The callback receives the bound client so it
 * can run multiple queries on the same connection.
 */
export async function transaction(fn) {
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
}
