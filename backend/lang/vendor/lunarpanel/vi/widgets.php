<?php

return [
    'dashboard' => [
        'orders' => [
            'order_stats_overview' => [
                'stat_one' => [
                    'label' => 'Đơn hàng hôm nay',
                    'increase' => ':percentage% tăng so với :count hôm qua',
                    'decrease' => ':percentage% giảm so với :count hôm qua',
                    'neutral' => 'Không thay đổi so với hôm qua',
                ],
                'stat_two' => [
                    'label' => 'Đơn hàng 7 ngày qua',
                    'increase' => ':percentage% tăng so với :count kỳ trước',
                    'decrease' => ':percentage% giảm so với :count kỳ trước',
                    'neutral' => 'Không thay đổi so với kỳ trước',
                ],
                'stat_three' => [
                    'label' => 'Đơn hàng 30 ngày qua',
                    'increase' => ':percentage% tăng so với :count kỳ trước',
                    'decrease' => ':percentage% giảm so với :count kỳ trước',
                    'neutral' => 'Không thay đổi so với kỳ trước',
                ],
                'stat_four' => [
                    'label' => 'Doanh thu hôm nay',
                    'increase' => ':percentage% tăng so với :total hôm qua',
                    'decrease' => ':percentage% giảm so với :total hôm qua',
                    'neutral' => 'Không thay đổi so với hôm qua',
                ],
                'stat_five' => [
                    'label' => 'Doanh thu 7 ngày qua',
                    'increase' => ':percentage% tăng so với :total kỳ trước',
                    'decrease' => ':percentage% giảm so với :total kỳ trước',
                    'neutral' => 'Không thay đổi so với kỳ trước',
                ],
                'stat_six' => [
                    'label' => 'Doanh thu 30 ngày qua',
                    'increase' => ':percentage% tăng so với :total kỳ trước',
                    'decrease' => ':percentage% giảm so với :total kỳ trước',
                    'neutral' => 'Không thay đổi so với kỳ trước',
                ],
            ],
            'order_totals_chart' => [
                'heading' => 'Tổng đơn hàng trong năm qua',
                'series_one' => [
                    'label' => 'Kỳ này',
                ],
                'series_two' => [
                    'label' => 'Kỳ trước',
                ],
                'yaxis' => [
                    'label' => 'Doanh thu :currency',
                ],
            ],
            'order_sales_chart' => [
                'heading' => 'Báo cáo Đơn hàng / Doanh thu',
                'series_one' => [
                    'label' => 'Đơn hàng',
                ],
                'series_two' => [
                    'label' => 'Doanh thu',
                ],
                'yaxis' => [
                    'series_one' => [
                        'label' => 'Số đơn hàng',
                    ],
                    'series_two' => [
                        'label' => 'Tổng giá trị',
                    ],
                ],
            ],
            'average_order_value' => [
                'heading' => 'Giá trị đơn hàng trung bình',
            ],
            'new_returning_customers' => [
                'heading' => 'Khách hàng mới và quay lại',
                'series_one' => [
                    'label' => 'Khách hàng mới',
                ],
                'series_two' => [
                    'label' => 'Khách hàng quay lại',
                ],
            ],
            'popular_products' => [
                'heading' => 'Sản phẩm bán chạy (12 tháng qua)',
                'description' => 'Những số liệu này dựa trên số lần sản phẩm xuất hiện trong đơn hàng, không phải số lượng đặt hàng.',
            ],
            'latest_orders' => [
                'heading' => 'Đơn hàng mới nhất',
            ],
        ],
    ],
    'customer' => [
        'stats_overview' => [
            'total_orders' => [
                'label' => 'Tổng đơn hàng',
            ],
            'avg_spend' => [
                'label' => 'Chi tiêu trung bình',
            ],
            'total_spend' => [
                'label' => 'Tổng chi tiêu',
            ],
        ],
    ],
];
