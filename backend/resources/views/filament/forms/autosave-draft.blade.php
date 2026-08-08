<div
    x-data="{
        key: 'petposture-draft:' + window.location.pathname,
        restoreAvailable: false,
        savedAt: null,
        init() {
            const raw = localStorage.getItem(this.key);

            if (raw) {
                try {
                    const parsed = JSON.parse(raw);

                    if (parsed.savedAt && (Date.now() - parsed.savedAt) < 1000 * 60 * 60 * 24) {
                        this.restoreAvailable = true;
                        this.savedAt = new Date(parsed.savedAt).toLocaleString();
                    } else {
                        localStorage.removeItem(this.key);
                    }
                } catch (e) {
                    localStorage.removeItem(this.key);
                }
            }

            setInterval(() => {
                localStorage.setItem(this.key, JSON.stringify({ data: $wire.data, savedAt: Date.now() }));
            }, 20000);
        },
        restore() {
            const raw = localStorage.getItem(this.key);

            if (raw) {
                $wire.data = JSON.parse(raw).data;
            }

            localStorage.removeItem(this.key);
            this.restoreAvailable = false;
        },
        discard() {
            localStorage.removeItem(this.key);
            this.restoreAvailable = false;
        },
    }"
    x-init="init()"
>
    <template x-if="restoreAvailable">
        <div class="mb-4 flex items-center justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-600 dark:bg-amber-500/10">
            <p class="text-sm text-amber-800 dark:text-amber-200">
                {{ __('Unsaved draft found from') }} <span x-text="savedAt"></span>.
            </p>
            <div class="flex gap-3">
                <button type="button" x-on:click="restore()" class="text-sm font-medium text-amber-800 underline dark:text-amber-200">{{ __('Restore') }}</button>
                <button type="button" x-on:click="discard()" class="text-sm font-medium text-gray-500 underline">{{ __('Discard') }}</button>
            </div>
        </div>
    </template>
</div>
