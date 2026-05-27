<?php

namespace App\Enums;

enum ErrorCode: string
{
    // Validation
    case VALIDATION_ERROR       = 'VALIDATION_ERROR';

    // Inventory / catalog
    case OUT_OF_STOCK           = 'OUT_OF_STOCK';
    case PRODUCT_NOT_FOUND      = 'PRODUCT_NOT_FOUND';

    // Checkout / order
    case CHECKOUT_FAILED        = 'CHECKOUT_FAILED';
    case ORDER_NOT_FOUND        = 'ORDER_NOT_FOUND';
    case INVALID_TRANSITION     = 'INVALID_TRANSITION';
    case REFUND_NOT_ELIGIBLE    = 'REFUND_NOT_ELIGIBLE';
    case RETURN_NOT_ELIGIBLE    = 'RETURN_NOT_ELIGIBLE';

    // Payment
    case PAYMENT_FAILED         = 'PAYMENT_FAILED';
    case PAYMENT_INTENT_ERROR   = 'PAYMENT_INTENT_ERROR';

    // Coupon
    case COUPON_NOT_FOUND       = 'COUPON_NOT_FOUND';
    case COUPON_INVALID         = 'COUPON_INVALID';

    // Auth
    case UNAUTHENTICATED        = 'UNAUTHENTICATED';
    case FORBIDDEN              = 'FORBIDDEN';

    // Generic
    case NOT_FOUND              = 'NOT_FOUND';
    case INTERNAL_ERROR         = 'INTERNAL_ERROR';
}
