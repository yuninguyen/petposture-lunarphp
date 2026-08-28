<?php

namespace App\Services;

use App\Models\OrderEmailDelivery;
use Closure;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Mailer\SentMessage;
use Throwable;

class OrderEmailDeliveryService
{
    /**
     * @param  Closure(): (?SentMessage)  $send
     */
    public function deliver(
        string $deliveryKey,
        string $jobType,
        int $orderId,
        string $recipient,
        Closure $send,
    ): bool {
        $delivery = DB::transaction(function () use ($deliveryKey, $jobType, $orderId, $recipient) {
            OrderEmailDelivery::query()->createOrFirst(
                ['delivery_key' => $deliveryKey],
                [
                    'job_type' => $jobType,
                    'order_id' => $orderId,
                    'recipient' => $recipient,
                    'status' => OrderEmailDelivery::STATUS_PENDING,
                ],
            );

            $locked = OrderEmailDelivery::query()
                ->where('delivery_key', $deliveryKey)
                ->lockForUpdate()
                ->firstOrFail();

            if (in_array($locked->status, [
                OrderEmailDelivery::STATUS_SENDING,
                OrderEmailDelivery::STATUS_SENT,
            ], true)) {
                return null;
            }

            $locked->update([
                'status' => OrderEmailDelivery::STATUS_SENDING,
                'attempt_count' => $locked->attempt_count + 1,
                'last_error' => null,
                'sending_at' => now(),
                'failed_at' => null,
            ]);

            return $locked;
        });

        if (! $delivery) {
            return false;
        }

        try {
            $sentMessage = $send();
            $delivery->update([
                'status' => OrderEmailDelivery::STATUS_SENT,
                'provider_message_id' => $sentMessage?->getMessageId(),
                'sent_at' => now(),
            ]);
        } catch (Throwable $exception) {
            $delivery->update([
                'status' => OrderEmailDelivery::STATUS_FAILED,
                'last_error' => mb_substr($exception->getMessage(), 0, 2000),
                'failed_at' => now(),
            ]);

            throw $exception;
        }

        return true;
    }
}
