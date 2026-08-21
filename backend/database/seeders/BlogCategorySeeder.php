<?php

namespace Database\Seeders;

use App\Models\BlogCategory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class BlogCategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $categories = [
            [
                'name' => 'Sức khỏe',
                'description' => 'Hướng dẫn chăm sóc sức khỏe cho thú cưng',
            ],
            [
                'name' => 'Dinh dưỡng',
                'description' => 'Lời khuyên về chế độ ăn và dinh dưỡng',
            ],
            [
                'name' => 'Huấn luyện',
                'description' => 'Mẹo huấn luyện thú cưng hiệu quả',
            ],
            [
                'name' => 'Chủng loài',
                'description' => 'Thông tin chi tiết về các chủng loài',
            ],
            [
                'name' => 'Sản phẩm',
                'description' => 'Đánh giá và hướng dẫn sản phẩm',
            ],
        ];

        foreach ($categories as $cat) {
            BlogCategory::updateOrCreate(
                ['slug' => Str::slug($cat['name'])],
                [
                    'name' => $cat['name'],
                    'description' => $cat['description'],
                    'image_url' => null,
                ]
            );
        }
    }
}
