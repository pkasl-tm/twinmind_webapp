import React, { useState, useEffect, useRef } from 'react';
import { View, Button, Alert, Text, Platform, StyleSheet } from 'react-native';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, RecordingOptions } from 'expo-audio';
import { getMobileMicrophoneLevel, getWebMicrophoneLevel, resetWebAudioLevel } from './getMicrophoneLevel';
import { MicrophoneActivityIndicator } from './MicrophoneActivityIndicator';
import { sendAudioToApi, getRecordingMimeType } from './audioApi';

const MEETING_ID = "31015c83-0027-40f2-a04d-b161112dd269"; // Example Meeting ID

const isRecordingButtonName = "Stop Process";
const isNotRecordingButtonName = "Start Process";
const isRecordingButtonColor = "#FF6347";
const isNotRecordingButtonColor = "#32CD32";
const SEGMENT_DURATION_MS = 5 * 1000;
const LEVEL_UPDATE_INTERVAL_MS = 8;

const recordingOptions: RecordingOptions = {
    ...RecordingPresets.HIGH_QUALITY,
    numberOfChannels: 1,
    isMeteringEnabled: true,
    android: { ...RecordingPresets.HIGH_QUALITY.android },
    ios: { ...RecordingPresets.HIGH_QUALITY.ios },
    web: {
        ...RecordingPresets.HIGH_QUALITY.web,
        mimeType: 'audio/webm',
        bitsPerSecond: 128000,
    }
};

const effectiveMimeType = getRecordingMimeType(recordingOptions);


