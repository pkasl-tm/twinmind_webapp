// useMicrophoneLevel.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

const AUDIO_UPDATE_INTERVAL_MS = 100; // How often to check level (native)
const SMOOTHING_FACTOR = 0.7; // Simple smoothing for level changes

export function useMicrophoneLevel() {
    const [audioLevel, setAudioLevel] = useState(0);
    const [isListening, setIsListening] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState(null);
    const [error, setError] = useState(null);

    // --- Refs ---
    const recordingRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserNodeRef = useRef(null);
    const sourceNodeRef = useRef(null);
    const animationFrameRef = useRef(null);
    const smoothedLevelRef = useRef(0);
    const isListeningRef = useRef(isListening); 

    useEffect(() => {
        isListeningRef.current = isListening;
    }, [isListening]);

    const checkAndRequestPermission = useCallback(async () => {
        setError(null);
        try {
            console.log('Requesting mic permissions...');
            const permissions = await Audio.requestPermissionsAsync();
            setPermissionStatus(permissions.status);
            console.log('Permission status:', permissions.status);
            return permissions.granted;
        } catch (err) {
            console.error('Failed to get permissions', err);
            setError('Failed to get microphone permissions.');
            setPermissionStatus('denied');
            return false;
        }
    }, []); 

    const stopWebListening = useCallback(() => {
        console.log("Attempting to stop web listening...");
         // Cancel frame FIRST
         if (animationFrameRef.current) {
             cancelAnimationFrame(animationFrameRef.current);
             animationFrameRef.current = null;
             console.log('Animation frame cancelled');
         }

          const wasListening = isListeningRef.current;
          isListeningRef.current = false; // Update ref immediately
          setIsListening(false); // Keep state in sync for consumers
          setAudioLevel(0);
          smoothedLevelRef.current = 0;

         if (sourceNodeRef.current && sourceNodeRef.current.mediaStream) {
             sourceNodeRef.current.mediaStream.getTracks().forEach(track => track.stop());
             console.log('Web Audio stream tracks stopped');
         }
         if (analyserNodeRef.current) {
            try { analyserNodeRef.current.disconnect(); } catch (e) { console.warn("Error disconnecting analyser:", e); }
            analyserNodeRef.current = null;
        }
         if (sourceNodeRef.current) { // Disconnect source too
            try { sourceNodeRef.current.disconnect(); } catch (e) { console.warn("Error disconnecting source:", e); }
             sourceNodeRef.current = null;
         }
         if (audioContextRef.current) {
              if (audioContextRef.current.state !== 'closed') {
                  audioContextRef.current.close().then(() => {
                       console.log('Web Audio context closed');
                  }).catch(e => console.warn("Error closing audio context:", e))
                  .finally(() => audioContextRef.current = null);
              } else {
                  audioContextRef.current = null;
              }
         }

        if (wasListening) {
            console.log("Web listening stopped.");
        } else {
             console.log("stopWebListening called, but wasn't actively listening according to ref.");
        }
    }, [/* setAudioLevel, setIsListening are stable */]); // Empty dependency array


    const processWebAudio = useCallback(() => {
        // --- Check the ref instead of the state variable ---
        if (!analyserNodeRef.current || !isListeningRef.current) {
            console.log(`processWebAudio: Returning early. Analyser exists: ${!!analyserNodeRef.current}, isListeningRef: ${isListeningRef.current}`);
            // If we are returning because listening stopped, ensure frame is cancelled
            if (!isListeningRef.current && animationFrameRef.current) {
                 cancelAnimationFrame(animationFrameRef.current);
                 animationFrameRef.current = null;
            }
            return;
        }

        try {
            const bufferLength = analyserNodeRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyserNodeRef.current.getByteFrequencyData(dataArray);

            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = bufferLength > 0 ? sum / bufferLength : 0;
            
            const normalizedLevel = Math.min(average / 128, 1);
            smoothedLevelRef.current = SMOOTHING_FACTOR * smoothedLevelRef.current + (1 - SMOOTHING_FACTOR) * normalizedLevel;

            setAudioLevel(smoothedLevelRef.current);

            if (isListeningRef.current) {
                animationFrameRef.current = requestAnimationFrame(processWebAudio);
            } else {
                 if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                    animationFrameRef.current = null;
                }
            }
        } catch (err) {
            console.error("Error inside processWebAudio:", err);
            setError("Error processing audio data.");
            stopWebListening(); 
        }
    
    }, [setError, stopWebListening]);


    const startWebListening = useCallback(async () => {
        if (audioContextRef.current || isListeningRef.current) {
             console.log("startWebListening: Already listening or context exists.");
             return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = context.createAnalyser();
            analyser.fftSize = 256;
            const source = context.createMediaStreamSource(stream);

            source.connect(analyser);

            audioContextRef.current = context;
            analyserNodeRef.current = analyser;
            sourceNodeRef.current = source;

            console.log('Web Audio setup complete.');

            
            isListeningRef.current = true;
            setIsListening(true);

            console.log('Scheduling FIRST animation frame.');
             if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            animationFrameRef.current = requestAnimationFrame(processWebAudio);

        } catch (err) {
            console.error('Failed to start web audio:', err);
            setError('Could not access microphone. Check browser permissions.');
            // Reset state and ref on error
            isListeningRef.current = false;
            setIsListening(false);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                 setPermissionStatus('denied');
            }
            // Cleanup partially created resources
             if (sourceNodeRef.current && sourceNodeRef.current.mediaStream) {
                 sourceNodeRef.current.mediaStream.getTracks().forEach(track => track.stop());
             }
              if (analyserNodeRef.current) { try { analyserNodeRef.current.disconnect(); } catch(e){} }
             if (sourceNodeRef.current) { try { sourceNodeRef.current.disconnect(); } catch(e){} }
             if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                 try { await audioContextRef.current.close(); } catch(e){}
             }
             analyserNodeRef.current = null;
             sourceNodeRef.current = null;
             audioContextRef.current = null;
        }
    // Add processWebAudio, setError, setPermissionStatus as dependencies
    }, [processWebAudio, setError, setPermissionStatus]);

    // --- Native Logic ---
    const stopNativeListening = useCallback(async () => {
        const wasListening = isListeningRef.current;
        // Set ref and state immediately
        isListeningRef.current = false;
        setIsListening(false);
        setAudioLevel(0);
        smoothedLevelRef.current = 0;

        if (!recordingRef.current) {
             if (wasListening) console.warn("stopNativeListening called, was listening according to ref, but no recordingRef found.");
             return; // Nothing to stop
        }

        console.log('Stopping native listening...');
        try {
            // Make sure to get the ref *before* nulling it out potentially
            const recordingToStop = recordingRef.current;
            recordingRef.current = null; // Prevent race conditions/double stops
            await recordingToStop.stopAndUnloadAsync();
            console.log('Native recording stopped and unloaded');
        } catch (error) {
            // Check if error is ignorable (e.g., already stopped)
            if (error?.message?.includes('Cannot unload a Recording that has already been unloaded')) {
                console.warn('Attempted to stop/unload native recording that was already unloaded.');
            } else {
                 console.error('Error stopping/unloading native recording:', error);
            }
        } finally {
            // Ensure ref is null even if stop failed partway
            recordingRef.current = null;
            // State/ref already updated above
            if (wasListening) console.log("Native listening stopped.");
        }
    // Stable setters/refs only
    }, [/* setAudioLevel, setIsListening are stable */]);


    // >>>>> Define startNativeListening SECOND <<<<<
    const startNativeListening = useCallback(async () => {
        if (recordingRef.current || isListeningRef.current) return;

        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            console.log('Starting Expo recording for metering...');
            const { recording } = await Audio.Recording.createAsync(
                 Audio.RecordingOptionsPresets.HIGH_QUALITY,
                (status) => {
                    // Check ref for listening status
                    if (status.isRecording && isListeningRef.current) {
                        const METERING_MIN_DB = -60;
                        const dbfs = status.metering ?? METERING_MIN_DB;
                        const linearLevel = Math.max(0, Math.min(1, (dbfs - METERING_MIN_DB) / (-METERING_MIN_DB)));
                        smoothedLevelRef.current = SMOOTHING_FACTOR * smoothedLevelRef.current + (1 - SMOOTHING_FACTOR) * linearLevel;
                        setAudioLevel(smoothedLevelRef.current);
                    } else if (status.isDoneRecording && isListeningRef.current) {
                         console.warn("Native recording stopped unexpectedly while hook thought it was listening.");
                         // Call the correctly memoized stop function
                         stopNativeListening(); // <<< This dependency is now valid
                    } else if (!status.isRecording && !status.isDoneRecording && isListeningRef.current) {
                        // Handle potential intermediate states if needed, or log them
                        // console.log("Native recording status update:", status);
                    }
                },
                AUDIO_UPDATE_INTERVAL_MS
            );
            recordingRef.current = recording;
            await recordingRef.current.startAsync();

            // Set ref and state
            isListeningRef.current = true;
            setIsListening(true);
            console.log('Native listening started');

        } catch (err) {
            console.error('Failed to start native recording:', err);
            setError('Could not start microphone recording.');
            // Reset state and ref
            isListeningRef.current = false;
            setIsListening(false);
             // Attempt cleanup if recording object was partially created but failed to start
             if (recordingRef.current) {
                 try {
                      await recordingRef.current.stopAndUnloadAsync();
                 } catch (cleanupError) {
                      console.warn("Error during cleanup after failed start:", cleanupError);
                 }
                 recordingRef.current = null;
             }
        }
    // Add setError and the (now defined) stopNativeListening
    }, [setError, stopNativeListening /* setAudioLevel, setIsListening are stable */ ]);

    // --- Public Controls ---
    const startListening = useCallback(async () => {
        if (isListeningRef.current) { // Check ref
            console.log("startListening aborted: Already listening.");
            return;
        }

        const hasPermission = await checkAndRequestPermission();
        if (!hasPermission) {
            console.log('Permission denied, cannot start listening.');
            return;
        }

        setError(null);
        if (Platform.OS === 'web') {
            await startWebListening();
        } else {
            await startNativeListening();
        }
    // Dependencies are the functions it calls + the permission checker
    }, [checkAndRequestPermission, startWebListening, startNativeListening, setError]);

    const stopListening = useCallback(async () => {
        if (!isListeningRef.current) { // Check ref
            console.log("stopListening aborted: Not listening.");
            return;
        }

        if (Platform.OS === 'web') {
            stopWebListening(); // Assuming sync cleanup is sufficient for web
        } else {
            await stopNativeListening(); // Native requires async unload
        }
    // Dependencies are the functions it calls
    }, [stopWebListening, stopNativeListening]);

    // --- Cleanup Effect ---
    useEffect(() => {
        // This runs when the component using the hook unmounts
        return () => {
            console.log('Cleanup: Stopping listening on unmount');
            // Use the stable stop functions directly
            if (isListeningRef.current) { // Check ref before stopping
                 if (Platform.OS === 'web') {
                    stopWebListening();
                } else {
                    // Don't await here, can cause issues during unmount
                    stopNativeListening();
                }
            }
            // Cancel any pending frame on web even if not "listening" according to state/ref
            // (e.g., if unmount happens between requestAnimationFrame and execution)
            if (Platform.OS === 'web' && animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [stopWebListening, stopNativeListening]);

    return {
        audioLevel,
        isListening, 
        permissionStatus,
        error,
        startListening,
        stopListening,
        requestPermission: checkAndRequestPermission,
    };
}