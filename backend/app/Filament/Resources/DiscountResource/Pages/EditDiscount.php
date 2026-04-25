<?php

namespace App\Filament\Resources\DiscountResource\Pages;

use App\Filament\Resources\DiscountResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Support\Str;
use Lunar\Models\Currency;

class EditDiscount extends EditRecord
{
    protected static string $resource = DiscountResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }

    protected function mutateFormDataBeforeSave(array $data): array
    {
        $defaultCurrency = Currency::getDefault();
        $type = $data['discount_type_select'];
        $amount = (float) ($data['amount'] ?? 0);
        $minorUnitAmount = (int) round($amount * $defaultCurrency->factor);

        // Required Lunar fields
        $data['handle'] = Str::slug($data['coupon']);
        $data['name'] = $data['name'] ?? $data['coupon'];

        if ($type === 'percentage') {
            $data['type'] = \Lunar\DiscountTypes\AmountOff::class;
            $data['data'] = array_merge($data['data'] ?? [], [
                'fixed_value' => false,
                'percentage' => $amount,
            ]);
        } elseif ($type === 'fixed_cart') {
            $data['type'] = \Lunar\DiscountTypes\AmountOff::class;
            $data['data'] = array_merge($data['data'] ?? [], [
                'fixed_value' => true,
                'fixed_values' => [
                    $defaultCurrency->code => $minorUnitAmount,
                ],
            ]);
        } elseif ($type === 'fixed_product') {
            $data['type'] = \App\Lunar\DiscountTypes\FixedAmountOffPerUnit::class;
            $data['data'] = array_merge($data['data'] ?? [], [
                'fixed_value' => true,
                'fixed_values' => [
                    $defaultCurrency->code => $minorUnitAmount,
                ],
            ]);
        }

        unset($data['discount_type_select'], $data['amount']);

        return $data;
    }
}
