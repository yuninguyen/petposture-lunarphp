param([int]$StartPartition = 0)
$ErrorActionPreference = 'Stop'
$env:APP_ENV='testing'; $env:DB_CONNECTION='sqlite'; $env:DB_DATABASE=':memory:'; $env:DB_URL=''; $env:CACHE_STORE='array'; $env:SESSION_DRIVER='array'; $env:QUEUE_CONNECTION='sync'
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes); $rng.Dispose()
$env:APP_KEY='base64:' + [Convert]::ToBase64String($bytes)
$env:APP_MAINTENANCE_DRIVER='file'; $env:BCRYPT_ROUNDS='4'; $env:BROADCAST_CONNECTION='null'; $env:MAIL_MAILER='array'; $env:PULSE_ENABLED='false'; $env:TELESCOPE_ENABLED='false'; $env:NIGHTWATCH_ENABLED='false'
$partitions = @(
 ,@('StorefrontRefreshJournalTest','StorefrontInitialClaimTest','StorefrontJournalFailureTest','StorefrontReplayOperationsTest')
 ,@('StorefrontRefreshTransactionTest','StorefrontMutationCompletionTest')
 ,@('PublicContentPurgeTest','SettingsApiTest','SiteMediaApiTest','Filament/ManageSettingsTest')
 ,@('CloudflarePurgeWarningMiddlewareTest','StorefrontRecoveryNotificationTest')
 ,@('StorefrontRefreshRoutedLifecycleTest')
)
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
 $failed = $false
 for ($i=$StartPartition; $i -lt $partitions.Count; $i++) {
  Write-Output "=== P$i ==="
  $files = @($partitions[$i] | ForEach-Object { "tests/Feature/$_.php" })
  & php vendor/phpunit/phpunit/phpunit --no-coverage @files
  $code = $LASTEXITCODE
  Write-Output "P${i}_EXIT_DECIMAL=$code"
  if ($code -ne 0) { $failed = $true }
 }
 if ($failed) { exit 1 }
} finally { Pop-Location }
