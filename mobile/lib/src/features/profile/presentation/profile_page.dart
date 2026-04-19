import 'package:flutter/material.dart';

import '../../../core/models/app_user.dart';
import '../../../shared/widgets/feature_placeholder_page.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key, required this.user});

  final AppUser user;

  @override
  Widget build(BuildContext context) {
    return FeaturePlaceholderPage(
      eyebrow: user.role.label,
      title: 'Profile',
      summary:
          'Profile will stay quiet on mobile: account details, lightweight team context, and notification history without dashboard clutter.',
      heroIcon: Icons.person_rounded,
      focusTags: const [
        'Account details',
        'Lightweight context',
        'Notification archive',
      ],
      snapshots: const [
        FeatureSnapshotData(
          label: 'Identity',
          value: 'Editable basics',
          caption: 'Name, role, contact details, and the few account fields that matter on a phone.',
          icon: Icons.id_card_rounded,
        ),
        FeatureSnapshotData(
          label: 'Context',
          value: 'Quiet support',
          caption: 'Team and supervisor context should support the page, not dominate it.',
          icon: Icons.info_outline_rounded,
        ),
        FeatureSnapshotData(
          label: 'Notifications',
          value: 'Archive later',
          caption: 'The history view can stay present without turning profile into another dashboard.',
          icon: Icons.notifications_none_rounded,
        ),
      ],
      sections: [
        const FeatureSectionData(
          title: 'Backend contracts to wire',
          icon: Icons.cloud_outlined,
          items: [
            'GET /api/v1/auth/me for canonical user/session restore.',
            'GET and PATCH /api/v1/users/me for profile editing.',
            'GET /api/v1/notifications plus read/delete actions for the archive.',
          ],
        ),
        const FeatureSectionData(
          title: 'Mobile direction',
          icon: Icons.settings_suggest_rounded,
          items: [
            'Treat profile editing as a calm form with large fields and minimal copy.',
            'Keep notification history secondary but accessible inside the same screen.',
            'Manager and employee variants should share structure, not force separate page designs.',
          ],
        ),
      ],
      nextStep:
          'Module 1 should wire session restore and live profile data first, then add editing and notifications.',
      footer: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Theme.of(context).dividerColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Preview session',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            Text(user.fullName, style: Theme.of(context).textTheme.bodyLarge),
            const SizedBox(height: 4),
            Text(user.email, style: Theme.of(context).textTheme.bodyMedium),
            if (user.jobTitle != null) ...[
              const SizedBox(height: 4),
              Text(
                user.jobTitle!,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
