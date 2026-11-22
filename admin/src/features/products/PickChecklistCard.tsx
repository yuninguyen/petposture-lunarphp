import { useTranslation } from 'react-i18next';
import { useWatch, type Control } from 'react-hook-form';
import { ChecklistCard } from '@/components/ui/ChecklistCard';
import { useMerchantOptions } from '@/features/affiliate-networks/api';
import type { AttributeValue } from './api';
import { pickChecklist } from './pickChecklist';

// Shown on a Pick's edit page only. It reads what the form holds right now, so a field ticks as soon as it is filled.
export function PickChecklistCard({ control, handles }: { control: Control<any>; handles: string[] }) {
  const { t } = useTranslation();
  const media = (useWatch({ control, name: 'media' }) ?? []) as { alt: string }[];
  const brandId = (useWatch({ control, name: 'brand_id' }) ?? null) as number | null;
  const attributes = (useWatch({ control, name: 'attributes' }) ?? {}) as Record<string, AttributeValue | undefined>;
  const merchants = (useWatch({ control, name: 'merchants' }) ?? []) as Parameters<typeof pickChecklist>[0]['merchants'];
  const networkNames = Object.fromEntries((useMerchantOptions().data ?? []).map((network) => [network.id, network.name]));
  const items = pickChecklist({ media, brandId, attributes, handles, merchants, networkNames, today: new Date().toISOString().slice(0, 10) });

  return <ChecklistCard testId="pick-checklist" title={t('products.checklist.title')} hint={t('products.checklist.hint')} labelPrefix="products.checklist.items" items={items} />;
}
