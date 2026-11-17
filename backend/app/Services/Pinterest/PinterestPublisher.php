<?php

namespace App\Services\Pinterest;

use App\Models\PinterestConnection;
use App\Models\PinterestPin;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Posts at most one due pin to Pinterest per run, within the owner's limits. It only ever picks pins that are
 * `ready`, have a scheduled date that has come and have a board, so a pin the owner already posted by hand
 * (`posted`) can never be posted twice. Pinterest has no way to say "this request was already done", so when the
 * outcome of a call is unknown the pin is parked as `needs_review` for a person instead of being retried.
 */
class PinterestPublisher
{
    public const MAX_ATTEMPTS = 3;

    /** A pin stuck in `publishing` this long lost its worker mid-call; its outcome is unknown. */
    private const STUCK_AFTER_MINUTES = 15;

    public function __construct(
        private readonly PinterestClient $client,
        private readonly PinterestPublishSettings $settings,
    ) {}

    /** Returns what happened as a short code, for the command output and the tests. */
    public function publishNext(): string
    {
        $this->parkStuckPins();

        if (! $this->settings->get('auto_publish')) {
            return 'disabled';
        }

        $connection = PinterestConnection::current();

        if (! $connection || ! $connection->isUsable()) {
            return 'not_connected';
        }

        $local = now((string) $this->settings->get('timezone'));

        if (! $this->insideWindow($local)) {
            return 'outside_window';
        }

        if ($this->takenTodayCount($local) >= (int) $this->settings->get('max_per_day')) {
            return 'daily_limit';
        }

        if ($this->tooSoonAfterLastAttempt()) {
            return 'too_soon';
        }

        $pin = PinterestPin::query()
            ->where('status', PinterestPin::STATUS_READY)
            ->whereDate('scheduled_date', '<=', $local->toDateString())
            ->whereNotNull('pinterest_board_id')
            ->where('publish_attempts', '<', self::MAX_ATTEMPTS)
            ->orderBy('scheduled_date')
            ->orderBy('id')
            ->first();

        if (! $pin) {
            return 'nothing_due';
        }

        if ($this->claim($pin->id) === 0) {
            return 'raced';
        }

        return $this->publish($pin->refresh());
    }

    /**
     * Posts one chosen pin right now, for the "Post now" button. The owner asked for this pin, so the schedule, the
     * daily limit, the gap and the time window do not apply. The safety checks do: Pinterest must be connected, the
     * pin must still be ready and have a board, its link must point to this site, and a second click while the first
     * is in flight finds the pin already taken.
     */
    public function publishNow(PinterestPin $pin): string
    {
        $connection = PinterestConnection::current();

        if (! $connection || ! $connection->isUsable()) {
            return 'not_connected';
        }

        if (blank($pin->pinterest_board_id)) {
            return 'no_board';
        }

        if ($this->claim($pin->id) === 0) {
            return 'not_ready';
        }

        return $this->publish($pin->refresh());
    }

    /** Takes the pin in one statement so a hand click or another run cannot take the same one. Returns rows taken. */
    private function claim(int $pinId): int
    {
        return PinterestPin::query()
            ->whereKey($pinId)
            ->where('status', PinterestPin::STATUS_READY)
            ->update([
                'status' => PinterestPin::STATUS_PUBLISHING,
                'publish_attempts' => DB::raw('publish_attempts + 1'),
                'last_attempt_at' => now(),
            ]);
    }

    private function publish(PinterestPin $pin): string
    {
        try {
            $this->assertPointsToOurSite($pin);
            [$bytes, $mime] = $this->imageFor($pin);
        } catch (PinterestException $e) {
            // Caught before anything was sent: nothing to retry until a person fixes the pin.
            return $this->fail($pin, $e->getMessage(), PinterestPin::STATUS_FAILED);
        }

        try {
            $pinterestId = $this->client->createPin($pin, $bytes, $mime);
        } catch (PinterestException $e) {
            return $this->afterFailedCall($pin, $e);
        } catch (Throwable $e) {
            report($e);

            return $this->fail($pin, 'Unexpected error: '.$e->getMessage(), PinterestPin::STATUS_FAILED);
        }

        $pin->forceFill([
            'status' => PinterestPin::STATUS_POSTED,
            'posted_at' => now(),
            'posted_via' => PinterestPin::POSTED_VIA_API,
            'pinterest_pin_id' => $pinterestId,
            'last_error' => null,
        ])->save();

        return 'posted';
    }

