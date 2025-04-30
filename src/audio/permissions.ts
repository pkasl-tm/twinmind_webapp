// src/permissions.ts
import { Alert } from 'react-native';
import { Audio } from 'expo-av';

/**
 * Checks for microphone permissions and requests them if not already granted.
 * Displays an alert if permissions are denied or an error occurs.
 * @returns {Promise<boolean>} True if permission is granted, false otherwise.
 */
export const checkAndRequestPermissions = async (): Promise<boolean> => {
  console.log('Checking/Requesting microphone permissions...');
  try {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission Required',
        'Microphone permission is needed. Please enable it in settings.'
      );
      console.log('Microphone permission denied.');
    } else {
      console.log('Microphone permission granted.');
    }
    return permission.granted;
  } catch (error) {
    console.error("Error requesting permissions:", error);
    Alert.alert('Permission Error', 'Could not request microphone permissions.');
    return false;
  }
};