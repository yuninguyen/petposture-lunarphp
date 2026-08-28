<?php

namespace App\Support;

use Illuminate\Contracts\Foundation\Application;
use RuntimeException;

class ProductionMailConfiguration
{
    public static function assertSafe(Application $app): void
    {
        if ($app->environment('production') && $app->make('config')->get('mail.default') === 'log') {
            throw new RuntimeException(
                'Production cannot use the log mailer. Configure MAIL_MAILER with a real delivery provider before startup.'
            );
        }
    }
}
