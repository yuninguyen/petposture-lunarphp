<?php

namespace App\Services\Admin;

use App\Models\AffiliateNetwork;
use Lunar\Models\Brand;
use App\Models\CuratorMedia;
use App\Support\ImageOptimizer;
use App\Support\RetailerUrl;
use App\Support\SafeImageDownloader;
use DateTimeInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Lunar\Models\Attribute;
use Lunar\Models\Currency;
use Lunar\Models\Product;
use Lunar\Models\ProductType;
use Lunar\Models\TaxClass;
use Lunar\Models\Url;
use OpenSpout\Reader\CSV\Reader as CsvReader;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use RuntimeException;
use Throwable;

/**
 * Creates Picks from a spreadsheet (.xlsx or .csv) the same way they are entered by hand: a General product with
 * one variant and a reference price, the Pick attributes, and photos attached from the Media Library. It never
 * changes an existing product: a row that matches one by name, Chewy URL or SKU is reported, not imported.
 */
class PickImportService
{
    public const MAX_ROWS = 200;

    public const PHOTO_SLOTS = 4;

    private const BREEDS = ['corgi', 'dachshund', 'english-bulldog', 'french-bulldog', 'pug'];

    private const SOLUTIONS = ['feeding', 'comfort', 'mobility', 'walking'];

    private const TEXT_COLUMNS = [
        'pros' => 'Pros', 'cons' => 'Cons', 'our_take' => 'Our take', 'best_for_note' => 'Best for note',
        'problem' => 'Problem', 'approach' => 'Approach', 'quick_specs' => 'Quick specs',
    ];

    public function __construct(private readonly ProductAttributeService $attributes) {}

    /** The rows as they would be imported, with problems flagged. Nothing is written. */
    public function preview(UploadedFile $file): array
    {
        $rows = $this->analyse($file);

        return [
            'summary' => [
                'create' => $rows->where('status', 'create')->count(),
                'skipped_duplicate' => $rows->where('status', 'skipped_duplicate')->count(),
                'error' => $rows->where('status', 'error')->count(),
            ],
            'rows' => $rows->map(fn (array $row): array => collect($row)->except('plan')->all())->values()->all(),
        ];
    }

    /** Creates every row that is clean; returns what happened to each row. */
    public function import(UploadedFile $file, mixed $user = null): array
    {
        $created = [];
        $skipped = [];
        $failed = [];
        $photoWarnings = [];

        foreach ($this->analyse($file) as $row) {
            if ($row['status'] === 'skipped_duplicate') {
                $skipped[] = ['row' => $row['row'], 'name' => $row['name'], 'reason' => implode(' ', $row['reasons'])];

                continue;
            }

            if ($row['status'] === 'error') {
                $failed[] = ['row' => $row['row'], 'name' => $row['name'], 'reasons' => $row['reasons']];

                continue;
            }

            try {
                [$product, $warnings] = $this->create($row['plan'], $user);
            } catch (Throwable $e) {
                report($e);
                $failed[] = ['row' => $row['row'], 'name' => $row['name'], 'reasons' => ['The row could not be saved: '.$e->getMessage()]];

                continue;
            }

            $created[] = ['row' => $row['row'], 'name' => $row['name'], 'id' => $product->id, 'slug' => $row['plan']['slug']];
            foreach ($warnings as $warning) {
                $photoWarnings[] = ['row' => $row['row'], 'name' => $row['name'], 'message' => $warning];
            }
        }

        return ['created' => $created, 'skipped' => $skipped, 'failed' => $failed, 'photo_warnings' => $photoWarnings];
    }

