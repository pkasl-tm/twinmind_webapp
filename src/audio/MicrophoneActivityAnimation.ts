import React, { useEffect, useRef, useState } from 'react';
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


function AnimatedBar(level : number, isActive: boolean) {
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
}