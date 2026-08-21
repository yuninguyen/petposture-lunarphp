<?php

namespace Database\Seeders;

use App\Models\BlogCategory;
use App\Models\Post;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class BlogPostSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Ensure categories exist
        $healthCategory = BlogCategory::whereSlug('suc-khoe')->first();
        $nutritionCategory = BlogCategory::whereSlug('dinh-duong')->first();

        if (!$healthCategory) {
            $healthCategory = BlogCategory::create([
                'name' => 'Sức khỏe',
                'slug' => 'suc-khoe',
                'description' => 'Hướng dẫn chăm sóc sức khỏe cho thú cưng',
            ]);
        }

        if (!$nutritionCategory) {
            $nutritionCategory = BlogCategory::create([
                'name' => 'Dinh dưỡng',
                'slug' => 'dinh-duong',
                'description' => 'Lời khuyên về chế độ ăn và dinh dưỡng',
            ]);
        }

        $posts = [
            [
                'title' => 'Tầm quan trọng của tư thế cơ thể với sức khỏe thú cưng',
                'content' => '<h2>Giới thiệu</h2><p>Tư thế cơ thể đóng một vai trò quan trọng trong sức khỏe tổng thể của thú cưng. Một tư thế tốt có thể giúp ngăn ngừa chấn thương và bệnh tật.</p><h2>Lợi ích của tư thế tốt</h2><ul><li>Giảm căng thẳng cơ bắp</li><li>Cải thiện tuần hoàn máu</li><li>Ngăn ngừa chấn thương</li><li>Tăng sự thoải mái</li></ul>',
                'status' => 'published',
                'blog_category_id' => $healthCategory->id,
                'type' => 'article',
                'read_time' => '5 min read',
            ],
            [
                'title' => 'Chế độ ăn cân bằng cho chó khỏe mạnh',
                'content' => '<h2>Các chất dinh dưỡng cần thiết</h2><p>Chó cần một chế độ ăn cân bằng gồm protein, chất béo, carbohydrate, vitamin và khoáng chất.</p><h2>Hướng dẫn cho từng giai đoạn</h2><ul><li>Chó con: Cần nhiều protein hơn</li><li>Chó trưởng thành: Cân bằng tất cả các chất dinh dưỡng</li><li>Chó cao tuổi: Protein vừa phải, chất béo ít</li></ul>',
                'status' => 'draft',
                'blog_category_id' => $nutritionCategory->id,
                'type' => 'guide',
                'read_time' => '7 min read',
            ],
        ];

        foreach ($posts as $post) {
            Post::updateOrCreate(
                ['slug' => Str::slug($post['title'])],
                array_merge($post, [
                    'featured_image' => null,
                    'featured_media_id' => null,
                    'author' => 'Admin',
                    'published_at' => $post['status'] === 'published' ? now() : null,
                ])
            );
        }
    }
}
