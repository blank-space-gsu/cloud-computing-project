import 'package:flutter/material.dart';

import '../../../core/models/app_role.dart';
import '../../../shared/widgets/feature_placeholder_page.dart';

class TeamsPage extends StatelessWidget {
  const TeamsPage({super.key, required this.role});

  final AppRole role;

  @override
  Widget build(BuildContext context) {
    if (role == AppRole.manager) {
      return const FeaturePlaceholderPage(
        eyebrow: 'Manager',
        title: 'Teams',
        summary:
            'Manager Teams on mobile should be a clean roster and join-access workspace, not a mini analytics dashboard.',
        heroIcon: Icons.groups_rounded,
        focusTags: ['Roster', 'Join access', 'Membership actions'],
        snapshots: [
          FeatureSnapshotData(
            label: 'Roster view',
            value: 'Calm hierarchy',
            caption: 'Team details should center on people and membership, not mini-metrics.',
            icon: Icons.group_work_rounded,
          ),
          FeatureSnapshotData(
            label: 'Join access',
            value: 'Code + link',
            caption: 'Employee and manager access stay clearly separated inside one touch-friendly block.',
            icon: Icons.key_rounded,
          ),
          FeatureSnapshotData(
            label: 'Member detail',
            value: 'Sheet-based',
            caption: 'Richer actions can open from compact member rows instead of dashboard-like cards.',
            icon: Icons.badge_rounded,
          ),
        ],
        sections: [
          FeatureSectionData(
            title: 'Backend contracts to wire',
            icon: Icons.cloud_outlined,
            items: [
              'GET /api/v1/teams and GET /api/v1/teams/:teamId for list and detail views.',
              'GET /api/v1/teams/:teamId/join-access and POST /api/v1/teams/:teamId/join-access/regenerate.',
              'PATCH /api/v1/teams/:teamId and membership add/remove endpoints.',
            ],
          ),
          FeatureSectionData(
            title: 'Mobile direction',
            icon: Icons.people_alt_rounded,
            items: [
              'Use team cards into detail screens with clean join-code and invite-link handling.',
              'Keep leadership and employee roster sections readable with large touch targets.',
              'Reserve member detail for sheets instead of dashboard-like modal stacks.',
            ],
          ),
        ],
        nextStep:
            'Module 2 should make Teams and Join Access the first live manager workflow in the mobile app.',
      );
    }

    return const FeaturePlaceholderPage(
      eyebrow: 'Employee',
      title: 'Teams',
      summary:
          'Employees need clear team membership context on mobile: current teams, teammates, and leave/rejoin behavior when work allows it.',
      heroIcon: Icons.groups_rounded,
      focusTags: ['Membership', 'Leave / rejoin', 'Clear roster context'],
      snapshots: [
        FeatureSnapshotData(
          label: 'Team view',
          value: 'Membership first',
          caption: 'Employees should understand where they belong before anything else.',
          icon: Icons.groups_2_rounded,
        ),
        FeatureSnapshotData(
          label: 'Leave guard',
          value: 'Clear guidance',
          caption: 'Open task blockers should read like help, not a raw API denial.',
          icon: Icons.gpp_maybe_rounded,
        ),
        FeatureSnapshotData(
          label: 'Rejoin path',
          value: 'Join Team',
          caption: 'Rejoining stays consistent with the main employee onboarding surface.',
          icon: Icons.login_rounded,
        ),
      ],
      sections: [
        FeatureSectionData(
          title: 'Backend contracts to wire',
          icon: Icons.cloud_outlined,
          items: [
            'GET /api/v1/teams for active memberships.',
            'GET /api/v1/teams/:teamId for roster detail.',
            'POST /api/v1/teams/:teamId/members/me/leave for guarded leave flow.',
          ],
        ),
        FeatureSectionData(
          title: 'Mobile direction',
          icon: Icons.group_rounded,
          items: [
            'Keep the list calm and membership-centric, with leave actions clearly separated from roster browsing.',
            'Treat open-task leave blocking as a clear inline explanation, not a cryptic failure.',
            'Rejoin should land naturally through Join Team using the same backend model.',
          ],
        ),
      ],
      nextStep:
          'Module 2 should wire the live employee team list, team detail, and leave guard states.',
    );
  }
}
