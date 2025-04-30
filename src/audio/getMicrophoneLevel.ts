// getMicrophoneLevel.ts
import { RecorderState } from 'expo-audio';

// Constants
const METERING_MIN_DB = -60; // For Native
const WEB_SMOOTHING_FACTOR = 0.7; // Add smoothing for web level
let smoothedWebLevel = 0; // Keep track of smoothed level for web

/**
 * Get current microphone input level as a normalized value between 0-1 for React Native.
 * Uses the metering value from expo-audio's RecorderState.
 *
 * @param recorderState The current state object from expo-audio recording.
 * @returns A promise resolving to the normalized microphone level (0-1).
 */
export function getMobileMicrophoneLevel(recorderState: RecorderState): number {
    // Reads the metering value (in dBFS) provided by expo-audio
    const dbfs = recorderState?.metering ?? METERING_MIN_DB; // Use nullish coalescing

    // Normalize from dBFS range (e.g., -60 dBFS to 0 dBFS) to a linear 0-1 scale.
    // Assumes 0 dBFS is the maximum level.
    const linearLevel = Math.max(0, Math.min(1, (dbfs - METERING_MIN_DB) / (-METERING_MIN_DB)));

    // Note: Expo-audio metering might already be somewhat smoothed,
    // but you could add smoothing here if needed:
    // smoothedMobileLevel = SMOOTHING_FACTOR * smoothedMobileLevel + (1 - SMOOTHING_FACTOR) * linearLevel;
    // return smoothedMobileLevel;

    return linearLevel;
}

/**
 * Get current microphone input level as a normalized value between 0-1 for Web platforms.
 * Uses the Web Audio API to analyze the provided AnalyserNode.
 *
 * @param analyserNode The active Web Audio AnalyserNode connected to the mic source.
 * @returns The normalized microphone level (0-1). Returns 0 if analyserNode is null.
 */
export function getWebMicrophoneLevel(analyserNode: AnalyserNode | null): number {
    if (!analyserNode) {
        smoothedWebLevel = 0; // Reset smoothing if node disappears
        return 0;
    }
    try {
        // Get audio frequency data
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteFrequencyData(dataArray); // Fills dataArray with frequency values

        // Calculate average level across frequency bins
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        const average = bufferLength > 0 ? sum / bufferLength : 0;

        // Normalize the average byte value (0-255) to a 0-1 range
        // Dividing by 128 assumes the average useful signal level is around half the max byte value.
        const normalizedLevel = Math.min(average / 128, 1);

        // Apply smoothing
        smoothedWebLevel = WEB_SMOOTHING_FACTOR * smoothedWebLevel + (1 - WEB_SMOOTHING_FACTOR) * normalizedLevel;

        return smoothedWebLevel;

    } catch (error) {
        console.error('Error processing web audio stream:', error);
        smoothedWebLevel = 0; // Reset on error
        return 0; // Return 0 on error
    }
}

// Optional: Function to reset smoothed level if needed (e.g., when stopping)
export function resetWebAudioLevel() {
    smoothedWebLevel = 0;
}