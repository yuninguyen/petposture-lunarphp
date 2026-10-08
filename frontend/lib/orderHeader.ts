// What the top of the order confirmation page says at each stage of an order (Shopify-style): the small label,
// the headline, and a short notice. Pure so every stage can be tested without rendering the page.

export type HeaderTone = 'orange' | 'green' | 'amber' | 'red';

// A piece of the notice text: plain text, or a link (an external href opens in a new tab).
export type HeaderPart = string | { link: string; href: string | null; external?: boolean };

export type OrderHeader = {
    label: string;
    title: string;
    tone: HeaderTone;
    headline: string;
    body: HeaderPart[];
    // The confirmation moment keeps its envelope icon.
    mail: boolean;
};

export type ReturnRequestSummary = {
    status: string;
    requested_at?: string | null;
    approved_at?: string | null;
    package_received_at?: string | null;
    completed_at?: string | null;
    tracking_deadline_at?: string | null;
    rma_address?: string | null;
    return_carrier?: string | null;
    return_tracking_number?: string | null;
    return_tracking_url?: string | null;
    refund_amount?: number | null;
    restocking_fee?: number | null;
};

export type OrderHeaderInput = {
    reference: string;
    status: string;
    fulfillment_status?: string | null;
    created_at?: string | null;
    confirmed_at?: string | null;
    shipped_at?: string | null;
    delivered_at?: string | null;
    cancelled_at?: string | null;
    carrier?: string | null;
    tracking_number?: string | null;
    tracking_url?: string | null;
    eta?: string | null;
    return_window_open?: boolean;
    return_window_ends_at?: string | null;
    payment_confirmed_before_cancellation?: boolean;
    refund_status?: string | null;
    return_request?: ReturnRequestSummary | null;
    shipping_address?: { first_name?: string | null } | null;
};

export type OrderHeaderContext = {
    // Right after paying (the confirmation moment) rather than opening the order again later.
    justPlaced: boolean;
    // Where the customer adds the tracking number of the parcel they send back.
    returnHref: string;
    now?: Date;
};

// Carriers are brands: UPS / USPS / DHL are acronyms and FedEx has its own casing.
const carrierLabels: Record<string, string> = { ups: 'UPS', usps: 'USPS', dhl: 'DHL', fedex: 'FedEx' };

