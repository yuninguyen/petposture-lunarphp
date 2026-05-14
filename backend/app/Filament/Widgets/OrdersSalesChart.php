<?php

namespace App\Filament\Widgets;

use Lunar\Admin\Filament\Widgets\Dashboard\Orders\OrdersSalesChart as BaseOrdersSalesChart;
use Carbon\Carbon;

class OrdersSalesChart extends BaseOrdersSalesChart
{
    protected int | string | array $columnSpan = 1;

    protected function getOptions(): array
    {
        $options = parent::getOptions();

        // Cập nhật font cho các trục Y (chữ nằm dọc)
        if (isset($options['yaxis'])) {
            foreach ($options['yaxis'] as &$yaxis) {
                data_set($yaxis, 'title.style.fontFamily', 'Google Sans Flex, sans-serif');
                data_set($yaxis, 'title.style.fontWeight', 600);
                data_set($yaxis, 'labels.style.fontFamily', 'Google Sans Flex, sans-serif');
            }
        }

        // Cập nhật font cho trục X (chữ nằm ngang)
        data_set($options, 'xaxis.labels.style.fontFamily', 'Google Sans Flex, sans-serif');

        // Cập nhật font cho Legend (chú thích)
        data_set($options, 'legend.fontFamily', 'Google Sans Flex, sans-serif');
        data_set($options, 'legend.fontWeight', 500);

        // Việt hóa và Viết hoa nhãn tháng
        if (isset($options['xaxis']['categories'])) {
            $options['xaxis']['categories'] = collect($options['xaxis']['categories'])->map(function ($label) {
                // Thử parse label (định dạng Dec 2023 chẳng hạn) và dịch sang tiếng Việt + viết hoa
                try {
                    return ucfirst(Carbon::parse($label)->translatedFormat('M Y'));
                } catch (\Exception $e) {
                    return $label;
                }
            })->toArray();
        }

        return $options;
    }
}
