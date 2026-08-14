/**
 * One place to check which Lucide icon a sidebar row uses, keyed by its exact
 * nav label (docs/planning/owner-console-rebuild-plan.md §0).
 */
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  CheckCircle2,
  CalendarClock,
  Users,
  Scissors,
  Clock,
  BarChart3,
  Sparkles,
  Bell,
  Mail,
  FileText,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export const NAV_ICONS: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Calendar,
  Appointments: ClipboardList,
  Approvals: CheckCircle2,
  'Availability Requests': CalendarClock,
  Customers: Users,
  Services: Scissors,
  Availability: Clock,
  Reports: BarChart3,
  'AI Assistant': Sparkles,
  Notifications: Bell,
  Email: Mail,
  Templates: FileText,
  Settings,
};
