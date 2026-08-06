<?php

return [
    'navigation' => [
        'sales' => 'Bán hàng',
        'content' => 'Quản lý nội dung',
        'settings' => 'Cài đặt',
        'catalog' => 'Danh mục',
        'system' => 'Hệ thống',
        'manage_settings' => 'Cài đặt hệ thống',
        'media_management' => 'Tệp tin',
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
            'payment-offline' => 'Thanh toán ngoại tuyến',
            'payment-received' => 'Đã nhận thanh toán',
            'processing' => 'Đang xử lý',
            'shipped' => 'Đã giao cho ĐVVC',
            'delivered' => 'Đã giao hàng',
            'cancelled' => 'Đã hủy',
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
            'increase' => 'Tăng :trend% so với kỳ trước',
            'decrease' => 'Giảm :trend% so với kỳ trước',
            'all_time' => 'Toàn thời gian',
        ],
        'stats' => [
            'revenue' => [
                'label' => 'Doanh thu',
            ],
            'orders' => [
                'label' => 'Đơn hàng',
            ],
            'sales' => [
                'label' => 'Tổng doanh số',
            ],
            'aov' => [
                'label' => 'Giá trị đơn TB',
            ],
            'conversion_rate' => [
                'label' => 'Tỷ lệ chuyển đổi',
            ],
            'refund_rate' => [
                'label' => 'Tỷ lệ hoàn trả',
            ],
            'active_users' => [
                'label' => 'Người dùng hoạt động',
            ],
            'page_views' => [
                'label' => 'Lượt xem trang',
            ],
            'not_connected' => 'Chưa kết nối',
        ],
        'order_status' => 'Trạng thái đơn hàng',
        'sales_overview' => 'Tổng quan doanh số',
        'sales_by_category' => 'Doanh thu theo ngành hàng',
        'uncategorized' => 'Chưa phân loại',
        'top_products' => 'Sản phẩm bán chạy',
        'top_products_columns' => [
            'product' => 'Sản phẩm',
            'sku' => 'SKU',
            'sold' => 'Đã bán',
            'revenue' => 'Doanh thu',
        ],
        'recent_orders' => 'Đơn hàng gần đây',
        'recent_orders_columns' => [
            'date' => 'Ngày',
            'order' => 'Đơn hàng',
            'customer' => 'Khách hàng',
            'status' => 'Trạng thái',
            'total' => 'Tổng tiền',
        ],
        'recent_activity' => 'Hoạt động gần đây',
        'activity' => [
            'order_placed' => 'Đơn hàng mới',
            'order_placed_desc' => 'Đơn :reference vừa được đặt',
            'customer_registered' => 'Khách hàng mới đăng ký',
            'customer_registered_desc' => ':name vừa tạo tài khoản',
            'review_received' => 'Đánh giá mới',
            'review_received_desc' => 'Đánh giá :rating sao từ :name',
        ],
        'traffic_sources' => 'Nguồn truy cập',
        'traffic' => [
            'direct' => 'Trực tiếp',
            'organic' => 'Tìm kiếm tự nhiên',
            'social' => 'Mạng xã hội',
            'referral' => 'Giới thiệu',
        ],
        'goals' => [
            'heading' => 'Mục tiêu — :month',
            'revenue' => 'Doanh thu',
            'orders' => 'Đơn hàng',
            'new_customers' => 'Khách hàng mới',
            'no_target' => 'Chưa đặt mục tiêu — thêm ở Settings → Goals.',
            'target' => 'Mục tiêu',
        ],
        'filters' => [
            'granularity' => [
                'today' => 'Hôm nay',
                'month' => 'Tháng này',
                'year' => 'Năm nay',
            ],
            'range' => [
                'label' => 'Khoảng thời gian',
                '7' => '7 ngày qua',
                '30' => '30 ngày qua',
                '90' => '90 ngày qua',
                '365' => '12 tháng qua',
                'all' => 'Toàn thời gian',
            ],
        ],
        'returns' => [
            'heading' => 'Yêu cầu trả hàng',
            'pending_review' => [
                'label' => 'Chờ duyệt',
                'description' => 'Đang chờ admin quyết định',
            ],
            'overdue' => [
                'label' => 'Quá hạn duyệt',
                'description' => 'Chờ quá 2 ngày',
            ],
            'awaiting_completion' => [
                'label' => 'Chờ hoàn tất',
                'description' => 'Đã duyệt, chưa hoàn tất',
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
