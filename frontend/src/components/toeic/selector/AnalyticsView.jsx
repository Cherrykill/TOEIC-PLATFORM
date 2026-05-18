import EmptyState from './EmptyState.jsx';
import ProgressChart from './charts/ProgressChart.jsx';
import ListeningReadingChart from './charts/ListeningReadingChart.jsx';
import PartsChart from './charts/PartsChart.jsx';
import { useToeicAnalytics } from '../hooks/useToeicAnalytics.js';

const NoData = ({ icon, text }) => (
    <div
        style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: 180, color: 'var(--text-secondary)', gap: 12,
        }}
    >
        <i className={`fas ${icon}`} style={{ fontSize: '2.5rem', opacity: 0.3 }}></i>
        <p style={{ margin: 0, fontSize: '0.9em', textAlign: 'center' }}
           dangerouslySetInnerHTML={{ __html: text }}></p>
    </div>
);

export default function AnalyticsView({ active }) {
    const { overview, progress, parts, loading, error } = useToeicAnalytics({ enabled: active });

    if (loading && !overview) {
        return (
            <div style={{ textAlign: 'center', padding: 40 }}>
                <i className="fas fa-spinner fa-spin fa-2x"></i>
            </div>
        );
    }

    if (error) {
        return (
            <EmptyState
                title="Chưa có dữ liệu thống kê"
                text="Làm một vài bài thi để xem phân tích chi tiết!"
            />
        );
    }

    const totalAttempts = overview?.totalAttempts || 0;
    const hasAttempts = totalAttempts > 0;
    const hasProgress = Array.isArray(progress) && progress.length > 0;
    const hasParts = Array.isArray(parts) && parts.length > 0;

    return (
        <div className="toeic-analytics-container">
            <div className="analytics-overview">
                <h3><i className="fas fa-chart-bar"></i> Tổng quan</h3>
                <div className="analytics-grid">
                    <div className="analytics-card">
                        <div className="analytics-value">{totalAttempts}</div>
                        <div className="analytics-label">Lần thi</div>
                    </div>
                    <div className="analytics-card">
                        <div className="analytics-value">{overview?.averageScore || 0}</div>
                        <div className="analytics-label">Điểm TB</div>
                    </div>
                    <div className="analytics-card">
                        <div className="analytics-value">{overview?.bestScore || 0}</div>
                        <div className="analytics-label">Điểm cao nhất</div>
                    </div>
                </div>
            </div>

            <div className="analytics-charts-row">
                <div className="analytics-chart-card">
                    <h3><i className="fas fa-chart-line"></i> Tiến độ điểm số</h3>
                    {hasProgress
                        ? <ProgressChart data={progress} />
                        : <NoData icon="fa-chart-line" text="Hoàn thành bài thi để xem<br>tiến độ điểm số của bạn" />}
                </div>

                <div className="analytics-chart-card">
                    <h3><i className="fas fa-chart-pie"></i> Listening vs Reading</h3>
                    {hasAttempts
                        ? <ListeningReadingChart overview={overview} />
                        : <NoData icon="fa-chart-pie" text="Chưa có dữ liệu<br>Listening / Reading" />}
                </div>
            </div>

            <div className="analytics-chart-card full-width">
                <h3><i className="fas fa-layer-group"></i> Phân tích theo Part</h3>
                {hasParts
                    ? <PartsChart data={parts} />
                    : <NoData icon="fa-layer-group" text="Hoàn thành Mini Test theo Part<br>để xem phân tích chi tiết" />}
            </div>
        </div>
    );
}
