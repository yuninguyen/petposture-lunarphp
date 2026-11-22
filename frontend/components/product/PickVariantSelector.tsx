'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { PickVariant, ProductPick } from '@/types/shop';
import { buttonClasses } from '@/components/ui/Button';
import { PICK_DISCLOSURE, PICK_DISCLOSURE_MANY, pickLowerPrice, pickPriceRows, pickVariantLine, type PickPriceRow } from '@/lib/pick';
import { PickAccordionSection } from './PickAccordionSection';

type Selection = { variants: PickVariant[]; selected: PickVariant | null; select: (id: number) => void };

const PickVariantContext = createContext<Selection>({ variants: [], selected: null, select: () => {} });

// A Pick with two or more variants lets the reader choose one; the buy box and the quick specs follow the
// choice. With one variant (or none listed) nothing here changes the page. The provider draws no markup of
// its own, so the page layout is the same either way.
export function PickVariantProvider({ variants = [], children }: { variants?: PickVariant[]; children: ReactNode }) {
    const [selectedId, setSelectedId] = useState<number | null>(variants[0]?.id ?? null);
    const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0] ?? null;

    return (
        <PickVariantContext.Provider value={{ variants, selected, select: setSelectedId }}>
            {children}
        </PickVariantContext.Provider>
    );
}

export function usePickVariant(): Selection {
    return useContext(PickVariantContext);
}

/** "Colour" when every variant differs by that one option, otherwise a general "Options". */
function selectorLabel(variants: PickVariant[]): string {
    const names = new Set(variants.flatMap((variant) => variant.options.map((option) => option.name ?? '')));

    return names.size === 1 && [...names][0] !== '' ? [...names][0] : 'Options';
}

/** The store's logo, or its name in text when it has none or the image does not load. */
function MerchantLogo({ row }: { row: PickPriceRow }) {
    const [failed, setFailed] = useState(false);

    if (!row.logo || failed) return <span className="text-base font-extrabold text-primary">{row.name}</span>;

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={row.logo.src}
            alt={row.name}
            width={row.logo.width ?? undefined}
            height={row.logo.height ?? undefined}
            onError={() => setFailed(true)}
            className="block h-[18px] w-auto max-w-full object-contain object-left min-[561px]:h-[22px]"
        />
    );
}

// The table has one shared set of four columns (the Buy column a fixed 104px, never "auto"), and the header and every row are
// subgrids of it, so Merchant / Price / Checked / Buy start at the same place in every row; the logo and the Buy button are
// inset 12px so the tinted row has room around them. The "Lower price" line is plain text hung under the price: it takes no
// part in centering the row, so the price, the date, the logo and the button stay on one line (the row's extra bottom padding
// holds it). Up to 560px the header goes and each row stacks: logo, price and button on the first line, the check date under
// them on the left and, on the cheaper row, the saving on the right, under the price and the button. Up to 400px the date does
// not fit beside the saving with room to spare (at 390px it has under 4px, and it wraps onto two or three lines below
// that), so it takes the whole second line and the saving goes to a third line of its own, still right-aligned to the edge
// of the button. From 401px the date has at least 14px to spare.
const TABLE_COLUMNS = 'grid-cols-[minmax(0,1.05fr)_minmax(0,0.72fr)_minmax(0,1.05fr)_104px]';
const ROW_BASE = 'col-span-full grid grid-cols-subgrid items-center gap-x-3 gap-y-1 px-[2px] pt-[14px] max-[560px]:grid-cols-[minmax(0,1fr)_auto_auto] max-[560px]:gap-x-[10px]';

/** `save` is set on the cheaper row only: it tints the row (6px below the one above) and carries the "Lower price" line. */
function PriceRow({ row, save }: { row: PickPriceRow; save?: string }) {
    return (
        <div role="row" className={`${ROW_BASE} ${save ? 'mt-[6px] bg-[#FDF2EA] pb-[30px] max-[560px]:pb-[14px]' : 'border-b border-[#eee7dc] pb-[14px]'}`}>
            <div role="cell" className="flex min-w-0 items-center pl-[12px] max-[560px]:col-start-1 max-[560px]:row-start-1">
                <MerchantLogo row={row} />
            </div>
            {/* On a phone this cell draws nothing of its own ("contents"), so the price and the saving line can sit in the
                grid of the row: the price on the first line, the saving on the second, right-aligned under the button. */}
            <div role="cell" className="relative min-w-0 max-[560px]:contents">
                <span className="block whitespace-nowrap text-[1.25rem] font-bold leading-[1.1] text-primary max-[560px]:col-start-2 max-[560px]:row-start-1 max-[560px]:justify-self-end">
                    {row.price}
                </span>
                {save && (
                    <span className="absolute left-0 top-[calc(100%+6px)] whitespace-nowrap text-[0.78rem] font-bold leading-[1.3] text-[#2e7d4f] max-[560px]:static max-[560px]:col-span-2 max-[560px]:col-start-2 max-[560px]:row-start-2 max-[560px]:mr-[12px] max-[560px]:justify-self-end max-[400px]:col-span-3 max-[400px]:col-start-1 max-[400px]:row-start-3">
                        Lower price · Save {save}
                    </span>
                )}
            </div>
            <div
                role="cell"
                className={`min-w-0 whitespace-nowrap text-[0.85rem] text-[#7a8894] max-[560px]:col-start-1 max-[560px]:row-start-2 max-[560px]:whitespace-normal max-[560px]:pl-[12px] max-[560px]:text-[0.78rem] ${save ? 'max-[560px]:col-span-1 max-[400px]:col-span-3' : 'max-[560px]:col-span-3'} ${row.checked ? '' : 'max-[560px]:hidden'}`}
            >
                {row.checked && <span className="hidden max-[560px]:inline">Checked </span>}
                {row.checked}
            </div>
            <div role="cell" className="min-w-0 max-[560px]:col-start-3 max-[560px]:row-start-1 max-[560px]:justify-self-end">
                <a
                    href={row.goUrl}
                    target="_blank"
                    rel="sponsored noopener"
                    aria-label={row.ariaLabel}
                    className={buttonClasses({ variant: 'primary', size: 'sm', className: 'w-[calc(100%-12px)] gap-[6px] max-[560px]:mr-[12px] max-[560px]:w-auto max-[560px]:min-w-[72px] max-[560px]:px-3' })}
                >
                    {row.buttonLabel}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                        <path d="M7 17L17 7M9 7h8v8" />
                    </svg>
                </a>
            </div>
        </div>
    );
}