export default function RecordScreen() {
    const audioRecorder = useAudioRecorder(recordingOptions);
    const recorderState = useAudioRecorderState(audioRecorder);

    const [audioLevel, setAudioLevel] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);
    const [lastUriHandled, setLastUriHandled] = useState<string | null>(null);
    const [actualIsRecording, setActualIsRecording] = useState(false);

    // Refs for intervals and web audio objects
    const levelIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const segmentIntervalRef = useRef<NodeJS.Timeout | null>(null); // Keep ref for potential cleanup if needed elsewhere
    const webAudioContextRef = useRef<AudioContext | null>(null);
    const webAnalyserNodeRef = useRef<AnalyserNode | null>(null);
    const webSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const webStreamRef = useRef<MediaStream | null>(null);

    // Ref to prevent race conditions during stop sequence
    const isStoppingRef = useRef(false);

    // Update actualIsRecording based on recorderState
    useEffect(() => {
        setActualIsRecording(recorderState?.isRecording ?? false);
    }, [recorderState?.isRecording]);

    // --- Web Audio Metering Setup/Teardown ---
    const setupWebAudio = async () => {
        if (Platform.OS !== 'web' || webAudioContextRef.current) return;
        console.log("Setting up Web Audio for metering...");
        try {
            // Get user media permission *before* trying to use AudioContext
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            webStreamRef.current = stream;

            const context = new window.AudioContext();
            const analyser = context.createAnalyser();
            analyser.fftSize = 256; // Smaller FFT size for faster response
            analyser.smoothingTimeConstant = 0.3; // Slightly less smoothing
            const source = context.createMediaStreamSource(stream);
            source.connect(analyser);

            webAudioContextRef.current = context;
            webAnalyserNodeRef.current = analyser;
            webSourceNodeRef.current = source;
            console.log("Web Audio metering setup complete.");
            setLastError(null); // Clear permission errors if successful now
        } catch (err) {
            console.error('Failed to start web audio for metering:', err);
            let errorMessage = 'Could not access microphone for metering. Check browser permissions.';
            if (err instanceof Error) errorMessage += ` (${err.name}: ${err.message})`;
            setLastError(errorMessage);
            await teardownWebAudio(); // Clean up partial setup
        }
    };

    const teardownWebAudio = async () => {
        if (Platform.OS !== 'web') return;
        console.log("Tearing down Web Audio metering...");
        resetWebAudioLevel();

        webSourceNodeRef.current?.disconnect();
        webAnalyserNodeRef.current?.disconnect(); // Disconnect analyser too

        // Stop the tracks associated with the stream
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

    // --- Level Monitoring ---
    const startLevelMonitoring = () => {
        if (levelIntervalRef.current) return;
        console.log("Starting level monitoring...");
        levelIntervalRef.current = setInterval(() => {
            let level = 0;
            if (Platform.OS === 'web' && webAnalyserNodeRef.current) {
                level = getWebMicrophoneLevel(webAnalyserNodeRef.current);
            } else if (Platform.OS !== 'web' && recorderState) {
                // Use recorderState directly if available and metering enabled
                level = getMobileMicrophoneLevel(recorderState);
            }
            // Clamp and handle NaN
            level = Math.max(0, Math.min(1, isNaN(level) ? 0 : level));
            setAudioLevel(level);
        }, LEVEL_UPDATE_INTERVAL_MS);
    };

    const stopLevelMonitoring = () => {
        console.log("Stopping level monitoring...");
        if (levelIntervalRef.current) {
            clearInterval(levelIntervalRef.current);
            levelIntervalRef.current = null;
        }
        setAudioLevel(0); // Reset level display
        if (Platform.OS === 'web') {
            resetWebAudioLevel(); // Reset internal web level state
        }
    };

    // --- Segment Processing ---
    const sendAudioSegment = async (uri: string | null) => {
      if (!uri || typeof uri !== 'string') {
          console.warn("sendAudioSegment called with invalid URI:", uri);
          return;
      };
      // Log the URI clearly here
      console.log(`Handling segment URI: ${uri}`);
      setLastUriHandled(uri); // Update UI state

      console.log(`Sending audio segment: ${uri.substring(0, 100)}... to API...`);
      try {
          // *** REPLACE SIMULATION WITH ACTUAL API CALL ***
          const apiResponse = await sendAudioToApi(
              uri,
              MEETING_ID, // Pass the meeting ID
              effectiveMimeType // Pass the determined MIME type
          );

          console.log("API call successful for URI ending with:", uri.slice(-20));
          console.log("API Response Data:", apiResponse); // Log the response from the server
          // You might want to do something with the apiResponse here
          setLastError(null); // Clear API error on success

      } catch (error) {
          let errorMessage = 'An unknown error occurred during API send';
          if (error instanceof Error) { errorMessage = error.message; }
          else if (typeof error === 'string') { errorMessage = error; }
          console.error("Failed to send audio segment:", error);
          setLastError(`API Send Failed: ${errorMessage}`);
          // Decide if a send failure should stop the whole process
          // Consider adding retry logic here if needed
          // await stopProcess(); // Uncomment this if an API failure should halt everything
      }
  };

    // --- Core Segment Recording Logic (called by interval) ---
    const recordAndSendSegment = async () => {
        // Double-check if we are in the process of stopping
        if (isStoppingRef.current) {
            console.log("recordAndSendSegment: Aborting because stop process is active.");
            return;
        }

        let stoppedSegmentUri: string | null = null;

        try {
            // --- Stop the current segment ---
            // Check if recorder thinks it's recording OR if our state tracker thinks so
            if (audioRecorder.isRecording || actualIsRecording) {
                console.log("Stopping previous segment...");
                
                await audioRecorder.stop(); // Use the URI returned by stop()
                setActualIsRecording(false); // Update state immediately after stop
                
                stoppedSegmentUri = audioRecorder.uri;
                console.log(`Segment stopped. URI: ${stoppedSegmentUri || '(No URI returned)'}`);
            } else {
                console.log("recordAndSendSegment: Recorder was not active when trying to stop segment. Skipping stop.");
            }

            // --- Process the stopped segment's URI ---
            if (stoppedSegmentUri) {
                await sendAudioSegment(stoppedSegmentUri); // This now logs the URI and updates state
            } else if (actualIsRecording) { // Check if we *thought* we were recording but got no URI
                console.warn(`Did not receive a valid URI from stop() for the previous segment, though actualIsRecording was true.`);
                setLastUriHandled(null);
            }

            // --- Start the next segment ---
            // Check *again* if a stop was initiated during the async stop/send operations
            if (isStoppingRef.current) {
                console.log("recordAndSendSegment: Aborting start of next segment because stop process became active.");
                return;
            }

            console.log("Preparing recorder for next segment...");
            // Prepare is needed before each record call according to docs/common practice
            await audioRecorder.prepareToRecordAsync(recordingOptions);
            console.log("Recorder prepared for next segment.");

            console.log("Starting next segment...");
            await audioRecorder.record();
            setActualIsRecording(true); // Update state after successful record start
            console.log("Next segment started.");
            setLastError(null); // Clear previous errors on success cycle

        } catch (error) {
            let errorMessage = 'An unknown error occurred';
            if (error instanceof Error) { errorMessage = error.message; }
            else if (typeof error === 'string') { errorMessage = error; }
            console.error("Error during segment cycle:", error);
            setLastError(`Error in segment cycle: ${errorMessage}`);
            setActualIsRecording(false); // Ensure state reflects error
            // Stop the entire process on segment cycle error
            await stopProcess();
        }
    };


    // --- Main Process Control ---
    const startProcess = async () => {
        if (isProcessing) return;
        console.log("Start Process requested...");
        setLastError(null);
        setLastUriHandled(null);
        isStoppingRef.current = false; // Ensure stop flag is reset

        // Set processing state *before* async operations that depend on it
        // Note: The useEffect for interval won't run until *after* this function completes
        // but setting it early signals intent.
        setIsProcessing(true);

        try {
            // Setup dependencies first
            if (Platform.OS === 'web') {
                await setupWebAudio();
                // Check if setup failed (e.g., permissions denied)
                if (!webAudioContextRef.current) {
                    throw new Error("Web Audio setup failed, cannot start process.");
                }
            }
            startLevelMonitoring();

            // Prepare and start the *first* segment
            console.log("Preparing recorder for the first segment...");
            await audioRecorder.prepareToRecordAsync(recordingOptions);
            console.log("Recorder prepared.");

            console.log("Starting first recording segment...");
            await audioRecorder.record();
            setActualIsRecording(true);
            console.log("First segment started successfully.");
            // Now the useEffect based interval will take over for subsequent segments

        } catch (startError) {
            let errorMessage = 'Failed to start recording process';
            if (startError instanceof Error) { errorMessage = startError.message; }
            else if (typeof startError === 'string') { errorMessage = startError; }
            console.error("Error during process start:", startError);
            setLastError(errorMessage);

            // Cleanup on failed start
            isStoppingRef.current = true; // Prevent stopProcess overlap
            setIsProcessing(false); // Revert state
            setActualIsRecording(false);
            stopLevelMonitoring();
            if (Platform.OS === 'web') { await teardownWebAudio(); }
            // Attempt to clean up recorder if prepare/record was called
            try { await audioRecorder.stop(); } catch { /* Ignore error */ }
            // try { await audioRecorder.unloadAsync(); } catch { /* Ignore error */ } // If unload exists/is needed
            isStoppingRef.current = false;
        }
    };

    const stopProcess = async () => {
        // Prevent multiple stop calls / stopping if not processing
        if (!isProcessing || isStoppingRef.current) {
            console.log(`Stop Process requested but not processing (${!isProcessing}) or already stopping (${isStoppingRef.current}). Aborting.`);
            return;
        }
        console.log("Stop Process requested...");
        isStoppingRef.current = true; // Signal that stopping is in progress

        // Set isProcessing to false FIRST. This is crucial.
        // It stops the useEffect from setting up a new interval if it runs,
        // and the cleanup function of the useEffect will clear the *existing* interval.
        setIsProcessing(false);

        // Stop auxiliary processes
        stopLevelMonitoring();
        if (Platform.OS === 'web') {
            await teardownWebAudio();
        }

        // Handle the final audio segment
        let finalSegmentUri: string | null = null;
        try {
            // Check if the recorder was actually recording before stopping
            if (audioRecorder.isRecording || actualIsRecording) {
                console.log("Stopping final segment...");
                
                await audioRecorder.stop();
                setActualIsRecording(false); // Update state
                
                finalSegmentUri = audioRecorder.uri;
                console.log(`Final segment stopped. URI: ${finalSegmentUri || '(No URI returned)'}`);

                if (finalSegmentUri) {
                    // Process the final segment like any other
                    await sendAudioSegment(finalSegmentUri);
                } else {
                    console.warn("Did not receive a valid URI from stop() for the final segment.");
                    setLastUriHandled(null);
                }
            } else {
                console.log("Stop requested, but recorder wasn't active. No final segment to stop.");
            }
        } catch (error) {
            console.error("Error stopping final segment:", error);
            setLastError(`Error stopping final segment: ${error instanceof Error ? error.message : String(error)}`);
            setActualIsRecording(false); // Ensure state consistency
        } finally {
             // Optional: Explicitly unload recorder if necessary. Often stop() is enough.
             // Check expo-audio docs for unloadAsync() or similar if needed.
             // Avoid redundant stop() call here which caused the previous error.
            // try {
            //    console.log("Unloading recorder...");
            //    await audioRecorder.unloadAsync(); // If this method exists
            //    console.log("Recorder unloaded.");
            // } catch (unloadError) {
            //    console.warn("Error unloading recorder:", unloadError);
            // }

            isStoppingRef.current = false; // Release the stop lock
            console.log("Process stopped.");
        }
    };


    // --- Effect for Segment Interval ---
    // This effect runs when `isProcessing` state changes.
    useEffect(() => {
        console.log(`Segment Interval Effect: isProcessing = ${isProcessing}`);
        if (isProcessing) {
            // Start the interval ONLY if processing is true.
            // The first segment is started manually in startProcess.
            // This interval handles stopping segment N and starting segment N+1.
            console.log(`Setting interval for segments every ${SEGMENT_DURATION_MS}ms`);
            segmentIntervalRef.current = setInterval(() => {
                console.log("Segment interval triggered.");
                // Call the function to stop current segment and start next
                recordAndSendSegment();
            }, SEGMENT_DURATION_MS);
        } else {
            // If isProcessing becomes false, clear the interval.
            if (segmentIntervalRef.current) {
                console.log("Clearing segment interval because isProcessing is false.");
                clearInterval(segmentIntervalRef.current);
                segmentIntervalRef.current = null;
            }
        }

        // --- Cleanup Function ---
        // This runs when the component unmounts OR BEFORE the effect runs again.
        return () => {
            console.log("Segment Interval Effect: Cleanup function running.");
            if (segmentIntervalRef.current) {
                console.log("Clearing segment interval in cleanup.");
                clearInterval(segmentIntervalRef.current);
                segmentIntervalRef.current = null;
            }
        };
    }, [isProcessing]); // Dependency: Re-run this effect only when `isProcessing` changes


    // --- Effect for Unmount Cleanup ---
    useEffect(() => {
        // Return a cleanup function that runs when the component unmounts
        return () => {
            console.log("RecordScreen unmounting - cleaning up...");
            // Ensure intervals are cleared (though the effect above should handle segmentInterval)
            if (levelIntervalRef.current) clearInterval(levelIntervalRef.current);
            if (segmentIntervalRef.current) clearInterval(segmentIntervalRef.current);

            // If the process was running on unmount, attempt a clean stop
            // Use a local variable to capture state at the time of unmount setup
            const wasProcessing = isProcessing;
            const wasRecording = actualIsRecording || audioRecorder.isRecording; // Check both

            // Use IIAFE (Immediately Invoked Async Function Expression) for async cleanup
            (async () => {
                if (wasProcessing || wasRecording) {
                    console.log("Unmount: Process or recording was active, attempting graceful stop...");
                    isStoppingRef.current = true; // Prevent race conditions during unmount cleanup
                    setIsProcessing(false); // Ensure state reflects stopping
                    stopLevelMonitoring(); // Stop monitoring first

                    if (Platform.OS === 'web') {
                        await teardownWebAudio();
                    }
                    try {
                        if (audioRecorder.isRecording) { // Check recorder directly
                           console.log("Unmount: Stopping final recording...");
                           
                           await audioRecorder.stop();

                           const finalUri = audioRecorder.uri;
                           console.log("Unmount: Recording stopped.", finalUri ? `URI: ${finalUri.slice(-20)}` : "(No URI)");
                           // Optionally process this final URI if needed
                           // await sendAudioSegment(finalUri);
                        }
                        // Optional: Unload recorder
                        // console.log("Unmount: Unloading recorder...");
                        // await audioRecorder.unloadAsync(); // if available/needed
                        // console.log("Unmount: Recorder unloaded.");
                    } catch (e) {
                        console.error("Error stopping/unloading recorder on unmount:", e);
                    } finally {
                         isStoppingRef.current = false;
                    }
                } else {
                    console.log("Unmount: No active process or recording to stop.");
                    // Still ensure Web Audio is torn down if it was set up
                    if (Platform.OS === 'web' && webAudioContextRef.current) {
                        await teardownWebAudio();
                    }
                }
            })();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency array: This effect runs only once on mount to set up the unmount cleanup

    // --- Render ---
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Expo Audio Recorder</Text>
            {lastError && <Text style={styles.errorText}>Error: {lastError}</Text>}
            <MicrophoneActivityIndicator
                isActive={isProcessing || actualIsRecording} // Indicate activity if processing or recording
                audioLevel={audioLevel} />

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
                title={isProcessing ? isRecordingButtonName : isNotRecordingButtonName}
                onPress={isProcessing ? stopProcess : startProcess}
                color={isProcessing ? isRecordingButtonColor : isNotRecordingButtonColor}
                // Disable start button if there was a setup error (e.g., mic permission)
                // Allow stop button even if there's an error during processing
                disabled={!isProcessing && !!lastError && lastError.includes("permission")}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f0f0f0' },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 25, color: '#333' },
    statusText: { marginVertical: 5, fontSize: 11, color: '#666', textAlign: 'center', maxWidth: '90%' },
    errorText: { color: '#D8000C', backgroundColor: '#FFD2D2', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 5, marginVertical: 10, textAlign: 'center', fontWeight: 'bold', maxWidth: '90%' }
});