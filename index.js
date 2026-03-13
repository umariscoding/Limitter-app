/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';

LogBox.ignoreLogs([
  '`new NativeEventEmitter()` was called with a non-null argument without the required `addListener` method.',
  '`new NativeEventEmitter()` was called with a non-null argument without the required `removeListeners` method.',
  'SafeAreaView has been deprecated and will be removed in a future release.',
]);

import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
