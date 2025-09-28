import React, { useMemo } from 'react';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  channel: 'in_app' | 'email';
  read: boolean;
}

export interface NotificationsProps {
  notifications: NotificationItem[];
  onMarkRead?: (ids: string[]) => void;
  filter?: 'all' | 'unread' | 'in_app' | 'email';
}

export const Notifications: React.FC<NotificationsProps> = ({ notifications, onMarkRead, filter = 'all' }) => {
  const filtered = useMemo(() => {
    return notifications.filter((notification) => {
      if (filter === 'unread') {
        return !notification.read;
      }
      if (filter === 'in_app') {
        return notification.channel === 'in_app';
      }
      if (filter === 'email') {
        return notification.channel === 'email';
      }
      return true;
    });
  }, [notifications, filter]);

  return (
    <section className="notifications">
      <header className="notifications__header">
        <h3>Notifications</h3>
        {onMarkRead && filtered.some((notification) => !notification.read) && (
          <button
            type="button"
            onClick={() => onMarkRead(filtered.filter((notification) => !notification.read).map((item) => item.id))}
          >
            Mark all read
          </button>
        )}
      </header>
      <ul className="notifications__list">
        {filtered.map((notification) => (
          <li key={notification.id} className={notification.read ? 'notifications__item' : 'notifications__item notifications__item--unread'}>
            <div>
              <strong>{notification.title}</strong>
              <p>{notification.body}</p>
              <span className="notifications__timestamp">{timeAgo(notification.createdAt)}</span>
            </div>
            <span className={`notifications__channel notifications__channel--${notification.channel}`}>
              {notification.channel === 'in_app' ? 'In-app' : 'Email'}
            </span>
          </li>
        ))}
        {filtered.length === 0 && <li className="notifications__empty">No notifications.</li>}
      </ul>
    </section>
  );
};

function timeAgo(value: string): string {
  const delta = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(delta)) {
    return '';
  }
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
