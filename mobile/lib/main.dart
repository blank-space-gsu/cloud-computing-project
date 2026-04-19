import 'package:flutter/widgets.dart';

import 'src/app/tasktrail_mobile_app.dart';
import 'src/core/config/app_config.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(TaskTrailMobileApp(config: AppConfig.fromEnvironment()));
}
