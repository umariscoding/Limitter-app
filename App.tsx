import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';

function App(): React.JSX.Element {
  const [showMainApp, setShowMainApp] = useState(false);

  // Render Auth flow if not logged in
  if (!showMainApp) {
    return (
      <NavigationContainer>
        <AuthNavigator onLoginSuccess={() => setShowMainApp(true)} />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <MainNavigator />
    </NavigationContainer>
  );
}

export default App;
