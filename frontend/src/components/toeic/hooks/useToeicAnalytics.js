import { useState, useEffect, useCallback } from 'react';
import { ToeicAPI } from '@api/toeic.js';

function unwrap(res) {
    return res?.data?.data || res?.data || res;
}

export function useToeicAnalytics({ enabled = true } = {}) {
    const [overview, setOverview] = useState(null);
    const [progress, setProgress] = useState([]);
    const [parts, setParts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [ov, pr, pa] = await Promise.all([
                ToeicAPI.getAnalyticsOverview(),
                ToeicAPI.getScoreProgress(10),
                ToeicAPI.getPartAnalysis(),
            ]);
            setOverview(unwrap(ov) || null);
            const prData = unwrap(pr);
            setProgress(Array.isArray(prData) ? prData : []);
            const paData = unwrap(pa);
            setParts(Array.isArray(paData) ? paData : []);
        } catch (err) {
            setError(err);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (enabled) load();
    }, [enabled, load]);

    return { overview, progress, parts, loading, error, reload: load };
}
