// src/audioApi.ts
import { Platform } from 'react-native';

// Define an interface for the expected API response (adjust as needed)
interface TranscriptionApiResponse {
    success: boolean;
    transcription?: string; // Example field
    message?: string;
    // Add other fields your API might return
}

// Define an interface for potential API errors
interface ApiErrorResponse {
    message: string;
    details?: any;
}

// --- Configuration ---
// IMPORTANT: Store sensitive data like API keys and bypass tokens securely.
// Avoid hardcoding them directly in the source code in production.
// Consider using environment variables (e.g., via expo-constants or react-native-dotenv).
const API_BASE_URL = "http://localhost:3000"; // Or your actual deployed URL
const API_ENDPOINT = "/api/v2/transcribe/choose";
const API_URL = `${API_BASE_URL}${API_ENDPOINT}`;

// Replace with your actual credentials (fetched securely)
const TEMP_BYPASS_TOKEN = "K1oNTqR7cjtbhehlqxQgxSP9As13QAeE"; // Replace or load securely
const TEMP_AUTH_TOKEN = "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtWX2RaamRVd19Gd2xDU0R0Vi1hUyJ9.eyJ0cmFuc2Zyb21lZF9zdWIiOiJnb29nbGUtb2F1dGgyfDExNDM1MzExOTEyMzUwMTE4ODg4NSIsImVtYWlsIjoicGF0cmlja0B0aGlyZGVhci5haSIsIm5hbWUiOiJQYXRyaWNrIEthc2wiLCJ0aGlyZGVhcl91c2VyX2lkIjoiYmMzNjMwNDQtMzQ3Ny00MjY5LWI5ODEtYjY5ODZjNDkwODM0IiwiaXNzIjoiaHR0cHM6Ly9kZXYtNXlsbm5td2Q3cmJhejEweS51cy5hdXRoMC5jb20vIiwic3ViIjoib2F1dGgyfEdvb2dsZXwxMTQzNTMxMTkxMjM1MDExODg4ODUiLCJhdWQiOlsiaHR0cHM6Ly9hcGkudGhpcmRlYXIubGl2ZSIsImh0dHBzOi8vZGV2LTV5bG5ubXdkN3JiYXoxMHkudXMuYXV0aDAuY29tL3VzZXJpbmZvIl0sImlhdCI6MTc0NTk4MjY0MSwiZXhwIjoxNzQ2MDY5MDQxLCJzY29wZSI6Im9wZW5pZCBwcm9maWxlIGVtYWlsIG9mZmxpbmVfYWNjZXNzIiwiYXpwIjoieGwyclF6OWp6dmphdEdhb3JTdDJzVGhwSmtEZWg3eG4ifQ.cU3QtlhnkRpExVjQ5dXHj4MQ5rqqJvgQLB4MdpYOyM7-1OfNeBgFjfqwPZzwfKaIrxbA1rlJHrqV5Ve4CvryiF5yWKFRwqRXeWaTnJxexqwhTgTjYKjxPpHwdDKMMOwSZOFWZSYWJf1EExz_WtbjjHEmwci5mZfTnTzkNpi8ZYPkOGR2bOy6fJEWy0HmukJZ9B8Ivq1mxq_-_Lu9qRo0iLmYPuTyDcJ0C0Ih23gf4WS6JQRKdd-ZiI9cRCCeZ5yZmdPQC-f2-NDigG6x-MyPY4-of76Ei5lqjZAbABd31ILaV20I4gHn4Tl9nhOnTtlAMfLQ25KUZeJXDp4-3Ptb_Q"; // e.g., "Bearer YOUR_JWT" or "ApiKey YOUR_KEY". Replace or load securely

/**
 * Sends an audio segment to the transcription API.
 *
 * @param audioUri The local URI (file:// or blob:) of the audio segment.
 * @param meetingId The meeting ID associated with the audio.
 * @param recordingMimeType The MIME type of the recorded audio (e.g., 'audio/mp4', 'audio/webm').
 * @returns A Promise resolving to the parsed API response on success.
 * @throws An error object with details on failure (network or API error).
 */
