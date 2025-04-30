// src/hooks/useAudioRecording.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { AudioRecorder, useAudioRecorder, RecordingPresets } from 'expo-audio';
import { AudioSegment } from '../../components/types/audio';
import { SEGMENT_DURATION_SECONDS } from '../../src/constants'; // Adjust path


export function useAudioRecording() {
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecordingActive, setIsRecordingActive] = useState(false); // User's intention
  const [isRecorderInstanceRecording, setIsRecorderInstanceRecording] = useState(false); // Actual recorder state
  const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);
  const [segmentTimer, setSegmentTimer] = useState(0);
  // Use state for transition flag if its changes need to reliably trigger effects/UI updates
  const [isTransitioning, setIsTransitioning] = useState(false);

  const segmentTimerRef = useRef(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const segmentCountRef = useRef(0);
  // isTransitioningSegment ref might still be useful for synchronous checks within rapid operations
  // but useEffect should depend on the state 'isTransitioning'
  const isTransitioningSegment = useRef(false);

  // --- State Sync Effects ---
  useEffect(() => {
    const newIsRecording = audioRecorder.isRecording ?? false;
    if (newIsRecording !== isRecorderInstanceRecording) {
      setIsRecorderInstanceRecording(newIsRecording);
      console.log(`Recorder instance state updated via hook: ${newIsRecording ? 'Recording' : 'Not Recording'}`);
    }
  }, [audioRecorder.isRecording]);

  useEffect(() => {
    segmentTimerRef.current = segmentTimer;
  }, [segmentTimer]);

  // --- Core Logic (Callbacks first, then effects depending on them) ---

  const stopRecordingProcess = useCallback(async (calledInternallyOnError = false) => {
    console.log(`Stopping recording process... (Called internally: ${calledInternallyOnError})`);

    // *** Set the intention state FIRST ***
    // This will trigger the useEffect cleanup for the timer.
    setIsRecordingActive(false);
    isTransitioningSegment.current = false; // Reset ref immediately
    setIsTransitioning(false); // Reset state too

    // No need to clear interval here - useEffect handles it.

    // Reset timer state/ref immediately
    segmentTimerRef.current = 0;
    setSegmentTimer(0);

    // Handle final segment completion AFTER setting state
    // Use the most recent recorder state check
    const currentRecorderIsRecording = audioRecorder.isRecording; // Check fresh value

    if (currentRecorderIsRecording && !isTransitioningSegment.current) { // Check ref for sync operation safety
      console.log('Stop requested: Recorder instance active, completing final segment...');
      const isFinalSegment = true;
      // Ensure completeCurrentSegment uses the latest state/ref values internally
      await completeCurrentSegment(isFinalSegment);
    } else if (currentRecorderIsRecording && isTransitioningSegment.current) {
      console.warn("Stop called while segment transition was in progress. Attempting direct stop.");
      try {
        await audioRecorder.stop();
        setIsRecorderInstanceRecording(false);
        console.log("Directly stopped recorder during transition.");
        const uri = audioRecorder.uri;
        if (uri) console.log("Saving potentially partial segment after direct stop:", uri);
      } catch (e) {
        console.error("Error during direct stop:", e);
      } finally {
         isTransitioningSegment.current = false; // Ensure ref is reset
         setIsTransitioning(false); // Ensure state is reset
      }
    } else {
      console.log('Stop requested: Recorder instance was already stopped or transition handling it.');
      if (isRecorderInstanceRecording) setIsRecorderInstanceRecording(false);
    }
    console.log('Recording process stop initiated.');
  }, [audioRecorder, isRecorderInstanceRecording]); // Removed completeCurrentSegment from deps here to avoid potential circularity if it calls stop. It will read its own state/refs. Add if strictly needed.

  const completeCurrentSegment = useCallback(async (isFinalSegment = false): Promise<void> => {
    // Guard remains the same
    if (isTransitioningSegment.current || !audioRecorder.isRecording) {
       // ... (warning logs) ...
       if (!audioRecorder.isRecording && isRecorderInstanceRecording) setIsRecorderInstanceRecording(false);
       return;
    }

    // Set transition state/ref INITIALLY
    isTransitioningSegment.current = true;
    setIsTransitioning(true); // Trigger effect cleanup for timer etc.
    console.log('Completing current segment...');

    let segmentUri: string | null = null; // Store URI temporarily

    try {
      // Stop recording first
      await audioRecorder.stop();
      segmentUri = audioRecorder.uri; // Get URI after stopping
      setIsRecorderInstanceRecording(false);
      console.log(`Recording stopped for segment completion. URI: ${segmentUri}`);

      if (segmentUri) {
        const timestamp = new Date().toLocaleTimeString();
        segmentCountRef.current += 1;
        const segmentNumber = segmentCountRef.current;
        const newSegment: AudioSegment = {
          id: Date.now().toString(), uri: segmentUri, timestamp, title: `Segment ${segmentNumber}`
        };
        setAudioSegments(prevSegments => [...prevSegments, newSegment]);
        console.log(`Completed segment ${segmentNumber}: ${segmentUri}. Added to list.`);
      } else {
        console.error('No URI available after stopping recorded segment');
      }

      // *** Check if we need to start the next segment ***
      if (!isFinalSegment && isRecordingActive) {
        console.log('Overall recording is still active, attempting to start next segment...');

        // ***** FIX: Reset transition flags BEFORE calling startNewSegment *****
        console.log('Resetting transition flag before starting next segment.');
        isTransitioningSegment.current = false;
        setIsTransitioning(false); // Allow timer effect to potentially restart if needed

        const started = await startNewSegment(); // Now startNewSegment's guard should pass

        if (!started) {
          console.error("Failed to start the next segment automatically. Stopping process.");
          // If startNewSegment fails now, it will set its own transition flag and handle cleanup/stop
          // We might not need to explicitly call stopRecordingProcess here again, as startNewSegment does it on failure.
          // Let's rely on startNewSegment's error handling. If it returns false, the process should already be stopping.
        } else {
          console.log("Next segment started successfully by completeCurrentSegment.");
          // startNewSegment resets its *own* transition flags on success.
        }
      } else {
         console.log(`Not starting new segment. Reason: ${isFinalSegment ? 'Final segment' : 'User stopped overall recording'}.`);
         // If not starting new, ensure transition flags are reset here too
         isTransitioningSegment.current = false;
         setIsTransitioning(false);
      }

    } catch (error) {
      console.error('Error completing segment:', error);
      Alert.alert('Recording Error', 'Failed to properly save or transition audio segment.');
      // Ensure flags are reset on error too
      isTransitioningSegment.current = false;
      setIsTransitioning(false);
      await stopRecordingProcess(true); // Stop on error
    }
    // No finally needed if all code paths reset the flags
  }, [audioRecorder, isRecordingActive, isRecorderInstanceRecording, startNewSegment, stopRecordingProcess]); // Keep dependencies

  // --- Effect to Manage Timer Interval (Check dependencies) ---
  useEffect(() => {
    if (isRecordingActive && !isTransitioning) {
      // ... (timer starting logic) ...
      timerIntervalRef.current = setInterval(() => {
        if (!isTransitioningSegment.current) { // Check ref inside interval
            // ... (increment timer logic) ...
            if (newTime >= SEGMENT_DURATION_SECONDS) {
              console.log(`[Interval Tick] Timer reached ${SEGMENT_DURATION_SECONDS}s, completing segment`);
              // *** Use the useCallback version ***
              completeCurrentSegment().catch(e => { // Call the memoized function
                console.error("Error completing segment from timer:", e);
                stopRecording();
              });
            }
        }
      }, 1000);
      // ... (log interval start) ...
      return () => {
        // ... (cleanup logic) ...
      };
    } else {
      // ... (timer clearing logic) ...
    }
   // *** Ensure completeCurrentSegment and stopRecording are stable dependencies ***
   // If they cause infinite loops, wrap their definitions further if needed, but useCallback should be sufficient.
  }, [isRecordingActive, isTransitioning, completeCurrentSegment, stopRecording]);

  // ... rest of the hook (startNewSegment, record, stopRecording, etc.)
  // Ensure startNewSegment also resets its flags reliably on success/error paths within itself.

  const startNewSegment = useCallback(async (): Promise<boolean> => {
    // Guard using ref for immediate check
    if (audioRecorder.isRecording || isTransitioningSegment.current) {
      console.warn('startNewSegment called but recorder is busy or transitioning. Skipping.');
      return false;
    }

    // Set transition state/ref
    isTransitioningSegment.current = true;
    setIsTransitioning(true); // Trigger effects dependent on transition start

    try {
      console.log('Preparing...');
      await audioRecorder.prepareToRecordAsync();
      console.log('Prepared. Recording...');
      await audioRecorder.record(); // This might return quickly on web
      console.log('audioRecorder.record() call completed.');

      // Maybe add a tiny delay on web? - Test without first.
      // if (Platform.OS === 'web') { await new Promise(resolve => setTimeout(resolve, 100)); }

      segmentTimerRef.current = 0;
      setSegmentTimer(0);

      setIsRecorderInstanceRecording(true);
      console.log('Started new segment successfully.');
      isTransitioningSegment.current = false; // Reset ref on success
      setIsTransitioning(false); // Reset state on success (triggers timer effect etc.)
      return true;
    } catch (error) {
      console.error('Error starting new segment:', error);
      Alert.alert('Recording Error', 'Failed to start the next audio segment.');
      setIsRecorderInstanceRecording(false); // Ensure state reflects failure
      isTransitioningSegment.current = false; // Reset ref on error
      setIsTransitioning(false); // Reset state on error
      // Stop the whole process cleanly if starting a segment fails
      // Avoid calling stopRecordingProcess directly if it causes dependency issues.
      // Instead, set isRecordingActive to false? Let's keep stopRecordingProcess for now.
      await stopRecordingProcess(true);
      return false;
    }
    // No finally needed here either if all paths reset
  }, [audioRecorder, stopRecordingProcess]); // Add dependencies (stopRecordingProcess might be needed)

  // --- Public Control Functions ---
  const record = useCallback(async (): Promise<boolean> => {
    if (isRecordingActive) {
      console.log("Record button pressed, but already recording.");
      return false;
    }
    console.log('Starting recording process...');
    setAudioSegments([]); // Clear previous segments
    segmentCountRef.current = 0;
    segmentTimerRef.current = 0;
    setSegmentTimer(0); // Reset timer state

    // *** Set the intention state ***
    // The useEffect below will handle starting the timer and the initial segment.
    setIsRecordingActive(true);

    // Optionally, immediately try starting the first segment.
    // The timer effect will catch up.
    const started = await startNewSegment();
    if (!started) {
         console.error("Initial startNewSegment failed. Aborting recording start.");
         setIsRecordingActive(false); // Turn off intention if first start fails
         return false;
    }
    return true; // Indicate success
  }, [isRecordingActive, startNewSegment]); // Dependencies

  const stopRecording = useCallback(async (): Promise<void> => {
    if (!isRecordingActive && !audioRecorder.isRecording) {
      console.log("Stop called, but already stopped.");
      return;
    }
     if (!isRecordingActive && audioRecorder.isRecording){
        console.warn("Stop called while isRecordingActive=false, but recorder instance might be running. Proceeding with cleanup.");
    }
    await stopRecordingProcess(false);
  }, [isRecordingActive, stopRecordingProcess, audioRecorder.isRecording]);

  // --- Effect to Manage Timer Interval ---
  useEffect(() => {
    // Only run if recording is intended AND not currently transitioning
    if (isRecordingActive && !isTransitioning) {
      console.log('[Effect] Conditions met. Starting timer interval.');

      // Start the interval
      timerIntervalRef.current = setInterval(() => {
        // Check transition state directly inside interval to pause timer during transition
        if (!isTransitioningSegment.current) { // Check ref for most up-to-date status within tick
            const newTime = segmentTimerRef.current + 1;
            segmentTimerRef.current = newTime;
            setSegmentTimer(newTime); // Update state for UI
            // console.log(`[Interval Tick] Timer incremented to ${newTime}`); // Reduce log noise

            if (newTime >= SEGMENT_DURATION_SECONDS) {
              console.log(`[Interval Tick] Timer reached ${SEGMENT_DURATION_SECONDS}s, completing segment`);
              // Don't await here, let it run async
              completeCurrentSegment().catch(e => {
                console.error("Error completing segment from timer:", e);
                stopRecording(); // Stop the whole process on timer completion error
              });
            }
        } else {
             // console.log("[Interval Tick] Timer paused due to segment transition."); // Reduce log noise
        }
      }, 1000);
      console.log("Segment timer interval started ID:", timerIntervalRef.current);

      // Cleanup function for this effect execution
      return () => {
        console.log('[Effect Cleanup] Clearing interval ID:', timerIntervalRef.current);
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      };
    } else {
      // This block runs if isRecordingActive becomes false OR if isTransitioning becomes true
      console.log(`[Effect] Conditions NOT met for timer (Active: ${isRecordingActive}, Transitioning: ${isTransitioning}). Ensuring timer cleared.`);
      // Clear any existing interval if conditions are no longer met
      if (timerIntervalRef.current) {
        console.log('[Effect] Clearing existing interval due to condition change.');
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    // Dependencies: Run when intention changes or transition state changes
  }, [isRecordingActive, isTransitioning, completeCurrentSegment, stopRecording]); // Add necessary dependencies

  // --- Debug ---
  const forceIncrementTimer = useCallback(() => {
    if (!isRecordingActive || isTransitioning) return; // Check state
    const newTime = segmentTimerRef.current + 1;
    console.log(`Manually incrementing timer to ${newTime}`);
    segmentTimerRef.current = newTime;
    setSegmentTimer(newTime);
    if (newTime >= SEGMENT_DURATION_SECONDS) {
      console.log(`Manual timer reached ${SEGMENT_DURATION_SECONDS}s, completing segment`);
      completeCurrentSegment().catch(e => console.error("Error completing segment from manual timer:", e));
    }
  }, [isRecordingActive, isTransitioning, completeCurrentSegment]); // Dependencies

  // --- Hook Cleanup Effect ---
  useEffect(() => {
    return () => {
      console.log("useAudioRecording Hook unmounting: Cleaning up...");
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (audioRecorder.isRecording) {
        console.log("Unmount: Stopping active recorder instance...");
        audioRecorder.stop()
          .then(() => console.log("Unmount: Recorder stopped successfully."))
          .catch(e => console.error("Error stopping recorder on unmount:", e));
      }
    };
  }, [audioRecorder]); // Dependency on audioRecorder instance

  return {
    isRecordingActive,
    isRecorderInstanceRecording,
    audioSegments,
    segmentTimer,
    segmentCount: segmentCountRef.current,
    isTransitioning, // Expose the state
    record,
    stopRecording,
    forceIncrementTimer,
  };
}