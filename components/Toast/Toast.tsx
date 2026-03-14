import React, { useEffect, useState } from 'react';
import { 
  Animated, 
  StyleSheet, 
  Text, 
  View, 
  Dimensions, 
  Platform,
  SafeAreaView
} from 'react-native';

const { width } = Dimensions.get('window');

interface ToastProps {
  message: string;
  visible: boolean;
  onHide: () => void;
  duration?: number;
  type?: 'success' | 'error' | 'info';
}

export const Toast: React.FC<ToastProps> = ({ 
  message, 
  visible, 
  onHide, 
  duration = 3000,
  type = 'success'
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [translateY] = useState(new Animated.Value(-100));
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      // Show animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      hideToast();
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShouldRender(false);
      onHide();
    });
  };

  if (!shouldRender) return null;

  const getBackgroundColor = () => {
    switch (type) {
      case 'success': return '#10B981'; // Figma Teal
      case 'error': return '#EF4444';
      case 'info': return '#3B82F6';
      default: return '#1E293B';
    }
  };

  return (
    <SafeAreaView style={styles.overlay} pointerEvents="none">
      <Animated.View 
        style={[
          styles.container, 
          { 
            backgroundColor: getBackgroundColor(),
            opacity: fadeAnim,
            transform: [{ translateY }]
          }
        ]}
      >
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 40 : 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  container: {
    width: width * 0.9,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default Toast;
