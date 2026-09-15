import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bell, Check, UserPlus, ShoppingBag, Star, Inbox } from 'lucide-react';
import clsx from 'clsx';
import { fetchNotifications, markAsRead, markAllAsRead, type AdminNotification } from './api';

export function formatRelativeTime(
  isoString: string,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (Number.isNaN(diffSeconds) || diffSeconds < 60) {
      return t('system_notifications.just_now', { defaultValue: 'Just now' });
    }

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return t('system_notifications.minutes_ago', {
        count: diffMinutes,
        defaultValue: `${diffMinutes}m ago`,
      });
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return t('system_notifications.hours_ago', {
        count: diffHours,
        defaultValue: `${diffHours}h ago`,
      });
    }

    const diffDays = Math.floor(diffHours / 24);
    return t('system_notifications.days_ago', {
      count: diffDays,
      defaultValue: `${diffDays}d ago`,
    });
  } catch {
    return t('system_notifications.just_now', { defaultValue: 'Just now' });
  }
}

function renderNotificationIcon(type: string) {
  switch (type) {
    case 'new_customer':
      return (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
          <UserPlus className="w-4 h-4" />
        </div>
      );
    case 'order_placed':
      return (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
          <ShoppingBag className="w-4 h-4" />
        </div>
      );
    case 'new_review':
      return (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
          <Star className="w-4 h-4" />
        </div>
      );
    default:
      return (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200">
          <Bell className="w-4 h-4" />
        </div>
      );
  }
}

export function NotificationBell() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'notifications'],
    queryFn: () => fetchNotifications({ per_page: 20 }),
    refetchInterval: 30000,
  });

  const unreadCount = data?.meta?.unread_count ?? 0;
  const notifications = data?.data ?? [];

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });
    },
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleItemClick = (notification: AdminNotification) => {
    if (!notification.read_at) {
      markReadMutation.mutate(notification.id);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
        aria-label={t('system_notifications.bell_label', { defaultValue: 'Notifications' })}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell className="w-5 h-5" />

        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm"
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-label={t('system_notifications.title', { defaultValue: 'Notifications' })}
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-800">
                {t('system_notifications.title', { defaultValue: 'Notifications' })}
              </h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {markAllReadMutation.isPending
                  ? t('system_notifications.marking_all_read', { defaultValue: 'Marking...' })
                  : t('system_notifications.mark_all_read', { defaultValue: 'Mark all as read' })}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[22rem] overflow-y-auto divide-y divide-slate-100">
            {isLoading && (
              <div className="p-8 text-center text-sm text-slate-500">
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-primary mb-2" />
                <p>{t('common.loading', { defaultValue: 'Loading...' })}</p>
              </div>
            )}

            {isError && (
              <div className="p-6 text-center text-sm text-red-500">
                <p>{t('system_notifications.error_loading', { defaultValue: 'Failed to load notifications' })}</p>
              </div>
            )}

            {!isLoading && !isError && notifications.length === 0 && (
              <div className="p-8 text-center">
                <div className="w-10 h-10 mx-auto mb-2 text-slate-400 bg-slate-100 rounded-full flex items-center justify-center">
                  <Inbox className="w-5 h-5" />
                </div>
                <p className="text-sm text-slate-500 font-medium">
                  {t('system_notifications.empty', { defaultValue: 'No notifications yet' })}
                </p>
              </div>
            )}

            {!isLoading &&
              !isError &&
              notifications.map((item) => {
                const isUnread = !item.read_at;

                const content = (
                  <div className="flex items-start gap-3 w-full">
                    {renderNotificationIcon(item.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p
                          className={clsx(
                            'text-sm truncate',
                            isUnread ? 'font-semibold text-slate-900' : 'font-normal text-slate-700'
                          )}
                        >
                          {item.title}
                        </p>
                        <span className="text-[11px] text-slate-400 whitespace-nowrap flex-shrink-0">
                          {formatRelativeTime(item.created_at, t)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {item.body}
                      </p>
                    </div>
                    {isUnread && (
                      <div className="flex items-center gap-1 flex-shrink-0 self-center">
                        <button
                          type="button"
                          aria-label={t('system_notifications.mark_as_read', { defaultValue: 'Mark as read' })}
                          title={t('system_notifications.mark_as_read', { defaultValue: 'Mark as read' })}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            markReadMutation.mutate(item.id);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                      </div>
                    )}
                  </div>
                );

                if (item.url) {
                  return (
                    <a
                      key={item.id}
                      href={item.url}
                      onClick={() => handleItemClick(item)}
                      className={clsx(
                        'block p-3 text-left transition-colors cursor-pointer',
                        isUnread ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'bg-white hover:bg-slate-50'
                      )}
                    >
                      {content}
                    </a>
                  );
                }

                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleItemClick(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleItemClick(item);
                      }
                    }}
                    className={clsx(
                      'block p-3 text-left transition-colors cursor-pointer',
                      isUnread ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'bg-white hover:bg-slate-50'
                    )}
                  >
                    {content}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
