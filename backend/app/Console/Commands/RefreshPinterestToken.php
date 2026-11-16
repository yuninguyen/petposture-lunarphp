<?php

namespace App\Console\Commands;

use App\Models\PinterestConnection;
use App\Models\User;
use App\Notifications\PinterestConnectionNotification;
use App\Services\Pinterest\PinterestClient;
use App\Services\Pinterest\PinterestException;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

/**
 * Keeps the Pinterest login alive: renews the access token before it runs out, and warns the admin when even the
 * refresh token is close to its end (after that the owner has to reconnect by hand).
 */
class RefreshPinterestToken extends Command
{
    /** Renew the access token when it has less than this many days left. */
    private const REFRESH_WITHIN_DAYS = 7;

    /** Warn when the refresh token has less than this many days left. */
    private const WARN_WITHIN_DAYS = 14;

    protected $signature = 'pinterest:refresh-token';

    protected $description = 'Renew the Pinterest access token before it expires and warn when the login is about to lapse';

    public function handle(PinterestClient $client): int
    {
        $connection = PinterestConnection::current();

        if (! $connection || ! $connection->isUsable()) {
            $this->line('not_connected');

            return self::SUCCESS;
        }

        if ($connection->access_expires_at && $connection->access_expires_at->lt(now()->addDays(self::REFRESH_WITHIN_DAYS))) {
            try {
                $client->refresh($connection);
                $this->info('refreshed');
            } catch (PinterestException $e) {
                // The client has already marked the connection lost (and told the admin) when it was refused.
                $this->error('refresh_failed: '.$e->getMessage());

                return self::FAILURE;
            }
        }

        $this->warnIfLapsing($connection->refresh());

        return self::SUCCESS;
    }

    private function warnIfLapsing(PinterestConnection $connection): void
    {
        if (! $connection->refresh_expires_at
            || $connection->refresh_expires_at->gt(now()->addDays(self::WARN_WITHIN_DAYS))
            || $connection->expiry_warned_at) {
            return;
        }

        Notification::send(User::staffRecipients(), new PinterestConnectionNotification(PinterestConnectionNotification::EXPIRING));
        $connection->forceFill(['expiry_warned_at' => now()])->save();
        $this->warn('expiry_warning_sent');
    }
}
