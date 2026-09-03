<?php

namespace Tests\Feature;

use App\Mail\OrderReturnApproved;
use App\Mail\OrderReturnRejected;
use App\Mail\OrderReturnRequested;
use App\Models\OrderReturnRequest;
use App\Models\User;
use App\Services\ReturnRequestService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Lunar\FieldTypes\Text;
use Lunar\Models\Channel;
use Lunar\Models\Country;
use Lunar\Models\Currency;
use Lunar\Models\CustomerGroup;
use Lunar\Models\Language;
use Lunar\Models\Order;
use Lunar\Models\OrderLine;
use Lunar\Models\Price;
use Lunar\Models\Product;
use Lunar\Models\ProductType;
use Lunar\Models\ProductVariant;
use Lunar\Models\TaxClass;
use Lunar\Models\TaxRate;
use Lunar\Models\TaxRateAmount;
use Lunar\Models\TaxZone;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ReturnRequestApiTest extends TestCase
{
    use RefreshDatabase;

    private array $trackingTokensByReference = [];

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        Mail::fake();
    }

    // ─── POST /api/orders/return-requests (guest) ──────────────────────────

    public function test_guest_can_submit_return_request_for_delivered_order(): void
    {
        ['order_id' => $orderId, 'reference' => $reference, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();

        $response = $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId));

        $response->assertCreated()
            ->assertJsonPath('data.order_reference', $reference)
            ->assertJsonPath('data.status', OrderReturnRequest::STATUS_REQUESTED)
            ->assertJsonPath('data.reason', 'Wrong size')
            ->assertJsonPath('data.items.0.order_line_id', (string) $lineId)
            ->assertJsonPath('data.items.0.quantity', 1);

        $this->assertDatabaseHas('order_return_requests', [
            'order_id' => $orderId,
            'status' => OrderReturnRequest::STATUS_REQUESTED,
        ]);

        Mail::assertSent(OrderReturnRequested::class);
    }

    public function test_guest_cannot_submit_return_request_for_shipped_order_not_yet_delivered(): void
    {
        ['reference' => $reference, 'order_line_id' => $lineId] = $this->placeShippedOrder();

        $response = $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['order']);
    }

    public function test_return_request_returns_not_found_for_unknown_credentials(): void
    {
        $response = $this->postJson('/api/orders/return-requests', $this->returnRequestPayload('MISSING-REF', 1));

        $response->assertNotFound()
            ->assertJsonPath('message', 'Unable to access this order.');
    }

    public function test_return_request_validates_required_fields(): void
    {
        $this->postJson('/api/orders/return-requests', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['tracking_token', 'email', 'reason', 'items']);
    }

    public function test_return_request_rejects_order_not_delivered(): void
    {
        $variant = $this->createPurchasableVariant();
        $placeResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $reference = $placeResponse->json('order.reference');
        $this->trackingTokensByReference[$reference] = $placeResponse->json('order.tracking_access_token');
        $orderId = $placeResponse->json('order.id');
        $lineId = OrderLine::where('order_id', $orderId)->value('id');

        $response = $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['order']);
    }

    public function test_return_request_rejects_duplicate_active_request(): void
    {
        ['reference' => $reference, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();

        $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId))
            ->assertCreated();

        $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['order']);
    }

    public function test_return_request_rejects_line_already_returned_in_a_completed_request(): void
    {
        ['reference' => $reference, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();

        $firstResponse = $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId));
        $firstResponse->assertCreated();
        $firstReturnRequestId = $firstResponse->json('data.id');

        $this->makeAdmin();
        $this->postJson("/api/admin/return-requests/{$firstReturnRequestId}/approve", [
            'rma_address' => '123 Warehouse Rd',
        ])->assertOk();
        $this->postJson("/api/admin/return-requests/{$firstReturnRequestId}/complete")->assertOk();

        // The line's full purchased quantity was already returned and completed —
        // a brand new return request for the same line must not be creatable again.
        $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['items']);
    }

    public function test_return_request_rejects_order_line_not_belonging_to_order(): void
    {
        ['reference' => $reference] = $this->placeDeliveredOrder();
        ['order_line_id' => $otherOrderLineId] = $this->placeDeliveredOrder();

        $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $otherOrderLineId))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['items']);
    }

    public function test_return_request_rejects_quantity_exceeding_purchased_quantity(): void
    {
        ['reference' => $reference, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();

        $payload = $this->returnRequestPayload($reference, $lineId);
        $payload['items'][0]['quantity'] = 999;

        $this->postJson('/api/orders/return-requests', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['items']);
    }

    public function test_return_request_rejects_duplicate_line_quantity_exceeding_purchased_quantity(): void
    {
        ['reference' => $reference, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();

        $payload = $this->returnRequestPayload($reference, $lineId);
        // Same order_line_id split across two items — quantities must be summed, not checked independently.
        $payload['items'] = [
            ['order_line_id' => $lineId, 'quantity' => 1],
            ['order_line_id' => $lineId, 'quantity' => 1],
        ];

        $this->postJson('/api/orders/return-requests', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['items']);
    }

    public function test_return_request_rejects_when_outside_30_day_window(): void
    {
        ['order_id' => $orderId, 'reference' => $reference, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();

        $this->setDeliveredAt($orderId, now()->subDays(31));

        $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['order']);
    }

    public function test_return_request_requires_tracking_token_instead_of_order_reference(): void
    {
        ['reference' => $reference, 'tracking_token' => $trackingToken, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();

        $legacyPayload = $this->returnRequestPayload($reference, $lineId);
        unset($legacyPayload['tracking_token']);
        $legacyPayload['order_reference'] = $reference;

        $this->postJson('/api/orders/return-requests', $legacyPayload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('tracking_token');

        $this->postJson('/api/orders/return-requests', [
            ...$this->returnRequestPayload($trackingToken, $lineId),
            'tracking_token' => $trackingToken,
        ])->assertCreated();
    }

    public function test_return_request_allows_within_30_day_window(): void
    {
        ['order_id' => $orderId, 'reference' => $reference, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();

        $this->setDeliveredAt($orderId, now()->subDays(29));

        $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId))
            ->assertCreated();
    }

    // ─── POST /api/orders/track (active-return flag) ───────────────────────

    public function test_track_flags_order_with_an_active_return_request(): void
    {
        ['reference' => $reference, 'tracking_token' => $trackingToken, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();

        $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId))
            ->assertCreated();

        $this->postJson('/api/orders/track', [
            'tracking_token' => $trackingToken,
            'email' => 'guest@petposture.com',
        ])->assertOk()->assertJsonPath('has_active_return_request', true);
    }

    public function test_track_does_not_flag_order_without_a_return_request(): void
    {
        ['tracking_token' => $trackingToken] = $this->placeDeliveredOrder();

        $this->postJson('/api/orders/track', [
            'tracking_token' => $trackingToken,
            'email' => 'guest@petposture.com',
        ])->assertOk()->assertJsonPath('has_active_return_request', false);
    }

    public function test_return_options_are_token_gated_and_only_expose_returnable_lines(): void
    {
        ['tracking_token' => $trackingToken, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();

        $response = $this->postJson('/api/orders/return-requests/options', [
            'tracking_token' => $trackingToken,
            'email' => 'guest@petposture.com',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'delivered')
            ->assertJsonPath('data.lines.0.id', (string) $lineId)
            ->assertJsonMissingPath('data.customer_email')
            ->assertJsonMissingPath('data.shipping_address')
            ->assertJsonMissingPath('data.payment_status')
            ->assertJsonMissingPath('data.total');
    }

    // ─── POST /api/orders/return-requests/preview ───────────────────────────

    public function test_preview_computes_refund_estimate_without_creating_a_request(): void
    {
        ['tracking_token' => $trackingToken, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();

        $response = $this->postJson('/api/orders/return-requests/preview', [
            'tracking_token' => $trackingToken,
            'email' => 'guest@petposture.com',
            'items' => [
                ['order_line_id' => $lineId, 'quantity' => 1],
            ],
        ]);

        // Same fixture as the approve-estimate tests: $89.99 subtotal, 25% fee = $22.50.
        $response->assertOk()
            ->assertJsonPath('restocking_fee', 22.5)
            ->assertJsonPath('estimated_refund', 74.87);

        $this->assertDatabaseCount('order_return_requests', 0);
    }

    public function test_preview_returns_not_found_for_unknown_credentials(): void
    {
        $this->postJson('/api/orders/return-requests/preview', [
            'tracking_token' => 'MISSING-REF',
            'email' => 'guest@petposture.com',
            'items' => [
                ['order_line_id' => 1, 'quantity' => 1],
            ],
        ])->assertNotFound();
    }

    // ─── ReturnRequestService (direct) ──────────────────────────────────────

    public function test_service_rejects_empty_items_array(): void
    {
        ['order_id' => $orderId] = $this->placeDeliveredOrder();
        $order = Order::find($orderId);

        $this->expectException(ValidationException::class);

        app(ReturnRequestService::class)->create($order, [], 'No longer needed', null);
    }

    // ─── Admin endpoints ─────────────────────────────────────────────────────

    public function test_admin_can_list_return_requests(): void
    {
        ['reference' => $reference, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();
        $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId))->assertCreated();

        $this->makeAdmin();

        $this->getJson('/api/admin/return-requests')
            ->assertOk()
            ->assertJsonPath('data.0.order_reference', $reference);
    }

    public function test_admin_can_view_single_return_request(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];

        $this->makeAdmin();

        $this->getJson("/api/admin/return-requests/{$returnRequestId}")
            ->assertOk()
            ->assertJsonPath('data.id', (string) $returnRequestId);
    }

    public function test_admin_view_returns_404_for_unknown_return_request(): void
    {
        $this->makeAdmin();

        $this->getJson('/api/admin/return-requests/999999')
            ->assertNotFound();
    }

    public function test_admin_can_approve_return_request(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];

        $this->makeAdmin();

        $response = $this->postJson("/api/admin/return-requests/{$returnRequestId}/approve", [
            'rma_address' => '123 Warehouse Rd, Austin, TX 78701',
            'refund_amount' => 25.50,
            'admin_note' => 'Approved, awaiting item.',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', OrderReturnRequest::STATUS_APPROVED)
            ->assertJsonPath('data.rma_address', '123 Warehouse Rd, Austin, TX 78701')
            ->assertJsonPath('data.refund_amount', 25.5)
            ->assertJsonPath('data.admin_note', 'Approved, awaiting item.');

        Mail::assertSent(OrderReturnApproved::class);
    }

    public function test_admin_approve_auto_computes_restocking_fee_when_not_waived(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];

        $this->makeAdmin();

        $response = $this->postJson("/api/admin/return-requests/{$returnRequestId}/approve", [
            'rma_address' => '123 Warehouse Rd, Austin, TX 78701',
        ]);

        // Line price is $89.99: 25% restocking fee on the pre-tax subtotal = $22.50.
        // Refund = subtotal + tax - fee = $89.99 + tax - $22.50.
        $response->assertOk()
            ->assertJsonPath('data.restocking_fee', 22.5)
            ->assertJsonPath('data.fee_waived', false)
            ->assertJsonPath('data.refund_amount', 74.87);
    }

    public function test_admin_approve_waives_restocking_fee_when_requested(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];

        $this->makeAdmin();

        $response = $this->postJson("/api/admin/return-requests/{$returnRequestId}/approve", [
            'rma_address' => '123 Warehouse Rd, Austin, TX 78701',
            'fee_waived' => true,
        ]);

        // Fee waived: refund = full subtotal + tax, no restocking deduction.
        $response->assertOk()
            ->assertJsonPath('data.restocking_fee', 0)
            ->assertJsonPath('data.fee_waived', true)
            ->assertJsonPath('data.refund_amount', 97.37);
    }

    public function test_admin_can_override_computed_refund_amount(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];

        $this->makeAdmin();

        $response = $this->postJson("/api/admin/return-requests/{$returnRequestId}/approve", [
            'rma_address' => '123 Warehouse Rd, Austin, TX 78701',
            'refund_amount' => 25.50,
        ]);

        // Explicit refund_amount overrides the computed estimate; the recorded fee is the
        // one implied by that override (subtotal + tax - refund), not the frozen 25% suggestion.
        $response->assertOk()
            ->assertJsonPath('data.restocking_fee', 71.87)
            ->assertJsonPath('data.refund_amount', 25.5);
    }

    public function test_admin_can_reject_return_request(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];

        $this->makeAdmin();

        $response = $this->postJson("/api/admin/return-requests/{$returnRequestId}/reject", [
            'admin_note' => 'Outside policy window.',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', OrderReturnRequest::STATUS_REJECTED)
            ->assertJsonPath('data.admin_note', 'Outside policy window.');

        Mail::assertSent(OrderReturnRejected::class);
    }

    public function test_admin_cannot_approve_a_return_request_that_is_not_requested(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];

        $this->makeAdmin();

        $this->postJson("/api/admin/return-requests/{$returnRequestId}/reject", [])->assertOk();

        $this->postJson("/api/admin/return-requests/{$returnRequestId}/approve", [
            'rma_address' => '123 Warehouse Rd',
        ])->assertStatus(422)->assertJsonValidationErrors(['status']);
    }

    public function test_admin_can_complete_an_approved_return_request_and_marks_order_returned(): void
    {
        $created = $this->createReturnRequestViaApi();
        $returnRequestId = $created['id'];
        $orderId = $created['order_id'];

        $this->makeAdmin();

        $this->postJson("/api/admin/return-requests/{$returnRequestId}/approve", [
            'rma_address' => '123 Warehouse Rd',
        ])->assertOk();

        $response = $this->postJson("/api/admin/return-requests/{$returnRequestId}/complete");

        $response->assertOk()
            ->assertJsonPath('data.status', OrderReturnRequest::STATUS_COMPLETED);

        $order = Order::find($orderId);
        $this->assertSame('returned', $order->meta['fulfillment_status'] ?? null);
    }

    public function test_admin_cannot_complete_a_return_request_that_is_not_approved(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];

        $this->makeAdmin();

        $this->postJson("/api/admin/return-requests/{$returnRequestId}/complete")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    public function test_admin_return_request_actions_are_forbidden_for_non_admin(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];

        $user = User::factory()->create();
        Role::findOrCreate('customer', 'web');
        $user->assignRole('customer');
        Sanctum::actingAs($user);

        $this->getJson('/api/admin/return-requests')->assertForbidden();
        $this->getJson("/api/admin/return-requests/{$returnRequestId}")->assertForbidden();
        $this->postJson("/api/admin/return-requests/{$returnRequestId}/approve")->assertForbidden();
        $this->postJson("/api/admin/return-requests/{$returnRequestId}/reject")->assertForbidden();
        $this->postJson("/api/admin/return-requests/{$returnRequestId}/complete")->assertForbidden();
    }

    public function test_each_permitted_role_can_use_the_new_admin_return_request_endpoints(): void
    {
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);

        foreach (['super_admin', 'admin', 'staff', 'Order Manager', 'Support'] as $role) {
            $previewRequestId = $this->createReturnRequestViaApi()['id'];
            $trackingRequestId = $this->createReturnRequestViaApi()['id'];
            $waiverRequestId = $this->createReturnRequestViaApi()['id'];
            OrderReturnRequest::findOrFail($trackingRequestId)->update(['status' => OrderReturnRequest::STATUS_APPROVED]);
            OrderReturnRequest::findOrFail($waiverRequestId)->update(['meta' => ['low_value_auto_waive_eligible' => true]]);
            $user = User::factory()->create();
            Role::findOrCreate($role, 'web');
            $user->assignRole($role);
            Sanctum::actingAs($user);

            $this->postJson("/api/admin/return-requests/{$previewRequestId}/preview")
                ->assertOk()
                ->assertJsonPath('restocking_fee', 22.5);
            $this->postJson("/api/admin/return-requests/{$trackingRequestId}/tracking", ['tracking_number' => 'TRACK-'.$role])
                ->assertOk();
            $this->postJson("/api/admin/return-requests/{$waiverRequestId}/approve-low-value-waiver")
                ->assertOk();
        }
    }

    public function test_new_admin_return_request_endpoints_require_authentication_and_forbid_unprivileged_users(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];

        $this->app['auth']->forgetGuards();
        foreach (['tracking', 'approve-low-value-waiver', 'preview'] as $action) {
            $this->postJson("/api/admin/return-requests/{$returnRequestId}/{$action}")->assertUnauthorized();
        }

        Sanctum::actingAs(User::factory()->create());
        foreach (['tracking', 'approve-low-value-waiver', 'preview'] as $action) {
            $this->postJson("/api/admin/return-requests/{$returnRequestId}/{$action}")->assertForbidden();
        }
    }

    public function test_new_admin_return_request_endpoints_return_not_found_for_unknown_return_requests(): void
    {
        $this->makeAdmin();

        foreach ([
            'tracking' => ['tracking_number' => 'TRACK-404'],
            'approve-low-value-waiver' => [],
            'preview' => [],
        ] as $action => $payload) {
            $this->postJson("/api/admin/return-requests/999999/{$action}", $payload)->assertNotFound();
        }
    }

    public function test_admin_return_request_waiver_and_preview_validate_inputs(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];
        $this->makeAdmin();

        $this->postJson("/api/admin/return-requests/{$returnRequestId}/approve-low-value-waiver", [
            'admin_note' => str_repeat('a', 2001),
        ])->assertUnprocessable()->assertJsonValidationErrors('admin_note');
        $this->postJson("/api/admin/return-requests/{$returnRequestId}/approve-low-value-waiver", [
            'admin_note' => ['not a string'],
        ])->assertUnprocessable()->assertJsonValidationErrors('admin_note');
        $this->postJson("/api/admin/return-requests/{$returnRequestId}/preview", ['fee_waived' => 'invalid'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('fee_waived');
    }

    public function test_admin_adds_trimmed_tracking_to_an_approved_return_request_once(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];
        $this->makeAdmin();
        $this->postJson("/api/admin/return-requests/{$returnRequestId}/approve", ['rma_address' => '123 Warehouse Rd'])->assertOk();

        $this->postJson("/api/admin/return-requests/{$returnRequestId}/tracking", [
            'tracking_number' => '  1Z999  ',
            'carrier' => 'ups',
        ])->assertOk()
            ->assertJsonPath('data.return_tracking_number', '1Z999')
            ->assertJsonPath('data.return_carrier', 'ups')
            ->assertJsonPath('data.return_tracking_url', 'https://www.ups.com/track?tracknum=1Z999');

        $this->postJson("/api/admin/return-requests/{$returnRequestId}/tracking", ['tracking_number' => 'REPLACE'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('tracking_number');
        $this->assertDatabaseHas('order_return_requests', ['id' => $returnRequestId, 'return_tracking_number' => '1Z999']);
    }

    public function test_tracking_rejects_requested_requests_and_malformed_carriers_without_mutation(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];
        $this->makeAdmin();

        $this->postJson("/api/admin/return-requests/{$returnRequestId}/tracking", ['tracking_number' => 'ABC'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('tracking_number');
        $this->postJson("/api/admin/return-requests/{$returnRequestId}/tracking", ['tracking_number' => 'ABC', 'carrier' => 'other'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('carrier');
        $this->assertDatabaseHas('order_return_requests', ['id' => $returnRequestId, 'status' => OrderReturnRequest::STATUS_REQUESTED, 'return_tracking_number' => null]);
    }

    public function test_admin_approves_only_strictly_eligible_requested_low_value_waivers(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];
        OrderReturnRequest::findOrFail($returnRequestId)->update(['meta' => ['low_value_auto_waive_eligible' => true]]);
        $this->makeAdmin();

        $this->postJson("/api/admin/return-requests/{$returnRequestId}/approve-low-value-waiver", ['admin_note' => 'Keep it.'])
            ->assertOk()
            ->assertJsonPath('data.status', OrderReturnRequest::STATUS_WAIVED)
            ->assertJsonPath('data.fee_waived', true)
            ->assertJsonPath('data.low_value_auto_waive_eligible', true)
            ->assertJsonPath('data.admin_note', 'Keep it.');
    }

    public function test_low_value_waiver_rejects_false_string_true_and_nonrequested_records_without_mutation(): void
    {
        foreach ([false, 'true'] as $eligibility) {
            $returnRequestId = $this->createReturnRequestViaApi()['id'];
            OrderReturnRequest::findOrFail($returnRequestId)->update(['meta' => ['low_value_auto_waive_eligible' => $eligibility]]);
            $this->makeAdmin();

            $this->postJson("/api/admin/return-requests/{$returnRequestId}/approve-low-value-waiver")
                ->assertUnprocessable()
                ->assertJsonValidationErrors('low_value_auto_waive_eligible');
            $this->assertDatabaseHas('order_return_requests', ['id' => $returnRequestId, 'status' => OrderReturnRequest::STATUS_REQUESTED]);
        }

        $returnRequestId = $this->createReturnRequestViaApi()['id'];
        OrderReturnRequest::findOrFail($returnRequestId)->update(['meta' => ['low_value_auto_waive_eligible' => true]]);
        $this->makeAdmin();
        $this->postJson("/api/admin/return-requests/{$returnRequestId}/approve", ['rma_address' => '123 Warehouse Rd'])->assertOk();
        $this->postJson("/api/admin/return-requests/{$returnRequestId}/approve-low-value-waiver")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('low_value_auto_waive_eligible');
        $this->assertDatabaseHas('order_return_requests', ['id' => $returnRequestId, 'status' => OrderReturnRequest::STATUS_APPROVED]);
    }

    public function test_return_request_resource_exposes_tracking_and_strict_low_value_eligibility(): void
    {
        $returnRequestId = $this->createReturnRequestViaApi()['id'];
        OrderReturnRequest::findOrFail($returnRequestId)->update([
            'return_tracking_number' => 'TRACK-1',
            'return_carrier' => 'manual',
            'return_tracking_url' => null,
            'meta' => ['low_value_auto_waive_eligible' => 'true'],
        ]);
        $this->makeAdmin();

        $this->getJson("/api/admin/return-requests/{$returnRequestId}")
            ->assertOk()
            ->assertJsonPath('data.return_tracking_number', 'TRACK-1')
            ->assertJsonPath('data.return_carrier', 'manual')
            ->assertJsonPath('data.return_tracking_url', null)
            ->assertJsonPath('data.low_value_auto_waive_eligible', false);
    }

    public function test_admin_preview_returns_fee_variants_without_mutating_the_return_request_or_public_preview(): void
    {
        ['tracking_token' => $trackingToken, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();
        $returnRequestId = $this->createReturnRequestViaApi()['id'];
        $this->makeAdmin();

        $this->postJson("/api/admin/return-requests/{$returnRequestId}/preview")
            ->assertOk()
            ->assertJsonPath('item_subtotal', 89.99)
            ->assertJsonPath('tax', 7.38)
            ->assertJsonPath('restocking_fee', 22.5)
            ->assertJsonPath('estimated_refund', 74.87);
        $this->postJson("/api/admin/return-requests/{$returnRequestId}/preview", ['fee_waived' => true])
            ->assertOk()
            ->assertJsonPath('restocking_fee', 0)
            ->assertJsonPath('estimated_refund', 97.37);
        $this->assertDatabaseHas('order_return_requests', ['id' => $returnRequestId, 'status' => OrderReturnRequest::STATUS_REQUESTED]);

        $this->postJson('/api/orders/return-requests/preview', [
            'tracking_token' => $trackingToken,
            'email' => 'guest@petposture.com',
            'items' => [['order_line_id' => $lineId, 'quantity' => 1]],
        ])->assertOk()->assertJsonPath('estimated_refund', 74.87);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /**
     * @return array{id: int, order_id: int}
     */
    private function createReturnRequestViaApi(): array
    {
        ['order_id' => $orderId, 'reference' => $reference, 'order_line_id' => $lineId] = $this->placeDeliveredOrder();

        $response = $this->postJson('/api/orders/return-requests', $this->returnRequestPayload($reference, $lineId));
        $response->assertCreated();

        return [
            'id' => (int) $response->json('data.id'),
            'order_id' => $orderId,
        ];
    }

    private function returnRequestPayload(string $reference, int $orderLineId): array
    {
        return [
            'tracking_token' => $this->trackingTokensByReference[$reference] ?? $reference,
            'email' => 'guest@petposture.com',
            'reason' => 'Wrong size',
            'note' => 'Please process quickly.',
            'items' => [
                ['order_line_id' => $orderLineId, 'quantity' => 1],
            ],
        ];
    }

    private function setDeliveredAt(int $orderId, \DateTimeInterface $deliveredAt): void
    {
        $order = Order::find($orderId);
        $meta = (array) ($order->meta ?? []);
        $meta['delivered_at'] = $deliveredAt->format('Y-m-d H:i:s');
        $order->update(['meta' => $meta]);
    }

    /**
     * @return array{order_id: int, reference: string, order_line_id: int}
     */
    private function placeDeliveredOrder(): array
    {
        $result = $this->placeOrderAndAdvance(['markProcessing', 'markShipped', 'markDelivered']);

        return $result;
    }

    /**
     * @return array{order_id: int, reference: string, order_line_id: int}
     */
    private function placeShippedOrder(): array
    {
        return $this->placeOrderAndAdvance(['markProcessing', 'markShipped']);
    }

    /**
     * @param  array<int, string>  $actions
     * @return array{order_id: int, reference: string, order_line_id: int}
     */
    private function placeOrderAndAdvance(array $actions): array
    {
        $variant = $this->createPurchasableVariant();
        $placeResponse = $this->postJson('/api/checkout/place-order', $this->checkoutPayload($variant));
        $placeResponse->assertCreated();

        $orderId = $placeResponse->json('order.id');
        $reference = $placeResponse->json('order.reference');
        $trackingToken = $placeResponse->json('order.tracking_access_token');
        $this->trackingTokensByReference[$reference] = $trackingToken;

        $order = Order::find($orderId);
        $meta = (array) ($order->meta ?? []);
        $meta['payment_intent_id'] = 'pi_test_'.Str::lower(Str::random(12));
        $meta['payment_status'] = 'paid';
        $order->update(['status' => 'payment-received', 'meta' => $meta]);

        $this->makeAdmin();

        foreach ($actions as $action) {
            $this->postJson("/api/orders/{$orderId}/actions/{$action}")->assertOk();
        }

        $lineId = OrderLine::where('order_id', $orderId)->value('id');

        return [
            'order_id' => $orderId,
            'reference' => $reference,
            'tracking_token' => $trackingToken,
            'order_line_id' => $lineId,
        ];
    }

    private function makeAdmin(): User
    {
        $admin = User::factory()->create();
        Role::findOrCreate('admin', 'web');
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function createPurchasableVariant(): ProductVariant
    {
        $this->setUpLunarPrerequisites();

        $productType = ProductType::firstOrCreate(['name' => 'General']);
        $taxClass = TaxClass::firstOrCreate(['name' => 'Default'], ['default' => true]);
        $channel = Channel::getDefault();
        $customerGroup = CustomerGroup::query()->where('default', true)->first();
        $currency = Currency::getDefault();

        $product = Product::create([
            'product_type_id' => $productType->id,
            'status' => 'published',
            'attribute_data' => [
                'name' => new Text('Test Pet Bed'),
                'description' => new Text('Supportive orthopedic pet bed'),
                'image_url' => new Text('/assets/Pug-Dog-Bed.jpg'),
            ],
        ]);

        $product->channels()->syncWithPivotValues([$channel->id], [
            'enabled' => true,
            'starts_at' => now(),
        ], false);

        $product->customerGroups()->syncWithPivotValues([$customerGroup->id], [
            'enabled' => true,
            'starts_at' => now(),
        ], false);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'tax_class_id' => $taxClass->id,
            'sku' => 'TEST-BED-'.Str::upper(Str::random(6)),
            'stock' => 25,
            'shippable' => true,
        ]);

        Price::create([
            'customer_group_id' => null,
            'currency_id' => $currency->id,
            'priceable_type' => $variant->getMorphClass(),
            'priceable_id' => $variant->id,
            'price' => 8999,
            'min_quantity' => 1,
        ]);

        return $variant;
    }

    private function setUpLunarPrerequisites(): void
    {
        $language = Language::firstOrCreate(
            ['code' => 'en'],
            ['name' => 'English', 'default' => true]
        );
        if (! $language->default) {
            $language->forceFill(['default' => true])->save();
        }

        $currency = Currency::firstOrCreate(
            ['code' => 'USD'],
            [
                'name' => 'US Dollar',
                'decimal_places' => 2,
                'default' => true,
                'enabled' => true,
                'exchange_rate' => 1,
            ]
        );
        if (! $currency->default || ! $currency->enabled) {
            $currency->forceFill(['default' => true, 'enabled' => true])->save();
        }

        $channel = Channel::firstOrCreate(
            ['handle' => 'webstore'],
            [
                'name' => 'Webstore',
                'default' => true,
                'url' => 'http://localhost',
            ]
        );
        if (! $channel->default) {
            $channel->forceFill(['default' => true])->save();
        }

        $customerGroup = CustomerGroup::firstOrCreate(
            ['handle' => 'retail'],
            [
                'name' => 'Retail',
                'default' => true,
            ]
        );
        if (! $customerGroup->default) {
            $customerGroup->forceFill(['default' => true])->save();
        }

        $country = Country::firstOrCreate(
            ['iso2' => 'US'],
            [
                'name' => 'United States',
                'iso3' => 'USA',
                'phonecode' => '1',
                'capital' => 'Washington',
                'currency' => 'USD',
                'native' => 'United States',
                'emoji' => 'US',
                'emoji_u' => 'U+1F1FA U+1F1F8',
            ]
        );

        $taxClass = TaxClass::firstOrCreate(
            ['name' => 'Default'],
            ['default' => true]
        );
        if (! $taxClass->default) {
            $taxClass->forceFill(['default' => true])->save();
        }

        $taxZone = TaxZone::firstOrCreate(
            ['name' => 'Default Tax Zone'],
            [
                'zone_type' => 'country',
                'price_display' => 'tax_exclusive',
                'active' => true,
                'default' => true,
            ]
        );
        if (! $taxZone->default || ! $taxZone->active) {
            $taxZone->forceFill(['default' => true, 'active' => true])->save();
        }

        if (! $taxZone->countries()->where('country_id', $country->id)->exists()) {
            $taxZone->countries()->create([
                'country_id' => $country->id,
            ]);
        }

        $taxRate = TaxRate::firstOrCreate(
            ['name' => 'Default Tax Rate'],
            [
                'tax_zone_id' => $taxZone->id,
                'priority' => 1,
            ]
        );

        TaxRateAmount::firstOrCreate(
            [
                'tax_rate_id' => $taxRate->id,
                'tax_class_id' => $taxClass->id,
            ],
            [
                'percentage' => 0,
            ]
        );
    }

    private function checkoutPayload(ProductVariant $variant, array $overrides = []): array
    {
        return array_replace_recursive([
            'items' => [
                [
                    'variantId' => $variant->id,
                    'quantity' => 1,
                ],
            ],
            'shipping' => [
                'email' => 'guest@petposture.com',
                'first_name' => 'Jane',
                'last_name' => 'Doe',
                'company' => null,
                'line_one' => '123 Congress Ave',
                'line_two' => 'Unit 4B',
                'city' => 'Austin',
                'state' => 'TX',
                'postcode' => '78701',
                'country' => 'United States',
                'phone' => '5125550101',
            ],
            'billing_same_as_shipping' => true,
            'shipping_method' => 'standard',
            'payment_method' => 'cod',
        ], $overrides);
    }
}
