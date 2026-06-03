const { execSync } = require('child_process');

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

// Backend — only composer install; artisan cache/migrate run manually on server
try {
  run('composer install --no-dev --optimize-autoloader --no-scripts', 'backend');
  console.log('Backend composer install complete.');
} catch (e) {
  console.log('Backend build skipped (composer not available).');
}

// Frontend — always runs
run('npm install', 'frontend');
run('npm run build', 'frontend');
