# Isolated, offline C0 journal partitions. Each PHPUnit child must exit cleanly.
param([string]$Partition)
$ErrorActionPreference = 'Stop'
$backend = Split-Path $PSScriptRoot -Parent
$env:APP_ENV = 'testing'
$env:APP_KEY = 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
$env:DB_CONNECTION = 'sqlite'
$env:DB_DATABASE = ':memory:'
$env:DB_URL = ''
$env:CACHE_STORE = 'array'
$env:SESSION_DRIVER = 'array'
$env:QUEUE_CONNECTION = 'sync'
$files = @(
 'StorefrontInitialClaimTest', 'StorefrontReplayOperationsTest', 'StorefrontReadinessTest',
 'JournalReplaySummaryTest', 'JournalCorsTest', 'JournalFaultEvidenceTest', 'JournalOwnerReplayTest',
 'StorefrontRefreshJournalTest', 'StorefrontJournalFailureTest', 'StorefrontRecoveryNotificationTest',
 'StorefrontRefreshRoutedLifecycleTest', 'StorefrontRefreshTransactionTest',
 'StorefrontMutationCompletionTest', 'PublicContentPurgeTest',
 'CloudflarePurgeWarningMiddlewareTest', 'SiteMediaApiTest', 'SettingsApiTest',
 'Filament/ManageSettingsTest'
)
if ($Partition) {
 if ($Partition -notin $files) { throw "Unknown scope partition $Partition" }
 $files = @($Partition)
}
Push-Location $backend
try {
 foreach ($file in $files) {
  Write-Output "=== PARTITION $file ==="
  & php vendor/phpunit/phpunit/phpunit "tests/Feature/$file.php" --no-coverage
  if ($LASTEXITCODE -ne 0) { throw "Partition $file exited $LASTEXITCODE; aggregate NOT verified." }
 }
 Write-Output "ALL $($files.Count) JOURNAL SCOPE PARTITIONS EXITED ZERO"
} finally { Pop-Location }
