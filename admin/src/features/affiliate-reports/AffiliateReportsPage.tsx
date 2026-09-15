import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  MousePointerClick,
  BarChart3,
  Trophy,
  DollarSign,
  Info,
  Calendar,
  Layers,
  FileText,
} from 'lucide-react';
import { fetchAffiliateReports, type NetworkReportItem, type PostReportItem } from './api';

type RangeOption = '7' | '30' | '90' | 'all';

export function AffiliateReportsPage() {
  const { t } = useTranslation();
  const [range, setRange] = useState<RangeOption>('30');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'affiliate-reports', range],
    queryFn: () => fetchAffiliateReports(range),
  });

  const overview = data?.overview;
  const byNetwork = data?.by_network ?? [];
  const byPost = data?.by_post ?? [];

  const rangeOptions: { value: RangeOption; label: string }[] = [
    { value: '7', label: t('affiliate_reports.range_7', 'Last 7 days') },
    { value: '30', label: t('affiliate_reports.range_30', 'Last 30 days') },
    { value: '90', label: t('affiliate_reports.range_90', 'Last 90 days') },
    { value: 'all', label: t('affiliate_reports.range_all', 'All time') },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t('affiliate_reports.title', 'Affiliate Reports')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t(
              'affiliate_reports.subtitle',
              'Track outbound clicks, top converting networks, and synced revenue'
            )}
          </p>
        </div>

        {/* Range Selector */}
        <div className="inline-flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <Calendar className="w-4 h-4 text-slate-400 ml-2 mr-1 hidden sm:inline" />
          <div className="flex space-x-1">
            {rangeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRange(opt.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  range === opt.value
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-500 shadow-sm">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-slate-300 border-t-primary mb-2" />
          <p>{t('affiliate_reports.loading', 'Loading affiliate reports...')}</p>
        </div>
      )}

      {isError && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-red-500 shadow-sm">
          <p>{t('affiliate_reports.error_loading', 'Failed to load affiliate reports.')}</p>
        </div>
      )}

      {!isLoading && !isError && overview && (
        <>
          {/* 4 Overview Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Clicks 7d */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <MousePointerClick className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t('affiliate_reports.clicks_7d', 'Clicks (7 days)')}
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">
                  {overview.clicks_7d.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Clicks 30d */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <MousePointerClick className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t('affiliate_reports.clicks_30d', 'Clicks (30 days)')}
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">
                  {overview.clicks_30d.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Clicks All-time */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t('affiliate_reports.clicks_all', 'Clicks (all time)')}
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">
                  {overview.clicks_all_time.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Top Network 30d */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t('affiliate_reports.top_network', 'Top network (30 days)')}
                </p>
                <p className="text-lg font-bold text-slate-900 truncate mt-0.5">
                  {overview.top_network_30d?.name || t('affiliate_reports.no_top_network', '—')}
                </p>
                {overview.top_network_30d && (
                  <p className="text-xs text-emerald-600 font-medium">
                    {t('affiliate_reports.top_network_clicks', {
                      count: overview.top_network_30d.clicks,
                      defaultValue: `${overview.top_network_30d.clicks} clicks`,
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Synced Conversion & Commission Banner / Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {t('affiliate_reports.synced_conversions', 'Synced Conversions')} & {t('affiliate_reports.synced_commission', 'Synced Commission')}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t(
                    'affiliate_reports.synced_data_notice',
                    'Tracked clicks reflect live outbound user events. Conversions & commissions reflect data synced from affiliate network APIs.'
                  )}
                </p>

                <div className="mt-3">
                  {overview.has_synced_data ? (
                    <div className="flex flex-wrap gap-6 items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">
                          {t('affiliate_reports.synced_conversions', 'Synced Conversions')}:
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {overview.conversions_synced?.toLocaleString() ?? '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">
                          {t('affiliate_reports.synced_commission', 'Synced Commission')}:
                        </span>
                        <span className="text-sm font-bold text-emerald-600">
                          ${overview.commission_amount_synced?.toFixed(2) ?? '0.00'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                      <span>{t('affiliate_reports.no_synced_data', 'No synced conversion data for this period (API not configured or reports pending)')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tables Grid: Networks and Posts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Table 1: Clicks by Network */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                <Layers className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-800">
                  {t('affiliate_reports.networks_table_title', 'Clicks by Network')}
                </h3>
              </div>

              <div className="overflow-x-auto flex-1">
                {byNetwork.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    {t('affiliate_reports.no_network_data', 'No clicks recorded for any network in this period.')}
                  </div>
                ) : (
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50/60 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th scope="col" className="px-4 py-3">
                          {t('affiliate_reports.column_network', 'Network')}
                        </th>
                        <th scope="col" className="px-4 py-3 text-right">
                          {t('affiliate_reports.column_tracked_clicks', 'Tracked Clicks')}
                        </th>
                        <th scope="col" className="px-4 py-3 text-right">
                          {t('affiliate_reports.column_conversions', 'Conversions')}
                        </th>
                        <th scope="col" className="px-4 py-3 text-right">
                          {t('affiliate_reports.column_commission', 'Commission')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {byNetwork.map((item: NetworkReportItem) => (
                        <tr key={item.network_id ?? 'unknown'} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {item.network_name}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">
                            {item.clicks.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {item.synced_conversions !== null
                              ? item.synced_conversions.toLocaleString()
                              : t('affiliate_reports.not_available', '—')}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-600">
                            {item.synced_commission !== null
                              ? `$${item.synced_commission.toFixed(2)}`
                              : t('affiliate_reports.not_available', '—')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Table 2: Top Clicked Posts */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                <FileText className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-800">
                  {t('affiliate_reports.posts_table_title', 'Top Clicked Posts')}
                </h3>
              </div>

              <div className="overflow-x-auto flex-1">
                {byPost.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    {t('affiliate_reports.no_post_data', 'No clicks recorded for any post in this period.')}
                  </div>
                ) : (
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50/60 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th scope="col" className="px-4 py-3">
                          {t('affiliate_reports.column_post', 'Post Title')}
                        </th>
                        <th scope="col" className="px-4 py-3 text-right">
                          {t('affiliate_reports.column_tracked_clicks', 'Tracked Clicks')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {byPost.map((post: PostReportItem) => (
                        <tr key={post.post_id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3 font-medium text-slate-900 truncate max-w-xs">
                            {post.post_title}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">
                            {post.clicks.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
