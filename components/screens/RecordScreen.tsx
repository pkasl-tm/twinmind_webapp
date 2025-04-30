import React, { useState, useMemo } from 'react';
import { View, Button, Text } from 'react-native';
import { MicrophoneActivityIndicator } from '../../src/audio/MicrophoneActivityIndicator'; // Adjust path
import { useSegmentedRecorder } from '../../src/hooks/useSegmentedRecorder'; // Adjust path
import { useMicrophoneLevel } from '../../src/hooks/useMicrophoneLevel'; // Adjust path
import {
    IS_RECORDING_BUTTON_NAME,
    IS_NOT_RECORDING_BUTTON_NAME,
    IS_RECORDING_BUTTON_COLOR,
    IS_NOT_RECORDING_BUTTON_COLOR
} from '../../src/constants/audioConstants'; // Adjust path
import { styles } from '../../src/styles/RecordScreen'; // Adjust path

export default function RecordScreen() {
    const {
        isProcessing,
        actualIsRecording,
        lastUriHandled,
        recorderError,
        recorderState,
        startRecordingProcess,
        stopRecordingProcess,
    } = useSegmentedRecorder({}); // Pass custom config here if needed

    const { audioLevel, levelSetupError } = useMicrophoneLevel({
        isActive: isProcessing || actualIsRecording, // Monitor level if process intended or recorder is active
        recorderState: recorderState,
    });

    // Combine errors from both hooks for display
    const displayError = useMemo(() => recorderError || levelSetupError, [recorderError, levelSetupError]);

    // --- Render ---
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Expo Audio Recorder</Text>

            {displayError && <Text style={styles.errorText}>Error: {displayError}</Text>}

            <MicrophoneActivityIndicator
                isActive={isProcessing || actualIsRecording}
                audioLevel={audioLevel}
            />

            <Text style={styles.statusText}>
                Process Active: {isProcessing ? 'Yes' : 'No'}
            </Text>
            <Text style={styles.statusText}>
                Recorder State: {actualIsRecording ? 'Recording' : 'Idle'} | Level: {audioLevel.toFixed(3)} | Ms: {recorderState?.durationMillis ?? 0}
            </Text>
            <Text style={styles.statusText} numberOfLines={1} ellipsizeMode="middle">
                Last URI Handled: {lastUriHandled || 'none'}
            </Text>

            <Button
                title={isProcessing ? IS_RECORDING_BUTTON_NAME : IS_NOT_RECORDING_BUTTON_NAME}
                onPress={isProcessing ? stopRecordingProcess : startRecordingProcess}
                color={isProcessing ? IS_RECORDING_BUTTON_COLOR : IS_NOT_RECORDING_BUTTON_COLOR}
                // Disable start if there's a setup error (mic permissions), allow stop even with errors
                disabled={!isProcessing && !!levelSetupError}
            />
        </View>
    );
}