    private function analyse(UploadedFile $file): Collection
    {
        $table = $this->read($file);

        $existingNames = [];
        $existingUrls = [];
        Product::query()->get(['id', 'attribute_data'])->each(function (Product $product) use (&$existingNames, &$existingUrls): void {
            $existingNames[Str::lower(trim((string) $product->translateAttribute('name')))] = true;
            $url = RetailerUrl::web($product->translateAttribute('external_url'));
            if ($url) {
                $existingUrls[Str::lower($url)] = true;
            }
        });
        $existingSkus = DB::table('lunar_product_variants')->pluck('sku')->map(fn ($sku) => Str::upper((string) $sku))->flip()->all();

        $brands = Brand::query()->get(['id', 'name'])->mapWithKeys(fn (Brand $brand) => [Str::lower(trim($brand->name)) => $brand->id])->all();
        $networks = AffiliateNetwork::query()->pluck('slug')->all();
        $seenNames = [];
        $seenUrls = [];
        $seenSkus = [];
        $rows = collect();

        foreach ($table as $number => $cells) {
            $row = ['row' => $number, 'name' => $cells['product name'] ?? '', 'variant' => $cells['variant'] ?? '', 'price' => $cells['price'] ?? '', 'brand' => trim($cells['brand'] ?? ''),
                'status' => 'create', 'reasons' => [], 'warnings' => [], 'photos' => [], 'plan' => []];
            $errors = [];
            $duplicate = null;

            $name = trim($cells['product name'] ?? '');
            $variant = trim($cells['variant'] ?? '');
            $url = RetailerUrl::web($cells['chewy url'] ?? '');
            $price = $this->price($cells['price'] ?? '');
            $checked = $this->date($cells['price checked date'] ?? '');

            if ($name === '') {
                $errors[] = 'Product name is missing.';
            } elseif (mb_strlen($name) > 255) {
                $errors[] = 'Product name is longer than 255 characters.';
            }
            if ($url === null) {
                $errors[] = 'Chewy URL is missing or is not a web address (http or https).';
            }
            if ($price === null) {
                $errors[] = 'Price is missing or is not a number with at most 2 decimals.';
            }
            if (($cells['price checked date'] ?? '') !== '' && $checked === null) {
                $errors[] = 'Price checked date must look like 2026-11-17.';
            }

            $breeds = $this->breeds($cells['breeds'] ?? '', $errors);
            $solutions = $this->solutions($cells['solution'] ?? '', $errors);

            $networkSlug = trim($cells['affiliate_network_slug'] ?? '');
            if ($networkSlug === '' && $url !== null) {
                $host = Str::lower((string) parse_url($url, PHP_URL_HOST));
                $networkSlug = collect($networks)->first(fn (string $slug) => $slug !== '' && str_contains($host, Str::lower($slug))) ?? '';
                if ($networkSlug === '') {
                    $row['warnings'][] = 'No affiliate network matches this URL, so the Pick is saved without one.';
                }
            } elseif ($networkSlug !== '' && ! in_array($networkSlug, $networks, true)) {
                $errors[] = "Affiliate network \"{$networkSlug}\" does not exist.";
            }

            // A brand is matched to an existing one by name; a typo is flagged rather than creating a second brand.
            $brandName = trim($cells['brand'] ?? '');
            $brandId = null;
            if ($brandName !== '') {
                $brandId = $brands[Str::lower($brandName)] ?? null;
                if ($brandId === null) {
                    $errors[] = "Brand \"{$brandName}\" does not exist. Add it under Brands first, or fix the spelling.";
                }
            }

            $status = Str::lower(trim($cells['status'] ?? ''));
            if (! in_array($status, ['', 'published', 'draft'], true)) {
                $errors[] = 'Status must be published or draft.';
            }

            $slug = $name === '' ? '' : Str::slug($name);
            $sku = $name === '' ? '' : Str::upper(Str::limit(Str::slug($name.' '.$variant), 100, ''));

            if ($name !== '') {
                if (isset($existingNames[Str::lower($name)])) {
                    $duplicate = 'A product with this name already exists.';
                } elseif (isset($seenNames[Str::lower($name)])) {
                    $duplicate = 'The same name appears earlier in this file.';
                }
            }
            if ($duplicate === null && $url !== null) {
                if (isset($existingUrls[Str::lower($url)])) {
                    $duplicate = 'A product with this Chewy URL already exists.';
                } elseif (isset($seenUrls[Str::lower($url)])) {
                    $duplicate = 'The same Chewy URL appears earlier in this file.';
                }
            }

            if ($duplicate === null && $sku !== '') {
                if (isset($existingSkus[$sku]) || isset($seenSkus[$sku])) {
                    $errors[] = "The generated SKU {$sku} is already used; add a Variant to tell the products apart.";
                }
                if ($slug !== '' && Url::query()->where('slug', $slug)->exists()) {
                    $errors[] = "The page address /picks/{$slug} is already taken.";
                }
            }

            $photos = $this->photos($cells, $name, $variant, $errors);
            $row['photos'] = array_map(fn (array $photo): array => collect($photo)->except('media_id')->all(), $photos);
            if ($photos === []) {
                $row['warnings'][] = 'No photo given: the Pick is saved without one.';
            }

            if ($duplicate !== null) {
                $row['status'] = 'skipped_duplicate';
                $row['reasons'] = [$duplicate];
            } elseif ($errors !== []) {
                $row['status'] = 'error';
                $row['reasons'] = $errors;
            } else {
                $values = ['external_url' => $url, 'affiliate_network_slug' => $networkSlug, 'reference_price' => $price,
                    'price_checked_date' => $checked ?? '', 'best_for_breeds' => implode(', ', $breeds), 'solution_tags' => implode(', ', $solutions)];
                foreach (self::TEXT_COLUMNS as $handle => $label) {
                    $values[$handle] = trim((string) ($cells[Str::lower($label)] ?? ''));
                }
                $row['plan'] = ['name' => $name, 'brand_id' => $brandId, 'variant' => $variant, 'sku' => $sku, 'slug' => $slug, 'price' => $price,
                    'status' => $status === '' ? 'published' : $status, 'values' => $values, 'photos' => $photos];
            }

            if ($name !== '') {
                $seenNames[Str::lower($name)] = true;
            }
            if ($url !== null) {
                $seenUrls[Str::lower($url)] = true;
            }
            if ($sku !== '') {
                $seenSkus[$sku] = true;
            }

            $rows->push($row);
        }

        return $rows;
    }

