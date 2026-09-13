import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { SearchableMultiSelect } from '@/components/ui/SearchableMultiSelect';
import { useProductLookups, useProducts } from '@/features/products/api';
import {
  buildDiscountPayload,
  buildDiscountUpdatePayload,
  toIsoUtc,
  toLocalDateTimeValue,
  type Discount,
  type DiscountAppliesTo,
  type DiscountFormValues,
  useCreateDiscount,
  useDiscount,
  useUpdateDiscount,
} from './api';

function localNowMinute(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function createValues(): DiscountFormValues {
  return {
    name: '',
    handle: '',
    starts_at: localNowMinute(),
    ends_at: '',
    coupon: '',
    priority: '',
    stop: false,
    max_uses: '',
    max_uses_per_user: '',
    min_price_usd: '',
    fixed_value: false,
    percentage: '',
    fixed_value_usd: '',
    applies_to: 'all_products',
    collection_ids: [],
    product_ids: [],
  };
}

function valuesFromDiscount(discount: Discount): DiscountFormValues {
  return {
    name: discount.name,
    handle: discount.handle,
    starts_at: toLocalDateTimeValue(discount.starts_at),
    ends_at: discount.ends_at ? toLocalDateTimeValue(discount.ends_at) : '',
    coupon: discount.coupon ?? '',
    priority: discount.priority == null ? '' : String(discount.priority),
    stop: discount.stop,
    max_uses: discount.max_uses == null ? '' : String(discount.max_uses),
    max_uses_per_user: discount.max_uses_per_user == null ? '' : String(discount.max_uses_per_user),
    min_price_usd: discount.data.min_prices.USD == null ? '' : String(discount.data.min_prices.USD),
    fixed_value: discount.data.fixed_value ?? false,
    percentage: discount.data.percentage == null ? '' : String(discount.data.percentage),
    fixed_value_usd: discount.data.fixed_values?.USD == null ? '' : String(discount.data.fixed_values.USD),
    applies_to: discount.applies_to ?? 'all_products',
    collection_ids: discount.collection_ids ?? [],
    product_ids: discount.product_ids ?? [],
  };
}

function slug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function generateRandomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function fieldErrors(error: unknown): string[] {
  if (!error || typeof error !== 'object' || !('status' in error) || error.status !== 422 || !('data' in error)) return [];
  const data = error.data;
  if (!data || typeof data !== 'object' || !('errors' in data) || !data.errors || typeof data.errors !== 'object') return [];
  return Object.values(data.errors).flatMap((messages) => Array.isArray(messages) ? messages.filter((message): message is string => typeof message === 'string') : []);
}

export function DiscountFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const parsedEditId = id && /^[1-9]\d*$/.test(id) ? Number(id) : undefined;
  const editId = parsedEditId !== undefined && Number.isSafeInteger(parsedEditId) && parsedEditId > 0 ? parsedEditId : undefined;
  const invalidEditId = id !== undefined && editId === undefined;
  const detailQuery = useDiscount(editId);
  const createMutation = useCreateDiscount();
  const updateMutation = useUpdateDiscount();

  const [values, setValues] = useState<DiscountFormValues>(createValues);
  const [handleEdited, setHandleEdited] = useState(Boolean(editId));
  const [errors, setErrors] = useState<string[]>([]);
  const [discountType, setDiscountType] = useState('amount_off_products');
  const [hasEndDate, setHasEndDate] = useState(false);
  const [hasMaxUses, setHasMaxUses] = useState(false);
  const [hasMaxUsesPerUser, setHasMaxUsesPerUser] = useState(false);
  const [minReqType, setMinReqType] = useState<'none' | 'amount'>('none');

  const { collectionOptions: rawCollectionOptions } = useProductLookups();
  const productsQuery = useProducts({ per_page: 100 });

  const collectionOptions = useMemo(() => {
    const options = [...(rawCollectionOptions ?? [])];
    if (detailQuery.data?.collections) {
      for (const col of detailQuery.data.collections) {
        if (!options.some((o) => o.id === col.id)) {
          options.push({ id: col.id, label: col.name, slug: '' });
        }
      }
    }
    return options.map((o) => ({ id: o.id, label: o.label }));
  }, [rawCollectionOptions, detailQuery.data?.collections]);

  const productOptions = useMemo(() => {
    const items = (productsQuery.data?.data ?? []).map((p) => ({ id: p.id, label: p.name }));
    if (detailQuery.data?.products) {
      for (const prod of detailQuery.data.products) {
        if (!items.some((i) => i.id === prod.id)) {
          items.push({ id: prod.id, label: prod.name });
        }
      }
    }
    return items;
  }, [productsQuery.data?.data, detailQuery.data?.products]);

  useEffect(() => {
    if (editId && detailQuery.data?.supported) {
      const initial = valuesFromDiscount(detailQuery.data);
      setValues(initial);
      setHandleEdited(true);
      setHasEndDate(Boolean(detailQuery.data.ends_at));
      setHasMaxUses(detailQuery.data.max_uses != null && detailQuery.data.max_uses > 0);
      setHasMaxUsesPerUser(detailQuery.data.max_uses_per_user != null && detailQuery.data.max_uses_per_user > 0);
      setMinReqType(detailQuery.data.data?.min_prices?.USD != null && Number(detailQuery.data.data.min_prices.USD) > 0 ? 'amount' : 'none');
      setDiscountType(
        detailQuery.data.type_label === 'Amount off order' || detailQuery.data.applies_to === 'all_products'
          ? 'amount_off_order'
          : 'amount_off_products'
      );
    }
  }, [editId, detailQuery.data]);

  function update<K extends keyof DiscountFormValues>(key: K, value: DiscountFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === 'name' && !handleEdited) next.handle = slug(value as string);
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors: string[] = [];
    if (!values.name.trim()) validationErrors.push(t('discounts.name_required'));
    if (!values.handle.trim()) validationErrors.push(t('discounts.handle_required'));
    if (!values.coupon.trim()) validationErrors.push(t('discounts.coupon_required'));
    if (!values.starts_at.trim()) validationErrors.push(t('discounts.starts_at_required'));
    if (values.starts_at.trim() && !toIsoUtc(values.starts_at)) validationErrors.push(t('discounts.datetime_invalid'));
    if (values.ends_at.trim() && !toIsoUtc(values.ends_at)) validationErrors.push(t('discounts.datetime_invalid'));

    const numericValues = [
      values.priority,
      values.max_uses,
      values.max_uses_per_user,
      values.min_price_usd,
      values.fixed_value ? values.fixed_value_usd : values.percentage,
    ];
    for (const value of numericValues) {
      if (!value.trim()) continue;
      const number = Number(value);
      if (!Number.isFinite(number)) validationErrors.push(t('discounts.numeric_invalid'));
      else if (number < 0) validationErrors.push(t('discounts.numeric_non_negative'));
    }

    if (!values.fixed_value && Number(values.percentage) > 100) validationErrors.push(t('discounts.percentage_maximum'));
    if (values.max_uses.trim() && Number(values.max_uses) === 0) validationErrors.push(t('discounts.positive_use_limit'));
    if (values.max_uses_per_user.trim() && Number(values.max_uses_per_user) === 0) validationErrors.push(t('discounts.positive_use_limit'));
    if (!(values.fixed_value ? values.fixed_value_usd : values.percentage).trim()) validationErrors.push(t('discounts.amount_off_value_required'));
    if (values.ends_at && values.starts_at && toIsoUtc(values.ends_at) && toIsoUtc(values.starts_at) && new Date(values.ends_at) <= new Date(values.starts_at)) {
      validationErrors.push(t('discounts.end_after_start'));
    }

    if (discountType === 'amount_off_products') {
      if (values.applies_to === 'specific_collections' && values.collection_ids.length === 0) {
        validationErrors.push(t('discounts.collections_required'));
      }
      if (values.applies_to === 'specific_products' && values.product_ids.length === 0) {
        validationErrors.push(t('discounts.products_required'));
      }
    }

    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }

    const valuesToSubmit: DiscountFormValues = discountType === 'amount_off_order'
      ? { ...values, applies_to: 'all_products', collection_ids: [], product_ids: [] }
      : values;

    const payload = editId ? buildDiscountUpdatePayload(valuesToSubmit) : buildDiscountPayload(valuesToSubmit);
    if (!payload) {
      setErrors([t('discounts.datetime_invalid')]);
      return;
    }

    setErrors([]);
    const options = {
      onSuccess: () => {
        toast.success(t(editId ? 'discounts.update_success' : 'discounts.create_success'));
        navigate('/discounts');
      },
      onError: (error: Error) => {
        const messages = fieldErrors(error);
        if (messages.length) setErrors(messages);
        else toast.error(error.message || t('discounts.save_error'));
      },
    };
    if (editId) updateMutation.mutate({ id: editId, payload }, options);
    else createMutation.mutate(payload, options);
  }

  if (invalidEditId) return <PageState text={t('discounts.not_found')} error />;
  if (editId && detailQuery.isLoading) return <PageState text={t('discounts.loading')} />;
  if (editId && (detailQuery.isError || !detailQuery.data)) return <PageState text={detailQuery.isError && detailQuery.error instanceof Error ? detailQuery.error.message : t('discounts.not_found')} error />;
  if (editId && detailQuery.data && !detailQuery.data.supported) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('discounts.edit_title')}</h1>
        <p className="mt-4 text-sm text-slate-600">{t('discounts.unsupported_legacy')}</p>
        <p className="mt-2 text-sm text-slate-600">{detailQuery.data.name}</p>
      </div>
    );
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t(editId ? 'discounts.edit_title' : 'discounts.create_title')}
        </h1>
      </div>
      {errors.length > 0 && (
        <div role="alert" className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-600">
          <p>{t('discounts.field_validation_summary')}</p>
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type Section: selector on create, read-only on edit */}
        {!editId ? (
          <Section title={t('discounts.type')}>
            <div className="sm:col-span-2">
              <Field label={t('discounts.type')}>
                <select
                  id="discount-type-selector"
                  value={discountType}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    setDiscountType(nextType);
                    if (nextType === 'amount_off_order') {
                      update('applies_to', 'all_products');
                      update('collection_ids', []);
                      update('product_ids', []);
                    }
                  }}
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="amount_off_products">{t('discounts.type_amount_off_products')}</option>
                  <option value="amount_off_order">{t('discounts.type_amount_off_order')}</option>
                  <option value="buy_x_get_y" disabled>{t('discounts.type_buy_x_get_y')} (Coming soon)</option>
                  <option value="free_shipping" disabled>{t('discounts.type_free_shipping')} (Coming soon)</option>
                </select>
              </Field>
            </div>
          </Section>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">{t('discounts.type')}</span>
            <span className="inline-flex items-center rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800">
              {detailQuery.data?.type_label === 'Amount off order'
                ? t('discounts.type_amount_off_order')
                : detailQuery.data?.type_label === 'Amount off products'
                ? t('discounts.type_amount_off_products')
                : (detailQuery.data?.type_label ?? t('discounts.type_amount_off_products'))}
            </span>
          </div>
        )}

        <Section title={t('discounts.core')}>
          <Field label={t('discounts.name')}>
            <input
              id="discount-name"
              required
              value={values.name}
              onChange={(event) => update('name', event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('discounts.handle')}>
            <input
              id="discount-handle"
              required
              value={values.handle}
              onChange={(event) => {
                setHandleEdited(true);
                update('handle', event.target.value);
              }}
              className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label={t('discounts.coupon')}
              action={
                <button
                  type="button"
                  onClick={() => update('coupon', generateRandomCode())}
                  className="text-xs font-medium text-secondary hover:underline"
                >
                  {t('discounts.generate_random_code')}
                </button>
              }
            >
              <input
                id="discount-coupon"
                required
                value={values.coupon}
                onChange={(event) => update('coupon', event.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono uppercase"
              />
            </Field>
          </div>
        </Section>

        {/* Discount Value Section */}
        <Section title={t('discounts.type_configuration')}>
          <div className="sm:col-span-2 space-y-4">
            <Check
              id="discount-fixed-value"
              checked={values.fixed_value}
              onChange={(checked) => update('fixed_value', checked)}
              label={t('discounts.fixed_value')}
            />
            {values.fixed_value ? (
              <Field label={t('discounts.fixed_value_usd')}>
                <input
                  id="discount-fixed-value-usd"
                  min="0"
                  step="0.01"
                  type="number"
                  value={values.fixed_value_usd}
                  onChange={(event) => update('fixed_value_usd', event.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </Field>
            ) : (
              <Field label={t('discounts.percentage')}>
                <input
                  id="discount-percentage"
                  min="0"
                  max="100"
                  step="0.01"
                  type="number"
                  value={values.percentage}
                  onChange={(event) => update('percentage', event.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </Field>
            )}
          </div>
        </Section>

        {/* Applies to Section - only for Amount off products */}
        {discountType === 'amount_off_products' && (
          <Section title={t('discounts.applies_to')}>
            <div className="sm:col-span-2 space-y-4">
              <Field label={t('discounts.applies_to')}>
                <select
                  id="discount-applies-to"
                  value={values.applies_to}
                  onChange={(event) => update('applies_to', event.target.value as DiscountAppliesTo)}
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="all_products">{t('discounts.applies_to_all_products')}</option>
                  <option value="specific_collections">{t('discounts.applies_to_specific_collections')}</option>
                  <option value="specific_products">{t('discounts.applies_to_specific_products')}</option>
                </select>
              </Field>
              {values.applies_to === 'specific_collections' && (
                <div className="space-y-1">
                  <SearchableMultiSelect
                    options={collectionOptions}
                    value={values.collection_ids}
                    onChange={(ids) => update('collection_ids', ids)}
                    placeholder={t('discounts.search_collections')}
                    noResultsText={t('discounts.empty')}
                    clearAllText={t('discounts.cancel')}
                  />
                </div>
              )}
              {values.applies_to === 'specific_products' && (
                <div className="space-y-1">
                  <SearchableMultiSelect
                    options={productOptions}
                    value={values.product_ids}
                    onChange={(ids) => update('product_ids', ids)}
                    placeholder={t('discounts.search_products')}
                    noResultsText={t('discounts.empty')}
                    clearAllText={t('discounts.cancel')}
                  />
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Minimum Purchase Requirements */}
        <Section title={t('discounts.minimum_requirements')}>
          <div className="sm:col-span-2 space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="min_requirement"
                id="discount-min-req-none"
                checked={minReqType === 'none'}
                onChange={() => {
                  setMinReqType('none');
                  update('min_price_usd', '');
                }}
                className="text-primary focus:ring-primary"
              />
              {t('discounts.min_requirement_none')}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="min_requirement"
                id="discount-min-req-amount"
                checked={minReqType === 'amount'}
                onChange={() => setMinReqType('amount')}
                className="text-primary focus:ring-primary"
              />
              {t('discounts.min_requirement_amount')}
            </label>
            {minReqType === 'amount' && (
              <div className="pt-2 max-w-xs">
                <Field label={t('discounts.min_price_usd')}>
                  <input
                    id="discount-min-price-usd"
                    min="0"
                    step="0.01"
                    type="number"
                    value={values.min_price_usd}
                    onChange={(event) => update('min_price_usd', event.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </Field>
              </div>
            )}
          </div>
        </Section>

        {/* Maximum Discount Uses */}
        <Section title={t('discounts.usage_limits')}>
          <div className="sm:col-span-2 space-y-4">
            <Check
              id="discount-has-max-uses"
              checked={hasMaxUses}
              onChange={(checked) => {
                setHasMaxUses(checked);
                if (!checked) update('max_uses', '');
              }}
              label={t('discounts.limit_total_uses')}
            />
            {hasMaxUses && (
              <div className="pl-6 max-w-xs">
                <Field label={t('discounts.max_uses')}>
                  <input
                    id="discount-max-uses"
                    min="1"
                    type="number"
                    value={values.max_uses}
                    onChange={(event) => update('max_uses', event.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </Field>
              </div>
            )}
            <Check
              id="discount-has-max-uses-per-user"
              checked={hasMaxUsesPerUser}
              onChange={(checked) => {
                setHasMaxUsesPerUser(checked);
                if (!checked) update('max_uses_per_user', '');
              }}
              label={t('discounts.limit_per_user')}
            />
            {hasMaxUsesPerUser && (
              <div className="pl-6 max-w-xs">
                <Field label={t('discounts.max_uses_per_user')}>
                  <input
                    id="discount-max-uses-per-user"
                    min="1"
                    type="number"
                    value={values.max_uses_per_user}
                    onChange={(event) => update('max_uses_per_user', event.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </Field>
              </div>
            )}
          </div>
        </Section>

        {/* Active Dates */}
        <Section title={t('discounts.active_dates')}>
          <Field label={t('discounts.starts')}>
            <input
              id="discount-starts-at"
              required
              type="datetime-local"
              value={values.starts_at}
              onChange={(event) => update('starts_at', event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </Field>
          <div className="sm:col-span-2 space-y-2">
            <Check
              id="discount-has-end-date"
              checked={hasEndDate}
              onChange={(checked) => {
                setHasEndDate(checked);
                if (!checked) update('ends_at', '');
              }}
              label={t('discounts.set_end_date')}
            />
            {hasEndDate && (
              <div className="max-w-xs">
                <Field label={t('discounts.ends')}>
                  <input
                    id="discount-ends-at"
                    type="datetime-local"
                    value={values.ends_at}
                    onChange={(event) => update('ends_at', event.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </Field>
              </div>
            )}
          </div>
        </Section>

        {/* Combinations / Advanced Settings */}
        <Section title={t('discounts.conditions')}>
          <Field label={t('discounts.priority')}>
            <input
              id="discount-priority"
              type="number"
              value={values.priority}
              onChange={(event) => update('priority', event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </Field>
          <div className="flex items-center">
            <Check
              id="discount-stop"
              checked={values.stop}
              onChange={(checked) => update('stop', checked)}
              label={t('discounts.stop')}
            />
          </div>
        </Section>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/discounts')}>
            {t('discounts.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {t(saving ? 'discounts.saving' : 'discounts.save')}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      <span className="flex items-center justify-between">
        {label}
        {action}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function Check({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="rounded border-slate-300 text-primary focus:ring-primary"
      />
      {label}
    </label>
  );
}

function PageState({ text, error = false }: { text: string; error?: boolean }) {
  return <p className={`py-8 text-center text-sm ${error ? 'text-red-600' : 'text-slate-500'}`}>{text}</p>;
}
