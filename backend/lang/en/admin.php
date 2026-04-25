<?php

return [
    'navigation' => [
        'sales' => 'Sales',
        'content' => 'Content',
        'settings' => 'Settings',
        'catalog' => 'Product Catalog',
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
];
