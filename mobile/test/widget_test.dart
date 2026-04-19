import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:tasktrail_mobile/src/core/models/app_role.dart';
import 'package:tasktrail_mobile/src/features/tasks/presentation/tasks_page.dart';

void main() {
  testWidgets('manager tasks placeholder renders core shell copy', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: TasksPage(role: AppRole.manager)),
      ),
    );

    expect(find.text('Tasks'), findsOneWidget);
    expect(find.textContaining('Manager task operations'), findsOneWidget);
    expect(find.textContaining('POST /api/v1/tasks'), findsOneWidget);
  });
}
