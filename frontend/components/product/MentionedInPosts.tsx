import Image from 'next/image';
import Link from 'next/link';
import { formatPickDate } from '@/lib/pick';

/** A guide that mentions a Pick, as the API sends it in `mentioned_in` (no article body). */
export interface MentionedPost {
    id: number;
    title: string;
    slug: string;
    category: string | null;
    published_at: string | null;
    read_time: string | null;
    featured_image: string | null;
    featured_image_alt: string | null;
}

// "Mentioned in": the published guides that link this Pick, after "More PetPosture Picks". Left out entirely when
// no guide links it.
export function MentionedInPosts({ posts }: { posts: MentionedPost[] }) {
    if (posts.length === 0) return null;

    return (
        <section aria-labelledby="mentioned-in-title" className="border-t border-zinc-100 px-4 py-12 md:px-8">
            <div className="mx-auto max-w-[900px]">
                <h2 id="mentioned-in-title" className="text-[18px] font-extrabold text-[#2c3840]">Mentioned in</h2>
                <p className="mb-3 mt-1 text-[13px] leading-5 text-[#4b5563]">Guides on PetPosture that mention this pick.</p>

                <ul className="space-y-2.5">
                    {posts.map((post) => {
                        // "Breed Guides · 14 Nov 2026 · 5 min read": each part only when there is one.
                        const meta = [post.category, post.published_at ? formatPickDate(post.published_at.slice(0, 10)) : null, post.read_time]
                            .filter(Boolean)
                            .join(' · ');

                        return (
                            <li key={post.id} className="flex gap-3 rounded-xl border border-[#e4e4e7] bg-white px-3.5 py-3">
                                {post.featured_image && (
                                    <div className="relative h-[72px] w-24 shrink-0 overflow-hidden rounded-lg bg-[#fdf2ea]">
                                        <Image src={post.featured_image} alt={post.featured_image_alt ?? ''} fill sizes="96px" className="object-cover" />
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-[14px] font-bold leading-[1.4] text-[#2c3840]">{post.title}</p>
                                    {meta && <p className="mt-[3px] text-xs text-[#71717a]">{meta}</p>}
                                    <Link href={`/blog/${post.slug}`} className="text-[13px] font-bold text-[#c9713a] hover:underline">
                                        Read the guide →
                                    </Link>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </section>
    );
}