    /** @return array<int, array<string, string>> rows keyed by their line number in the file, columns keyed by lower-case header */
    private function read(UploadedFile $file): array
    {
        $extension = Str::lower($file->getClientOriginalExtension());
        $reader = $extension === 'xlsx' ? new XlsxReader : new CsvReader;
        $reader->open($file->getRealPath());

        $header = null;
        $table = [];

        try {
            foreach ($reader->getSheetIterator() as $sheet) {
                foreach ($sheet->getRowIterator() as $index => $row) {
                    $cells = array_map(fn ($cell) => $this->cell($cell), $row->toArray());

                    if ($header === null) {
                        $header = array_map(fn (string $title) => Str::lower(trim($title)), $cells);
                        foreach (['product name', 'chewy url', 'price'] as $required) {
                            if (! in_array($required, $header, true)) {
                                throw new RuntimeException("The file has no \"{$required}\" column in its first row.");
                            }
                        }

                        continue;
                    }

                    if (collect($cells)->every(fn (string $cell) => trim($cell) === '')) {
                        continue;
                    }

                    if (count($table) >= self::MAX_ROWS) {
                        throw new RuntimeException('The file has more than '.self::MAX_ROWS.' rows; split it.');
                    }

                    $named = [];
                    foreach ($header as $position => $title) {
                        if ($title !== '') {
                            $named[$title] = $cells[$position] ?? '';
                        }
                    }
                    $table[$index] = $named;
                }

                break; // only the first sheet
            }
        } finally {
            $reader->close();
        }

        if ($header === null) {
            throw new RuntimeException('The file is empty.');
        }

        return $table;
    }

