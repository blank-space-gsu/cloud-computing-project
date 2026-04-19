import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/app_role.dart';
import '../../core/models/app_user.dart';
import '../../features/auth/application/auth_controller.dart';
import 'navigation_item.dart';
import 'tasktrail_tab_bar.dart';

class RoleShell extends StatelessWidget {
  const RoleShell({
    super.key,
    required this.user,
    required this.authController,
    required this.navigationShell,
    required this.items,
    this.child,
  });

  final AppUser user;
  final AuthController authController;
  final StatefulNavigationShell navigationShell;
  final List<NavigationItem> items;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final activeItem = items[navigationShell.currentIndex];
    final shellBody = child ?? navigationShell;

    return Scaffold(
      extendBody: true,
      backgroundColor: Colors.transparent,
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFFF4F7FE),
              Color(0xFFF6F8FC),
              Color(0xFFF2F5FA),
            ],
          ),
        ),
        child: Stack(
          children: [
            Positioned(
              top: -110,
              right: -30,
              child: _AmbientGlow(
                color: const Color(0xFF7BA7FF).withValues(alpha: 0.24),
              ),
            ),
            Positioned(
              top: 120,
              left: -70,
              child: _AmbientGlow(
                color: const Color(0xFFD7E5FF).withValues(alpha: 0.58),
              ),
            ),
            SafeArea(
              bottom: false,
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 12, 18, 12),
                    child: _ShellHeader(
                      user: user,
                      activeItem: activeItem,
                      onSignOut: authController.isBusy
                          ? null
                          : authController.signOut,
                    ),
                  ),
                  Expanded(child: shellBody),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: TaskTrailTabBar(
        items: items,
        selectedIndex: navigationShell.currentIndex,
        onTap: (index) {
          navigationShell.goBranch(
            index,
            initialLocation: index == navigationShell.currentIndex,
          );
        },
      ),
    );
  }
}

class _ShellHeader extends StatelessWidget {
  const _ShellHeader({
    required this.user,
    required this.activeItem,
    required this.onSignOut,
  });

  final AppUser user;
  final NavigationItem activeItem;
  final VoidCallback? onSignOut;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: Colors.white.withValues(alpha: 0.78)),
        boxShadow: [
          BoxShadow(
            color: colors.shadow.withValues(alpha: 0.06),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: colors.primaryContainer,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Icon(
              _roleIcon(user.role),
              color: colors.primary,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  activeItem.title,
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  user.role == AppRole.manager
                      ? 'Manager mobile preview'
                      : 'Employee mobile preview',
                  style: theme.textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          IconButton.filledTonal(
            tooltip: 'Sign out of preview session',
            onPressed: onSignOut,
            icon: const Icon(Icons.logout_rounded),
          ),
        ],
      ),
    );
  }

  IconData _roleIcon(AppRole role) {
    return role == AppRole.manager
        ? Icons.admin_panel_settings_rounded
        : Icons.verified_user_rounded;
  }
}

class _AmbientGlow extends StatelessWidget {
  const _AmbientGlow({
    required this.color,
  });

  final Color color;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: 220,
        height: 220,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [
              color,
              color.withValues(alpha: 0),
            ],
          ),
        ),
      ),
    );
  }
}
