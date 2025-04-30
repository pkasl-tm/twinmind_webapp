// MicrophoneActivityIndicator.js
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
    interpolate,
    Extrapolate,
} from 'react-native-reanimated';

// --- Constants ---
const BAR_WIDTH = 6;
const BAR_MAX_HEIGHT = 40;
const BAR_MIN_HEIGHT = 10; // Base height (when scaleY = 1)
const GAP = 4;
const ACTIVE_COLOR = '#53a158';
const INACTIVE_COLOR = '#878ea1';
const ANIMATION_DURATION_LEVEL = 50;
const ANIMATION_DURATION_ACTIVE = 200;
const PROPAGATION_DELAY = 50; 

// Ensure Min Height is valid for scaling base
if (BAR_MIN_HEIGHT <= 0) {
    console.error("MicrophoneActivityIndicator: BAR_MIN_HEIGHT must be positive to be used as a scaling base.");
}

// Individual bar component
function AnimatedBar({ level, isActive }) {
    // Convert from props to shared value
    const levelValue = useSharedValue(level);
    const activeState = useSharedValue(isActive ? 1 : 0);
    
    // Update when props change
    useEffect(() => {
        levelValue.value = withTiming(level, {
            duration: ANIMATION_DURATION_LEVEL,
            easing: Easing.out(Easing.quad),
        });
        
        activeState.value = withTiming(isActive ? 1 : 0, {
            duration: ANIMATION_DURATION_ACTIVE,
            easing: Easing.inOut(Easing.quad),
        });
    }, [level, isActive]);
    
    // Create animated style
    const animatedStyle = useAnimatedStyle(() => {
        // Calculate target height based on level
        const targetHeight = interpolate(
            levelValue.value,
            [0, 1],
            [BAR_MIN_HEIGHT, BAR_MAX_HEIGHT],
            Extrapolate.CLAMP
        );

        // Interpolate current height based on active state
        const currentEffectiveHeight = interpolate(
            activeState.value,
            [0, 1],
            [BAR_MIN_HEIGHT, targetHeight],
            Extrapolate.CLAMP
        );

        // Calculate scale factor
        const scaleY = currentEffectiveHeight / BAR_MIN_HEIGHT;

        // Interpolate opacity based on active state
        const currentOpacity = interpolate(
            activeState.value,
            [0, 1],
            [0.5, 1],
            Extrapolate.CLAMP
        );

        // Determine color based on active state
        const bgColor = activeState.value > 0.5 ? ACTIVE_COLOR : INACTIVE_COLOR;

        return {
            backgroundColor: bgColor,
            opacity: currentOpacity,
            transform: [{ scaleY }],
        };
    });
    
    return <Animated.View style={[styles.bar, animatedStyle]} />;
}

// Main component that handles bar levels and propagation
export function MicrophoneActivityIndicator({
    audioLevel = 0,
    isActive = false,
    numberOfBars = 7,
    propagationDelay = PROPAGATION_DELAY, // Add prop to allow customization
}) {
    // Store previous audio levels for propagation
    const levelHistory = useRef(Array(numberOfBars).fill(0));
    const wasActive = useRef(isActive);
    const [levels, setLevels] = useState(Array(numberOfBars).fill(0));
    const lastUpdateTime = useRef(0);
    const pendingLevels = useRef(null);
    
    // Handle level propagation with controlled timing
    useEffect(() => {
        if (numberOfBars !== levelHistory.current.length) {
            // Reset history if bar count changes
            levelHistory.current = Array(numberOfBars).fill(0);
            setLevels(Array(numberOfBars).fill(0));
        }
        
        if (isActive) {
            const now = Date.now();
            
            if (!wasActive.current) {
                // Initial activation: only the rightmost bar gets current audio level
                const newLevels = Array(numberOfBars).fill(0);
                newLevels[numberOfBars - 1] = audioLevel;
                levelHistory.current = newLevels;
                setLevels(newLevels);
                lastUpdateTime.current = now;
            } else {
                // Store the latest audio level for the rightmost bar
                const currentLevels = [...levelHistory.current];
                currentLevels[numberOfBars - 1] = audioLevel;
                levelHistory.current = currentLevels;
                
                // Check if it's time to propagate
                if (now - lastUpdateTime.current >= propagationDelay) {
                    // Shift values to the left and keep latest value at the end
                    const newLevels = [...currentLevels.slice(1), audioLevel];
                    levelHistory.current = newLevels;
                    setLevels(newLevels);
                    lastUpdateTime.current = now;
                } else {
                    // Just update the current display without shifting
                    setLevels(currentLevels);
                    
                    // Schedule the next propagation if not already scheduled
                    if (!pendingLevels.current) {
                        const remainingDelay = propagationDelay - (now - lastUpdateTime.current);
                        pendingLevels.current = setTimeout(() => {
                            // Shift values to the left
                            const newLevels = [...levelHistory.current.slice(1), levelHistory.current[numberOfBars - 1]];
                            levelHistory.current = newLevels;
                            setLevels(newLevels);
                            lastUpdateTime.current = Date.now();
                            pendingLevels.current = null;
                        }, remainingDelay);
                    }
                }
            }
        } else {
            // When inactive, reset all levels to zero
            levelHistory.current = Array(numberOfBars).fill(0);
            setLevels(Array(numberOfBars).fill(0));
            
            // Clear any pending updates
            if (pendingLevels.current) {
                clearTimeout(pendingLevels.current);
                pendingLevels.current = null;
            }
        }
        
        wasActive.current = isActive;
        
        // Cleanup function
        return () => {
            if (pendingLevels.current) {
                clearTimeout(pendingLevels.current);
                pendingLevels.current = null;
            }
        };
    }, [audioLevel, isActive, numberOfBars, propagationDelay]);
    
    return (
        <View style={styles.container}>
            {levels.map((level, index) => (
                <AnimatedBar
                    key={`bar-${index}`}
                    level={level}
                    isActive={isActive}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: BAR_MAX_HEIGHT + 8,
        gap: GAP,
        paddingHorizontal: 5,
    },
    bar: {
        width: BAR_WIDTH,
        height: BAR_MIN_HEIGHT,
        borderRadius: BAR_WIDTH / 2,
    },
});