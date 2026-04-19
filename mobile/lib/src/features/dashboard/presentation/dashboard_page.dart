import 'package:flutter/material.dart';

import '../../../shared/widgets/feature_placeholder_page.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePlaceholderPage(
      eyebrow: 'Manager',
      title: 'Dashboard',
      summary:
          'A calm, attention-first landing screen for overdue work, blocked work, and the team members who need manager intervention next.',
      heroIcon: Icons.space_dashboard_rounded,
      focusTags: ['Attention surface', 'Low clutter', 'Manager-first'],
      snapshots: [
        FeatureSnapshotData(
          label: 'Primary lens',
          value: 'Attention now',
          caption: 'Overdue, blocked, and long-pending work rise to the top.',
          icon: Icons.priority_high_rounded,
        ),
        FeatureSnapshotData(
          label: 'Team context',
          value: 'Switcher-ready',
          caption: 'The shell is prepared for a quick team pivot on mobile.',
          icon: Icons.swap_horiz_rounded,
        ),
        FeatureSnapshotData(
          label: 'Hand-off path',
          value: 'Tracker + Tasks',
          caption: 'This page should launch a manager into action, not trap them in analytics.',
          icon: Icons.route_rounded,
        ),
      ],
      sections: [
        FeatureSectionData(
          title: 'Backend contracts to wire',
          icon: Icons.cloud_outlined,
          items: [
            'GET /api/v1/dashboards/manager for the attention summary and team health slices.',
            'GET /api/v1/tasks with urgency sorting for the mobile attention queue.',
            'GET /api/v1/teams and GET /api/v1/teams/:teamId/members for team switcher and people context.',
          ],
        ),
        FeatureSectionData(
          title: 'Mobile direction',
          icon: Icons.phone_iphone_rounded,
          items: [
            'Keep the first screen focused on what needs attention now, not a wall of analytics.',
            'Use vertically stacked cards with strong tap targets for task and person drill-down.',
            'Treat this as the manager launchpad into Worker Tracker and Tasks.',
          ],
        ),
      ],
      nextStep:
          'Module 1 should bind the real manager dashboard payload and turn this shell into a live attention feed.',
    );
  }
}
