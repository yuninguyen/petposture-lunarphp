import { useTranslation } from 'react-i18next';
import { useFieldArray, useWatch, type Control, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useMerchantOptions, type MerchantOption } from '@/features/affiliate-networks/api';
import type { ProductFormValues } from './ProductSchema';

export const MAX_OTHER_MERCHANTS = 10;

const field = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm';

function Logo({ network }: { network: MerchantOption | null | undefined }) {
  if (!network?.logo) return <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-200 text-[10px] text-slate-400">—</span>;

  return <img src={network.logo} alt="" className="h-10 w-16 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-1" />;
}

function Message({ text }: { text?: unknown }) {
  return typeof text === 'string' && text !== '' ? <p className="mt-1 text-xs text-red-600">{text}</p> : null;
}

// The stores a Pick is sold at, as one list. The first row is the main store (its values are the product's own
// attributes, which creating a Pick, the import and a variant's link all rely on); the rows after it are `merchants`.
// A store is chosen from the Affiliate Networks, so its name, logo and click counting always match.
export function PickMerchantsEditor({ control, register, setValue, errors }: { control: Control<any>; register: UseFormRegister<any>; setValue: UseFormSetValue<any>; errors: any }) {
  const { t } = useTranslation();
  const options = useMerchantOptions();
  const networks = options.data ?? [];
  const { fields, append, remove, move } = useFieldArray({ control, name: 'merchants' });
  const attributes = (useWatch({ control, name: 'attributes' }) ?? {}) as Record<string, unknown>;
  const rows = (useWatch({ control, name: 'merchants' }) ?? []) as ProductFormValues['merchants'];
  const primarySlug = String(attributes.affiliate_network_slug ?? '').trim();
  const primary = networks.find((network) => network.slug === primarySlug) ?? null;
  const taken = new Set<number>([...(primary ? [primary.id] : []), ...rows.flatMap((row) => (row.affiliate_network_id === null ? [] : [row.affiliate_network_id]))]);

  return (
    <Card className="space-y-5 p-6" data-testid="pick-merchants">
      <div>
        <h2 className="text-lg font-semibold">{t('products.merchants.title')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('products.merchants.help')}</p>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 p-4" data-testid="merchant-main">
        <div className="flex items-center justify-between">
          <span className="rounded-[3px] bg-secondary-light px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-rust">{t('products.merchants.main')}</span>
        </div>
        <div className="flex items-end gap-3">
          <Logo network={primary} />
          <label className="block flex-1">
            <span className="mb-1 block text-sm font-medium text-slate-700">{t('products.merchants.merchant')}</span>
            <select value={primarySlug} onChange={(event) => setValue('attributes.affiliate_network_slug', event.target.value, { shouldDirty: true })} className={field} aria-label={t('products.merchants.merchant')}>
              <option value="">{t('products.merchants.choose')}</option>
              {primarySlug !== '' && !primary && <option value={primarySlug}>{t('products.merchants.unknown', { slug: primarySlug })}</option>}
              {networks.map((network) => <option key={network.id} value={network.slug} disabled={network.slug !== primarySlug && taken.has(network.id)}>{network.name}</option>)}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">{t('products.merchants.url')} <span className="text-red-500">*</span></span>
          <input {...register('attributes.external_url')} type="url" placeholder="https://" className={field} />
          <Message text={errors?.attributes?.external_url?.message} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">{t('products.merchants.price')}</span>
            <input {...register('attributes.reference_price')} inputMode="decimal" placeholder="49.96" className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">{t('products.merchants.checked')}</span>
            <input {...register('attributes.price_checked_date')} type="date" className={field} />
          </label>
        </div>
        <p className="text-xs text-slate-500">{t('products.merchants.price_help')}</p>
      </div>

      {fields.map((item, index) => {
        const row = rows[index];
        const network = networks.find((candidate) => candidate.id === row?.affiliate_network_id);
        const rowErrors = errors?.merchants?.[index];

        return (
          <div key={item.id} className="space-y-4 rounded-xl border border-slate-200 p-4" data-testid="merchant-extra">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-700">{t('products.merchants.other', { number: index + 2 })}</span>
              <div className="flex gap-1">
                <Button type="button" variant="secondary" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={t('products.merchants.move_up')}>↑</Button>
                <Button type="button" variant="secondary" disabled={index === fields.length - 1} onClick={() => move(index, index + 1)} aria-label={t('products.merchants.move_down')}>↓</Button>
                <Button type="button" variant="danger" onClick={() => remove(index)} aria-label={t('products.merchants.remove')}>{t('products.merchants.remove')}</Button>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <Logo network={network} />
              <label className="block flex-1">
                <span className="mb-1 block text-sm font-medium text-slate-700">{t('products.merchants.merchant')}</span>
                <select
                  value={row?.affiliate_network_id ?? ''}
                  onChange={(event) => setValue(`merchants.${index}.affiliate_network_id`, event.target.value === '' ? null : Number(event.target.value), { shouldDirty: true })}
                  className={field}
                  aria-label={t('products.merchants.merchant')}
                >
                  <option value="">{t('products.merchants.choose')}</option>
                  {networks.map((candidate) => <option key={candidate.id} value={candidate.id} disabled={candidate.id !== row?.affiliate_network_id && taken.has(candidate.id)}>{candidate.name}</option>)}
                </select>
                <Message text={rowErrors?.affiliate_network_id?.message} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">{t('products.merchants.url')} <span className="text-red-500">*</span></span>
              <input {...register(`merchants.${index}.url`)} type="url" placeholder="https://" className={field} />
              <Message text={rowErrors?.url?.message} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">{t('products.merchants.price')}</span>
                <input {...register(`merchants.${index}.price`)} inputMode="decimal" placeholder="40.99" className={field} />
                <Message text={rowErrors?.price?.message} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">{t('products.merchants.checked')}</span>
                <input {...register(`merchants.${index}.price_checked_date`)} type="date" className={field} />
                <Message text={rowErrors?.price_checked_date?.message} />
              </label>
            </div>
          </div>
        );
      })}

      {options.isError && <p className="text-sm text-red-600">{t('products.merchants.load_failed')}</p>}
      <Button type="button" variant="secondary" disabled={fields.length >= MAX_OTHER_MERCHANTS} onClick={() => append({ id: null, affiliate_network_id: null, url: '', price: '', price_checked_date: '' })}>
        + {t('products.merchants.add')}
      </Button>
    </Card>
  );
}
