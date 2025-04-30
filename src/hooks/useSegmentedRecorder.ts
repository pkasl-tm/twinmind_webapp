import { useState, useEffect, useRef, useCallback } from 'react';
import { useAudioRecorder, useAudioRecorderState, RecordingOptions } from 'expo-audio';
import { sendAudioToApi } from '../audio/audioApi'; // Adjust path
import { MEETING_ID, SEGMENT_DURATION_MS, EFFECTIVE_MIME_TYPE, RECORDING_OPTIONS } from '../constants/audioConstants'; // Adjust path

interface UseSegmentedRecorderProps {
    recordingOptions?: RecordingOptions;
    segmentDuration?: number;
    meetingId?: string;
    mimeType?: string;
    onStateChange?: (isProcessing: boolean, isRecording: boolean) => void; // Optional callback
    onError?: (error: string | null) => void; // Optional callback
}

export function useSegmentedRecorder({
    recordingOptions = RECORDING_OPTIONS,
    segmentDuration = SEGMENT_DURATION_MS,
    meetingId = MEETING_ID,
    mimeType = EFFECTIVE_MIME_TYPE,
    onStateChange,
    onError,
}: UseSegmentedRecorderProps) {
    const audioRecorder = useAudioRecorder(recordingOptions);
    const recorderState = useAudioRecorderState(audioRecorder);

    const [isProcessing, setIsProcessing] = useState(false); // User intent to process
    const [actualIsRecording, setActualIsRecording] = useState(false); // Reflects recorder.isRecording
    const [lastUriHandled, setLastUriHandled] = useState<string | null>(null);
    const [recorderError, setRecorderError] = useState<string | null>(null);

    const segmentIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isStoppingRef = useRef(false);

    // Notify parent component of state changes
    useEffect(() => {
        onStateChange?.(isProcessing, actualIsRecording);
    }, [isProcessing, actualIsRecording, onStateChange]);

    // Notify parent component of error changes
    useEffect(() => {
        onError?.(recorderError);
    }, [recorderError, onError]);

    // Update actualIsRecording based on recorderState
    useEffect(() => {
        setActualIsRecording(recorderState?.isRecording ?? false);
    }, [recorderState?.isRecording]);

    // --- Segment Processing ---
    const sendAudioSegment = useCallback(async (uri: string | null) => {
        if (!uri || typeof uri !== 'string') {
            console.warn("sendAudioSegment called with invalid URI:", uri);
            return;
        };
        console.log(`Handling segment URI: ${uri}`);
        setLastUriHandled(uri); // Update UI state

        console.log(`Sending audio segment: ${uri.substring(0, 100)}... to API...`);
        try {
            const apiResponse = await sendAudioToApi(uri, meetingId, mimeType);
            console.log("API call successful for URI ending with:", uri.slice(-20));
            console.log("API Response Data:", apiResponse);
            setRecorderError(null); // Clear API error on success
        } catch (error) {
            let errorMessage = 'An unknown error occurred during API send';
            if (error instanceof Error) { errorMessage = error.message; }
            else if (typeof error === 'string') { errorMessage = error; }
            console.error("Failed to send audio segment:", error);
            setRecorderError(`API Send Failed: ${errorMessage}`);
            // Decide if a send failure should stop the whole process
            // stopRecordingProcess(); // Uncomment if API failure should halt everything
        }
    }, [meetingId, mimeType]); // Dependencies for sendAudioSegment

    // --- Core Segment Recording Logic (called by interval) ---
    const recordAndSendSegment = useCallback(async () => {
        if (isStoppingRef.current) {
            console.log("recordAndSendSegment: Aborting because stop process is active.");
            return;
        }

        let stoppedSegmentUri: string | null = null;

        try {
            // --- Stop the current segment ---
            if (audioRecorder.isRecording || actualIsRecording) {
                console.log("Stopping previous segment...");
                await audioRecorder.stop();
                setActualIsRecording(false); // Update state immediately
                stoppedSegmentUri = audioRecorder.uri;
                console.log(`Segment stopped. URI: ${stoppedSegmentUri || '(No URI returned)'}`);
            } else {
                console.log("recordAndSendSegment: Recorder not active when trying to stop. Skipping stop.");
            }

            // --- Process the stopped segment's URI ---
            if (stoppedSegmentUri) {
                await sendAudioSegment(stoppedSegmentUri);
            } else if (actualIsRecording) { // Check if we *thought* we were recording but got no URI
                console.warn(`No valid URI from stop(), though actualIsRecording was true.`);
                setLastUriHandled(null);
            }

            // --- Start the next segment ---
            if (isStoppingRef.current) {
                 console.log("recordAndSendSegment: Aborting start next segment (stop became active).");
                 return;
            }
            if (!isProcessing) { // Also check if user intent changed
                 console.log("recordAndSendSegment: Aborting start next segment (isProcessing is false).");
                 return;
            }


            console.log("Preparing recorder for next segment...");
            await audioRecorder.prepareToRecordAsync(recordingOptions);
            console.log("Recorder prepared.");
            await audioRecorder.record();
            setActualIsRecording(true);
            console.log("Next segment started.");
            setRecorderError(null); // Clear previous errors on success cycle

        } catch (error) {
            let errorMessage = 'An unknown error occurred';
            if (error instanceof Error) { errorMessage = error.message; }
            else if (typeof error === 'string') { errorMessage = error; }
            console.error("Error during segment cycle:", error);
            setRecorderError(`Error in segment cycle: ${errorMessage}`);
            setActualIsRecording(false); // Ensure state reflects error
            stopRecordingProcess(); // Stop the entire process on error
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioRecorder, actualIsRecording, sendAudioSegment, recordingOptions, stopRecordingProcess, isProcessing]); // Add isProcessing dependency


    // --- Main Process Control ---
    const startRecordingProcess = useCallback(async () => {
        if (isProcessing) return;
        console.log("Start Process requested...");
        setRecorderError(null);
        setLastUriHandled(null);
        isStoppingRef.current = false;
        setIsProcessing(true); // Signal intent to start

        try {
            // Prepare and start the *first* segment
            console.log("Preparing recorder for the first segment...");
            await audioRecorder.prepareToRecordAsync(recordingOptions);
            console.log("Recorder prepared.");

            console.log("Starting first recording segment...");
            await audioRecorder.record();
            setActualIsRecording(true); // State now reflects recorder
            console.log("First segment started successfully.");
            // Interval effect will handle subsequent segments

        } catch (startError) {
            let errorMessage = 'Failed to start recording process';
            if (startError instanceof Error) { errorMessage = startError.message; }
            else if (typeof startError === 'string') { errorMessage = startError; }
            console.error("Error during process start:", startError);
            setRecorderError(errorMessage);

            // Cleanup on failed start
            isStoppingRef.current = true; // Prevent stopProcess overlap
            setIsProcessing(false); // Revert state
            setActualIsRecording(false);
            try { if (audioRecorder.isRecording) await audioRecorder.stop(); } catch { /* Ignore */ }
            isStoppingRef.current = false;
        }
    }, [isProcessing, audioRecorder, recordingOptions]);

    const stopRecordingProcess = useCallback(async () => {
        // Prevent multiple stop calls / stopping if not processing
        if (!isProcessing || isStoppingRef.current) {
            console.log(`Stop Process requested but not processing (${!isProcessing}) or already stopping (${isStoppingRef.current}). Aborting.`);
            return;
        }
        console.log("Stop Process requested...");
        isStoppingRef.current = true;
        setIsProcessing(false); // Signal intent to stop - THIS STOPS THE INTERVAL EFFECT

        // Handle the final audio segment
        let finalSegmentUri: string | null = null;
        try {
            if (audioRecorder.isRecording || actualIsRecording) { // Check both states
                console.log("Stopping final segment...");
                await audioRecorder.stop();
                setActualIsRecording(false); // Update state
                finalSegmentUri = audioRecorder.uri;
                console.log(`Final segment stopped. URI: ${finalSegmentUri || '(No URI returned)'}`);

                if (finalSegmentUri) {
                    await sendAudioSegment(finalSegmentUri);
                } else {
                    console.warn("No valid URI from final stop().");
                    setLastUriHandled(null);
                }
            } else {
                console.log("Stop requested, but recorder wasn't active. No final segment.");
            }
        } catch (error) {
            console.error("Error stopping final segment:", error);
            setRecorderError(`Error stopping final segment: ${error instanceof Error ? error.message : String(error)}`);
            setActualIsRecording(false); // Ensure state consistency
        } finally {
            // Optional: Unload recorder if needed, check expo-audio docs
            // try { await audioRecorder.unloadAsync(); } catch (e) { console.warn("Error unloading:", e); }
            isStoppingRef.current = false; // Release the stop lock
            console.log("Process stopped.");
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isProcessing, audioRecorder, actualIsRecording, sendAudioSegment]); // Dependencies for stop

    // --- Effect for Segment Interval ---
    useEffect(() => {
        // Clear any existing interval on effect run
        if (segmentIntervalRef.current) {
            clearInterval(segmentIntervalRef.current);
            segmentIntervalRef.current = null;
        }

        if (isProcessing) {
            // Start interval ONLY if processing. The first segment is started manually.
            // This interval handles stopping N and starting N+1.
            console.log(`Setting interval for segments every ${segmentDuration}ms`);
            // Run immediately *after* the first segment has been running for segmentDuration
             segmentIntervalRef.current = setInterval(() => {
                 console.log("Segment interval triggered.");
                 recordAndSendSegment();
             }, segmentDuration);
        }

        // Cleanup: Clear interval when isProcessing becomes false or component unmounts
        return () => {
            if (segmentIntervalRef.current) {
                console.log("Clearing segment interval in cleanup.");
                clearInterval(segmentIntervalRef.current);
                segmentIntervalRef.current = null;
            }
        };
    }, [isProcessing, segmentDuration, recordAndSendSegment]); // Rerun when these change

     // --- Effect for Unmount Cleanup ---
     useEffect(() => {
        // Return cleanup function for unmount
        return () => {
            console.log("useSegmentedRecorder unmounting - ensuring process is stopped.");
            // Use IIAFE for async cleanup
            (async () => {
                // If processing was active on unmount, trigger a stop
                if (isProcessing || actualIsRecording) { // Check if we were trying to process OR if recorder was active
                     await stopRecordingProcess();
                }
                 // Optional: Explicit unload on unmount if necessary
                 // try { await audioRecorder.unloadAsync(); } catch (e) { console.warn("Unmount unload error:", e); }
            })();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency array: This effect runs only once on mount to set up the unmount cleanup


    return {
        isProcessing, // User intent state
        actualIsRecording, // Recorder's physical state
        lastUriHandled,
        recorderError,
        recorderState, // Expose for level monitoring hook
        startRecordingProcess,
        stopRecordingProcess,
    };
}