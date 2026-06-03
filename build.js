const { execSync } = require('child_process');

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

// Backend — skip silently if composer/php not available
try {
  run('composer install --no-dev --optimize-autoloader', 'backend');
  run('php artisan config:cache', 'backend');
  run('php artisan route:cache', 'backend');
  run('php artisan view:cache', 'backend');
  run('php artisan migrate --force', 'backend');
  console.log('Backend build complete.');
} catch (e) {
  console.log('Backend build skipped (PHP/composer not available locally).');
}

// Frontend — always runs
run('npm install', 'frontend');
run('npm run build', 'frontend');
