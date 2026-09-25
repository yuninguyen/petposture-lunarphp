import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { fetchActivityLogs, type ActivityLogEntry } from './api';

const SUBJECT_TYPES = [
  { value: 'all', labelKey: 'system_activity_logs.filter.subject_type_all', fallback: 'All Types' },
  { value: 'Product', labelKey: 'system_activity_logs.filter.subject_type_product', fallback: 'Product' },
  { value: 'Order', labelKey: 'system_activity_logs.filter.subject_type_order', fallback: 'Order' },
  { value: 'Post', labelKey: 'system_activity_logs.filter.subject_type_post', fallback: 'Post' },
  { value: 'User', labelKey: 'system_activity_logs.filter.subject_type_user', fallback: 'User' },
  { value: 'Role', labelKey: 'system_activity_logs.filter.subject_type_role', fallback: 'Role' },
  { value: 'Media', labelKey: 'system_activity_logs.filter.subject_type_media', fallback: 'Media' },
  { value: 'customer', labelKey: 'system_activity_logs.filter.subject_type_customer', fallback: 'Customer' },
  { value: 'product_type', labelKey: 'system_activity_logs.filter.subject_type_product_type', fallback: 'Product Type' },
  { value: 'collection_group', labelKey: 'system_activity_logs.filter.subject_type_collection_group', fallback: 'Collection Group' },
  { value: 'brand', labelKey: 'system_activity_logs.filter.subject_type_brand', fallback: 'Brand' },
];

