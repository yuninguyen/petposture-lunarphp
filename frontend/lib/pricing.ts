type CouponPricing = {
    discountAmount?: number;
    freeShipping?: boolean;
};

/**
 * Fallback only — used until the real rate loads from
 * GET /api/checkout/shipping-rates (backed by admin Settings).
 */
export function getShippingAmount(subtotal: number, coupon?: CouponPricing): number {
    if (coupon?.freeShipping) {
        return 0;
    }

    return subtotal > 50 ? 0 : 15;
}
