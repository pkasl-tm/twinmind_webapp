import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f0f0f0' },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 25, color: '#333' },
    statusText: { marginVertical: 5, fontSize: 11, color: '#666', textAlign: 'center', maxWidth: '90%' },
    errorText: { color: '#D8000C', backgroundColor: '#FFD2D2', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 5, marginVertical: 10, textAlign: 'center', fontWeight: 'bold', maxWidth: '90%' },
    transcriptionContainer: {
        height: 150, 
        width: '90%',
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 5,
        marginVertical: 15,
        padding: 5,
        backgroundColor: '#fff'
    },
    transcriptionLabel: {
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#555'
    },
    transcriptionScrollView: {
        flex: 1,
    },
    transcriptionContent: {
        fontSize: 14,
        color: '#333'
    }
});