<?php

return [
    'navigation' => [
        'sales' => 'Sales',
        'content' => 'Content Management',
        'settings' => 'Settings',
        'catalog' => 'Catalogue',
        'system' => 'System',
        'manage_settings' => 'Manage Settings',
        'media_management' => 'Media Management',
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
        'stats' => [
            'revenue' => [
                'label' => 'Total Revenue',
                'description' => 'All time, excluding cancelled',
            ],
            'orders' => [
                'label' => 'Total Orders',
                'description' => 'Lifetime transactions',
            ],
            'products' => [
                'label' => 'Active Products',
                'description' => 'Published in catalogue',
            ],
            'customers' => [
                'label' => 'Customers',
                'description' => 'Registered customers',
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
