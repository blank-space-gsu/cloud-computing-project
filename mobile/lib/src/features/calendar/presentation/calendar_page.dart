import 'package:flutter/material.dart';

import '../../../shared/widgets/feature_placeholder_page.dart';

class CalendarPage extends StatelessWidget {
  const CalendarPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePlaceholderPage(
      eyebrow: 'Employee',
      title: 'Calendar',
      summary:
          'Calendar stays lightweight on mobile: due-dated assigned tasks across active teams, with a natural path back to task detail.',
      heroIcon: Icons.calendar_month_rounded,
      focusTags: ['Due dates', 'Team toggles', 'Mobile-first agenda'],
      snapshots: [
        FeatureSnapshotData(
          label: 'Calendar lens',
          value: 'Due work only',
          caption: 'The mobile calendar should answer what is due when, not become a full scheduler.',
          icon: Icons.event_available_rounded,
        ),
        FeatureSnapshotData(
          label: 'Team toggles',
          value: 'Simple filters',
          caption: 'Employees should be able to isolate one team or view all active work at a glance.',
          icon: Icons.filter_list_rounded,
        ),
        FeatureSnapshotData(
          label: 'Task jump',
          value: 'Sheet -> Tasks',
          caption: 'Calendar events should offer a clean path back to the task execution flow.',
          icon: Icons.open_in_new_rounded,
        ),
      ],
      sections: [
        FeatureSectionData(
          title: 'Backend contracts to wire',
          icon: Icons.cloud_outlined,
          items: [
            'GET /api/v1/tasks with date-range and team filters provides the calendar source.',
            'Only due-dated non-cancelled tasks need to surface for the MVP calendar.',
            'Team membership context from /api/v1/teams drives the toggle chips.',
          ],
        ),
        FeatureSectionData(
          title: 'Mobile direction',
          icon: Icons.calendar_view_week_rounded,
          items: [
            'Favor an agenda-style month or week presentation that reads cleanly on phones.',
            'Keep team toggles compact and easy to thumb with one hand.',
            'Task detail can open as a bottom sheet with a direct jump to My Tasks.',
          ],
        ),
      ],
      nextStep:
          'Module 4 should make Calendar the second employee workflow after live task execution is wired.',
    );
  }
}
