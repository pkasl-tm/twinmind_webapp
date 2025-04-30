import React, { useState, useEffect, useRef } from 'react';
import { View, Button, Alert, Text, Platform, StyleSheet, ScrollView } from 'react-native'; // Added ScrollView
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, RecordingOptions } from 'expo-audio';
import { getMobileMicrophoneLevel, getWebMicrophoneLevel, resetWebAudioLevel } from './getMicrophoneLevel';
import { MicrophoneActivityIndicator } from './MicrophoneActivityIndicator';
import { sendAudioToApi, getRecordingMimeType } from './audioApi';
import { styles } from '../styles/RecordScreen'

const MEETING_ID = "31015c83-0027-40f2-a04d-b161112dd269"; 

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
    const [transcriptionText, setTranscriptionText] = useState('');
  

    const levelIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const segmentIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const webAudioContextRef = useRef<AudioContext | null>(null);
    const webAnalyserNodeRef = useRef<AnalyserNode | null>(null);
    const webSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const webStreamRef = useRef<MediaStream | null>(null);
    const isStoppingRef = useRef(false);

    useEffect(() => {
        setActualIsRecording(recorderState?.isRecording ?? false);
    }, [recorderState?.isRecording]);

    const setupWebAudio = async () => {
        if (Platform.OS !== 'web' || webAudioContextRef.current) return;
        console.log("Setting up Web Audio for metering...");
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
            setLastError(null);
        } catch (err) {
            console.error('Failed to start web audio for metering:', err);
            let errorMessage = 'Could not access microphone for metering. Check browser permissions.';
            if (err instanceof Error) errorMessage += ` (${err.name}: ${err.message})`;
            setLastError(errorMessage);
            await teardownWebAudio();
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
            } catch (e) { console.warn("Error closing audio context:", e); }
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
                level = getMobileMicrophoneLevel(recorderState);
            }
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
        setAudioLevel(0);
        if (Platform.OS === 'web') { resetWebAudioLevel(); }
    };

    const sendAudioSegment = async (uri: string | null) => {
      if (!uri || typeof uri !== 'string') {
          console.warn("sendAudioSegment called with invalid URI:", uri);
          return;
      };
      console.log(`Handling segment URI: ${uri}`);
      setLastUriHandled(uri);

      console.log(`Sending audio segment: ${uri.substring(0, 100)}... to API...`);
      try {
          const apiResponse = await sendAudioToApi(
              uri,
              MEETING_ID,
              effectiveMimeType
          );

          console.log("API call successful for URI ending with:", uri.slice(-20));
          console.log("API Response Data:", apiResponse);

          const newTranscription = apiResponse?.transcript; 

          if (typeof newTranscription === 'string' && newTranscription.trim().length > 0) {
              console.log("Received transcription:", newTranscription);
              setTranscriptionText(prevText => prevText + newTranscription + ' ');
          } else {
              console.log("No transcription text received in this segment's response.");
          }

          setLastError(null);

      } catch (error) {
          let errorMessage = 'An unknown error occurred during API send';
          if (error instanceof Error) { errorMessage = error.message; }
          else if (typeof error === 'string') { errorMessage = error; }
          console.error("Failed to send audio segment:", error);
          setLastError(`API Send Failed: ${errorMessage}`);
          // await stopProcess(); // Optional: Stop on API failure
      }
  };

    // --- Core Segment Recording Logic (called by interval) ---
    const recordAndSendSegment = async () => {
        if (isStoppingRef.current) {
            console.log("recordAndSendSegment: Aborting because stop process is active.");
            return;
        }

        let stoppedSegmentUri: string | null = null;

        try {
            if (audioRecorder.isRecording || actualIsRecording) {
                console.log("Stopping previous segment...");
                
                await audioRecorder.stop();
                setActualIsRecording(false);
                
                stoppedSegmentUri = audioRecorder.uri;
                console.log(`Segment stopped. URI: ${stoppedSegmentUri || '(No URI returned)'}`);
            } else {
                console.log("recordAndSendSegment: Recorder was not active when trying to stop segment. Skipping stop.");
            }

            if (stoppedSegmentUri) {
                await sendAudioSegment(stoppedSegmentUri); // Sends and updates transcription
            } else if (actualIsRecording) {
                console.warn(`Did not receive a valid URI from stop() for the previous segment, though actualIsRecording was true.`);
                setLastUriHandled(null);
            }

            if (isStoppingRef.current) {
                console.log("recordAndSendSegment: Aborting start of next segment because stop process became active.");
                return;
            }

            console.log("Preparing recorder for next segment...");
            await audioRecorder.prepareToRecordAsync(recordingOptions);
            console.log("Recorder prepared for next segment.");

            console.log("Starting next segment...");
            await audioRecorder.record();
            setActualIsRecording(true);
            console.log("Next segment started.");
            setLastError(null);

        } catch (error) {
            let errorMessage = 'An unknown error occurred';
            if (error instanceof Error) { errorMessage = error.message; }
            else if (typeof error === 'string') { errorMessage = error; }
            console.error("Error during segment cycle:", error);
            setLastError(`Error in segment cycle: ${errorMessage}`);
            setActualIsRecording(false);
            await stopProcess();
        }
    };


    // --- Main Process Control (MODIFIED) ---
    const startProcess = async () => {
        if (isProcessing) return;
        console.log("Start Process requested...");
        setLastError(null);
        setLastUriHandled(null);
        setTranscriptionText(''); // <-- Reset transcription text
        isStoppingRef.current = false;

        setIsProcessing(true);

        try {
            if (Platform.OS === 'web') {
                await setupWebAudio();
                if (!webAudioContextRef.current) {
                    throw new Error("Web Audio setup failed, cannot start process.");
                }
            }
            startLevelMonitoring();

            console.log("Preparing recorder for the first segment...");
            await audioRecorder.prepareToRecordAsync(recordingOptions);
            console.log("Recorder prepared.");

            console.log("Starting first recording segment...");
            await audioRecorder.record();
            setActualIsRecording(true);
            console.log("First segment started successfully.");

        } catch (startError) {
            let errorMessage = 'Failed to start recording process';
            if (startError instanceof Error) { errorMessage = startError.message; }
            else if (typeof startError === 'string') { errorMessage = startError; }
            console.error("Error during process start:", startError);
            setLastError(errorMessage);

            isStoppingRef.current = true;
            setIsProcessing(false);
            setActualIsRecording(false);
            stopLevelMonitoring();
            if (Platform.OS === 'web') { await teardownWebAudio(); }
            try { await audioRecorder.stop(); } catch { /* Ignore */ }
            isStoppingRef.current = false;
        }
    };

    // --- Stop Process (MODIFIED - Handles final segment transcription) ---
    const stopProcess = async () => {
        if (!isProcessing || isStoppingRef.current) {
            console.log(`Stop Process requested but not processing (${!isProcessing}) or already stopping (${isStoppingRef.current}). Aborting.`);
            return;
        }
        console.log("Stop Process requested...");
        isStoppingRef.current = true;

        // Stop interval *before* processing final segment
        setIsProcessing(false); // This triggers useEffect cleanup

        stopLevelMonitoring();
        if (Platform.OS === 'web') {
            await teardownWebAudio();
        }

        let finalSegmentUri: string | null = null;
        try {
            if (audioRecorder.isRecording || actualIsRecording) {
                console.log("Stopping final segment...");
                
                await audioRecorder.stop();
                setActualIsRecording(false);

                finalSegmentUri = audioRecorder.uri;
                console.log(`Final segment stopped. URI: ${finalSegmentUri || '(No URI returned)'}`);

                if (finalSegmentUri) {
                    // Process the final segment and update transcription one last time
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
            setActualIsRecording(false);
        } finally {
            isStoppingRef.current = false;
            console.log("Process stopped.");
        }
    };

    useEffect(() => {
        console.log(`Segment Interval Effect: isProcessing = ${isProcessing}`);
        if (isProcessing) {
            console.log(`Setting interval for segments every ${SEGMENT_DURATION_MS}ms`);
            segmentIntervalRef.current = setInterval(() => {
                console.log("Segment interval triggered.");
                recordAndSendSegment();
            }, SEGMENT_DURATION_MS);
        } else {
            if (segmentIntervalRef.current) {
                console.log("Clearing segment interval because isProcessing is false.");
                clearInterval(segmentIntervalRef.current);
                segmentIntervalRef.current = null;
            }
        }

        return () => {
            console.log("Segment Interval Effect: Cleanup function running.");
            if (segmentIntervalRef.current) {
                console.log("Clearing segment interval in cleanup.");
                clearInterval(segmentIntervalRef.current);
                segmentIntervalRef.current = null;
            }
        };
    }, [isProcessing]);

    useEffect(() => {
        return () => {
            console.log("RecordScreen unmounting - cleaning up...");
            if (levelIntervalRef.current) clearInterval(levelIntervalRef.current);
            if (segmentIntervalRef.current) clearInterval(segmentIntervalRef.current);

            const wasProcessing = isProcessing;
            const wasRecording = actualIsRecording || audioRecorder.isRecording;

            (async () => {
                if (wasProcessing || wasRecording) {
                    console.log("Unmount: Process or recording was active, attempting graceful stop...");
                    isStoppingRef.current = true;
                    setIsProcessing(false);
                    stopLevelMonitoring();

                    if (Platform.OS === 'web') {
                        await teardownWebAudio();
                    }
                    try {
                        if (audioRecorder.isRecording) {
                           console.log("Unmount: Stopping final recording...");
                           
                           await audioRecorder.stop();
                           const finalUri = audioRecorder.uri;
                           console.log("Unmount: Recording stopped.", finalUri ? `URI: ${finalUri.slice(-20)}` : "(No URI)");
                           if (finalUri) await sendAudioSegment(finalUri);
                        }
                    } catch (e) {
                        console.error("Error stopping recorder on unmount:", e);
                    } finally {
                         isStoppingRef.current = false;
                    }
                } else {
                    console.log("Unmount: No active process or recording to stop.");
                    if (Platform.OS === 'web' && webAudioContextRef.current) {
                        await teardownWebAudio();
                    }
                }
            })();
        };

    }, []);


    return (
        <View style={styles.container}>
            <Text style={styles.title}>Expo Audio Recorder</Text>
            {lastError && <Text style={styles.errorText}>Error: {lastError}</Text>}
            <MicrophoneActivityIndicator
                isActive={isProcessing || actualIsRecording}
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

            {/* --- TRANSCRIPTION DISPLAY --- */}
            <View style={styles.transcriptionContainer}>
                <Text style={styles.transcriptionLabel}>Transcription:</Text>
                <ScrollView style={styles.transcriptionScrollView}>
                    <Text style={styles.transcriptionContent}>
                        {transcriptionText || (isProcessing ? "Listening..." : "Start process to see transcription.")}
                    </Text>
                </ScrollView>
            </View>
            {/* --------------------------- */}


            <Button
                title={isProcessing ? isRecordingButtonName : isNotRecordingButtonName}
                onPress={isProcessing ? stopProcess : startProcess}
                color={isProcessing ? isRecordingButtonColor : isNotRecordingButtonColor}
                disabled={!isProcessing && !!lastError && lastError.includes("permission")}
            />
        </View>
    );
}

