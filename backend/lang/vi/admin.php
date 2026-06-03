<?php

return [
    'navigation' => [
        'sales' => 'Bán hàng',
        'content' => 'Quản lý nội dung',
        'settings' => 'Cài đặt',
        'catalog' => 'Danh mục',
        'system' => 'Hệ thống',
        'manage_settings' => 'Cài đặt hệ thống',
        'media_management' => 'Quản lý Media',
        'shield' => 'Bảo mật & Vai trò',
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
        'statuses' => [
            'awaiting-payment' => 'Chờ thanh toán',
            'payment-offline'  => 'Thanh toán ngoại tuyến',
            'payment-received' => 'Đã nhận thanh toán',
            'processing'       => 'Đang xử lý',
            'shipped'          => 'Đã giao cho ĐVVC',
            'delivered'        => 'Đã giao hàng',
            'cancelled'        => 'Đã hủy',
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
    'dashboard' => [
        'welcome' => 'Chào mừng trở lại, :name!',
        'subtitle' => 'Dưới đây là thông tin tổng quan về hiệu suất của PetPosture hôm nay.',
        'overview' => 'Tổng quan',
        'no_orders_yet' => 'Chưa có đơn hàng nào',
        'order_status_breakdown' => 'Phân tích trạng thái đơn hàng',
        'actions' => [
            'new_product' => 'Sản phẩm mới',
            'orders' => 'Đơn hàng',
            'customers' => 'Khách hàng',
            'discounts' => 'Khuyến mãi',
        ],
        'trend' => [
            'increase' => 'Tăng :trend% so với 30 ngày trước',
            'decrease' => 'Giảm :trend% so với 30 ngày trước',
        ],
        'stats' => [
            'revenue' => [
                'label' => 'Tổng doanh thu',
                'description' => 'Toàn thời gian, không bao gồm đơn đã hủy',
            ],
            'orders' => [
                'label' => 'Tổng đơn hàng',
                'description' => 'Tổng số giao dịch',
            ],
            'products' => [
                'label' => 'Sản phẩm đang hoạt động',
                'description' => 'Đã xuất bản trong danh mục',
            ],
            'customers' => [
                'label' => 'Khách hàng',
                'description' => 'Khách hàng đã đăng ký',
            ],
            'today_revenue' => [
                'label' => 'Doanh thu hôm nay',
                'description' => 'Doanh thu tích lũy hôm nay',
            ],
            'today_orders' => [
                'label' => 'Đơn hàng hôm nay',
                'description' => 'Đơn đặt hàng hôm nay',
            ],
        ],
    ],
    'resources' => [
        'product_attributes' => [
            'label' => 'Thuộc tính Sản phẩm',
            'plural_label' => 'Thuộc tính Sản phẩm',
            'navigation_label' => 'Thuộc tính Sản phẩm',
            'attributes' => [
                'name' => 'Tên thuộc tính',
                'handle' => 'Mã định danh',
                'values_count' => 'Số lượng giá trị',
                'values' => 'Các giá trị',
            ],
            'sections' => [
                'details' => 'Chi tiết thuộc tính',
                'values' => 'Giá trị thuộc tính',
                'values_description' => 'Định nghĩa các giá trị có sẵn cho thuộc tính này (ví dụ: Đỏ, Xanh cho thuộc tính Màu sắc)',
            ],
        ],
    ],
];
