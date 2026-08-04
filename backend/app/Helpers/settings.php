<?php

use App\Models\Setting;

if (! function_exists('setting')) {
    /**
     * Get a setting value.
     *
     * @param  mixed  $default
     * @return mixed
     */
    function setting(string $key, $default = null)
    {
        return Setting::get($key, $default);
    }
}
