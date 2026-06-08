const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

// Generate backend .env from Hostinger environment variables (set in hPanel)
const envKeys = [
  'APP_NAME', 'APP_ENV', 'APP_KEY', 'APP_DEBUG', 'APP_URL', 'FRONTEND_URL',
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

// Generate frontend .env.local so NEXT_PUBLIC_* vars are available at build time
if (process.platform === 'linux' && process.env.NEXT_PUBLIC_API_URL) {
  fs.writeFileSync('frontend/.env.local', `NEXT_PUBLIC_API_URL=${process.env.NEXT_PUBLIC_API_URL}\n`);
  console.log(`Frontend .env.local generated (NEXT_PUBLIC_API_URL=${process.env.NEXT_PUBLIC_API_URL}).`);
}

// Backend — composer install + wipe stale bootstrap cache
try {
  run('composer install --no-dev --optimize-autoloader --no-scripts 2>&1', 'backend');
  run('npm install', 'backend');
  run('npm run build', 'backend');
  if (process.platform === 'linux') {
    run('rm -f bootstrap/cache/config.php bootstrap/cache/routes.php bootstrap/cache/routes-v7.php bootstrap/cache/packages.php bootstrap/cache/services.php', 'backend');

    // Re-point storage/app/public at persistent storage outside the git working tree.
    // Git checkout/clean removes this path each deploy since it's untracked, so recreate it.
    const storagePublic = path.resolve('backend/storage/app/public');
    const persistentPublic = path.resolve('../petposture-storage/app/public');
    if (fs.existsSync(persistentPublic)) {
      const isLinkToTarget = fs.existsSync(storagePublic)
        && fs.lstatSync(storagePublic).isSymbolicLink()
        && fs.realpathSync(storagePublic) === fs.realpathSync(persistentPublic);
      if (!isLinkToTarget) {
        fs.rmSync(storagePublic, { recursive: true, force: true });
        fs.symlinkSync(persistentPublic, storagePublic);
        console.log(`Re-created persistent storage symlink: ${storagePublic} -> ${persistentPublic}`);
      }
    }

    // Sync backend to public_html/api where PHP serves from
    const src = path.resolve('backend');
    const dest = path.resolve('../public_html/api');
    if (fs.existsSync(dest)) {
      console.log(`Syncing backend to ${dest} ...`);
      fs.cpSync(src, dest, {
        recursive: true,
        force: true,
        filter: (s) => {
          if (s.includes('/.git/')) return false;
          const storageDir = path.join(src, 'storage');
          return s !== storageDir && !s.startsWith(storageDir + path.sep);
        },
      });
      console.log('Backend sync complete.');
    }
  }
  console.log('Backend composer install complete.');
} catch (e) {
  console.error('Backend composer error:', e.message);
}

// Frontend — always runs
run('npm install', 'frontend');
run('npm run build', 'frontend');
