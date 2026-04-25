<?php

return [
    'navigation' => [
        'sales' => 'Bán hàng',
        'content' => 'Nội dung',
        'settings' => 'Cài đặt',
        'catalog' => 'Danh mục sản phẩm',
    ],
    'orders' => [
        'label' => 'Đơn hàng',
        'plural_label' => 'Danh sách Đơn hàng',
        'sections' => [
            'summary' => 'Tóm tắt đơn hàng',
            'customer' => 'Thông tin khách hàng',
            'metadata' => 'Thông tin hệ thống',
        ],
        'fields' => [
            'reference' => 'Mã đơn hàng',
            'status' => 'Trạng thái',
            'total' => 'Tổng tiền',
            'customer' => 'Khách hàng',
            'currency' => 'Tiền tệ',
            'ordered_at' => 'Thời gian đặt',
        ],
    ],
    'customers' => [
        'label' => 'Khách hàng',
        'plural_label' => 'Danh sách Khách hàng',
        'sections' => [
            'personal' => 'Thông tin cá nhân',
            'identifiers' => 'Định danh',
            'status' => 'Trạng thái & Nhóm',
        ],
        'fields' => [
            'first_name' => 'Tên',
            'last_name' => 'Họ',
            'title' => 'Danh xưng',
            'company_name' => 'Tên công ty',
            'tax_id' => 'Mã số thuế',
            'account_ref' => 'Mã tham chiếu',
            'customer_groups' => 'Nhóm khách hàng',
        ],
    ],
];
