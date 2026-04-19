import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/app_role.dart';
import '../../features/auth/application/auth_controller.dart';
import '../../features/auth/presentation/auth_gate_page.dart';
import '../../features/auth/presentation/splash_page.dart';
import '../../features/calendar/presentation/calendar_page.dart';
import '../../features/dashboard/presentation/dashboard_page.dart';
import '../../features/join/presentation/join_team_page.dart';
import '../../features/profile/presentation/profile_page.dart';
import '../../features/tasks/presentation/tasks_page.dart';
import '../../features/teams/presentation/teams_page.dart';
import '../../features/worker_tracker/presentation/worker_tracker_page.dart';
import '../../shared/navigation/navigation_item.dart';
import '../../shared/navigation/role_shell.dart';
import 'app_routes.dart';

class AppRouter {
  AppRouter._();

  static GoRouter create({
    required AuthController authController,
    required AuthGatePage authPage,
  }) {
    return GoRouter(
      initialLocation: AppRoutes.splash,
      refreshListenable: authController,
      redirect: (context, state) {
        final location = state.uri.path;

        if (authController.status == AuthStatus.loading) {
          return location == AppRoutes.splash ? null : AppRoutes.splash;
        }

        if (!authController.isAuthenticated) {
          return location == AppRoutes.auth ? null : AppRoutes.auth;
        }

        final user = authController.user!;
        final defaultRoute = user.defaultRoute;
        final isManagerPath = location.startsWith('/manager');
        final isEmployeePath = location.startsWith('/employee');

        if (location == AppRoutes.splash || location == AppRoutes.auth) {
          return defaultRoute;
        }

        if (user.role == AppRole.manager && isEmployeePath) {
          return defaultRoute;
        }

        if (user.role == AppRole.employee && isManagerPath) {
          return defaultRoute;
        }

        return null;
      },
      routes: [
        GoRoute(
          path: AppRoutes.splash,
          pageBuilder: (context, state) =>
              const NoTransitionPage(child: SplashPage()),
        ),
        GoRoute(
          path: AppRoutes.auth,
          pageBuilder: (context, state) => NoTransitionPage(child: authPage),
        ),
        StatefulShellRoute.indexedStack(
          builder: (context, state, navigationShell) {
            final user = authController.user!;
            return RoleShell(
              user: user,
              authController: authController,
              navigationShell: navigationShell,
              items: managerNavigationItems,
            );
          },
          branches: [
            _branch(
              path: AppRoutes.managerDashboard,
              child: const DashboardPage(),
            ),
            _branch(
              path: AppRoutes.managerWorkerTracker,
              child: const WorkerTrackerPage(),
            ),
            _branch(
              path: AppRoutes.managerTasks,
              child: const TasksPage(role: AppRole.manager),
            ),
            _branch(
              path: AppRoutes.managerTeams,
              child: const TeamsPage(role: AppRole.manager),
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: AppRoutes.managerProfile,
                  pageBuilder: (context, state) => NoTransitionPage(
                    child: ProfilePage(user: authController.user!),
                  ),
                ),
              ],
            ),
          ],
        ),
        StatefulShellRoute.indexedStack(
          builder: (context, state, navigationShell) {
            final user = authController.user!;
            return RoleShell(
              user: user,
              authController: authController,
              navigationShell: navigationShell,
              items: employeeNavigationItems,
            );
          },
          branches: [
            _branch(
              path: AppRoutes.employeeTasks,
              child: const TasksPage(role: AppRole.employee),
            ),
            _branch(
              path: AppRoutes.employeeCalendar,
              child: const CalendarPage(),
            ),
            _branch(
              path: AppRoutes.employeeTeams,
              child: const TeamsPage(role: AppRole.employee),
            ),
            _branch(
              path: AppRoutes.employeeJoin,
              child: const JoinTeamPage(),
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: AppRoutes.employeeProfile,
                  pageBuilder: (context, state) => NoTransitionPage(
                    child: ProfilePage(user: authController.user!),
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
      errorBuilder: (context, state) {
        final user = authController.user;
        if (user == null) {
          return authPage;
        }

        return RoleShell(
          user: user,
          authController: authController,
          navigationShell: _FallbackNavigationShell(
            currentIndex: 0,
          ),
          items: user.role == AppRole.manager
              ? managerNavigationItems
              : employeeNavigationItems,
          child: const Center(child: Text('Screen not found')),
        );
      },
    );
  }

  static StatefulShellBranch _branch({
    required String path,
    required Widget child,
  }) {
    return StatefulShellBranch(
      routes: [
        GoRoute(
          path: path,
          pageBuilder: (context, state) => NoTransitionPage(child: child),
        ),
      ],
    );
  }
}

class _FallbackNavigationShell extends StatefulNavigationShell {
  _FallbackNavigationShell({
    required this.currentIndex,
  }) : super(
         shellRouteContext: throw UnimplementedError(),
         router: throw UnimplementedError(),
         containerBuilder: (_, __, ___) => const SizedBox.shrink(),
       );

  @override
  final int currentIndex;

  @override
  void goBranch(int index, {bool initialLocation = false}) {}
}
