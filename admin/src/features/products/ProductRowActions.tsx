import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ProductSummary } from './api';

export function ProductRowActions({ product, onDelete }: { product: ProductSummary; onDelete: (product: ProductSummary) => void }) {
  const { t } = useTranslation();
  return <div className="flex justify-end gap-2"><Link className="rounded-lg px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5" to={`/products/${product.id}`}>{t('common.edit', 'Edit')}</Link><button type="button" onClick={() => onDelete(product)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">{t('common.delete', 'Delete')}</button></div>;
}
