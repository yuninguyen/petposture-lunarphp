<?php

namespace App\Console\Commands;

use App\Models\CuratorMedia;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Lunar\Models\Product;

class BackfillCuratorMediaFolders extends Command
{
    protected $signature = 'media:backfill-folders';

    protected $description = 'Assign Curator media folders from existing content and product references';

    public function handle(): int
    {
        $curatorTable = (new CuratorMedia)->getTable();

        if (! Schema::hasTable($curatorTable) || ! Schema::hasColumn($curatorTable, 'folder')) {
            $this->warn("Skipping backfill: {$curatorTable}.folder is not available.");

            return self::SUCCESS;
        }

        CuratorMedia::query()->update(['folder' => CuratorMedia::FOLDER_GENERAL]);

        $this->assignFromOwner('posts', 'featured_media_id', CuratorMedia::FOLDER_BLOG);
        $this->assignFromOwner('breeds', 'featured_media_id', CuratorMedia::FOLDER_BREED);
        $this->assignFromOwner('solutions', 'featured_media_id', CuratorMedia::FOLDER_SOLUTION);

        if (Schema::hasTable('media')
            && Schema::hasColumn('media', 'model_type')
            && Schema::hasColumn('media', 'custom_properties')) {
            $productMediaIds = DB::table('media')
                ->where('model_type', Product::morphName())
                ->pluck('custom_properties')
                ->map(function ($properties) {
                    $properties = is_string($properties) ? json_decode($properties, true) : (array) $properties;

                    return $properties['curator_media_id'] ?? null;
                })
                ->filter()
                ->unique()
                ->values();
            $this->assign($productMediaIds, CuratorMedia::FOLDER_PRODUCT);
        }

        $counts = CuratorMedia::query()
            ->selectRaw('folder, COUNT(*) as aggregate')
            ->groupBy('folder')
            ->pluck('aggregate', 'folder');

        foreach (CuratorMedia::FOLDERS as $folder) {
            $this->line("{$folder}: ".($counts[$folder] ?? 0));
        }

        return self::SUCCESS;
    }

    private function assignFromOwner(string $table, string $column, string $folder): void
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
            return;
        }

        $this->assign(
            DB::table($table)->whereNotNull($column)->pluck($column),
            $folder
        );
    }

    private function assign($ids, string $folder): void
    {
        CuratorMedia::query()
            ->whereIn('id', $ids)
            ->update(['folder' => $folder]);
    }
}