export const sendAudioToApi = async (
    audioUri: string,
    meetingId: string,
    recordingMimeType: string
): Promise<TranscriptionApiResponse> => {
    console.log(`Preparing to send audio from URI: ${audioUri} for meeting: ${meetingId}`);

    const apiUrl = API_URL;

    // Filename determined similarly regardless of platform
    const fileExtension = recordingMimeType.split('/')[1]?.split(';')[0] || 'bin';
    const filename = `segment-${Date.now()}.${fileExtension}`;
    const mimeType = recordingMimeType; // Use the passed mimeType

    console.log(`Uploading as filename: ${filename}, MIME type: ${mimeType}`);

    const formData = new FormData();
    formData.append('meeting_id', meetingId); // Append non-file data first

    // --- Platform-Specific File Handling ---
    if (Platform.OS === 'web') {
        try {
            // 1. Fetch the Blob data from the blob URI
            console.log(`Fetching blob data from: ${audioUri}`);
            const blobResponse = await fetch(audioUri);
            if (!blobResponse.ok) {
                throw new Error(`Failed to fetch blob data: ${blobResponse.statusText}`);
            }
            const audioBlob = await blobResponse.blob();
            console.log(`Fetched blob size: ${audioBlob.size}, type: ${audioBlob.type}`);

            // 2. Append the actual Blob object to FormData
            // The standard append signature is (name, value, filename?)
            formData.append('file', audioBlob, filename);

        } catch (blobError) {
            console.error("Error fetching or processing blob:", blobError);
            throw new Error(`Failed to prepare audio blob for upload: ${blobError instanceof Error ? blobError.message : String(blobError)}`);
        }
    } else {
        // Assume Mobile (iOS/Android) - uses the { uri, name, type } structure
        // Ensure audioUri is a 'file://...' URI on mobile
        console.log("Appending file for mobile platform.");
        formData.append('file', {
            uri: audioUri,
            name: filename,
            type: mimeType, // Use the determined MIME type
        } as any); // `as any` might still be needed for TS reasons
    }

    // --- Set Headers ---
    const headers = new Headers();
    headers.append('x-vercel-protection-bypass', TEMP_BYPASS_TOKEN); // Load securely
    headers.append('Authorization', TEMP_AUTH_TOKEN); // Load securely
    // 'Content-Type': 'multipart/form-data' is set automatically by fetch with FormData

    // --- Perform Fetch Request ---
    try {
        console.log(`POSTing FormData to ${apiUrl}...`);
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: formData,
        });

        console.log(`API Response Status: ${response.status}`);

        // --- Handle Response ---
        if (!response.ok) {
            let errorData: ApiErrorResponse = { message: `HTTP error! Status: ${response.status}` };
            try {
                const errorJson = await response.json();
                errorData = { ...errorData, ...errorJson };
                console.error("API Error Response Body:", errorJson); // Log the specific error
            } catch (parseError) {
                try {
                    const errorText = await response.text();
                    errorData.message += ` - ${errorText}`;
                    console.error("API Error Response Text:", errorText);
                } catch (textError) {
                    console.error("Could not read API error response body.");
                }
            }
            // Throw error with the message from the server if available
            throw new Error(`API Error: ${errorData.message || 'Status ' + response.status}`);
        }

        const data: TranscriptionApiResponse = await response.json();
        console.log("API Success Response:", data);
        return data;

    } catch (error) {
        console.error("Error sending audio to API:", error);
        if (error instanceof Error) {
            // Make sure we propagate the specific message (e.g., API error message)
            throw error;
        } else {
            throw new Error(`An unknown error occurred during API call: ${String(error)}`);
        }
    }
};

/**
 * Helper to get the correct MIME type based on platform and recording options.
 * Adapt this based on your actual `RecordingPresets` and overrides.
 */
export const getRecordingMimeType = (options: any): string => {
    if (Platform.OS === 'web') {
        return options?.web?.mimeType || 'audio/webm'; // Default to webm for web if not specified
    } else if (Platform.OS === 'ios') {
        // iOS HIGH_QUALITY typically defaults to 'audio/mp4' (AAC in an MP4 container)
        // Check options.ios.outputFormat if you override it.
        return options?.ios?.outputFormat ? mapIosFormatToMime(options.ios.outputFormat) : 'audio/mp4';
    } else if (Platform.OS === 'android') {
        // Android HIGH_QUALITY typically defaults to 'audio/mp4' (AAC in an MP4 container)
        // Check options.android.outputFormat if you override it.
        return options?.android?.outputFormat ? mapAndroidFormatToMime(options.android.outputFormat) : 'audio/mp4';
    }
    // Fallback default
    return 'application/octet-stream';
};

// Helper mappings (adjust if you use different formats)
const mapIosFormatToMime = (format: string): string => {
    switch (format) {
        case 'mp4': return 'audio/mp4';
        case 'm4a': return 'audio/mp4'; // m4a is often mp4 container
        case 'caf': return 'audio/x-caf';
        default: return 'audio/mp4'; // Default assumption
    }
};

const mapAndroidFormatToMime = (format: string): string => {
    switch (format) {
        case 'mp4': return 'audio/mp4';
        case 'aac': return 'audio/aac';
        case 'amr_nb': return 'audio/amr';
        case 'amr_wb': return 'audio/amr-wb';
        case 'three_gpp': return 'audio/3gpp';
        case 'webm': return 'audio/webm';
        default: return 'audio/mp4'; // Default assumption
    }
};