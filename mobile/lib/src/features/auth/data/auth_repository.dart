import '../../../core/models/app_role.dart';
import '../../../core/network/tasktrail_api_client.dart';
import '../../../core/storage/session_store.dart';
import '../domain/auth_session.dart';
import '../../../core/models/app_user.dart';

class AuthRepository {
  AuthRepository({
    required TaskTrailApiClient apiClient,
    required SessionStore sessionStore,
  }) : _apiClient = apiClient,
       _sessionStore = sessionStore;

  final TaskTrailApiClient _apiClient;
  final SessionStore _sessionStore;

  Future<AuthSession?> restoreSession() => _sessionStore.readSession();

  Future<AuthSession> createPreviewSession(AppRole role) async {
    final session = AuthSession(user: AppUser.preview(role));
    await _sessionStore.writeSession(session);
    return session;
  }

  Future<void> signOut() => _sessionStore.clear();

  Future<AuthSession> signInWithPassword({
    required String email,
    required String password,
  }) async {
    throw UnimplementedError(
      'Module 1 will wire signInWithPassword to ${_apiClient.runtimeType}.',
    );
  }

  Future<void> signUp({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required AppRole role,
    String? jobTitle,
  }) async {
    throw UnimplementedError('Module 1 will wire signUp to the live backend.');
  }
}
