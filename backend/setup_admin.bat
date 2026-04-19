@echo off
set PHP_BIN=C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe
set COMPOSER_BIN=%PHP_BIN% C:\laragon\bin\composer\composer.phar

echo [PetPosture] Starting Backend Admin Setup (FilamentPHP)...
cd backend

echo Step 1: Installing Filament via Composer...
%COMPOSER_BIN% require filament/filament:^3.2 -W

echo Step 2: Running Database Migrations...
%PHP_BIN% artisan migrate --force

echo Step 3: Installing Filament Admin Panel...
%PHP_BIN% artisan filament:install --panels --no-interaction

echo Step 4: Starting Laravel Server on Port 8000...
%PHP_BIN% artisan serve --port=8000

pause
