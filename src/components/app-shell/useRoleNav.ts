import {
  LayoutGrid,
  Calendar,
  BookOpen,
  CreditCard,
  Users,
  ClipboardList,
  Settings,
  Home,
  Wallet,
  Baby,
  MessageCircle,
  BarChart3,
  DoorOpen,
  Activity,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/auth-redirect";
import { t } from "@/lib/i18n";

export type NavItem = { to: string; label: string; icon: LucideIcon; exact?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

export function navForRole(role: AppRole): NavGroup[] {
  if (role === "admin") {
    return [
      {
        label: t("nav.group.studio"),
        items: [
          { to: "/admin", label: t("nav.overview"), icon: LayoutGrid, exact: true },
          { to: "/admin/pulse", label: t("nav.studioPulse"), icon: Activity },
          { to: "/admin/calendar", label: t("nav.schedule"), icon: Calendar },
          { to: "/admin/attendance", label: t("nav.attendance"), icon: ClipboardList },
          { to: "/admin/rooms", label: t("nav.rooms"), icon: DoorOpen },
        ],
      },
      {
        label: t("nav.group.people"),
        items: [
          { to: "/admin/members", label: t("nav.members"), icon: Users },
          { to: "/admin/kids", label: t("nav.kids"), icon: Baby },
          { to: "/admin/instructors", label: t("nav.instructors"), icon: Sparkles },
          { to: "/admin/programs", label: t("nav.programs"), icon: BookOpen },
          { to: "/admin/plans", label: t("nav.plans"), icon: CreditCard },
          { to: "/admin/payments", label: t("nav.payments"), icon: Wallet },
        ],
      },
      {
        label: t("nav.group.system"),
        items: [
          { to: "/admin/reports", label: t("nav.reports"), icon: BarChart3 },
          { to: "/admin/messages", label: t("nav.messages"), icon: MessageCircle },
          { to: "/admin/settings", label: t("nav.settings"), icon: Settings },
        ],
      },
    ];
  }

  if (role === "instructor") {
    return [
      {
        label: t("nav.group.instructor"),
        items: [{ to: "/instructor", label: t("nav.studioPulse"), icon: Home, exact: true }],
      },
    ];
  }

  // member
  return [
    {
      label: t("nav.group.studio"),
      items: [
        { to: "/member", label: t("nav.home"), icon: Home, exact: true },
        { to: "/member/schedule", label: t("nav.schedule"), icon: Calendar },
        { to: "/member/bookings", label: t("nav.myBookings"), icon: BookOpen },
        { to: "/member/packages", label: t("nav.plans"), icon: CreditCard },
        { to: "/member/account", label: t("nav.profile"), icon: Users },
      ],
    },
  ];
}

export function isActive(pathname: string, item: NavItem) {
  return item.exact
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(item.to + "/");
}

// Flat list for the mobile bottom bar (cap ~4)
export function bottomTabsForRole(role: AppRole): NavItem[] {
  if (role === "admin") {
    return [
      { to: "/admin", label: t("nav.overview"), icon: LayoutGrid, exact: true },
      { to: "/admin/pulse", label: t("nav.studioPulse"), icon: Activity },
      { to: "/admin/calendar", label: t("nav.schedule"), icon: Calendar },
      { to: "/admin/members", label: t("nav.members"), icon: Users },
    ];
  }
  if (role === "instructor") {
    return [{ to: "/instructor", label: t("nav.studioPulse"), icon: Home, exact: true }];
  }
  return [
    { to: "/member", label: t("nav.home"), icon: Home, exact: true },
    { to: "/member/schedule", label: t("nav.schedule"), icon: Calendar },
    { to: "/member/bookings", label: t("nav.myBookings"), icon: BookOpen },
    { to: "/member/packages", label: t("nav.plans"), icon: CreditCard },
    { to: "/member/account", label: t("nav.profile"), icon: Users },
  ];
}
