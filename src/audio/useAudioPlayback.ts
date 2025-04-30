// src/hooks/useAudioPlayback.ts
import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { Audio, AVPlaybackStatus, AVPlaybackStatusSuccess, AVPlaybackStatusError } from 'expo-av';
import { AudioSegment } from '../../components/types/audio'; 

export function useAudioPlayback() {
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const stopSegmentPlayback = useCallback(async (): Promise<void> => {
    if (soundRef.current) {
      console.log('Stopping and unloading current playback...');
      const soundToUnload = soundRef.current;
      soundRef.current = null;
      try {
        // Prevent further status updates after initiating stop
        soundToUnload.setOnPlaybackStatusUpdate(null);
        await soundToUnload.stopAsync();
        await soundToUnload.unloadAsync();
        console.log("Playback stopped and unloaded.");
      } catch (error) {
        // Don't reset currentlyPlaying here, let the caller decide
        console.warn('Error stopping/unloading playback:', error);
      }
    }
    // Always ensure state reflects no playback if stop is called successfully or fails
    // unless the failure was minor during unload and we want to try playing again immediately.
    // For safety, setting to null is generally better upon explicit stop request.
    if (currentlyPlaying !== null) {
         setCurrentlyPlaying(null);
    }
  }, [currentlyPlaying]); // Add currentlyPlaying as dependency

  const playSegment = useCallback(async (segment: AudioSegment): Promise<void> => {
    try {
      // Stop any currently playing sound *before* checking if it's the same segment
      if (soundRef.current) {
          await stopSegmentPlayback(); // This will also setCurrentlyPlaying(null)
      }

      // If the user clicked the same segment that was just stopped, don't restart
      if (currentlyPlaying === segment.id) {
           // state was already set to null by stopSegmentPlayback
           return;
      }

      console.log(`Loading segment for playback: ${segment.uri}`);
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: segment.uri },
        { shouldPlay: true } // Start playing immediately
      );

      if (!status.isLoaded) {
        const errorMsg = (status as AVPlaybackStatusError).error || 'Unknown loading error.';
        console.error(`Failed to load sound for segment ${segment.id}. Error: ${errorMsg}`);
        Alert.alert('Playback Error', `Could not load segment ${segment.title}. ${errorMsg}`);
        soundRef.current = null; // Ensure ref is null
        setCurrentlyPlaying(null); // Ensure state is null
        // Attempt to unload even if loading failed partially
        await sound.unloadAsync().catch(e => console.warn("Error unloading partially loaded sound:", e));
        return;
      }

      // Successfully loaded
      soundRef.current = sound;
      setCurrentlyPlaying(segment.id); // Set playing *after* successful load

      sound.setOnPlaybackStatusUpdate((playbackStatus: AVPlaybackStatus) => {
        // Ensure the update is for the sound we currently care about
        if (sound !== soundRef.current) {
             console.log("Ignoring status update for obsolete sound instance.");
             return;
        }

        if (!playbackStatus.isLoaded) {
          if ('error' in playbackStatus) {
            const errorMsg = playbackStatus.error;
            console.error(`Playback Error for segment ${segment.id}:`, errorMsg);
            Alert.alert('Playback Error', `Could not play segment ${segment.title}. ${errorMsg}`);
            stopSegmentPlayback(); // Clean up
            // setCurrentlyPlaying(null) is handled by stopSegmentPlayback
          }
          // If not loaded and no error, it might be unloading, ignore.
          return;
        }

        // If loaded, status is AVPlaybackStatusSuccess
        if (playbackStatus.didJustFinish) {
          console.log(`Segment ${segment.id} finished playing.`);
          stopSegmentPlayback(); // Clean up
          // setCurrentlyPlaying(null) is handled by stopSegmentPlayback
        }
      });

    } catch (error) {
      console.error('Error initiating segment playback:', error);
      Alert.alert('Playback Error', `Could not load or play segment ${segment.title}.`);
      setCurrentlyPlaying(null);
      // Attempt cleanup even if initial load/play failed
      await stopSegmentPlayback();
    }
  // Include stopSegmentPlayback in dependency array as it's used inside
  }, [currentlyPlaying, stopSegmentPlayback]);

  // Cleanup effect for the hook itself
  useEffect(() => {
      // Return a cleanup function that stops playback when the component using the hook unmounts
      return () => {
          stopSegmentPlayback().catch(e => console.warn("Error stopping playback on hook unmount:", e));
      };
  }, [stopSegmentPlayback]); // Dependency on the stable stopSegmentPlayback function

  return {
    currentlyPlaying,
    playSegment,
    stopSegmentPlayback, // Expose stop if needed externally
  };
}