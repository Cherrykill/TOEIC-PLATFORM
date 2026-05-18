// ===================================
// AI HELPER MODULE
// ===================================

const AIHelper = (() => {
    const API_URL = window.CONFIG?.API_URL || 'http://localhost:5000/api';

    /**
     * Explain word using AI
     */
    async function explainWord(wordEn) {
        try {
            const response = await fetch(`${API_URL}/ai/explain`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ wordEn }),
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error explaining word:', error);
            return {
                success: false,
                message: 'Không thể kết nối đến AI',
            };
        }
    }

    /**
     * Generate practice questions using AI
     */
    async function generateQuestions(wordEn, count = 5, type = 'multiple-choice') {
        try {
            const response = await fetch(`${API_URL}/ai/generate-questions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ wordEn, count, type }),
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error generating questions:', error);
            return {
                success: false,
                message: 'Không thể kết nối đến AI',
            };
        }
    }

    /**
     * Check grammar using AI
     */
    async function checkGrammar(sentence) {
        try {
            const response = await fetch(`${API_URL}/ai/check-grammar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sentence }),
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error checking grammar:', error);
            return {
                success: false,
                message: 'Không thể kết nối đến AI',
            };
        }
    }

    /**
     * Chat with AI tutor
     */
    async function chatWithTutor(message, conversationHistory = []) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ message, conversationHistory }),
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error chatting with AI:', error);
            return {
                success: false,
                message: 'Không thể kết nối đến AI',
            };
        }
    }

    /**
     * Translate English sentence to Vietnamese
     */
    async function translateSentence(sentence) {
        try {
            const response = await fetch(`${API_URL}/ai/translate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sentence }),
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error translating sentence:', error);
            return {
                success: false,
                message: 'Không thể kết nối đến AI',
            };
        }
    }

    return {
        explainWord,
        generateQuestions,
        checkGrammar,
        chatWithTutor,
        translateSentence,
    };
})();

// Export for use in other modules
window.AIHelper = AIHelper;
