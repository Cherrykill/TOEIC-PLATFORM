import EmptyState from './EmptyState.jsx';
import HistoryItem from './HistoryItem.jsx';
import Pagination from './Pagination.jsx';
import { useToeicHistory } from '../hooks/useToeicHistory.js';

export default function HistoryList({ active, onView }) {
    const { items, page, totalPages, loading, error, goToPage } = useToeicHistory({ enabled: active });

    if (loading && items.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: 40 }}>
                <i className="fas fa-spinner fa-spin fa-2x"></i>
            </div>
        );
    }

    if (error) {
        return <EmptyState title="Lỗi tải lịch sử" text="Vui lòng thử lại sau" />;
    }

    if (items.length === 0) {
        return (
            <EmptyState
                title="Chưa có lịch sử thi"
                text="Bắt đầu làm bài thi đầu tiên của bạn!"
            />
        );
    }

    return (
        <>
            <div className="toeic-history-list">
                {items.map(attempt => (
                    <HistoryItem key={attempt._id} attempt={attempt} onView={onView} />
                ))}
            </div>
            <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={goToPage}
            />
        </>
    );
}
