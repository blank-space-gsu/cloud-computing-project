import 'package:flutter/material.dart';

import '../../../shared/widgets/feature_placeholder_page.dart';

class WorkerTrackerPage extends StatelessWidget {
  const WorkerTrackerPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePlaceholderPage(
      eyebrow: 'Manager',
      title: 'Worker Tracker',
      summary:
          'The core manager surface on mobile: drill from team to worker to task without the web dashboard weight.',
      heroIcon: Icons.multiline_chart_rounded,
      focusTags: [
        'Team -> worker -> task',
        'Mobile drilldown',
        'Assignment visibility',
      ],
      snapshots: [
        FeatureSnapshotData(
          label: 'Default view',
          value: 'Team first',
          caption: 'A manager should land on the most relevant team, then drill deeper.',
          icon: Icons.groups_rounded,
        ),
        FeatureSnapshotData(
          label: 'Worker view',
          value: 'Expandable',
          caption: 'Touch-first worker rows can reveal assignments without rebuilding the screen.',
          icon: Icons.person_search_rounded,
        ),
        FeatureSnapshotData(
          label: 'Unassigned',
          value: 'Always visible',
          caption: 'Unclaimed work stays easy to spot without chart-heavy treatment.',
          icon: Icons.assignment_late_rounded,
        ),
      ],
      sections: [
        FeatureSectionData(
          title: 'Backend contracts to wire',
          icon: Icons.cloud_outlined,
          items: [
            'GET /api/v1/worker-tracker?teamId=&memberUserId= for the hierarchical payload.',
            'POST /api/v1/task-assignments for quick assign/reassign flows from the drilldown.',
            'GET /api/v1/teams for sensible default-team selection and switcher data.',
          ],
        ),
        FeatureSectionData(
          title: 'Mobile direction',
          icon: Icons.auto_graph_rounded,
          items: [
            'Lean into accordion and sheet-based drilldown instead of dense cross-table layouts.',
            'Keep team summaries compact, then let worker cards expand into current task lists.',
            'Preserve the calm tone: meaningful status chips, not chart-heavy reporting.',
          ],
        ),
      ],
      nextStep:
          'Module 2 should make Worker Tracker the first fully live manager workflow after auth is wired.',
    );
  }
}
