type CouponPricing = {
    discountAmount?: number;
    freeShipping?: boolean;
};

export function getShippingAmount(subtotal: number, coupon?: CouponPricing): number {
    if (coupon?.freeShipping) {
        return 0;
    }

    return subtotal > 50 ? 0 : 15;
}

export function getOrderTotal(subtotal: number, coupon?: CouponPricing): number {
    const discountAmount = coupon?.discountAmount ?? 0;
    const shippingAmount = getShippingAmount(subtotal, coupon);

    return Math.max(0, subtotal - discountAmount + shippingAmount);
}
