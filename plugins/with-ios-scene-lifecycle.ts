import fs from 'node:fs';
import path from 'node:path';

import {
  type ConfigPlugin,
  IOSConfig,
  withAppDelegate,
  withInfoPlist,
  withPlugins,
  withXcodeProject,
} from 'expo/config-plugins';

// Backport of the SDK 58 bare template: the iOS 27 SDK refuses to launch apps
// that have not adopted the UIScene life cycle.

const SCENE_DELEGATE_FILE = 'SceneDelegate.swift';

const SCENE_DELEGATE_SOURCE = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`;

const APP_DELEGATE_CLASS = 'class AppDelegate: ExpoAppDelegate {';
const APP_DELEGATE_CLASS_WITH_PROVIDER =
  'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {';

const WINDOW_BOOTSTRAP =
  /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;

const withSceneManifest: ConfigPlugin = (config) =>
  withInfoPlist(config, (plistConfig) => {
    plistConfig.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return plistConfig;
  });

const withSceneAwareAppDelegate: ConfigPlugin = (config) =>
  withAppDelegate(config, (delegateConfig) => {
    if (delegateConfig.modResults.language !== 'swift') {
      throw new Error('with-ios-scene-lifecycle only supports a Swift AppDelegate.');
    }
    let contents = delegateConfig.modResults.contents;

    if (!contents.includes(APP_DELEGATE_CLASS_WITH_PROVIDER)) {
      if (!contents.includes(APP_DELEGATE_CLASS)) {
        throw new Error('with-ios-scene-lifecycle: AppDelegate class declaration not found.');
      }
      contents = contents.replace(APP_DELEGATE_CLASS, APP_DELEGATE_CLASS_WITH_PROVIDER);
    }

    if (WINDOW_BOOTSTRAP.test(contents)) {
      contents = contents.replace(
        WINDOW_BOOTSTRAP,
        '    // The window is created and React Native is started by `SceneDelegate`.\n',
      );
    } else if (contents.includes('UIWindow(frame:')) {
      throw new Error('with-ios-scene-lifecycle: unrecognised window bootstrap in AppDelegate.');
    }

    delegateConfig.modResults.contents = contents;
    return delegateConfig;
  });

const withSceneDelegateFile: ConfigPlugin = (config) =>
  withXcodeProject(config, (projectConfig) => {
    const { platformProjectRoot, projectRoot } = projectConfig.modRequest;
    const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
    const relativePath = path.join(projectName, SCENE_DELEGATE_FILE);

    fs.writeFileSync(path.join(platformProjectRoot, relativePath), SCENE_DELEGATE_SOURCE);

    const project = projectConfig.modResults;
    if (!project.hasFile(relativePath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: relativePath,
        groupName: projectName,
        project,
      });
    }
    return projectConfig;
  });

const withIosSceneLifecycle: ConfigPlugin = (config) =>
  withPlugins(config, [withSceneManifest, withSceneAwareAppDelegate, withSceneDelegateFile]);

export default withIosSceneLifecycle;
