import type { LucideIcon } from 'lucide-react';
import { routes } from '@/lib/routes';
import { NAV_ICONS } from '@/lib/icons';

export interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Rendered as a count beside the label; omitted when zero. */
  badge?: number;
  /**
   * Extra paths that also count as "active" for this entry, for a single nav
   * item that fronts more than one route — Calendar also owns Appointment
   * type (`CalendarCapacityTabs`'s in-page switcher). Availability
   * (`weeklyDefault`) is deliberately NOT included here even though it's
   * also reachable from that switcher — it has its own direct nav row under
   * Salon, and including it here would double-highlight the sidebar.
   */
  activePaths?: string[];
  /**
   * For entries that deep-link into Inbox's `?tab=` param (Approvals,
   * Availability Requests) rather than owning a distinct route.
   */
  matchTab?: 'approvals' | 'requests';
}

export interface NavGroup {
  label: string;
  items: NavEntry[];
}

export interface DashboardNavBadges {
  approvals?: number;
  requests?: number;
  notifications?: number;
}

/** Mirrors `NavLink`'s own non-`end` matching: exact, or a path segment below. */
export function isEntryActive(
  entry: NavEntry,
  pathname: string,
  search: string,
): boolean {
  if (entry.matchTab) {
    return (
      pathname === routes.owner.inbox &&
      new URLSearchParams(search).get('tab') === entry.matchTab
    );
  }
  if (entry.activePaths) return entry.activePaths.includes(pathname);
  if (entry.to === routes.owner.dashboard) return pathname === entry.to;
  return pathname === entry.to || pathname.startsWith(`${entry.to}/`);
}

/** Grouped Owner Console nav (docs/planning/owner-console-rebuild-plan.md §0). */
export function buildNavGroups(badges?: DashboardNavBadges): NavGroup[] {
  return [
    {
      label: 'Workspace',
      items: [
        { to: routes.owner.dashboard, label: 'Dashboard', icon: NAV_ICONS.Dashboard },
        {
          to: routes.owner.calendar,
          label: 'Calendar',
          icon: NAV_ICONS.Calendar,
          activePaths: [routes.owner.calendar, routes.owner.appointmentType],
        },
        {
          to: routes.owner.appointments,
          label: 'Appointments',
          icon: NAV_ICONS.Appointments,
        },
        {
          to: routes.owner.dailyClose,
          label: 'Daily Close',
          icon: NAV_ICONS['Daily Close'],
        },
      ],
    },
    {
      label: 'Bookings',
      items: [
        {
          to: `${routes.owner.inbox}?tab=approvals`,
          label: 'Approvals',
          icon: NAV_ICONS.Approvals,
          matchTab: 'approvals',
          badge: badges?.approvals,
        },
        {
          to: `${routes.owner.inbox}?tab=requests`,
          label: 'Availability Requests',
          icon: NAV_ICONS['Availability Requests'],
          matchTab: 'requests',
          badge: badges?.requests,
        },
      ],
    },
    {
      label: 'Customers',
      items: [
        { to: routes.owner.customers, label: 'Customers', icon: NAV_ICONS.Customers },
      ],
    },
    {
      label: 'Salon',
      items: [
        { to: routes.owner.serviceMenu, label: 'Services', icon: NAV_ICONS.Services },
        {
          to: routes.owner.weeklyDefault,
          label: 'Availability',
          icon: NAV_ICONS.Availability,
        },
      ],
    },
    {
      label: 'Insights',
      items: [
        { to: routes.owner.reports, label: 'Reports', icon: NAV_ICONS.Reports },
        {
          to: routes.owner.assistant,
          label: 'AI Assistant',
          icon: NAV_ICONS['AI Assistant'],
        },
      ],
    },
    {
      label: 'Communications',
      items: [
        {
          to: routes.owner.notifications,
          label: 'Notifications',
          icon: NAV_ICONS.Notifications,
        },
        { to: routes.owner.email, label: 'Email', icon: NAV_ICONS.Email },
        { to: routes.owner.templates, label: 'Templates', icon: NAV_ICONS.Templates },
        { to: routes.owner.broadcasts, label: 'Broadcasts', icon: NAV_ICONS.Broadcasts },
      ],
    },
    {
      label: 'Account',
      items: [
        { to: routes.owner.settings, label: 'Settings', icon: NAV_ICONS.Settings },
        { to: routes.owner.audit, label: 'Audit Log', icon: NAV_ICONS.Audit },
        {
          to: routes.owner.systemHealth,
          label: 'System Health',
          icon: NAV_ICONS['System Health'],
        },
      ],
    },
  ];
}
