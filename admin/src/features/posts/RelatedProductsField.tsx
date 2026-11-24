import { useTranslation } from 'react-i18next';
import { SearchableMultiSelect } from '@/components/ui/SearchableMultiSelect';
import type { PickOption } from './postsApi';

/** "Brand — Name · $25.99": what the list shows and what the search box matches against. */
export function pickOptionLabel(option: PickOption): string {
  const brand = option.brand ? `${option.brand} — ` : '';
  const price = option.reference_price === null ? '' : ` · $${option.reference_price.toFixed(2)}`;

  return `${brand}${option.name}${price}`;
}

/**
 * "Related Products" of a post: the Published Picks it mentions, chosen with the same searchable list the Breed and
 * Solution pages use. The chosen ones also show as chips with their photo and a remove button. A link to a Pick that
 * is no longer published stays in the value (the list cannot show it) and appears as a chip so it can be removed.
 */
export function RelatedProductsField({
  options,
  value,
  onChange,
  ready = true,
}: {
  options: PickOption[];
  value: number[];
  onChange: (value: number[]) => void;
  /** False while the list of picks is still loading: a chosen pick is not called "not published" before it is known. */
  ready?: boolean;
}) {
  const { t } = useTranslation();
  const chosen = value
    .map((id) => ({ id, option: options.find((option) => option.id === id) }))
    .filter(({ option }) => ready || option);

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.related_products.label')}</label>
      <p className="mb-2 text-xs leading-5 text-slate-500">{t('posts.related_products.hint')}</p>
      <SearchableMultiSelect
        options={options.map((option) => ({ id: option.id, label: pickOptionLabel(option) }))}
        value={value}
        onChange={onChange}
        placeholder={t('posts.related_products.search')}
        noResultsText={t('posts.related_products.none')}
        selectedCountText={(count) => t('posts.related_products.selected', { count })}
        clearAllText={t('posts.related_products.clear_all')}
      />
      {chosen.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chosen.map(({ id, option }) => (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 py-1 pl-1.5 pr-2.5 text-xs text-ink"
            >
              {option?.thumbnail && <img src={option.thumbnail} alt="" className="h-6 w-6 rounded-full object-cover" />}
              {option ? option.name : t('posts.related_products.unavailable', { id })}
              <button
                type="button"
                onClick={() => onChange(value.filter((selected) => selected !== id))}
                className="font-bold text-rust hover:text-red-600"
                aria-label={t('posts.related_products.remove', { name: option?.name ?? `#${id}` })}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
