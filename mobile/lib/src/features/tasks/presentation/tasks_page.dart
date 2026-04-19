import 'package:flutter/material.dart';

import '../../../core/models/app_role.dart';
import '../../../shared/widgets/feature_placeholder_page.dart';

class TasksPage extends StatelessWidget {
  const TasksPage({super.key, required this.role});

  final AppRole role;

  @override
  Widget build(BuildContext context) {
    if (role == AppRole.manager) {
      return const FeaturePlaceholderPage(
        eyebrow: 'Manager',
        title: 'Tasks',
        summary:
            'Manager task operations will stay compact on mobile: quick scanning, assignment, editing, and recurring setup without the desktop density.',
        heroIcon: Icons.checklist_rtl_rounded,
        focusTags: ['Assignment', 'Recurring rules', 'Compact cards'],
        snapshots: [
          FeatureSnapshotData(
            label: 'List rhythm',
            value: 'Compact cards',
            caption: 'Title, assignee, due date, status, and priority stay visible at first glance.',
            icon: Icons.view_agenda_rounded,
          ),
          FeatureSnapshotData(
            label: 'Manager action',
            value: 'Bottom sheets',
            caption: 'Create, edit, and reassign flows should feel thumb-friendly on a phone.',
            icon: Icons.edit_note_rounded,
          ),
          FeatureSnapshotData(
            label: 'Recurring work',
            value: 'Native forms',
            caption: 'Recurring rules will be shaped for touch instead of copied from web modals.',
            icon: Icons.repeat_rounded,
          ),
        ],
        sections: [
          FeatureSectionData(
            title: 'Backend contracts to wire',
            icon: Icons.cloud_outlined,
            items: [
              'GET /api/v1/tasks for filtered task lists.',
              'POST /api/v1/tasks and PATCH /api/v1/tasks/:taskId for create and edit flows.',
              'POST /api/v1/task-assignments plus recurring task endpoints for assignment and recurring setup.',
            ],
          ),
          FeatureSectionData(
            title: 'Mobile direction',
            icon: Icons.touch_app_rounded,
            items: [
              'Use a stacked list with fast filters and a bottom-sheet editor for create and edit.',
              'Keep assignee, due date, status, and priority visible at first glance.',
              'Let recurring rules feel native to touch instead of a cramped form clone of the web app.',
            ],
          ),
        ],
        nextStep:
            'Module 3 should wire the live task list, create/edit forms, and recurring rule flows for managers.',
      );
    }

    return const FeaturePlaceholderPage(
      eyebrow: 'Employee',
      title: 'My Tasks',
      summary:
          'Employee task work stays simple on mobile: see assigned work, update progress, add notes, and mark complete with minimal friction.',
      heroIcon: Icons.checklist_rounded,
      focusTags: ['Self-reporting', 'Priority-first', 'Touch-first'],
      snapshots: [
        FeatureSnapshotData(
          label: 'Daily view',
          value: 'Assigned first',
          caption: 'The task list should open directly on the work an employee owns right now.',
          icon: Icons.assignment_turned_in_rounded,
        ),
        FeatureSnapshotData(
          label: 'Primary action',
          value: 'Progress + notes',
          caption: 'Update flows stay lightweight so self-reporting feels easy, not admin-heavy.',
          icon: Icons.edit_rounded,
        ),
        FeatureSnapshotData(
          label: 'Completion',
          value: 'Clear finish state',
          caption: 'Done work should feel satisfying without hiding what changed.',
          icon: Icons.task_alt_rounded,
        ),
      ],
      sections: [
        FeatureSectionData(
          title: 'Backend contracts to wire',
          icon: Icons.cloud_outlined,
          items: [
            'GET /api/v1/tasks with employee filtering and completion states.',
            'PATCH /api/v1/tasks/:taskId for progress, notes, and completion updates.',
            'GET /api/v1/notifications later for lightweight task nudges.',
          ],
        ),
        FeatureSectionData(
          title: 'Mobile direction',
          icon: Icons.phone_android_rounded,
          items: [
            'Use segmented filters and grouped lists rather than table-like sorting controls.',
            'Make the primary actions obvious: update progress, add note, complete task.',
            'Treat task detail as a sheet, not a crowded full-screen form unless needed.',
          ],
        ),
      ],
      nextStep:
          'Module 3 should wire live employee task queries and the mobile progress/completion sheet.',
    );
  }
}
