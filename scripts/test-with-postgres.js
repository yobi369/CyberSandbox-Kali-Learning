import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postgresDirectory = path.join(root, '.local', 'postgres');
const databaseName = 'cybersandbox_test';
const postgresUser = 'postgres';
const postgresPassword = 'cybersandbox-local-test-only';

function run(command, args, env = process.env, stdio = 'inherit') {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio });
    child.once('error', reject);
    child.once('close', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not allocate a local PostgreSQL port.');
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function runTests(env) {
  return run(process.execPath, [path.join(root, 'node_modules', 'vitest', 'vitest.mjs'), 'run'], env);
}

if (process.env.DATABASE_URL) {
  process.exitCode = await runTests(process.env);
} else {
  const port = await availablePort();
  const platformName = process.platform === 'win32' ? 'windows' : process.platform;
  const binaryPackage = `@embedded-postgres/${platformName}-${process.arch}`;
  const { pg_ctl: pgCtl } = await import(binaryPackage);
  const database = new EmbeddedPostgres({
    databaseDir: postgresDirectory,
    port,
    user: postgresUser,
    password: postgresPassword,
    authMethod: 'scram-sha-256',
    initdbFlags: ['--encoding=UTF8'],
    persistent: true,
    autoRehydrateSymlinks: true,
    onLog: (message) => process.stdout.write(message),
    onError: (error) => console.error('Embedded PostgreSQL:', error),
  });
  let started = false;
  let stopPromise;
  const stopDatabase = () => {
    if (stopPromise) return stopPromise;
    if (!started) return Promise.resolve(0);
    started = false;
    stopPromise = run(pgCtl, ['stop', '-D', postgresDirectory, '-m', 'fast', '-w']);
    return stopPromise;
  };

  try {
    try {
      await access(path.join(postgresDirectory, 'PG_VERSION'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await database.initialise();
    }

    const statusResult = await run(pgCtl, ['status', '-D', postgresDirectory], process.env, 'ignore');
    if (statusResult === 0) {
      throw new Error('The local PostgreSQL cluster is already running. Stop it before running npm test.');
    }

    const startResult = await run(pgCtl, [
      'start',
      '-D',
      postgresDirectory,
      '-o',
      `-h 127.0.0.1 -p ${port}`,
      '-w',
    ]);
    if (startResult !== 0) throw new Error('PostgreSQL failed to start.');
    started = true;
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.once(signal, () => {
        process.exitCode = signal === 'SIGINT' ? 130 : 143;
        void stopDatabase().then((result) => {
          if (result !== 0) {
            console.error('PostgreSQL did not stop cleanly.');
            process.exitCode = 1;
          }
        }).catch((error) => {
          console.error('Could not stop local PostgreSQL:', error);
          process.exitCode = 1;
        });
      });
    }

    const client = database.getPgClient('postgres', '127.0.0.1');
    try {
      await client.connect();
      const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
      if (existing.rowCount === 0) await database.createDatabase(databaseName);
    } finally {
      await client.end();
    }

    const databaseUrl = `postgresql://${postgresUser}:${postgresPassword}@127.0.0.1:${port}/${databaseName}`;
    const env = { ...process.env, DATABASE_URL: databaseUrl };
    console.log(`Using local PostgreSQL at 127.0.0.1:${port}/${databaseName}. Data is retained in .local/postgres.`);

    const buildResult = await run(process.execPath, [
      path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
      '-p',
      'tsconfig.server.json',
    ]);
    if (buildResult !== 0) {
      process.exitCode = buildResult;
    } else {
      const migrationResult = await run(process.execPath, [
        path.join(root, 'dist-server', 'server', 'migrate.js'),
      ], env);
      process.exitCode = migrationResult === 0 ? await runTests(env) : migrationResult;
    }
  } catch (error) {
    console.error('Could not prepare the local PostgreSQL test database:', error);
    process.exitCode = 1;
  } finally {
    const stopResult = await stopDatabase();
    if (stopResult !== 0) {
      console.error('PostgreSQL did not stop cleanly.');
      process.exitCode = 1;
    }
  }
}
