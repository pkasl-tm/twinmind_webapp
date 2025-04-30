// src/components/SegmentListItem.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AudioSegment } from '../types/audio'; // Adjust path

interface SegmentListItemProps {
  item: AudioSegment;
  currentlyPlaying: string | null;
  onPlayPress: (item: AudioSegment) => void;
}

export const SegmentListItem: React.FC<SegmentListItemProps> = ({
  item,
  currentlyPlaying,
  onPlayPress,
}) => {
  const isPlayingThis = currentlyPlaying === item.id;
  const isDisabled = currentlyPlaying !== null && !isPlayingThis;

  return (
    <View style={styles.segmentItem}>
      <View style={styles.segmentInfo}>
        <Text style={styles.segmentTitle}>{item.title}</Text>
        <Text style={styles.segmentTimestamp}>{item.timestamp}</Text>
      </View>
      <TouchableOpacity
        style={styles.playButton}
        onPress={() => onPlayPress(item)}
        disabled={isDisabled}
      >
        <Ionicons
          name={isPlayingThis ? "pause-circle" : "play-circle"}
          size={32}
          color={isDisabled ? "#ccc" : "#2196F3"}
        />
      </TouchableOpacity>
    </View>
  );
};

// Add styles specific to this component here
const styles = StyleSheet.create({
  segmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentInfo: {
    flex: 1,
    marginRight: 10,
  },
  segmentTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212529',
  },
  segmentTimestamp: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
  },
  playButton: {
    padding: 5,
  },
});