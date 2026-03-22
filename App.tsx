import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import MainNavigator from './src/navigation/MainNavigator';
import { UserContextProvider } from './src/context/UserContext';

function App(): React.JSX.Element {
  return (
    <UserContextProvider>
      <NavigationContainer>
        <MainNavigator />
      </NavigationContainer>
    </UserContextProvider>
  );
}

export default App;
