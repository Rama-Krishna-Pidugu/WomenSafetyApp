const { withAndroidManifest, withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withSafetyAndroidManifest = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application.find(
      (item) => item.$['android:name'] === '.MainApplication'
    );

    if (mainApplication) {
      // Add SafetyForegroundService
      const hasSafetyForegroundService = mainApplication.service?.some(
        (service) => service.$['android:name'] === '.SafetyForegroundService'
      );
      
      if (!hasSafetyForegroundService) {
        if (!mainApplication.service) mainApplication.service = [];
        mainApplication.service.push({
          $: {
            'android:name': '.SafetyForegroundService',
            'android:foregroundServiceType': 'specialUse',
            'android:exported': 'false'
          },
          property: [{
            $: {
              'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
              'android:value': 'emergency'
            }
          }]
        });
      }

      // Add NotificationActionReceiver
      const hasNotificationActionReceiver = mainApplication.receiver?.some(
        (receiver) => receiver.$['android:name'] === '.NotificationActionReceiver'
      );
      if (!hasNotificationActionReceiver) {
        if (!mainApplication.receiver) mainApplication.receiver = [];
        mainApplication.receiver.push({
          $: {
            'android:name': '.NotificationActionReceiver',
            'android:exported': 'false'
          }
        });
      }

      // Add FakeCallBroadcastReceiver
      const hasFakeCallReceiver = mainApplication.receiver?.some(
        (receiver) => receiver.$['android:name'] === '.FakeCallBroadcastReceiver'
      );
      if (!hasFakeCallReceiver) {
        if (!mainApplication.receiver) mainApplication.receiver = [];
        mainApplication.receiver.push({
          $: {
            'android:name': '.FakeCallBroadcastReceiver',
            'android:exported': 'false'
          }
        });
      }

      // Add FakeCallActivity
      const hasFakeCallActivity = mainApplication.activity?.some(
        (activity) => activity.$['android:name'] === '.FakeCallActivity'
      );
      if (!hasFakeCallActivity) {
        if (!mainApplication.activity) mainApplication.activity = [];
        mainApplication.activity.push({
          $: {
            'android:name': '.FakeCallActivity',
            'android:showWhenLocked': 'true',
            'android:turnScreenOn': 'true',
            'android:showForAllUsers': 'true',
            'android:excludeFromRecents': 'true',
            'android:launchMode': 'singleTask',
            'android:taskAffinity': '',
            'android:screenOrientation': 'portrait',
            'android:theme': '@style/Theme.AppCompat.NoActionBar',
            'android:exported': 'false'
          }
        });
      }

      // Add SafetyTileService
      const hasSafetyTileService = mainApplication.service?.some(
        (service) => service.$['android:name'] === '.SafetyTileService'
      );
      
      if (!hasSafetyTileService) {
        if (!mainApplication.service) mainApplication.service = [];
        mainApplication.service.push({
          $: {
            'android:name': '.SafetyTileService',
            'android:label': 'Women Safety',
            'android:icon': '@mipmap/ic_launcher',
            'android:permission': 'android.permission.BIND_QUICK_SETTINGS_TILE',
            'android:exported': 'true'
          },
          'intent-filter': [{
            action: [{
              $: {
                'android:name': 'android.service.quicksettings.action.QS_TILE'
              }
            }]
          }]
        });
      }
    }

    // Add permissions
    const permissionsToAdd = [
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.VIBRATE',
      'android.permission.WAKE_LOCK',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.USE_EXACT_ALARM',
      'android.permission.USE_FULL_SCREEN_INTENT',
      'android.permission.FOREGROUND_SERVICE_SPECIAL_USE'
    ];

    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }
    
    for (const permission of permissionsToAdd) {
      const exists = androidManifest.manifest['uses-permission'].some(
        (p) => p.$['android:name'] === permission
      );
      if (!exists) {
        androidManifest.manifest['uses-permission'].push({
          $: {
            'android:name': permission
          }
        });
      }
    }

    return config;
  });
};

const withSafetyAndroidFiles = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const packageName = config.android?.package || 'com.nameisrk.aegiswomensafety';
      const packagePath = packageName.replace(/\./g, '/');
      const targetDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'java', packagePath);
      const sourceDir = path.join(projectRoot, 'custom-android-files');

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const files = [
        'EmergencyModule.kt',
        'EmergencyPackage.kt',
        'NotificationActionReceiver.kt',
        'SafetyForegroundModule.kt',
        'SafetyForegroundService.kt',
        'SafetyPackage.kt',
        'SafetyTileService.kt',
        'SOSModule.kt',
        'ShakeModule.kt',
        'FakeCallActivity.kt',
        'FakeCallBroadcastReceiver.kt',
        'FakeCallScheduler.kt',
        'FakeCallModule.kt',
        'FakeCallTileService.kt'
      ];

      for (const file of files) {
        const src = path.join(sourceDir, file);
        const dest = path.join(targetDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }

      return config;
    }
  ]);
};

const withEmergencyPackage = (config) => {
  return withMainApplication(config, async (config) => {
    let mainApp = config.modResults.contents;
    
    // Add import if not present
    if (!mainApp.includes('import com.nameisrk.aegiswomensafety.EmergencyPackage')) {
      mainApp = mainApp.replace(
        'import android.app.Application',
        'import android.app.Application\nimport com.nameisrk.aegiswomensafety.EmergencyPackage'
      );
    }

    // Add EmergencyPackage to the package list
    if (!mainApp.includes('add(EmergencyPackage())')) {
      const targetString = 'PackageList(this).packages.apply {';
      if (mainApp.includes(targetString)) {
        mainApp = mainApp.replace(
          targetString,
          `${targetString}\n          add(EmergencyPackage())`
        );
      }
    }

    config.modResults.contents = mainApp;
    return config;
  });
};

const withSafetyFeatures = (config) => {
  config = withSafetyAndroidManifest(config);
  config = withSafetyAndroidFiles(config);
  config = withEmergencyPackage(config);
  return config;
};

module.exports = withSafetyFeatures;
