import 'package:flutter/material.dart';

import '../../app/router/app_routes.dart';

class NavigationItem {
  const NavigationItem({
    required this.route,
    required this.label,
    required this.title,
    required this.icon,
    required this.selectedIcon,
  });

  final String route;
  final String label;
  final String title;
  final IconData icon;
  final IconData selectedIcon;
}

const managerNavigationItems = [
  NavigationItem(
    route: AppRoutes.managerDashboard,
    label: 'Dashboard',
    title: 'Dashboard',
    icon: Icons.space_dashboard_outlined,
    selectedIcon: Icons.space_dashboard_rounded,
  ),
  NavigationItem(
    route: AppRoutes.managerWorkerTracker,
    label: 'Tracker',
    title: 'Worker Tracker',
    icon: Icons.multiline_chart_outlined,
    selectedIcon: Icons.multiline_chart_rounded,
  ),
  NavigationItem(
    route: AppRoutes.managerTasks,
    label: 'Tasks',
    title: 'Tasks',
    icon: Icons.checklist_rtl_outlined,
    selectedIcon: Icons.checklist_rtl_rounded,
  ),
  NavigationItem(
    route: AppRoutes.managerTeams,
    label: 'Teams',
    title: 'Teams',
    icon: Icons.groups_outlined,
    selectedIcon: Icons.groups_rounded,
  ),
  NavigationItem(
    route: AppRoutes.managerProfile,
    label: 'Profile',
    title: 'Profile',
    icon: Icons.person_outline_rounded,
    selectedIcon: Icons.person_rounded,
  ),
];

const employeeNavigationItems = [
  NavigationItem(
    route: AppRoutes.employeeTasks,
    label: 'Tasks',
    title: 'My Tasks',
    icon: Icons.checklist_outlined,
    selectedIcon: Icons.checklist_rounded,
  ),
  NavigationItem(
    route: AppRoutes.employeeCalendar,
    label: 'Calendar',
    title: 'Calendar',
    icon: Icons.calendar_month_outlined,
    selectedIcon: Icons.calendar_month_rounded,
  ),
  NavigationItem(
    route: AppRoutes.employeeTeams,
    label: 'Teams',
    title: 'Teams',
    icon: Icons.groups_outlined,
    selectedIcon: Icons.groups_rounded,
  ),
  NavigationItem(
    route: AppRoutes.employeeJoin,
    label: 'Join',
    title: 'Join Team',
    icon: Icons.qr_code_2_outlined,
    selectedIcon: Icons.qr_code_2_rounded,
  ),
  NavigationItem(
    route: AppRoutes.employeeProfile,
    label: 'Profile',
    title: 'Profile',
    icon: Icons.person_outline_rounded,
    selectedIcon: Icons.person_rounded,
  ),
];
