import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import type { PermissionStatus } from 'expo-av/build/Audio'; // Import specific type

const RECORDING_INTERVAL_MS = 5000; // 5 seconds

// Define the type for the callback function
type AudioChunkCallback = (chunk: string | Blob) => void; // URI (string) for native, Blob for web


export function useAudioRecorder(onNewChunk: AudioChunkCallback) {
    
}