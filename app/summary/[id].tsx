// app/summary/[id].tsx
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ViewStyle,
    TextStyle,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    ActivityIndicator,
    TouchableOpacity,
    Platform,
    Falsy,
    RecursiveArray,
    RegisteredStyle,
    TextInput
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import Markdown, { MarkdownIt, renderRules } from 'react-native-markdown-display';
import { Ionicons } from '@expo/vector-icons';
import { Memory } from '../../components/types/memory';
import fectchSpecificMemory from '../../components/helperFuncs/fetchSpecificMemory';

import taskListsPlugin from 'markdown-it-tasks';

const markdownItInstance = MarkdownIt().use(taskListsPlugin);

interface MarkdownStyles {
    [key: string]: ViewStyle | TextStyle;
}

const customRenderRules = {
    // Add custom renderer for task items
    taskItem: (node: { attrs: any[]; key: React.Key | null | undefined; }, children: string | number | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | null | undefined, parent: any, styles: { listItem: string | boolean | ViewStyle | RegisteredStyle<ViewStyle> | RecursiveArray<ViewStyle | Falsy | RegisteredStyle<ViewStyle>> | null | undefined; }) => {
        const checked = node.attrs && node.attrs.some(attr => attr[0] === 'checked');
        
        return (
            <View key={node.key} style={styles.listItem as ViewStyle}>
                <View style={{flexDirection: 'row', alignItems: 'flex-start', marginRight: 10}}>
                    <Text style={{marginRight: 10, fontSize: 20, lineHeight: 20}}>
                        {checked ? '☑' : '☐'}
                    </Text>
                    <View style={{flex: 1}}>{children}</View>
                </View>
            </View>
        );
    }
};

