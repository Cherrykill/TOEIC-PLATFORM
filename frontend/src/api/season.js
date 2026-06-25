// Mùa giải — đếm ngược (public, không cần token).
export const SeasonAPI = {
    async current() {
        return fetch('/api/season/current')
            .then(r => r.json())
            .catch(() => ({ success: false }));
    },
};
