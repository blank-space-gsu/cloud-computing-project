import 'package:flutter/material.dart';

import '../../../shared/widgets/feature_placeholder_page.dart';

class JoinTeamPage extends StatelessWidget {
  const JoinTeamPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePlaceholderPage(
      eyebrow: 'Employee',
      title: 'Join Team',
      summary:
          'Join Team will be the first-run recovery surface for employees with zero active teams and the everyday entry point for code or invite-link onboarding.',
      heroIcon: Icons.qr_code_2_rounded,
      focusTags: ['Zero-team default', 'Join code', 'Invite link'],
      snapshots: [
        FeatureSnapshotData(
          label: 'First-run route',
          value: 'Zero-team default',
          caption: 'Employees with no active teams should land here immediately after login.',
          icon: Icons.alt_route_rounded,
        ),
        FeatureSnapshotData(
          label: 'Join inputs',
          value: 'Code or link',
          caption: 'One calm screen should handle manual entry and invite-link deep links.',
          icon: Icons.confirmation_number_rounded,
        ),
        FeatureSnapshotData(
          label: 'Safety',
          value: 'Manager access blocked',
          caption: 'Role-mismatched access stays clearly denied without confusing the user.',
          icon: Icons.lock_person_rounded,
        ),
      ],
      sections: [
        FeatureSectionData(
          title: 'Backend contracts to wire',
          icon: Icons.cloud_outlined,
          items: [
            'POST /api/v1/team-join accepts exactly one of joinCode or inviteToken.',
            'GET /api/v1/auth/me remains the source of truth for active team memberships after join.',
            'Manager-only tokens must stay blocked cleanly in the mobile flow.',
          ],
        ),
        FeatureSectionData(
          title: 'Mobile direction',
          icon: Icons.waving_hand_rounded,
          items: [
            'Make code entry simple, camera-friendly later, and calm under failure states.',
            'Handle invite-link deep links through the same screen instead of splitting onboarding.',
            'Keep the copy reassuring for employees who sign in with no active teams yet.',
          ],
        ),
      ],
      nextStep:
          'Module 2 should wire deep-link-safe invite handling and zero-team routing into this screen.',
    );
  }
}
