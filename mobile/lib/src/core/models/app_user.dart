import 'app_role.dart';

class AppUser {
  const AppUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    required this.activeTeamCount,
    required this.isPreview,
    this.jobTitle,
  });

  factory AppUser.preview(AppRole role) {
    return AppUser(
      id: 'preview-${role.apiValue}',
      email: role == AppRole.manager
          ? 'manager.mobile.preview@tasktrail.site'
          : 'employee.mobile.preview@tasktrail.site',
      firstName: role == AppRole.manager ? 'Morgan' : 'Avery',
      lastName: role == AppRole.manager ? 'Manager' : 'Employee',
      role: role,
      activeTeamCount: role == AppRole.employee ? 0 : 2,
      isPreview: true,
      jobTitle: role == AppRole.manager
          ? 'Operations lead'
          : 'Field specialist',
    );
  }

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'] as String? ?? '',
      email: json['email'] as String? ?? '',
      firstName: json['firstName'] as String? ?? '',
      lastName: json['lastName'] as String? ?? '',
      role: AppRole.fromValue(json['role'] as String? ?? 'employee'),
      activeTeamCount: (json['activeTeamCount'] as num?)?.toInt() ?? 0,
      isPreview: json['isPreview'] as bool? ?? false,
      jobTitle: json['jobTitle'] as String?,
    );
  }

  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final AppRole role;
  final int activeTeamCount;
  final bool isPreview;
  final String? jobTitle;

  String get fullName {
    final full = '$firstName $lastName'.trim();
    return full.isEmpty ? role.label : full;
  }

  String get defaultRoute {
    if (role == AppRole.manager) {
      return '/manager/dashboard';
    }

    if (activeTeamCount == 0) {
      return '/employee/join';
    }

    return '/employee/tasks';
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'firstName': firstName,
      'lastName': lastName,
      'role': role.apiValue,
      'activeTeamCount': activeTeamCount,
      'isPreview': isPreview,
      'jobTitle': jobTitle,
    };
  }
}
