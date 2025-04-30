import { RecordingPresets, RecordingOptions } from 'expo-audio';
import { getRecordingMimeType } from '../audio/audioApi'; // Adjust path if needed

export const MEETING_ID = "31015c83-0027-40f2-a04d-b161112dd269"; // Example Meeting ID

export const IS_RECORDING_BUTTON_NAME = "Stop Process";
export const IS_NOT_RECORDING_BUTTON_NAME = "Start Process";
export const IS_RECORDING_BUTTON_COLOR = "#FF6347";
export const IS_NOT_RECORDING_BUTTON_COLOR = "#32CD32";

export const SEGMENT_DURATION_MS = 5 * 1000;
export const LEVEL_UPDATE_INTERVAL_MS = 8;

export const RECORDING_OPTIONS: RecordingOptions = {
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

export const EFFECTIVE_MIME_TYPE = getRecordingMimeType(RECORDING_OPTIONS);