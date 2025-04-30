// app/(tabs)/dashboard.tsx
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    SectionList,
    RefreshControl,
    SafeAreaView,
    Platform
} from 'react-native';
import { router } from 'expo-router';
import fetchMemories from '../../components/helperFuncs/fetchMemories';
import { Memory } from '../../components/types/memory';
import { Ionicons } from '@expo/vector-icons';

interface DateGroup {
    title: string;
    data: Memory[];
}

export default function DashboardScreen() {
    const [summaries, setSummaries] = useState<Memory[]>([]);
    const [dateGroups, setDateGroups] = useState<DateGroup[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    useEffect(() => {
        loadSummaries();
    }, []);

    const loadSummaries = async () => {
        try {
            setLoading(true);
            setError(null);

            const memories = await fetchMemories();

            

            if (!memories) {
                throw new Error('Failed to fetch memories');
            }

            // Filter out any memory missing start or end time
            const validMemories = memories.filter(m => {
                const start = m.summary?.start_time_local;
                const end = m.summary?.end_time_local;
              
                // Only keep if both dates can be parsed into valid Date objects
                return start && end && !isNaN(new Date(start).getTime()) && !isNaN(new Date(end).getTime());
              });

            const sortedSummaries = [...validMemories].sort((a, b) => {
                return new Date(b.summary.start_time_local).getTime() - new Date(a.summary.start_time_local).getTime();
            });

            //console.log(sortedSummaries);

            //   const sortedSummaries = [...memories].sort((a, b) => {
            //     return new Date(b.summary.start_time_local).getTime() - new Date(a.summary.start_time_local).getTime();
            //   });

            setSummaries(sortedSummaries);

            groupSummariesByDate(sortedSummaries);
        } catch (error: any) {
            console.error('Error fetching summaries:', error);
            setError('Failed to load summaries: ' + error.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadSummaries();
    };

    const groupSummariesByDate = (summariesList: Memory[]) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const twoWeeksAgo = new Date(today);
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const oneMonthAgo = new Date(today);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const groups: DateGroup[] = [
            { title: 'Today', data: [] },
            { title: 'Yesterday', data: [] },
            { title: '2 Days Ago', data: [] },
            { title: 'This Week', data: [] },
            { title: 'Last Week', data: [] },
            { title: 'This Month', data: [] },
            { title: 'Older', data: [] }
        ];

        summariesList.forEach(summary => {

            const summaryDate = new Date(summary.summary.start_time_local);
            console.log(typeof summaryDate);
            summaryDate.setHours(0, 0, 0, 0);

            if (summaryDate.getTime() === today.getTime()) {
                groups[0].data.push(summary);
            } else if (summaryDate.getTime() === yesterday.getTime()) {
                groups[1].data.push(summary);
            } else if (summaryDate.getTime() === twoDaysAgo.getTime()) {
                groups[2].data.push(summary);
            } else if (summaryDate > oneWeekAgo && summaryDate < yesterday) {
                groups[3].data.push(summary);
            } else if (summaryDate <= oneWeekAgo && summaryDate > twoWeeksAgo) {
                groups[4].data.push(summary);
            } else if (summaryDate <= twoWeeksAgo && summaryDate > oneMonthAgo) {
                groups[5].data.push(summary);
            } else {
                groups[6].data.push(summary);
            }
        });

        // Only include groups that have summaries
        const filteredGroups = groups.filter(group => group.data.length > 0);
        setDateGroups(filteredGroups);
    };

    const navigateToSummary = (memomry: Memory) => {
        // Using Expo Router to navigate to the dynamic route with summary ID
        router.push({
            pathname: `../summary/${memomry.summary.meeting_id}`,
            params: {
                id: memomry.summary.meeting_id,
                title: memomry.summary.meeting_title || 'Untitled Meeting'
            }
        });
    };

    const renderSummaryItem = ({ item }: { item: Memory }) => {
        return (
            <TouchableOpacity
                style={styles.summaryItem}
                onPress={() => navigateToSummary(item)}
            >
                <Text style={styles.summaryTitle} numberOfLines={1} ellipsizeMode="tail">
                    {item.summary.meeting_title || 'Untitled Meeting'}
                </Text>
                <Text style={styles.summaryDate} numberOfLines={1}>
                    {new String(item.summary.start_time_local)}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderSectionHeader = ({ section: { title } }: { section: DateGroup }) => (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
        </View>
    );

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0000ff" />
                <Text style={styles.loadingText}>Loading summaries...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={48} color="#ff4444" />
                <Text style={styles.errorText}>Error: {error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadSummaries}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {dateGroups.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="document-outline" size={64} color="#cccccc" />
                    <Text style={styles.emptyText}>No meeting summaries found</Text>
                </View>
            ) : (
                <SectionList
                    sections={dateGroups}
                    keyExtractor={(item, index) => item.summary.meeting_id || index.toString()}
                    renderItem={renderSummaryItem}
                    renderSectionHeader={renderSectionHeader}
                    stickySectionHeadersEnabled={true}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                        />
                    }
                    contentContainerStyle={styles.listContent}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
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
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    emptyText: {
        marginTop: 16,
        color: '#999',
        fontSize: 16,
    },
    listContent: {
        paddingBottom: 20,
    },
    sectionHeader: {
        backgroundColor: '#eef2f5',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ddd',
    },
    sectionHeaderText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    summaryItem: {
        backgroundColor: 'white',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#eee',
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
        marginBottom: 4,
    },
    summaryDate: {
        fontSize: 13,
        color: '#888',
    },
});