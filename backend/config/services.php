<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'stripe' => [
        'key' => env('STRIPE_KEY'),
        'secret' => env('STRIPE_SECRET'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
        'tax' => [
            'default_product_tax_code' => env('STRIPE_TAX_DEFAULT_PRODUCT_TAX_CODE', 'txcd_99999999'),
        ],
    ],

    'paypal' => [
        'mode' => env('PAYPAL_MODE', 'sandbox'),
        'client_id' => env('PAYPAL_CLIENT_ID'),
        'client_secret' => env('PAYPAL_CLIENT_SECRET'),
        'webhook_id' => env('PAYPAL_WEBHOOK_ID'),
    ],

    'airwallex' => [
        'mode' => env('AIRWALLEX_MODE', 'sandbox'),
        'client_id' => env('AIRWALLEX_CLIENT_ID'),
        'api_key' => env('AIRWALLEX_API_KEY'),
        'webhook_secret' => env('AIRWALLEX_WEBHOOK_SECRET'),
    ],

    'payoneer' => [
        'mode' => env('PAYONEER_MODE', 'sandbox'),
        'merchant_code' => env('PAYONEER_MERCHANT_CODE'),
        'api_key' => env('PAYONEER_API_KEY'),
        'api_secret' => env('PAYONEER_API_SECRET'),
        'webhook_secret' => env('PAYONEER_WEBHOOK_SECRET'),
    ],

    'pingpong' => [
        'mode' => env('PINGPONG_MODE', 'sandbox'),
        'app_id' => env('PINGPONG_APP_ID'),
        'private_key' => env('PINGPONG_PRIVATE_KEY'),
        'public_key' => env('PINGPONG_PUBLIC_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'aftership' => [
        'api_key' => env('AFTERSHIP_API_KEY'),
        'webhook_secret' => env('AFTERSHIP_WEBHOOK_SECRET'),
    ],

    'cloudflare' => [
        'api_token' => env('CLOUDFLARE_API_TOKEN'),
        'zone_id' => env('CLOUDFLARE_ZONE_ID'),
        'turnstile_secret' => env('TURNSTILE_SECRET_KEY'),
    ],

    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY'),
        'model' => env('ANTHROPIC_MODEL'),
    ],

    'openai' => [
        'key' => env('OPENAI_API_KEY'),
        'model' => env('OPENAI_MODEL'),
        'base_url' => env('OPENAI_BASE_URL'),
    ],

    'xai' => [
        'key' => env('XAI_API_KEY'),
        'model' => env('XAI_MODEL'),
    ],

    'gemini' => [
        'key' => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL'),
    ],

];
