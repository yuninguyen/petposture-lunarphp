<div class="flex items-center">
    <button wire:click="changeLocale('{{ $currentLocale === 'vi' ? 'en' : 'vi' }}')"
        class="flex items-center gap-x-2 px-3 py-2 text-sm font-bold transition-all hover:bg-gray-100 rounded-lg text-primary-600"
        title="{{ $currentLocale === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt' }}">
        {{ strtoupper($currentLocale) }}
    </button>
</div>