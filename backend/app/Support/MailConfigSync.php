<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;

/**
 * Admin → Settings → SMTP Settings only affected the "Send Test Email"
 * button; real outgoing mail always used .env regardless of what was
 * saved there. Applying these settings to config('mail.*') makes them
 * govern real mail, falling back to .env untouched otherwise.
 *
 * Also purges the cached "smtp" mailer transport: MailManager caches
 * transports by name, so changing config alone would not affect a
 * mailer already resolved earlier in the same process (relevant once
 * FrankenPHP worker mode keeps the container alive across requests).
 */
class MailConfigSync
{
    public static function run(): void
    {
        try {
            if (! Schema::hasTable('settings')) {
                return;
            }

            $host = Setting::get('smtp_host');

            if (! $host) {
                return;
            }

            $encryption = Setting::get('smtp_encryption') ?: 'tls';

            config([
                'mail.mailers.smtp.host' => $host,
                'mail.mailers.smtp.port' => (int) (Setting::get('smtp_port') ?: 587),
                'mail.mailers.smtp.username' => Setting::get('smtp_user'),
                'mail.mailers.smtp.password' => Setting::get('smtp_pass'),
                'mail.mailers.smtp.encryption' => $encryption === 'none' ? null : $encryption,
            ]);

            if ($fromAddress = Setting::get('mail_from_address')) {
                config(['mail.from.address' => $fromAddress]);
            }

            Mail::purge('smtp');
        } catch (\Throwable) {
            // DB not ready yet (fresh install, migrations running) -- fall back to .env.
        }
    }
}
