<?php

namespace App\Filament\Widgets;

use Lunar\Admin\Filament\Widgets\Dashboard\Orders\OrderTotalsChart as BaseOrderTotalsChart;
use Carbon\Carbon;

class OrderTotalsChart extends BaseOrderTotalsChart
{
    protected int | string | array $columnSpan = 1;

    protected function getOptions(): array
    {
        $options = parent::getOptions();

        // Cập nhật font cho trục Y (chữ nằm dọc)
        data_set($options, 'yaxis.title.style.fontFamily', 'Google Sans Flex, sans-serif');
        data_set($options, 'yaxis.title.style.fontWeight', 600);
        data_set($options, 'yaxis.labels.style.fontFamily', 'Google Sans Flex, sans-serif');

        // Cập nhật font cho trục X (chữ nằm ngang)
        data_set($options, 'xaxis.labels.style.fontFamily', 'Google Sans Flex, sans-serif');

        // Cập nhật font cho Legend (chú thích)
        data_set($options, 'legend.fontFamily', 'Google Sans Flex, sans-serif');
        data_set($options, 'legend.fontWeight', 500);

        // Việt hóa và Viết hoa nhãn tháng
        if (isset($options['xaxis']['categories'])) {
            $options['xaxis']['categories'] = collect($options['xaxis']['categories'])->map(function ($label) {
                try {
                    return ucfirst(Carbon::parse($label)->translatedFormat('F'));
                } catch (\Exception $e) {
                    return $label;
                }
            })->toArray();
        }

        return $options;
    }
}
