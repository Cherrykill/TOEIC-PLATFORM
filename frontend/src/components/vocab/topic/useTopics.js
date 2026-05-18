import { useState, useEffect, useCallback } from 'react';
import { TopicSelector } from '@components/vocab/topic/topicSelector.js';
import { getToken } from '@/auth/token.js';
import { UploadVocabAPI } from '@api/uploadVocab.js';

export function useTopics({ enabled = true } = {}) {
    const [shared, setShared] = useState(() => TopicSelector.getAvailableTopics() || []);
    const [personal, setPersonal] = useState([]);
    const [loadingShared, setLoadingShared] = useState(false);
    const [loadingPersonal, setLoadingPersonal] = useState(false);
    const [current, setCurrent] = useState(() => TopicSelector.getCurrentTopic());

    const loadShared = useCallback(async () => {
        if (TopicSelector.getAvailableTopics()?.length > 0) {
            setShared(TopicSelector.getAvailableTopics());
            return;
        }
        setLoadingShared(true);
        await TopicSelector.loadAvailableTopics();
        setShared(TopicSelector.getAvailableTopics() || []);
        setLoadingShared(false);
    }, []);

    const loadPersonal = useCallback(async () => {
        if (!getToken()) { setPersonal([]); return; }
        setLoadingPersonal(true);
        try {
            const res = await UploadVocabAPI.myTopics();
            setPersonal(res.success ? (res.data || []) : []);
        } catch {
            setPersonal([]);
        }
        setLoadingPersonal(false);
    }, []);

    const selectShared = useCallback(async (topicId) => {
        const topic = await TopicSelector.selectTopic(topicId);
        setCurrent(topic);
        return topic;
    }, []);

    const selectPersonal = useCallback(async (source) => {
        const topic = await TopicSelector.selectPersonalTopic(source);
        setCurrent(topic);
        return topic;
    }, []);

    useEffect(() => {
        if (enabled) loadShared();
    }, [enabled, loadShared]);

    return {
        shared, personal, current,
        loadingShared, loadingPersonal,
        loadShared, loadPersonal,
        selectShared, selectPersonal,
    };
}