export default function SummaryDetailScreen() {
    const { id, title } = useLocalSearchParams();
    const [memory, setMemory] = useState<Memory | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [markdownContent, setMarkdownContent] = useState('');

    useEffect(() => {
        fetchSummaryData();
    }, [id]);

    useEffect(() => {
        if (memory) {
            // Combine summary and action items into a single markdown string
            const content = `${memory.summary.summary || ''}
  
---

## Action Items
${memory.summary.action || 'No action items recorded.'}`;
            setMarkdownContent(content);
        }
    }, [memory]);

    const fetchSummaryData = async () => {
        try {
            setLoading(true);
            setError(null);
            var foundSummary = null;

            // Fetch all memories and find the one with matching ID
            if (typeof id === 'string') {
                foundSummary = await fectchSpecificMemory(id);
                setMemory(foundSummary);
            }
            
        } catch (error: any) {
            console.error('Error fetching summary:', error);
            setError('Failed to load summary: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Format date function
    const formatDate = (input: string | Date): string => {
        // Create a Date object from the input
        const date = typeof input === 'string' ? new Date(input) : input;

        // Extract day and determine suffix
        const day = date.getDate();
        const suffix = getDaySuffix(day);

        // Format month and year
        const month = date.toLocaleDateString("en-US", { month: "long" });
        const year = date.getFullYear();

        // Format time (hours and minutes)
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12; // Convert to 12-hour format
        const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;

        // Combine all parts
        return `${month} ${day}${suffix}, ${year} at ${formattedHours}:${formattedMinutes} ${ampm}`;
    };

    // Helper function to get suffix (st, nd, rd, th)
    const getDaySuffix = (day: number): string => {
        if (day >= 11 && day <= 13) return "th"; // Special case for 11-13
        switch (day % 10) {
            case 1: return "st";
            case 2: return "nd";
            case 3: return "rd";
            default: return "th";
        }
    };

    const toggleEditMode = () => {
        setEditMode(!editMode);
    };

    const saveChanges = async () => {
        // Here you would implement saving changes to your backend
        // This is a placeholder for where you would update memory with the edited content
        // For now, just switch back to view mode
        setEditMode(false);
        
        // You would parse the markdownContent to separate summary and action items
        // and update the memory object accordingly
        // Then send it to your backend for persistent storage
        
        // Example pseudocode:
        // const [summary, actionItems] = parseMarkdownContent(markdownContent);
        // const updatedMemory = {...memory};
        // updatedMemory.summary.summary = summary;
        // updatedMemory.summary.action = actionItems;
        // await updateMemoryInDatabase(updatedMemory);
    };

    // Stack component configuration
    return (
        <>
            <Stack.Screen
                options={{
                    title: title as string || 'Meeting Summary',
                    headerBackTitle: 'Back',
                    presentation: 'card',
                    // Add Edit/Save button to header
                    headerRight: () => (
                        memory && (
                            <TouchableOpacity onPress={editMode ? saveChanges : toggleEditMode}>
                                <Text style={styles.headerButton}>{editMode ? 'Save' : 'Edit'}</Text>
                            </TouchableOpacity>
                        )
                    ),
                }}
            />

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#0066cc" />
                    <Text style={styles.loadingText}>Loading summary...</Text>
                </View>
            ) : error ? (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={48} color="#ff4444" />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={fetchSummaryData}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : memory ? (
                <SafeAreaView style={styles.container}>
                    <ScrollView 
                        style={styles.scrollView} 
                        contentContainerStyle={styles.contentContainer}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Date, duration and sender info */}
                        <View style={styles.metaContainer}>
                            {memory.summary.time_created && (
                                <Text style={styles.dateText}>{formatDate(memory.summary.time_created)}</Text>
                            )}
                            {memory.summary.start_time_local && memory.summary.end_time_local && (
                                <Text style={styles.durationText}> · {(Math.round(Math.floor(Math.abs(new Date(memory.summary.start_time_local).getTime() - new Date(memory.summary.end_time_local).getTime())) / (1000*60)))}min</Text>
                            )}
                        </View>

                        {/* Meeting Title */}
                        <Text style={styles.title}>{memory.summary.meeting_title || 'Untitled Meeting'}</Text>

                        {/* Edit Mode - TextInput for editing markdown */}
                        {editMode ? (
                            <View style={styles.editContainer}>
                                <TextInput
                                    style={styles.markdownInput}
                                    multiline
                                    value={markdownContent}
                                    onChangeText={setMarkdownContent}
                                    placeholder="Enter markdown content here..."
                                    keyboardType="default"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                
                                {/* Preview Section */}
                                <View style={styles.previewContainer}>
                                    <Text style={styles.previewTitle}>Preview</Text>
                                    <View style={styles.markdownContainer}>
                                        <Markdown
                                            style={{
                                                body: { fontSize: 16, lineHeight: 24, color: '#333' },
                                                heading1: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, marginTop: 20 },
                                                heading2: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, marginTop: 16 },
                                                heading3: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, marginTop: 14 },
                                                heading4: { fontSize: 16, fontWeight: 'bold', marginBottom: 6, marginTop: 12 },
                                                heading5: { fontSize: 14, fontWeight: 'bold', marginBottom: 4, marginTop: 10 },
                                                heading6: { fontSize: 13, fontWeight: 'bold', marginBottom: 4, marginTop: 8 },
                                                hr: { backgroundColor: '#ccc', height: 1, marginVertical: 20 },
                                                bullet_list: { marginLeft: 20 },
                                                ordered_list: { marginLeft: 20 },
                                                paragraph: { marginBottom: 12 },
                                                link: { color: '#0066cc' },
                                                blockquote: {
                                                    backgroundColor: '#f5f5f5',
                                                    borderLeftColor: '#ddd',
                                                    borderLeftWidth: 4,
                                                    padding: 12,
                                                    marginVertical: 12
                                                },
                                                code_block: {
                                                    backgroundColor: '#f9f9f9',
                                                    padding: 10,
                                                    borderRadius: 4,
                                                    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                                                },
                                                code_inline: {
                                                    backgroundColor: '#f3f3f3',
                                                    paddingHorizontal: 4,
                                                    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                                                },
                                            }}
                                            markdownit={markdownItInstance}
                                            rules={{...renderRules, ...customRenderRules}}
                                        >
                                            {markdownContent}
                                        </Markdown>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            /* View Mode - Markdown Display */
                            <View style={styles.markdownContainer}>
                                <Markdown
                                    style={{
                                        body: { fontSize: 16, lineHeight: 24, color: '#333' },
                                        heading1: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, marginTop: 20 },
                                        heading2: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, marginTop: 16 },
                                        heading3: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, marginTop: 14 },
                                        heading4: { fontSize: 16, fontWeight: 'bold', marginBottom: 6, marginTop: 12 },
                                        heading5: { fontSize: 14, fontWeight: 'bold', marginBottom: 4, marginTop: 10 },
                                        heading6: { fontSize: 13, fontWeight: 'bold', marginBottom: 4, marginTop: 8 },
                                        hr: { backgroundColor: '#ccc', height: 1, marginVertical: 20 },
                                        bullet_list: { marginLeft: 20 },
                                        ordered_list: { marginLeft: 20 },
                                        paragraph: { marginBottom: 12 },
                                        link: { color: '#0066cc' },
                                        blockquote: {
                                            backgroundColor: '#f5f5f5',
                                            borderLeftColor: '#ddd',
                                            borderLeftWidth: 4,
                                            padding: 12,
                                            marginVertical: 12
                                        },
                                        code_block: {
                                            backgroundColor: '#f9f9f9',
                                            padding: 10,
                                            borderRadius: 4,
                                            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                                        },
                                        code_inline: {
                                            backgroundColor: '#f3f3f3',
                                            paddingHorizontal: 4,
                                            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                                        },
                                    }}
                                    markdownit={markdownItInstance}
                                    rules={{...renderRules, ...customRenderRules}}
                                >
                                    {markdownContent}
                                </Markdown>
                            </View>
                        )}
                    </ScrollView>
                </SafeAreaView>
            ) : (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Summary not found</Text>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
        fontSize: 16,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        padding: 20,
    },
    errorText: {
        marginTop: 10,
        color: '#ff4444',
        fontSize: 16,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 20,
        backgroundColor: '#0066cc',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 5,
    },
    retryButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '500',
    },
    backButton: {
        marginTop: 20,
        backgroundColor: '#0066cc',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 5,
    },
    backButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '500',
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    metaContainer: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    dateText: {
        color: '#666',
        fontSize: 14,
    },
    durationText: {
        color: '#666',
        fontSize: 14,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
        color: '#333',
    },
    senderContainer: {
        marginBottom: 24,
    },
    senderBadge: {
        backgroundColor: '#e8edee',
        borderRadius: 20,
        paddingVertical: 6,
        paddingHorizontal: 12,
        alignSelf: 'flex-start',
    },
    senderText: {
        color: '#42738e',
        fontSize: 14,
        fontWeight: '500',
    },
    markdownContainer: {
        flex: 1,
    },
    headerButton: {
        color: '#0066cc',
        fontSize: 16,
        fontWeight: '500',
        paddingHorizontal: 10,
    },
    editContainer: {
        flex: 1,
    },
    markdownInput: {
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 5,
        padding: 12,
        fontSize: 16,
        lineHeight: 24,
        height: 250,
        textAlignVertical: 'top',
        backgroundColor: '#f9f9f9',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    previewContainer: {
        marginTop: 20,
        flex: 1,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 15,
    },
    previewTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#555',
    },
});