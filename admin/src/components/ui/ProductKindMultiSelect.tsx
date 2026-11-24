import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchableMultiSelect } from './SearchableMultiSelect';

export type ProductForSelect = { id: number; name?: string; title?: string; pick?: unknown };

type KindFilter = 'all' | 'pick' | 'shop';

/** A product with a retailer link carries a `pick` block in the public product list; a shop product does not. */
export const kindOf = (product: ProductForSelect): 'pick' | 'shop' => (product.pick ? 'pick' : 'shop');

/**
 * The searchable product list of the Breed and Solution forms with a Kind filter (All / Picks / Shop) in front of it.
 * The filter only narrows what the list shows: products already ticked stay ticked when the filter changes.
 */
export function ProductKindMultiSelect({
  products,
  value,
  onChange,
  placeholder,
}: {
  products: ProductForSelect[];
  value: number[];
  onChange: (value: number[]) => void;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<KindFilter>('all');

  const counts = useMemo(
    () => ({
      all: products.length,
      pick: products.filter((product) => kindOf(product) === 'pick').length,
      shop: products.filter((product) => kindOf(product) === 'shop').length,
    }),
    [products],
  );
  const options = useMemo(
    () =>
      products
        .filter((product) => kind === 'all' || kindOf(product) === kind)
        .map((product) => ({ id: product.id, label: product.name || product.title || `#${product.id}` })),
    [products, kind],
  );
  const filters: { key: KindFilter; label: string }[] = [
    { key: 'all', label: t('product_picker.kind.all') },
    { key: 'pick', label: t('product_picker.kind.pick') },
    { key: 'shop', label: t('product_picker.kind.shop') },
  ];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5" role="group" aria-label={t('product_picker.kind.label')}>
        <span className="mr-1 text-xs font-medium text-slate-500">{t('product_picker.kind.label')}</span>
        {filters.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={kind === key}
            onClick={() => setKind(key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              kind === key ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>
      <SearchableMultiSelect options={options} value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}