    private function afterFailedCall(PinterestPin $pin, PinterestException $e): string
    {
        if ($e->outcomeUnknown) {
            return $this->fail($pin, 'Pinterest did not confirm: it may have been posted. Check Pinterest, then mark it posted or retry. ('.$e->getMessage().')', PinterestPin::STATUS_NEEDS_REVIEW);
        }

        // Pinterest refused outright (bad data, expired login, rate limit): nothing was created, so a retry is safe.
        // An auth failure or a rate limit is not the pin's fault, so it does not use up one of its attempts.
        $notThePinsFault = $e->isAuthFailure() || $e->isRateLimited();

        if ($notThePinsFault) {
            $pin->publish_attempts = max(0, $pin->publish_attempts - 1);
        }

        $retry = $notThePinsFault || $pin->publish_attempts < self::MAX_ATTEMPTS;

        return $this->fail($pin, $e->getMessage(), $retry ? PinterestPin::STATUS_READY : PinterestPin::STATUS_FAILED);
    }

    private function fail(PinterestPin $pin, string $message, string $status): string
    {
        $pin->forceFill(['status' => $status, 'last_error' => Str::limit($message, 500)])->save();

        return $status === PinterestPin::STATUS_READY ? 'retry_later' : $status;
    }

    /** A pin goes to our own articles and Pick pages only: never to another site (an affiliate link, say). */
    private function assertPointsToOurSite(PinterestPin $pin): void
    {
        $ours = $this->host((string) config('app.frontend_url'));

        if ($ours === null || $this->host($pin->destination_url) !== $ours) {
            throw new PinterestException('The link must point to this site.');
        }
    }

    private function host(string $url): ?string
    {
        $host = parse_url($url, PHP_URL_HOST);

        return $host ? preg_replace('/^www\./i', '', strtolower($host)) : null;
    }

    /**
     * The image file as Pinterest wants it. Pinterest takes JPEG or PNG; the media library stores uploads as WebP,
     * so those are turned into JPEG here.
     *
     * @return array{0: string, 1: string} bytes and mime type
     */
    private function imageFor(PinterestPin $pin): array
    {
        $disk = Storage::disk(config('curator.disk'));

        if (! $disk->exists($pin->image)) {
            throw new PinterestException('The image file of this pin is missing.');
        }

        $bytes = $disk->get($pin->image);
        $extension = strtolower(pathinfo($pin->image, PATHINFO_EXTENSION));

        if ($extension === 'png') {
            return [$bytes, 'image/png'];
        }

        if (in_array($extension, ['jpg', 'jpeg'], true)) {
            return [$bytes, 'image/jpeg'];
        }

        $image = function_exists('imagecreatefromstring') ? @imagecreatefromstring($bytes) : false;

        if ($image === false) {
            throw new PinterestException('The image could not be converted to JPEG for Pinterest.');
        }

        ob_start();
        imagejpeg($image, null, 92);
        $jpeg = (string) ob_get_clean();

        return [$jpeg, 'image/jpeg'];
    }

    private function insideWindow(Carbon $local): bool
    {
        $now = $local->format('H:i');

        return $now >= $this->settings->get('window_start') && $now <= $this->settings->get('window_end');
    }

    /** Pins the job took today (posted by it, in flight, or unconfirmed), counted on the owner's calendar day. */
    private function takenTodayCount(Carbon $local): int
    {
        return PinterestPin::query()
            ->where('last_attempt_at', '>=', $local->copy()->startOfDay()->utc())
            ->where(function ($query) {
                $query->where('posted_via', PinterestPin::POSTED_VIA_API)
                    ->orWhereIn('status', [PinterestPin::STATUS_PUBLISHING, PinterestPin::STATUS_NEEDS_REVIEW]);
            })
            ->count();
    }

    private function tooSoonAfterLastAttempt(): bool
    {
        $last = PinterestPin::query()->max('last_attempt_at');

        return $last !== null
            && now()->lt(Carbon::parse($last)->addMinutes((int) $this->settings->get('min_gap_minutes')));
    }

    private function parkStuckPins(): void
    {
        PinterestPin::query()
            ->where('status', PinterestPin::STATUS_PUBLISHING)
            ->where('last_attempt_at', '<', now()->subMinutes(self::STUCK_AFTER_MINUTES))
            ->update([
                'status' => PinterestPin::STATUS_NEEDS_REVIEW,
                'last_error' => 'The run stopped before Pinterest answered. Check Pinterest, then mark it posted or retry.',
            ]);
    }
}