// `today` (YYYY-MM-DD, UTC) comes from the server so the page and its hydration agree on which prices are recent.
export function PickBuyBox({ pick, today }: { pick: ProductPick; today?: string }) {
    const { variants, selected, select } = usePickVariant();
    const hasVariantChoice = variants.length > 1;
    const rows = pickPriceRows(pick, selected, hasVariantChoice);
    const lower = pickLowerPrice(rows, new Date(`${today ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`));
    const variantLine = hasVariantChoice ? null : pickVariantLine(pick);
    const label = selectorLabel(variants);

    return (
        <>
            {variants.length > 1 && (
                <fieldset className="mb-4">
                    <legend className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">
                        {label}: <span className="text-primary">{selected?.label}</span>
                    </legend>
                    <div className="flex flex-wrap gap-2">
                        {variants.map((variant) => {
                            const active = variant.id === selected?.id;

                            return (
                                <button
                                    key={variant.id}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => select(variant.id)}
                                    className={`min-h-[40px] rounded-[3px] border px-4 py-2 text-sm font-bold transition-colors ${
                                        active ? 'border-secondary bg-secondary-light text-rust' : 'border-zinc-200 text-primary hover:border-secondary'
                                    }`}
                                >
                                    {variant.label}
                                </button>
                            );
                        })}
                    </div>
                </fieldset>
            )}
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">Compare prices</p>
            {variantLine && <p className="mt-1 text-[0.85rem] text-[#7a8894]">{variantLine}</p>}
            {/* One row per store, the first store above the second. A store's price is its own, with the date it was
                checked; the second store's button goes through /go as well and does not follow the variant choice. */}
            <div role="table" aria-label="Compare prices" className={`mt-[14px] grid ${TABLE_COLUMNS} gap-x-3`}>
                {rows.some((row) => row.price) && (
                    <div role="row" className="col-span-full grid grid-cols-subgrid items-center gap-x-3 border-y border-[#eee7dc] px-[2px] py-2 text-[0.68rem] font-bold uppercase tracking-[0.11em] text-[#8b98a1] max-[560px]:hidden">
                        <span role="columnheader" className="pl-[12px]">Merchant</span>
                        <span role="columnheader">Price</span>
                        <span role="columnheader">Checked</span>
                        <span role="columnheader"><span className="sr-only">Buy</span></span>
                    </div>
                )}
                {rows.map((row) => (
                    <PriceRow key={row.key} row={row} save={lower[row.key]} />
                ))}
            </div>
            <p className="mt-[14px] text-xs leading-5 text-zinc-500">{rows.length > 1 ? PICK_DISCLOSURE_MANY : PICK_DISCLOSURE}</p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">No made-up star ratings: just pros and cons.</p>
        </>
    );
}

/** The quick specs, with the chosen variant's option values (Colour: Camo) taking the place of a same-named line. */
export function PickSpecs({
    specs,
    className,
    title = 'Quick specs',
    wide = false,
    accordion = false,
}: {
    specs: { label: string; value: string }[];
    className: string;
    title?: string;
    // Full-width use: the rows run in two columns from md up instead of one long, sparse list.
    wide?: boolean;
    // Below lg the title is a button that opens and closes the rows (closed to start with). It lives here because the
    // rows can be empty, and only this component knows, once a variant is chosen, whether there is anything to show.
    accordion?: boolean;
}) {
    const { selected } = usePickVariant();
    const fromVariant = (selected?.options ?? []).filter((option): option is { name: string; value: string } => Boolean(option.name));
    const variantLabels = new Set(fromVariant.map((option) => option.name.toLowerCase()));
    const merged = [
        ...fromVariant.map((option) => ({ label: option.name, value: option.value })),
        ...specs.filter((spec) => !variantLabels.has(spec.label.toLowerCase())),
    ];

    if (merged.length === 0) return null;

    const rows = (
        <dl className={`text-sm ${wide ? 'md:columns-2 md:gap-x-12' : 'divide-y divide-zinc-100'}`}>
            {merged.map((spec) => (
                <div key={spec.label} className={`flex justify-between gap-4 py-2.5 ${wide ? 'break-inside-avoid border-b border-zinc-100' : ''}`}>
                    <dt className="font-semibold text-primary">{spec.label}</dt>
                    <dd className="text-right text-zinc-600">{spec.value}</dd>
                </div>
            ))}
        </dl>
    );

    if (accordion) return <PickAccordionSection title={title} className={className}>{rows}</PickAccordionSection>;

    return (
        <div className={className}>
            <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">{title}</h3>
            {rows}
        </div>
    );
}
