<?php

namespace App\Livewire;

use Livewire\Component;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\App;

class LanguageSwitcher extends Component
{
    public string $currentLocale;

    public function mount()
    {
        // fallback_locale is never mutated (unlike app.locale, mutated per-request by
        // SetLocale) — avoids the same cross-request locale drift in worker mode.
        $this->currentLocale = Session::get('locale', config('app.fallback_locale', 'en'));
    }

    public function changeLocale(string $locale)
    {
        if (!in_array($locale, ['en', 'vi'])) {
            return;
        }

        Session::put('locale', $locale);
        App::setLocale($locale);

        return redirect(request()->header('Referer'));
    }

    public function render()
    {
        return view('livewire.language-switcher');
    }
}
