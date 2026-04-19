import '../../../core/models/app_user.dart';

class AuthSession {
  const AuthSession({required this.user, this.accessToken, this.refreshToken});

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    return AuthSession(
      user: AppUser.fromJson(json['user'] as Map<String, dynamic>? ?? const {}),
      accessToken: json['accessToken'] as String?,
      refreshToken: json['refreshToken'] as String?,
    );
  }

  final AppUser user;
  final String? accessToken;
  final String? refreshToken;

  Map<String, dynamic> toJson() {
    return {
      'user': user.toJson(),
      'accessToken': accessToken,
      'refreshToken': refreshToken,
    };
  }
}
