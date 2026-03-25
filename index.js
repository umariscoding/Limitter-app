import { LogBox } from "react-native";
import { registerRootComponent } from "expo";

LogBox.ignoreLogs([
  '`new NativeEventEmitter()` was called with a non-null argument without the required `addListener` method.',
  '`new NativeEventEmitter()` was called with a non-null argument without the required `removeListeners` method.',
  'SafeAreaView has been deprecated and will be removed in a future release.',
]);

import App from "./App";

registerRootComponent(App);