function formatDate(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

function formatPropertyValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (Array.isArray(val)) return `${val.length} items`;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function getEventBadgeColor(event: string): string {
  switch (event.toLowerCase()) {
    case 'created':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'updated':
    case 'permissions_updated':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'deleted':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'refunded':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'returned':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function ActivityLogsPage() {
  const { t } = useTranslation();

  const [subjectType, setSubjectType] = useState<string>('all');
  const [actor, setActor] = useState<string>('');
  const [debouncedActor, setDebouncedActor] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedActor(actor.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [actor]);

  const { data: response, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['activity-logs', { subjectType, actor: debouncedActor, dateFrom, dateTo, page }],
    queryFn: () =>
      fetchActivityLogs({
        subject_type: subjectType === 'all' ? undefined : subjectType,
        actor: debouncedActor === '' ? undefined : debouncedActor,
        date_from: dateFrom.trim() === '' ? undefined : dateFrom.trim(),
        date_to: dateTo.trim() === '' ? undefined : dateTo.trim(),
        page,
        per_page: 20,
      }),
  });

  const logs = response?.data ?? [];
  const meta = response?.meta;
  const totalPages = meta?.last_page ?? 1;
  const currentPage = meta?.current_page ?? page;

  const toggleExpand = (id: number) => {
    setExpandedLogs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleResetFilters = () => {
    setSubjectType('all');
    setActor('');
    setDebouncedActor('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasActiveFilters =
    subjectType !== 'all' || actor !== '' || dateFrom !== '' || dateTo !== '';

  const renderCompactProperties = (entry: ActivityLogEntry) => {
    const props = entry.properties ?? {};
    const keys = Object.keys(props);

    if (keys.length === 0) {
      return <span className="text-slate-400">{t('system_activity_logs.no_properties', '—')}</span>;
    }

    // Check for before / after structure
    const hasBefore = 'before' in props && typeof props.before === 'object' && props.before !== null;
    const hasAfter = 'after' in props && typeof props.after === 'object' && props.after !== null;

    if (hasBefore || hasAfter) {
      const beforeObj = (props.before as Record<string, unknown>) ?? {};
      const afterObj = (props.after as Record<string, unknown>) ?? {};
      const diffKeys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]));

      if (diffKeys.length === 0) {
        return <span className="text-slate-400">{t('system_activity_logs.no_properties', '—')}</span>;
      }

      return (
        <div className="flex flex-wrap gap-1.5 max-w-md">
          {diffKeys.map((key) => {
            const beforeVal = formatPropertyValue(beforeObj[key]);
            const afterVal = formatPropertyValue(afterObj[key]);
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
              >
                <span className="font-medium text-slate-900">{key}:</span>
                <span className="line-through text-slate-400">{beforeVal}</span>
                <span className="text-slate-400">→</span>
                <span className="font-semibold text-slate-800">{afterVal}</span>
              </span>
            );
          })}
        </div>
      );
    }

    // Flat key-value rendering
    return (
      <div className="flex flex-wrap gap-1.5 max-w-md">
        {keys.map((key) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
          >
            <span className="font-medium text-slate-900">{key}:</span>
            <span className="text-slate-800">{formatPropertyValue(props[key])}</span>
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t('system_activity_logs.title', 'Activity Logs')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {t(
            'system_activity_logs.subtitle',
            'Audit trail of administrator actions and system changes'
          )}
        </p>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
          {/* Subject Type Filter */}
          <div>
            <label
              htmlFor="filter-subject-type"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              {t('system_activity_logs.filter.subject_type', 'Subject Type')}
            </label>
            <select
              id="filter-subject-type"
              aria-label={t('system_activity_logs.filter.subject_type', 'Subject Type')}
              value={subjectType}
              onChange={(e) => {
                setSubjectType(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {SUBJECT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {t(type.labelKey, type.fallback)}
                </option>
              ))}
            </select>
          </div>

          {/* Actor Filter */}
          <div>
            <label
              htmlFor="filter-actor"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              {t('system_activity_logs.filter.actor', 'Actor')}
            </label>
            <input
              id="filter-actor"
              aria-label={t('system_activity_logs.filter.actor', 'Actor')}
              type="search"
              maxLength={255}
              placeholder={t('system_activity_logs.filter.actor_placeholder', 'Name or email')}
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Date From Filter */}
          <div>
            <label
              htmlFor="filter-date-from"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              {t('system_activity_logs.filter.date_from', 'From Date')}
            </label>
            <input
              id="filter-date-from"
              aria-label={t('system_activity_logs.filter.date_from', 'From Date')}
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Date To Filter */}
          <div>
            <label
              htmlFor="filter-date-to"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              {t('system_activity_logs.filter.date_to', 'To Date')}
            </label>
            <input
              id="filter-date-to"
              aria-label={t('system_activity_logs.filter.date_to', 'To Date')}
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Reset Filters */}
          <div>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={!hasActiveFilters}
              onClick={handleResetFilters}
            >
              {t('system_activity_logs.filter.clear', 'Clear Filters')}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div role="status" className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-sm text-slate-500">
              {t('system_activity_logs.loading', 'Loading activity logs...')}
            </span>
          </div>
        ) : isError ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-red-600">
              {t('system_activity_logs.error_loading', 'Failed to load activity logs. Please try again.')}
            </p>
            <p className="mt-1 text-xs text-slate-500">{(error as Error)?.message}</p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => refetch()}
              className="mt-4"
            >
              {t('common.retry', 'Retry')}
            </Button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-500">
              {t('system_activity_logs.empty', 'No activity logs found.')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3.5">
                    {t('system_activity_logs.column_actor', 'Actor')}
                  </th>
                  <th className="px-6 py-3.5">
                    {t('system_activity_logs.column_event', 'Action')}
                  </th>
                  <th className="px-6 py-3.5">
                    {t('system_activity_logs.column_subject', 'Subject')}
                  </th>
                  <th className="px-6 py-3.5">
                    {t('system_activity_logs.column_properties', 'Details')}
                  </th>
                  <th className="px-6 py-3.5 text-right">
                    {t('system_activity_logs.column_created_at', 'Timestamp')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((entry) => {
                  const hasNonEmptyProps =
                    entry.properties && Object.keys(entry.properties).length > 0;
                  const isExpanded = !!expandedLogs[entry.id];

                  return (
                    <React.Fragment key={entry.id}>
                      <tr className="hover:bg-slate-50/60 transition-colors">
                        {/* Actor */}
                        <td className="px-6 py-4 align-top">
                          {entry.actor ? (
                            <div>
                              <div className="font-medium text-slate-900">{entry.actor.name}</div>
                              <div className="text-xs text-slate-500">{entry.actor.email}</div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                              {t('system_activity_logs.system_actor', 'System')}
                            </span>
                          )}
                        </td>

                        {/* Event / Action */}
                        <td className="px-6 py-4 align-top">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getEventBadgeColor(
                              entry.event
                            )}`}
                          >
                            {t(`system_activity_logs.event.${entry.event}`, entry.event)}
                          </span>
                        </td>

                        {/* Subject */}
                        <td className="px-6 py-4 align-top">
                          {entry.subject_type ? (
                            <span className="font-mono text-xs font-medium text-slate-800">
                              {entry.subject_type}
                              {entry.subject_id !== null && entry.subject_id !== undefined
                                ? ` #${entry.subject_id}`
                                : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Properties */}
                        <td className="px-6 py-4 align-top">
                          <div className="space-y-1.5">
                            {renderCompactProperties(entry)}
                            {hasNonEmptyProps && (
                              <button
                                type="button"
                                onClick={() => toggleExpand(entry.id)}
                                className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                              >
                                {isExpanded
                                  ? t('system_activity_logs.hide_details', 'Hide')
                                  : t('system_activity_logs.view_details', 'Details')}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Timestamp */}
                        <td className="px-6 py-4 align-top text-right font-mono text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(entry.created_at)}
                        </td>
                      </tr>

                      {/* Expanded JSON details */}
                      {isExpanded && hasNonEmptyProps && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={5} className="px-6 py-3 border-t border-slate-100">
                            <pre className="text-xs font-mono text-slate-800 bg-slate-100 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-64">
                              {JSON.stringify(entry.properties, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {meta && totalPages > 1 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row">
            <div className="text-xs text-slate-500">
              {t('system_activity_logs.page_info', {
                current: currentPage,
                total: totalPages,
                defaultValue: `Page ${currentPage} of ${totalPages}`,
              })}{' '}
              <span className="text-slate-400">
                {t('system_activity_logs.total_items', {
                  count: meta.total,
                  defaultValue: `(${meta.total} items)`,
                })}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1 || isLoading}
              >
                {t('common.previous', 'Previous')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages || isLoading}
              >
                {t('common.next', 'Next')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
