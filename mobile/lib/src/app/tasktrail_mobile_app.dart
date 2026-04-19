import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/config/app_config.dart';
import '../core/network/tasktrail_api_client.dart';
import '../core/storage/session_store.dart';
import '../core/theme/tasktrail_theme.dart';
import '../features/auth/application/auth_controller.dart';
import '../features/auth/data/auth_repository.dart';
import '../features/auth/presentation/auth_gate_page.dart';
import 'router/app_router.dart';

class TaskTrailMobileApp extends StatefulWidget {
  const TaskTrailMobileApp({super.key, required this.config});

  final AppConfig config;

  @override
  State<TaskTrailMobileApp> createState() => _TaskTrailMobileAppState();
}

class _TaskTrailMobileAppState extends State<TaskTrailMobileApp> {
  late final SessionStore _sessionStore;
  late final TaskTrailApiClient _apiClient;
  late final AuthRepository _authRepository;
  late final AuthController _authController;
  late final AuthGatePage _authPage;
  late final GoRouter router;

  @override
  void initState() {
    super.initState();
    _sessionStore = SessionStore();
    _apiClient = TaskTrailApiClient(
      config: widget.config,
      sessionStore: _sessionStore,
    );
    _authRepository = AuthRepository(
      apiClient: _apiClient,
      sessionStore: _sessionStore,
    );
    _authController = AuthController(repository: _authRepository);
    _authPage = AuthGatePage(
      config: widget.config,
      authController: _authController,
    );
    router = AppRouter.create(
      authController: _authController,
      authPage: _authPage,
    );
    _authController.bootstrap();
  }

  @override
  void dispose() {
    router.dispose();
    _authController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'TaskTrail',
      debugShowCheckedModeBanner: false,
      theme: TaskTrailTheme.build(),
      routerConfig: router,
    );
  }
}
