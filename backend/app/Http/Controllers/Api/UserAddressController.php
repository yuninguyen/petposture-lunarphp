<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserAddress;
use Illuminate\Http\Request;

class UserAddressController extends Controller
{
    public function index(Request $request)
    {
        return response()->json([
            'data' => $request->user()
                ->addresses()
                ->orderByDesc('is_default')
                ->orderBy('created_at')
                ->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'label'        => 'nullable|string|max:64',
            'first_name'   => 'required|string|max:128',
            'last_name'    => 'required|string|max:128',
            'line_one'     => 'required|string|max:255',
            'line_two'     => 'nullable|string|max:255',
            'city'         => 'required|string|max:128',
            'state'        => 'required|string|max:128',
            'postcode'     => 'required|string|max:20',
            'country_code' => 'nullable|string|size:2',
            'phone'        => 'nullable|string|max:32',
            'is_default'   => 'nullable|boolean',
        ]);

        $user = $request->user();

        if (! empty($validated['is_default'])) {
            $user->addresses()->update(['is_default' => false]);
        }

        $address = $user->addresses()->create(array_merge(
            ['label' => 'Home', 'country_code' => 'US'],
            $validated,
            ['user_id' => $user->id],
        ));

        return response()->json(['data' => $address], 201);
    }

    public function update(Request $request, int $id)
    {
        $address = $request->user()->addresses()->findOrFail($id);

        $validated = $request->validate([
            'label'        => 'nullable|string|max:64',
            'first_name'   => 'sometimes|required|string|max:128',
            'last_name'    => 'sometimes|required|string|max:128',
            'line_one'     => 'sometimes|required|string|max:255',
            'line_two'     => 'nullable|string|max:255',
            'city'         => 'sometimes|required|string|max:128',
            'state'        => 'sometimes|required|string|max:128',
            'postcode'     => 'sometimes|required|string|max:20',
            'country_code' => 'nullable|string|size:2',
            'phone'        => 'nullable|string|max:32',
            'is_default'   => 'nullable|boolean',
        ]);

        if (! empty($validated['is_default'])) {
            $request->user()->addresses()->where('id', '!=', $id)->update(['is_default' => false]);
        }

        $address->update($validated);

        return response()->json(['data' => $address]);
    }

    public function destroy(Request $request, int $id)
    {
        $request->user()->addresses()->findOrFail($id)->delete();

        return response()->json(null, 204);
    }
}
