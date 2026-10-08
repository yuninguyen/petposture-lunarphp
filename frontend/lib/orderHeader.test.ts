import { describe, expect, it } from 'vitest';
import { addBusinessDays, buildOrderHeader, deliveryEstimate, formatShortDate, type OrderHeaderInput } from './orderHeader';

const now = new Date(2026, 9, 10, 12); // Oct 10, 2026
const ctx = { justPlaced: false, returnHref: '/returns?token=t&email=e', now };
const base: OrderHeaderInput = { reference: '00000014', status: 'processing', created_at: '2026-10-06T10:00:00', shipping_address: { first_name: 'RICHARD' } };
const text = (header: ReturnType<typeof buildOrderHeader>) => header.body.map((p) => (typeof p === 'string' ? p : p.link)).join('');

describe('dates', () => {
    it('formats short dates and adds the year only when it is not the current one', () => {
        expect(formatShortDate('2026-10-08T09:00:00', now)).toBe('Oct 8');
        expect(formatShortDate('2025-07-19T09:00:00', now)).toBe('Jul 19, 2025');
        expect(formatShortDate(null, now)).toBe('');
    });

    it('adds business days skipping weekends', () => {
        // Tue Oct 6 + 7 business days = Thu Oct 15
        expect(addBusinessDays(new Date(2026, 9, 6), 7).getDate()).toBe(15);
        // Fri Oct 9 + 1 = Mon Oct 12
        expect(addBusinessDays(new Date(2026, 9, 9), 1).getDate()).toBe(12);
    });

    it('prefers the shipment date, falls back to the policy window and stops once it has passed', () => {
        expect(deliveryEstimate({ ...base, eta: '2026-10-15T00:00:00' }, now)).toBe('Expected Oct 15');
        expect(deliveryEstimate(base, now)).toBe('Estimated Oct 15–20');
        expect(deliveryEstimate({ ...base, created_at: '2026-09-01T10:00:00' }, now)).toBeNull();
        // Placed Tue Oct 20: 7 business days is Oct 29, 10 is Nov 3 — a range across two months names both.
        expect(deliveryEstimate({ ...base, created_at: '2026-10-20T10:00:00' }, new Date(2026, 9, 22))).toBe('Estimated Oct 29 – Nov 3');
    });
});

