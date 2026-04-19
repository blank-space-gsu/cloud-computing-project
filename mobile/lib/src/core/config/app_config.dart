enum AppEnvironment { development, production }

class AppConfig {
  AppConfig({required this.environment, required this.apiBaseUrl});

  factory AppConfig.fromEnvironment() {
    const environmentValue = String.fromEnvironment(
      'TASKTRAIL_ENV',
      defaultValue: 'development',
    );
    const overrideApiBaseUrl = String.fromEnvironment('TASKTRAIL_API_BASE_URL');

    final environment = environmentValue.toLowerCase() == 'production'
        ? AppEnvironment.production
        : AppEnvironment.development;

    final apiBaseUrl = overrideApiBaseUrl.isNotEmpty
        ? overrideApiBaseUrl
        : environment == AppEnvironment.production
        ? 'https://api.tasktrail.site/api/v1'
        : 'http://10.0.2.2:4000/api/v1';

    return AppConfig(environment: environment, apiBaseUrl: apiBaseUrl);
  }

  final AppEnvironment environment;
  final String apiBaseUrl;

  bool get isProduction => environment == AppEnvironment.production;

  String get label => switch (environment) {
    AppEnvironment.development => 'Development',
    AppEnvironment.production => 'Production',
  };
}
