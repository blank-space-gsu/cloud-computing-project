import { el, clearElement } from '../utils/dom.js';
import { dismissNotification, markNotificationRead, syncNotifications } from '../utils/notifications.js';
import { formatDateTime, formatTimeRemaining } from '../utils/format.js';

function notificationCopy(notification) {
  if (notification.type === 'task_due') {
    return notification.meta?.timeRemainingSeconds != null
      ? formatTimeRemaining(notification.meta.timeRemainingSeconds)
      : 'Task alert';
  }

  return formatDateTime(notification.createdAt);
}

function notificationLinkLabel(notification) {
  return notification.type === 'task_due' ? 'Open tasks' : 'Open teams';
}

function buildNotificationItem(notification, { onChange, archive = false }) {
  const item = el('details', {
    className: `notification-item${notification.readAt ? ' is-read' : ' is-unread'}`,
    onToggle: (event) => {
      if (event.currentTarget.open && !notification.readAt) {
        markNotificationRead(notification.id);
        onChange();
      }
    }
  },
    el('summary', { className: 'notification-item__summary' },
      el('div', { className: 'notification-item__copy' },
        el('strong', { className: 'notification-item__title' }, notification.title),
        el('span', { className: 'notification-item__meta' }, notificationCopy(notification))
      ),
      el('div', { className: 'notification-item__actions' },
        !archive && !notification.readAt ? el('span', { className: 'notification-item__status' }, 'Unread') : null,
        el('button', {
          className: 'notification-item__dismiss',
          type: 'button',
          title: 'Delete notification',
          onClick: (event) => {
            event.preventDefault();
            event.stopPropagation();
            dismissNotification(notification.id);
            onChange();
          }
        }, '×')
      )
    ),
    el('div', { className: 'notification-item__body' },
      el('p', {}, notification.body),
      el('div', { className: 'btn-group', style: 'margin-top:12px' },
        el('button', {
          className: 'btn btn-outline btn-sm',
          type: 'button',
          onClick: () => { window.location.hash = notification.link; }
        }, notificationLinkLabel(notification))
      )
    )
  );

  return item;
}

export function createNotificationBell() {
  const shell = el('div', { className: 'notification-shell' });
  const button = el('button', {
    className: 'notification-bell',
    type: 'button',
    title: 'Notifications'
  }, '🔔');
  const count = el('span', { className: 'notification-bell__count hidden' }, '0');
  const panel = el('div', { className: 'notification-popover hidden' });

  async function refresh() {
    const notifications = await syncNotifications();
    clearElement(panel);

    const unreadCount = notifications.active.filter((item) => !item.readAt).length;
    count.textContent = String(unreadCount);
    count.classList.toggle('hidden', unreadCount === 0);

    panel.appendChild(el('div', { className: 'notification-popover__header' },
      el('div', {},
        el('h3', {}, 'Notifications'),
        el('p', {}, 'Open a notification to mark it as read.')
      ),
      el('button', {
        className: 'btn btn-outline btn-sm',
        type: 'button',
        onClick: () => { window.location.hash = '#/profile?section=notifications'; panel.classList.add('hidden'); }
      }, 'Past notifications')
    ));

    if (!notifications.active.length) {
      panel.appendChild(el('div', { className: 'notification-popover__empty' },
        el('strong', {}, 'Nothing new'),
        el('span', {}, 'Due soon tasks and team updates will appear here.')
      ));
      return;
    }

    const list = el('div', { className: 'notification-list' },
      ...notifications.active.map((notification) => buildNotificationItem(notification, { onChange: refresh }))
    );

    panel.appendChild(list);
  }

  button.addEventListener('click', async () => {
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
      await refresh();
    }
  });

  shell.append(button, count, panel);
  refresh();
  return shell;
}

export async function buildNotificationArchiveSection({ open = false } = {}) {
  const notifications = await syncNotifications();

  return el('details', { className: 'dashboard-collapsible dashboard-section card', open, id: 'notifications-archive' },
    el('summary', { className: 'dashboard-collapsible__summary' },
      el('div', { className: 'dashboard-collapsible__copy' },
        el('h3', { className: 'section-title' }, 'Past notifications'),
        el('p', { className: 'section-subtitle' }, 'Read and dismissed alerts from your workspace activity.')
      ),
      el('span', { className: 'dashboard-collapsible__icon', 'aria-hidden': 'true' })
    ),
    el('div', { className: 'dashboard-collapsible__body' },
      notifications.past.length
        ? el('div', { className: 'notification-list notification-list--archive' },
            ...notifications.past.map((notification) => buildNotificationItem(notification, {
              onChange: () => { window.location.hash = '#/profile?section=notifications'; },
              archive: true
            }))
          )
        : el('div', { className: 'notification-popover__empty' },
            el('strong', {}, 'No past notifications'),
            el('span', {}, 'Anything you read or dismiss will show up here.')
          )
    )
  );
}
