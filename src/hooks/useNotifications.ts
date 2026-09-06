import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchNotifications, fetchTasksForUser, markAllNotificationsRead, markNotificationRead } from '../lib/queries';
import type { Notification } from '../types/database';

export interface BellNotification {
  id: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
  virtual: boolean;
}

/**
 * Notifications shown in the header bell.
 *
 * Two sources are merged:
 * 1. Persisted `notifications` rows (see 005_agency_features.sql) — currently
 *    only task-assignment events, inserted by a Postgres trigger.
 * 2. "Due soon" notifications, computed client-side on every load from the
 *    current user's own tasks (due within 2 days, not DONE). There is no
 *    server/cron to run a scheduled job in this "$0 infra" app, so this is
 *    computed on-demand instead of stored — see the note in
 *    supabase/migrations/005_agency_features.sql. These are "dismissed"
 *    locally (session-only) when clicked; they are not persisted as read.
 */
export function useNotifications() {
  const { profile } = useAuth();
  const [persisted, setPersisted] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dueSoonTaskIds, setDueSoonTaskIds] = useState<Set<string>>(new Set());
  const [dismissedDueSoon, setDismissedDueSoon] = useState<Set<string>>(new Set());
  const [dueSoonTitles, setDueSoonTitles] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: notifs }, { data: tasks }] = await Promise.all([
      fetchNotifications(profile.id),
      fetchTasksForUser(profile.id),
    ]);
    setPersisted(notifs ?? []);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const soonCutoff = new Date(today);
    soonCutoff.setDate(soonCutoff.getDate() + 2);

    const ids = new Set<string>();
    const titles = new Map<string, string>();
    (tasks ?? []).forEach((t) => {
      if (!t.due_date || t.status === 'DONE') return;
      const due = new Date(t.due_date);
      if (due >= today && due <= soonCutoff) {
        ids.add(t.id);
        titles.set(t.id, t.title);
      }
    });
    setDueSoonTaskIds(ids);
    setDueSoonTitles(titles);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const notifications: BellNotification[] = useMemo(() => {
    const fromServer: BellNotification[] = persisted.map((n) => ({
      id: n.id,
      message: n.message,
      link: n.link,
      read: n.read,
      created_at: n.created_at,
      virtual: false,
    }));
    const fromDueSoon: BellNotification[] = Array.from(dueSoonTaskIds)
      .filter((taskId) => !dismissedDueSoon.has(taskId))
      .map((taskId) => ({
        id: `duesoon-${taskId}`,
        message: `La tarea "${dueSoonTitles.get(taskId)}" vence pronto`,
        link: '/app/today',
        read: false,
        created_at: new Date().toISOString(),
        virtual: true,
      }));
    return [...fromDueSoon, ...fromServer].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [persisted, dueSoonTaskIds, dueSoonTitles, dismissedDueSoon]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markRead(n: BellNotification) {
    if (n.virtual) {
      setDismissedDueSoon((prev) => new Set(prev).add(n.id.replace('duesoon-', '')));
      return;
    }
    if (!n.read) {
      await markNotificationRead(n.id);
      setPersisted((prev) => prev.map((p) => (p.id === n.id ? { ...p, read: true } : p)));
    }
  }

  async function markAllRead() {
    if (!profile) return;
    await markAllNotificationsRead(profile.id);
    setPersisted((prev) => prev.map((p) => ({ ...p, read: true })));
    setDismissedDueSoon(new Set(dueSoonTaskIds));
  }

  return { notifications, unreadCount, loading, markRead, markAllRead, refetch: load };
}
