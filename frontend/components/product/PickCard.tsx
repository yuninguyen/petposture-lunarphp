import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/types/shop';

// A Pick as a card in a list: it opens the Pick's own page. No cart, wishlist, stock or price here;
// the retailer price only ever appears on the Pick page, together with the date it was checked.
export function PickCard({
    product,
    sizes = '(max-width: 768px) 100vw, 33vw',
}: {
    product: Product;
    sizes?: string;
}) {
    return (
        <article className="group overflow-hidden rounded-[15px] border border-[#e8e1d8] bg-white shadow-[0_8px_24px_rgba(34,33,33,0.035)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(34,33,33,0.08)]">
            <Link href={`/picks/${product.slug}`} className="block">
                {product.image && (
                    <div className="relative aspect-square overflow-hidden border-b border-[#eee8e0] bg-[#f8f6f2]">
                        <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            sizes={sizes}
                            className="object-contain p-6 mix-blend-multiply transition duration-500 group-hover:scale-[1.03]"
                        />
                    </div>
                )}

                <div className="p-[18px]">
                    {product.brand && (
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#56616a]">{product.brand}</p>
                    )}
                    <h3 className="line-clamp-2 min-h-[46px] text-[15px] font-semibold leading-6 text-[#2d3a43] transition-colors group-hover:text-[#2c3840]">
                        {product.name}
                    </h3>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.08em] text-rust">
                        View pick <span aria-hidden="true">→</span>
                    </span>
                </div>
            </Link>
        </article>
    );
}
