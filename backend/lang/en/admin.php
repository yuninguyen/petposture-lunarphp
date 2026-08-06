<?php

return [
    'navigation' => [
        'sales' => 'Sales',
        'content' => 'Content Management',
        'settings' => 'Settings',
        'catalog' => 'Catalogue',
        'system' => 'System',
        'manage_settings' => 'Manage Settings',
        'media_management' => 'Files',
        'shield' => 'Security & Roles',
    ],
    'orders' => [
        'label' => 'Order',
        'plural_label' => 'Orders',
        'sections' => [
            'summary' => 'Order Summary',
            'customer' => 'Customer Information',
            'metadata' => 'System Information',
        ],
        'fields' => [
            'reference' => 'Order Reference',
            'status' => 'Status',
            'total' => 'Total Amount',
            'customer' => 'Customer',
            'currency' => 'Currency',
            'ordered_at' => 'Order Time',
        ],
        'statuses' => [
            'awaiting-payment' => 'Awaiting Payment',
            'payment-offline' => 'Payment Offline',
            'payment-received' => 'Payment Received',
            'processing' => 'Processing',
            'shipped' => 'Shipped',
            'delivered' => 'Delivered',
            'cancelled' => 'Cancelled',
        ],
    ],
    'customers' => [
        'label' => 'Customer',
        'plural_label' => 'Customers',
        'sections' => [
            'personal' => 'Personal Information',
            'identifiers' => 'Identifiers',
            'status' => 'Status & Groups',
        ],
        'fields' => [
            'first_name' => 'First Name',
            'last_name' => 'Last Name',
            'title' => 'Title',
            'company_name' => 'Company Name',
            'tax_id' => 'Tax ID',
            'account_ref' => 'Account Ref',
            'customer_groups' => 'Customer Groups',
        ],
    ],
    'dashboard' => [
        'welcome' => 'Welcome back, :name!',
        'subtitle' => 'Here is an overview of PetPosture\'s performance today.',
        'overview' => 'Overview',
        'no_orders_yet' => 'No Orders Yet',
        'order_status_breakdown' => 'Order Status Breakdown',
        'actions' => [
            'new_product' => 'New Product',
            'orders' => 'Orders',
            'customers' => 'Customers',
            'discounts' => 'Discounts',
        ],
        'trend' => [
            'increase' => ':trend% increase vs previous period',
            'decrease' => ':trend% decrease vs previous period',
            'all_time' => 'All time',
        ],
        'stats' => [
            'revenue' => [
                'label' => 'Revenue',
            ],
            'orders' => [
                'label' => 'Orders',
            ],
            'sales' => [
                'label' => 'Total Sales',
            ],
            'aov' => [
                'label' => 'Avg. Order Value',
            ],
            'conversion_rate' => [
                'label' => 'Conversion Rate',
            ],
            'refund_rate' => [
                'label' => 'Refund Rate',
            ],
            'active_users' => [
                'label' => 'Active Users',
            ],
            'page_views' => [
                'label' => 'Page Views',
            ],
            'not_connected' => 'Not connected yet',
        ],
        'order_status' => 'Order Status',
        'sales_overview' => 'Sales Overview',
        'sales_by_category' => 'Sales by Category',
        'uncategorized' => 'Uncategorized',
        'top_products' => 'Top Products',
        'top_products_columns' => [
            'product' => 'Product',
            'sku' => 'SKU',
            'sold' => 'Sold',
            'revenue' => 'Revenue',
        ],
        'recent_orders' => 'Recent Orders',
        'recent_orders_columns' => [
            'date' => 'Date',
            'order' => 'Order',
            'customer' => 'Customer',
            'status' => 'Order Status',
            'total' => 'Total',
        ],
        'recent_activity' => 'Recent Activity',
        'activity' => [
            'order_placed' => 'New order placed',
            'order_placed_desc' => 'Order :reference was placed',
            'customer_registered' => 'New customer registered',
            'customer_registered_desc' => ':name created an account',
            'review_received' => 'New review received',
            'review_received_desc' => ':rating-star review from :name',
        ],
        'traffic_sources' => 'Traffic Sources',
        'traffic' => [
            'direct' => 'Direct',
            'organic' => 'Organic Search',
            'social' => 'Social Media',
            'referral' => 'Referral',
        ],
        'goals' => [
            'heading' => 'Goals — :month',
            'revenue' => 'Revenue',
            'orders' => 'Orders',
            'new_customers' => 'New Customers',
            'no_target' => 'No target set — add one in Settings → Goals.',
            'target' => 'Target',
        ],
        'filters' => [
            'granularity' => [
                'today' => 'Today',
                'month' => 'This Month',
                'year' => 'This Year',
            ],
            'range' => [
                'label' => 'Date range',
                '7' => 'Last 7 days',
                '30' => 'Last 30 days',
                '90' => 'Last 90 days',
                '365' => 'Last 12 months',
                'all' => 'All time',
            ],
        ],
        'returns' => [
            'heading' => 'Return Requests',
            'pending_review' => [
                'label' => 'Pending Review',
                'description' => 'Awaiting admin decision',
            ],
            'overdue' => [
                'label' => 'Overdue Review',
                'description' => 'Pending more than 2 days',
            ],
            'awaiting_completion' => [
                'label' => 'Awaiting Completion',
                'description' => 'Approved, not yet completed',
            ],
        ],
    ],
    'resources' => [
        'product_attributes' => [
            'label' => 'Product Attributes',
            'plural_label' => 'Product Attributes',
            'navigation_label' => 'Product Attributes',
            'attributes' => [
                'name' => 'Attribute Name',
                'handle' => 'Handle',
                'values_count' => 'Values Count',
                'values' => 'Values',
            ],
            'sections' => [
                'details' => 'Attribute Details',
                'values' => 'Values',
                'values_description' => 'Define the available values for this attribute (e.g. Red, Blue for Color)',
            ],
        ],
    ],
];