export function carrierLabel(carrier: string): string {
    return carrierLabels[carrier.toLowerCase()] ?? carrier.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// A carrier worth naming ("manual" is only how an order shipped by hand is recorded).
function realCarrier(carrier?: string | null): string | null {
    return carrier && carrier.toLowerCase() !== 'manual' ? carrierLabel(carrier) : null;
}

function parse(value?: string | null): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

// "Oct 8", with the year when it is not the current one ("Jul 19, 2025").
export function formatShortDate(value: string | Date | null | undefined, now: Date): string {
    const date = value instanceof Date ? value : parse(value);
    if (!date) return '';
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    if (date.getFullYear() !== now.getFullYear()) options.year = 'numeric';
    return new Intl.DateTimeFormat('en-US', options).format(date);
}

export function addBusinessDays(from: Date, days: number): Date {
    const date = new Date(from);
    let remaining = days;
    while (remaining > 0) {
        date.setDate(date.getDate() + 1);
        const weekday = date.getDay();
        if (weekday !== 0 && weekday !== 6) remaining -= 1;
    }
    return date;
}

// "Expected Oct 15" when the shipment has a date, otherwise the 7-10 business days of the shipping policy
// counted from the order date ("Estimated Oct 15–20"), and nothing once that window has passed.
export function deliveryEstimate(order: OrderHeaderInput, now: Date): string | null {
    const eta = parse(order.eta);
    if (eta) return `Expected ${formatShortDate(eta, now)}`;

    const placed = parse(order.created_at);
    if (!placed) return null;

    const start = addBusinessDays(placed, 7);
    const end = addBusinessDays(placed, 10);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (end < startOfToday) return null;

    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    const range = sameMonth
        ? `${formatShortDate(start, now)}–${end.getDate()}`
        : `${formatShortDate(start, now)} – ${formatShortDate(end, now)}`;
    return `Estimated ${range}`;
}

const money = (amount: number) => `$${amount.toFixed(2)}`;

function trackingBody(label: string, carrier: string | null, number: string, href: string | null): HeaderPart[] {
    return [`${label}${carrier ? ` (${carrier})` : ''}: `, { link: number, href, external: true }];
}

function returnHeader(request: ReturnRequestSummary, ctx: OrderHeaderContext, now: Date): OrderHeader | null {
    const date = (value?: string | null) => formatShortDate(value, now);
    const base = { label: '', mail: false } as const;

    switch (request.status) {
        case 'requested':
            return { ...base, title: 'Return requested', tone: 'amber', headline: `We received your request${request.requested_at ? ` on ${date(request.requested_at)}` : ''}`, body: ["We'll review it within 2 business days."] };
        case 'approved': {
            if (request.package_received_at) {
                return { ...base, title: 'Return received', tone: 'amber', headline: `We received your package on ${date(request.package_received_at)}`, body: ['Your refund is being processed.'] };
            }
            if (request.return_tracking_number) {
                return {
                    ...base,
                    title: 'Return on its way',
                    tone: 'amber',
                    headline: "We'll refund you once we receive the package",
                    body: trackingBody('Return tracking number', realCarrier(request.return_carrier), request.return_tracking_number, request.return_tracking_url ?? null),
                };
            }
            const deadline = request.tracking_deadline_at ? ` within 7 days (by ${date(request.tracking_deadline_at)})` : '';
            return {
                ...base,
                title: 'Return approved',
                tone: 'amber',
                headline: `Send your items back${deadline}`,
                body: [request.rma_address ? `Ship to: ${request.rma_address}. ` : '', 'Then ', { link: 'add your return tracking number', href: ctx.returnHref }, '.'],
            };
        }
        case 'completed': {
            const fee = request.restocking_fee && request.restocking_fee > 0 ? `Restocking fee: ${money(request.restocking_fee)} · ` : '';
            return {
                ...base,
                title: `Returned${request.completed_at ? ` ${date(request.completed_at)}` : ''}`,
                tone: 'green',
                headline: request.refund_amount != null ? `Refund of ${money(request.refund_amount)} issued${request.completed_at ? ` ${date(request.completed_at)}` : ''}` : 'Your refund has been issued',
                body: [`${fee}It can take 5–10 business days to appear on your statement.`],
            };
        }
        case 'waived':
            return {
                ...base,
                title: 'Refund approved',
                tone: 'green',
                headline: 'No need to send your items back',
                body: [request.refund_amount != null ? `Refund of ${money(request.refund_amount)}.` : "We'll refund you shortly."],
            };
        case 'rejected':
            return { ...base, title: 'Return declined', tone: 'amber', headline: "We couldn't approve this return", body: ['Please ', { link: 'contact us', href: '/contact' }, ' for details.'] };
        case 'expired':
            return { ...base, title: 'Return expired', tone: 'amber', headline: "We didn't receive the return tracking in time", body: ['Please ', { link: 'contact us', href: '/contact' }, ' if you still need to send the items back.'] };
        default:
            return null;
    }
}

export function buildOrderHeader(order: OrderHeaderInput, ctx: OrderHeaderContext): OrderHeader {
    const now = ctx.now ?? new Date();
    const date = (value?: string | null) => formatShortDate(value, now);
    const label = `Order #${order.reference}`;
    const firstName = order.shipping_address?.first_name ?? '';

    if (ctx.justPlaced) {
        return {
            label: `Confirmation #${order.reference}`,
            title: `Thank you${firstName ? `, ${firstName}` : ''}!`,
            tone: 'orange',
            headline: 'Your order is confirmed',
            body: ["You'll receive a confirmation email soon"],
            mail: true,
        };
    }

    if (order.status === 'cancelled') {
        const refunded = order.refund_status === 'refunded';
        return {
            label,
            title: `Cancelled${order.cancelled_at ? ` ${date(order.cancelled_at)}` : ''}`,
            tone: 'red',
            headline: 'This order was cancelled',
            body: [order.payment_confirmed_before_cancellation ? (refunded ? 'Your refund has been completed.' : 'Your refund is being processed.') : "You haven't been charged."],
            mail: false,
        };
    }

    const returned = order.return_request ? returnHeader(order.return_request, ctx, now) : null;
    if (returned) return { ...returned, label };

    if (order.status === 'awaiting-payment' || order.status === 'payment-offline') {
        return { label, title: 'Payment pending', tone: 'amber', headline: "We're waiting for your payment", body: ['Your order will be confirmed as soon as it completes.'], mail: false };
    }

    if (order.status === 'shipped') {
        const carrier = realCarrier(order.carrier);
        const estimate = deliveryEstimate(order, now);
        const headline = ['Shipped' + (order.shipped_at ? ` ${date(order.shipped_at)}` : '') + (carrier ? ` via ${carrier}` : ''), estimate].filter(Boolean).join(' · ');
        const body: HeaderPart[] = order.tracking_number
            ? trackingBody('Tracking number', carrier, order.tracking_number, order.tracking_url ?? null)
            : order.tracking_url
                ? [{ link: 'Track your package', href: order.tracking_url, external: true }]
                : ["We'll update this page when tracking is available."];
        return { label, title: 'On its way', tone: 'orange', headline, body, mail: false };
    }

    if (order.status === 'delivered') {
        if (order.fulfillment_status === 'returned') {
            return { label, title: 'Returned', tone: 'green', headline: 'Your items were returned', body: [], mail: false };
        }
        const open = order.return_window_open !== false && order.return_window_ends_at;
        return {
            label,
            title: `Delivered${order.delivered_at ? ` ${date(order.delivered_at)}` : ''}`,
            tone: 'green',
            headline: 'Your order was delivered',
            body: open ? [`Returns are accepted until ${date(order.return_window_ends_at)}.`] : [],
            mail: false,
        };
    }

    // payment-received / processing
    return {
        label,
        title: `Confirmed ${date(order.confirmed_at ?? order.created_at)}`.trim(),
        tone: 'orange',
        headline: "We're preparing your order",
        body: ["We'll email you tracking as soon as it ships."],
        mail: false,
    };
}
