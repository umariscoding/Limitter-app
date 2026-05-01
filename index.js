import { LogBox } from "react-native";
import { registerRootComponent } from "expo";

LogBox.ignoreLogs([
  '`new NativeEventEmitter()` was called with a non-null argument without the required `addListener` method.',
  '`new NativeEventEmitter()` was called with a non-null argument without the required `removeListeners` method.',
  'SafeAreaView has been deprecated and will be removed in a future release.',
  // Dev-client only: Expo auto-activates KeepAwake before the Android Activity
  // is attached, rejecting with this message. Harmless — does not affect prod.
  'ExpoKeepAwake.activate',
  'The current activity is no longer available',
]);

import App from "./App";

registerRootComponent(App);
