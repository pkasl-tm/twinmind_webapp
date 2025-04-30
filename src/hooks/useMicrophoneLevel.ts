import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAudioRecorderState } from 'expo-audio'; // Assuming this type exists or import specifics
import { getMobileMicrophoneLevel, getWebMicrophoneLevel, resetWebAudioLevel } from '../audio/getMicrophoneLevel'; // Adjust path
import { LEVEL_UPDATE_INTERVAL_MS } from '../constants/audioConstants'; // Adjust path

interface UseMicrophoneLevelProps {
    isActive: boolean; // Should monitoring be active?
    recorderState: typeof useAudioRecorderState | null; // Needed for mobile level
}

export function useMicrophoneLevel({ isActive, recorderState }: UseMicrophoneLevelProps) {
    const [audioLevel, setAudioLevel] = useState(0);
    const [setupError, setSetupError] = useState<string | null>(null);

    const levelIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const webAudioContextRef = useRef<AudioContext | null>(null);
    const webAnalyserNodeRef = useRef<AnalyserNode | null>(null);
    const webSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const webStreamRef = useRef<MediaStream | null>(null);

    // --- Web Audio Metering Setup/Teardown ---
    const setupWebAudio = async () => {
        if (Platform.OS !== 'web' || webAudioContextRef.current) return true; // Indicate success if not web or already setup
        console.log("Setting up Web Audio for metering...");
        setSetupError(null); // Clear previous errors
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            webStreamRef.current = stream;

            const context = new window.AudioContext();
            const analyser = context.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.3;
            const source = context.createMediaStreamSource(stream);
            source.connect(analyser);

            webAudioContextRef.current = context;
            webAnalyserNodeRef.current = analyser;
            webSourceNodeRef.current = source;
            console.log("Web Audio metering setup complete.");
            return true; // Indicate success
        } catch (err) {
            console.error('Failed to start web audio for metering:', err);
            let errorMessage = 'Could not access microphone for metering. Check browser permissions.';
            if (err instanceof Error) errorMessage += ` (${err.name}: ${err.message})`;
            setSetupError(errorMessage);
            await teardownWebAudio(); // Clean up partial setup
            return false; // Indicate failure
        }
    };

    const teardownWebAudio = async () => {
        if (Platform.OS !== 'web') return;
        console.log("Tearing down Web Audio metering...");
        resetWebAudioLevel();

        webSourceNodeRef.current?.disconnect();
        webAnalyserNodeRef.current?.disconnect();

        webStreamRef.current?.getTracks().forEach(track => track.stop());
        webStreamRef.current = null;

        if (webAudioContextRef.current && webAudioContextRef.current.state !== 'closed') {
            try {
                await webAudioContextRef.current.close();
                console.log('Web Audio context closed');
            } catch (e) {
                console.warn("Error closing audio context:", e);
            }
        }
        webAudioContextRef.current = null;
        webAnalyserNodeRef.current = null;
        webSourceNodeRef.current = null;
    };

    // --- Level Monitoring Control ---
    const startLevelMonitoring = () => {
        if (levelIntervalRef.current) return; // Already running
        if (setupError) {
             console.warn("Cannot start level monitoring due to setup error:", setupError);
             return;
        }
        console.log("Starting level monitoring interval...");
        levelIntervalRef.current = setInterval(() => {
            let level = 0;
            if (Platform.OS === 'web' && webAnalyserNodeRef.current) {
                level = getWebMicrophoneLevel(webAnalyserNodeRef.current);
            } else if (Platform.OS !== 'web' && recorderState) {
                level = getMobileMicrophoneLevel(recorderState);
            }
            level = Math.max(0, Math.min(1, isNaN(level) ? 0 : level));
            setAudioLevel(level);
        }, LEVEL_UPDATE_INTERVAL_MS);
    };

    const stopLevelMonitoring = () => {
        console.log("Stopping level monitoring interval...");
        if (levelIntervalRef.current) {
            clearInterval(levelIntervalRef.current);
            levelIntervalRef.current = null;
        }
        setAudioLevel(0); // Reset level display
        if (Platform.OS === 'web') {
            resetWebAudioLevel(); // Reset internal web level state
        }
    };

     // Effect to manage setup/teardown and monitoring based on isActive
     useEffect(() => {
        let isMounted = true;
        let monitoringStarted = false;

        const manageMonitoring = async () => {
            if (isActive) {
                let setupSuccess = true;
                if (Platform.OS === 'web' && !webAudioContextRef.current) {
                   setupSuccess = await setupWebAudio();
                }
                // Only start if setup succeeded (or wasn't needed) and component is still mounted
                if (setupSuccess && isMounted) {
                    startLevelMonitoring();
                    monitoringStarted = true;
                }
            } else {
                stopLevelMonitoring();
                if (Platform.OS === 'web') {
                   await teardownWebAudio();
                }
            }
        };

        manageMonitoring();

        // Cleanup function
        return () => {
            isMounted = false;
            console.log("useMicrophoneLevel cleanup: Stopping monitoring and tearing down web audio (if applicable)");
            stopLevelMonitoring();
             // Ensure teardown happens on unmount/isActive change to false
             // Use IIAFE because cleanup function itself cannot be async
            (async () => {
                if (Platform.OS === 'web') {
                    await teardownWebAudio();
                }
            })();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive]); // Rerun when isActive changes

    // Effect to update level source for mobile when recorderState changes
    // This is separate because recorderState changes frequently
    useEffect(() => {
      // No action needed here other than ensuring the interval callback
      // uses the latest `recorderState` prop from the parent scope.
      // The interval callback itself references `recorderState` directly.
    }, [recorderState])


    return { audioLevel, levelSetupError: setupError };
}