describe('buildOrderHeader', () => {
    it('keeps the confirmation wording right after paying', () => {
        const header = buildOrderHeader(base, { ...ctx, justPlaced: true });

        expect(header).toMatchObject({ label: 'Confirmation #00000014', title: 'Thank you, RICHARD!', tone: 'orange', mail: true, headline: 'Your order is confirmed' });
        expect(text(header)).toContain('confirmation email soon');
    });

    it('says Order # and the stage once the order is opened again', () => {
        expect(buildOrderHeader({ ...base, status: 'awaiting-payment' }, ctx)).toMatchObject({ label: 'Order #00000014', title: 'Payment pending', tone: 'amber' });
        expect(buildOrderHeader({ ...base, confirmed_at: '2026-10-07T10:00:00' }, ctx)).toMatchObject({ title: 'Confirmed Oct 7', headline: "We're preparing your order" });
        expect(buildOrderHeader(base, ctx).title).toBe('Confirmed Oct 6');
    });

    it('puts the shipping date, carrier, estimate and tracking number of a shipped order in the notice', () => {
        const header = buildOrderHeader({ ...base, status: 'shipped', shipped_at: '2026-10-08T10:00:00', carrier: 'ups', tracking_number: '1Z999', tracking_url: 'https://ups.example/1Z999', eta: '2026-10-15T00:00:00' }, ctx);

        expect(header.title).toBe('On its way');
        expect(header.headline).toBe('Shipped Oct 8 via UPS · Expected Oct 15');
        expect(header.body).toEqual(['Tracking number (UPS): ', { link: '1Z999', href: 'https://ups.example/1Z999', external: true }]);
    });

    it('does not name a manual carrier and says so when there is no tracking yet', () => {
        const header = buildOrderHeader({ ...base, status: 'shipped', shipped_at: '2026-10-08T10:00:00', carrier: 'manual' }, ctx);

        expect(header.headline).toBe('Shipped Oct 8 · Estimated Oct 15–20');
        expect(text(header)).toBe("We'll update this page when tracking is available.");
    });

    it('shows the delivery date and, while it is open, how long returns are accepted', () => {
        const open = buildOrderHeader({ ...base, status: 'delivered', delivered_at: '2026-10-09T10:00:00', return_window_open: true, return_window_ends_at: '2026-11-08T10:00:00' }, ctx);
        const closed = buildOrderHeader({ ...base, status: 'delivered', delivered_at: '2026-08-09T10:00:00', return_window_open: false, return_window_ends_at: '2026-09-08T10:00:00' }, ctx);

        expect(open).toMatchObject({ title: 'Delivered Oct 9', tone: 'green' });
        expect(text(open)).toBe('Returns are accepted until Nov 8.');
        expect(closed.body).toEqual([]);
    });

    it('explains a cancelled order according to whether it was paid and refunded', () => {
        const unpaid = buildOrderHeader({ ...base, status: 'cancelled', cancelled_at: '2026-10-07T10:00:00' }, ctx);
        const paid = buildOrderHeader({ ...base, status: 'cancelled', payment_confirmed_before_cancellation: true, refund_status: 'refunded' }, ctx);
        const refunding = buildOrderHeader({ ...base, status: 'cancelled', payment_confirmed_before_cancellation: true }, ctx);

        expect(unpaid).toMatchObject({ title: 'Cancelled Oct 7', tone: 'red' });
        expect(text(unpaid)).toBe("You haven't been charged.");
        expect(text(paid)).toBe('Your refund has been completed.');
        expect(text(refunding)).toBe('Your refund is being processed.');
    });

    describe('return requests', () => {
        const delivered = { ...base, status: 'delivered', delivered_at: '2026-10-09T10:00:00' };

        it('walks through requested, approved, on its way, received and refunded', () => {
            const requested = buildOrderHeader({ ...delivered, return_request: { status: 'requested', requested_at: '2026-10-10T08:00:00' } }, ctx);
            const approved = buildOrderHeader({ ...delivered, return_request: { status: 'approved', tracking_deadline_at: '2026-10-17T08:00:00', rma_address: 'Returns, 1 Test St' } }, ctx);
            const onItsWay = buildOrderHeader({ ...delivered, return_request: { status: 'approved', return_carrier: 'ups', return_tracking_number: '1ZRET', return_tracking_url: null } }, ctx);
            const received = buildOrderHeader({ ...delivered, return_request: { status: 'approved', return_tracking_number: '1ZRET', package_received_at: '2026-10-18T08:00:00' } }, { ...ctx, now: new Date(2026, 9, 19) });
            const refunded = buildOrderHeader({ ...delivered, return_request: { status: 'completed', completed_at: '2026-10-20T08:00:00', refund_amount: 31.5, restocking_fee: 5.68 } }, { ...ctx, now: new Date(2026, 9, 21) });

            expect(requested).toMatchObject({ title: 'Return requested', headline: 'We received your request on Oct 10' });
            expect(approved.title).toBe('Return approved');
            expect(approved.headline).toBe('Send your items back within 7 days (by Oct 17)');
            expect(approved.body).toEqual(['Ship to: Returns, 1 Test St. ', 'Then ', { link: 'add your return tracking number', href: '/returns?token=t&email=e' }, '.']);
            expect(onItsWay.title).toBe('Return on its way');
            expect(onItsWay.body).toEqual(['Return tracking number (UPS): ', { link: '1ZRET', href: null, external: true }]);
            expect(received.title).toBe('Return received');
            expect(refunded).toMatchObject({ title: 'Returned Oct 20', tone: 'green', headline: 'Refund of $31.50 issued Oct 20' });
            expect(text(refunded)).toBe('Restocking fee: $5.68 · It can take 5–10 business days to appear on your statement.');
        });

        it('handles waived, declined and expired requests without exposing internal notes', () => {
            expect(buildOrderHeader({ ...delivered, return_request: { status: 'waived', refund_amount: 12 } }, ctx)).toMatchObject({ title: 'Refund approved', headline: 'No need to send your items back' });
            const declined = buildOrderHeader({ ...delivered, return_request: { status: 'rejected' } }, ctx);
            expect(declined.title).toBe('Return declined');
            expect(declined.body).toContainEqual({ link: 'contact us', href: '/contact' });
            expect(buildOrderHeader({ ...delivered, return_request: { status: 'expired' } }, ctx).title).toBe('Return expired');
        });
    });
});
