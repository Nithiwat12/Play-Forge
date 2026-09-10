const { spawnSync } = require('node:child_process');
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', 'tests/rejoin.test.ts'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test', DIRECT_URL: 'postgresql://test:test@127.0.0.1:1/test', JWT_SECRET: 'test-only-key' },
});
process.exit(result.status ?? 1);
