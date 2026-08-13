import Image from 'next/image';
import { ShieldAlert, Star } from 'lucide-react';

export type ComparisonItem = {
    id?: string;
    product_name: string;
    image_url?: string | null;
    retailer: string;
    retailer_label?: string | null;
    retailer_logo?: string | null;
    price_display: string;
    price_cents?: number;
    rating?: number | null;
    highlight?: 'best_overall' | 'best_value' | 'budget_pick' | null;
    pros?: string[];
    cons?: string[];
    affiliate_url: string;
    redirect_url?: string | null;
    in_house_match_url?: string | null;
};

export type ComparisonData = {
    intro?: string | null;
    disclosure_shown: boolean;
    items: ComparisonItem[];
};

const HIGHLIGHT_LABEL: Record<NonNullable<ComparisonItem['highlight']>, string> = {
    best_overall: 'Best Overall',
    best_value: 'Best Value',
    budget_pick: 'Budget Pick',
};

function Stars({ rating }: { rating: number }) {
    const rounded = Math.round(rating);
    return (
        <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
            {Array.from({ length: 5 }).map((_, i) => (
                <Star
                    key={i}
                    size={13}
                    className={i < rounded ? 'fill-secondary text-secondary-dark' : 'text-zinc-200'}
                />
            ))}
        </div>
    );
}

function ComparisonCard({ item }: { item: ComparisonItem }) {
    const retailerLabel = item.retailer_label || item.retailer;

    return (
        <div className="flex flex-col rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
            {item.highlight ? (
                <span className="mb-3 inline-block w-fit rounded-full bg-secondary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-secondary-dark">
                    {HIGHLIGHT_LABEL[item.highlight]}
                </span>
            ) : (
                <span className="mb-3 h-[22px]" aria-hidden="true" />
            )}

            <div className="relative mb-3 aspect-square overflow-hidden rounded-xl bg-[#f8f9fa]">
                {item.image_url ? (
                    <Image
                        src={item.image_url}
                        alt={item.product_name}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover"
                    />
                ) : null}
            </div>

            <h4 className="mb-1 text-[15px] font-bold leading-snug text-primary">{item.product_name}</h4>
            <span className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                {item.retailer_logo ? (
                    <Image src={item.retailer_logo} alt={retailerLabel} width={14} height={14} className="rounded-sm object-contain" />
                ) : null}
                {retailerLabel}
            </span>

            {typeof item.rating === 'number' ? (
                <div className="mb-2">
                    <Stars rating={item.rating} />
                </div>
            ) : null}

            <div className="mb-3 text-[20px] font-bold text-primary">{item.price_display}</div>

            {(item.pros?.length || item.cons?.length) ? (
                <ul className="mb-4 space-y-1 text-[12.5px] text-zinc-500">
                    {item.pros?.map((pro) => (
                        <li key={pro} className="flex gap-1.5">
                            <span className="text-emerald-500">+</span> {pro}
                        </li>
                    ))}
                    {item.cons?.map((con) => (
                        <li key={con} className="flex gap-1.5">
                            <span className="text-rose-400">–</span> {con}
                        </li>
                    ))}
                </ul>
            ) : null}

            <div className="mt-auto flex flex-col gap-2">
                {item.in_house_match_url ? (
                    <a
                        href={item.in_house_match_url}
                        className="text-center text-[11.5px] font-bold text-secondary-dark underline underline-offset-2"
                    >
                        We carry a similar product
                    </a>
                ) : null}
                <a
                    href={item.redirect_url || item.affiliate_url}
                    target="_blank"
                    rel="sponsored nofollow noopener"
                    className="rounded-[3px] bg-secondary py-3 text-center text-[13px] font-bold uppercase tracking-widest text-ink transition-colors hover:bg-secondary-dark"
                >
                    View on {retailerLabel}
                </a>
            </div>
        </div>
    );
}

export default function ComparisonTable({ data }: { data: ComparisonData }) {
    if (!data.items?.length) {
        return null;
    }

    return (
        <div className="mb-12 space-y-6">
            {data.disclosure_shown ? (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-[13px] leading-relaxed text-amber-800">
                    <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                    <p>
                        This post contains affiliate links. If you buy through one, PetPosture may earn a commission at
                        no extra cost to you — see our{' '}
                        <a href="/affiliate-disclosure" className="font-bold underline underline-offset-2">
                            affiliate disclosure
                        </a>
                        .
                    </p>
                </div>
            ) : null}

            {data.intro ? (
                <p className="text-[17px] leading-[1.8] text-primary">{data.intro}</p>
            ) : null}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {data.items.map((item) => (
                    <ComparisonCard key={item.id ?? item.product_name} item={item} />
                ))}
            </div>
        </div>
    );
}
