const { execSync } = require('child_process');
const fs = require('fs');

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

// Generate backend .env from Hostinger environment variables (set in hPanel)
const envKeys = [
  'APP_NAME', 'APP_ENV', 'APP_KEY', 'APP_DEBUG', 'APP_URL',
  'DB_CONNECTION', 'DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD',
  'SESSION_DRIVER', 'SESSION_LIFETIME', 'CACHE_STORE', 'FILESYSTEM_DISK',
  'LOG_CHANNEL', 'LOG_LEVEL',
  'STRIPE_KEY', 'STRIPE_SECRET', 'STRIPE_WEBHOOK_SECRET',
  'MAIL_MAILER', 'MAIL_HOST', 'MAIL_PORT', 'MAIL_USERNAME', 'MAIL_PASSWORD', 'MAIL_FROM_ADDRESS',
];

const envLines = envKeys
  .filter(k => process.env[k] !== undefined)
  .map(k => `${k}=${process.env[k]}`);

if (envLines.length > 0 && process.platform === 'linux') {
  fs.writeFileSync('backend/.env', envLines.join('\n') + '\n');
  console.log(`Backend .env generated (${envLines.length} variables).`);
}

// Backend — composer install + wipe stale bootstrap cache
try {
  run('composer install --no-dev --optimize-autoloader --no-scripts 2>&1', 'backend');
  if (process.platform === 'linux') {
    run('rm -f bootstrap/cache/config.php bootstrap/cache/routes.php bootstrap/cache/routes-v7.php bootstrap/cache/packages.php bootstrap/cache/services.php', 'backend');
  }
  console.log('Backend composer install complete.');
} catch (e) {
  console.error('Backend composer error:', e.message);
}

// Frontend — always runs
run('npm install', 'frontend');
run('npm run build', 'frontend');
