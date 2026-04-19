enum AppRole {
  manager,
  employee;

  String get apiValue => switch (this) {
    AppRole.manager => 'manager',
    AppRole.employee => 'employee',
  };

  String get label => switch (this) {
    AppRole.manager => 'Manager',
    AppRole.employee => 'Employee',
  };

  static AppRole fromValue(String value) {
    return switch (value.toLowerCase()) {
      'manager' || 'admin' => AppRole.manager,
      _ => AppRole.employee,
    };
  }
}
