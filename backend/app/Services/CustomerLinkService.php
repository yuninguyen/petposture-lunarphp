<?php

namespace App\Services;

use App\Models\User;
use Lunar\Models\Customer;

class CustomerLinkService
{
    public function resolveForUser(User $user): Customer
    {
        if ($existing = $user->latestCustomer()) {
            return $existing;
        }

        $parts = preg_split('/\s+/', trim($user->name), 2);
        $firstName = $parts[0] !== '' ? $parts[0] : 'Customer';
        $lastName = $parts[1] ?? '-';

        $customer = Customer::create([
            'first_name' => $firstName,
            'last_name' => $lastName,
        ]);

        $user->customers()->attach($customer->id);

        return $customer;
    }
}