    private function cell(mixed $value): string
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        if (is_float($value)) {
            return rtrim(rtrim(number_format($value, 4, '.', ''), '0'), '.');
        }

        return str_replace(["\r\n", "\r"], "\n", (string) $value);
    }

    private function price(string $value): ?string
    {
        $value = trim(str_replace(['$', ','], '', $value));

        return preg_match('/^\d+(?:\.\d{1,2})?$/', $value) && (float) $value > 0 ? $value : null;
    }

    private function date(string $value): ?string
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $value);

        return $date && $date->format('Y-m-d') === $value ? $value : null;
    }

    private function breeds(string $value, array &$errors): array
    {
        $value = Str::lower(trim($value));
        if ($value === '') {
            return [];
        }
        if (in_array($value, ['all 5 breeds', 'all breeds', 'all'], true)) {
            return self::BREEDS;
        }

        $breeds = array_values(array_filter(array_map('trim', explode(',', $value))));
        $unknown = array_diff($breeds, self::BREEDS);
        if ($unknown !== []) {
            $errors[] = 'Unknown breed: '.implode(', ', $unknown).'. Use '.implode(', ', self::BREEDS).'.';
        }

        return $breeds;
    }

    private function solutions(string $value, array &$errors): array
    {
        $solutions = array_values(array_filter(array_map('trim', explode(',', Str::lower($value)))));
        $unknown = array_diff($solutions, self::SOLUTIONS);
        if ($unknown !== []) {
            $errors[] = 'Unknown solution: '.implode(', ', $unknown).'. Use '.implode(', ', self::SOLUTIONS).' or leave it empty.';
        }

        return $solutions;
    }

    /** Photos in column order. A Media Library name wins; the URL is the fallback. */
    private function photos(array $cells, string $name, string $variant, array &$errors): array
    {
        $photos = [];

        for ($slot = 1; $slot <= self::PHOTO_SLOTS; $slot++) {
            $file = trim($cells["image file {$slot}"] ?? '');
            $url = trim($cells["image url {$slot}"] ?? '');
            if ($file === '' && $url === '') {
                continue;
            }

            $alt = trim($cells["alt text {$slot}"] ?? '') ?: trim($name.($variant !== '' ? ', '.$variant : ''));
            $media = $file === '' ? null : CuratorMedia::query()->where('name', $file)->orderByDesc('id')->first();

            if ($media) {
                $photos[] = ['slot' => $slot, 'source' => 'library', 'label' => $file, 'alt' => $alt, 'media_id' => $media->id];

                continue;
            }

            if ($url === '') {
                $errors[] = "Photo {$slot}: \"{$file}\" is not in the Media Library and no Image URL {$slot} is given. Upload it first.";

                continue;
            }

            try {
                SafeImageDownloader::check($url);
            } catch (RuntimeException $e) {
                $errors[] = "Photo {$slot}: the Image URL cannot be used. {$e->getMessage()}";

                continue;
            }

            $photos[] = ['slot' => $slot, 'source' => 'url', 'label' => $url, 'alt' => $alt, 'media_id' => null, 'file_name' => $file];
        }

        return $photos;
    }

    /** @return array{0: Product, 1: array<int, string>} the product and the photo warnings */
    private function create(array $plan, mixed $user): array
    {
        $type = ProductType::query()->where('name', 'General')->first();
        $nameAttribute = Attribute::query()->where('attribute_type', Product::morphName())->where('handle', 'name')->first();
        $currency = Currency::getDefault();
        $taxClass = TaxClass::getDefault();

        if (! $type || ! $nameAttribute || ! $currency || ! $taxClass) {
            throw new RuntimeException('Product prerequisites are missing: the General product type, the name attribute, a default currency and a default tax class.');
        }

        $mapped = $type->mappedAttributes()->pluck('handle')->all();
        $filled = collect($plan['values'])->filter(fn ($value) => $value !== '');
        $missing = $filled->keys()->diff($mapped);
        if ($missing->isNotEmpty()) {
            throw new RuntimeException('These attributes are not set up on the General type: '.$missing->implode(', ').'.');
        }
        $values = $filled->all();

        // Photos are fetched before anything is saved, so a slow download never holds a transaction open.
        $warnings = [];
        $photos = [];
        foreach ($plan['photos'] as $photo) {
            if ($photo['source'] === 'library') {
                $photos[] = ['media' => CuratorMedia::query()->find($photo['media_id']), 'alt' => $photo['alt']];

                continue;
            }

            try {
                $photos[] = ['media' => $this->storeDownloaded($photo['label'], $photo['file_name'] ?: $plan['slug'].'-'.$photo['slot']), 'alt' => $photo['alt']];
            } catch (Throwable $e) {
                $warnings[] = "Photo {$photo['slot']} was skipped: {$e->getMessage()}";
            }
        }
        $photos = array_values(array_filter($photos, fn (array $photo) => $photo['media'] !== null));

        $product = DB::transaction(function () use ($plan, $type, $nameAttribute, $currency, $taxClass, $values, $photos): Product {
            $product = Product::query()->create([
                'status' => 'draft',
                'brand_id' => $plan['brand_id'],
                'product_type_id' => $type->id,
                'attribute_data' => ['name' => $this->attributes->makeNameValue($nameAttribute->type, $plan['name'])],
            ]);

            $product->attribute_data = $this->attributes->apply($type, 'product', $product->attribute_data ?? collect(), $values);
            $product->status = $plan['status'];
            $product->save();

            $variant = $product->variants()->create(['tax_class_id' => $taxClass->id, 'sku' => $plan['sku']]);
            $variant->prices()->create([
                'min_quantity' => 1,
                'currency_id' => $currency->id,
                'customer_group_id' => null,
                'price' => (int) bcmul($plan['price'], (string) $currency->factor, 0),
            ]);

            foreach ($photos as $index => $photo) {
                $curator = $photo['media'];
                $media = $product->addMediaFromDisk($curator->path, $curator->disk)
                    ->usingName($curator->name)
                    ->withCustomProperties(['curator_media_id' => $curator->id, 'primary' => $index === 0, 'alt' => $photo['alt']])
                    ->toMediaCollection(config('lunar.media.collection'));
                $media->order_column = $index + 1;
                $media->save();
            }

            return $product;
        });

        activity()
            ->causedBy($user)
            ->performedOn($product)
            ->event('created')
            ->withProperties(['after' => ['name' => $plan['name'], 'sku' => $plan['sku'], 'status' => $plan['status'], 'source' => 'import']])
            ->log('created');

        return [$product, $warnings];
    }

    private function storeDownloaded(string $url, string $baseName): CuratorMedia
    {
        $download = SafeImageDownloader::download($url);
        $disk = config('curator.disk');
        $directory = config('curator.directory');
        $baseName = pathinfo($baseName, PATHINFO_FILENAME) ?: 'pick-photo';

        $path = trim($directory, '/').'/'.Str::uuid().'.'.$download['extension'];
        Storage::disk($disk)->put($path, $download['bytes']);
        $path = ImageOptimizer::optimize($disk, $path);
        [$width, $height] = getimagesize(Storage::disk($disk)->path($path)) ?: [null, null];

        return CuratorMedia::create([
            'disk' => $disk,
            'directory' => $directory,
            'visibility' => 'public',
            'name' => $baseName.'.'.$download['extension'],
            'path' => $path,
            'width' => $width,
            'height' => $height,
            'size' => Storage::disk($disk)->size($path),
            'type' => 'image',
            'ext' => pathinfo($path, PATHINFO_EXTENSION),
            'folder' => CuratorMedia::FOLDER_PRODUCT,
        ]);
    }
}
