import 'package:flutter/foundation.dart';

import '../../../core/models/app_role.dart';
import '../../../core/models/app_user.dart';
import '../data/auth_repository.dart';
import '../domain/auth_session.dart';

enum AuthStatus { loading, signedOut, signedIn }

class AuthController extends ChangeNotifier {
  AuthController({required AuthRepository repository})
    : _repository = repository;

  final AuthRepository _repository;

  AuthStatus _status = AuthStatus.loading;
  AppUser? _user;
  bool _isBusy = false;
  bool _bootstrapped = false;
  String? _errorMessage;

  AuthStatus get status => _status;
  AppUser? get user => _user;
  bool get isBusy => _isBusy;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _status == AuthStatus.signedIn && _user != null;

  Future<void> bootstrap() async {
    if (_bootstrapped) {
      return;
    }

    _bootstrapped = true;
    _status = AuthStatus.loading;
    notifyListeners();

    final session = await _repository.restoreSession();
    if (session == null) {
      _status = AuthStatus.signedOut;
      notifyListeners();
      return;
    }

    _applySession(session);
  }

  Future<void> usePreviewRole(AppRole role) async {
    _isBusy = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final session = await _repository.createPreviewSession(role);
      _applySession(session);
    } catch (error) {
      _errorMessage = error.toString();
      _status = AuthStatus.signedOut;
    } finally {
      _isBusy = false;
      notifyListeners();
    }
  }

  Future<void> signOut() async {
    await _repository.signOut();
    _user = null;
    _status = AuthStatus.signedOut;
    _errorMessage = null;
    notifyListeners();
  }

  void _applySession(AuthSession session) {
    _user = session.user;
    _status = AuthStatus.signedIn;
    _errorMessage = null;
    notifyListeners();
  }
}
