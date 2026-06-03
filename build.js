const { execSync } = require('child_process');

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

// Backend — composer install + wipe stale bootstrap cache
try {
  run('composer install --no-dev --optimize-autoloader --no-scripts', 'backend');
  // Remove stale cache files so runtime reads .env fresh, not a build-time sqlite default
  run('rm -f bootstrap/cache/config.php bootstrap/cache/routes.php bootstrap/cache/routes-v7.php bootstrap/cache/packages.php bootstrap/cache/services.php', 'backend');
  console.log('Backend composer install complete.');
} catch (e) {
  console.log('Backend build skipped (composer not available).');
}

// Frontend — always runs
run('npm install', 'frontend');
run('npm run build', 'frontend');
