import { useState, useEffect, useMemo } from "react";
import { Notification } from "@ui/Toaster.jsx";
import { useTopics } from "./useTopics.js";

export default function TopicModal({ open, onClose, onSelected }) {
  const {
    shared,
    personal,
    current,
    loadingShared,
    loadingPersonal,
    loadShared,
    loadPersonal,
    selectShared,
    selectPersonal,
  } = useTopics({ enabled: open });
  const [tab, setTab] = useState("shared");
  const [query, setQuery] = useState("");
  const [searchReadOnly, setSearchReadOnly] = useState(true); // prevent autofill until user interacts
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!open) return;
    loadShared();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loadShared, onClose]);

  useEffect(() => {
    if (open && tab === "personal") loadPersonal();
  }, [open, tab, loadPersonal]);

  const filteredShared = useMemo(() => {
    const kw = query.trim().toLowerCase();
    if (!kw) return shared;
    return shared.filter(
      (t) =>
        (t.source || "").toLowerCase().includes(kw) ||
        (t.name || "").toLowerCase().includes(kw),
    );
  }, [shared, query]);

  if (!open) return null;

  async function handleSelectShared(topicId) {
    if (busyId) return;
    if (current?.id === topicId) {
      onSelected?.();
      onClose();
      return;
    }
    setBusyId(topicId);
    try {
      await selectShared(topicId);
      onSelected?.();
      onClose();
    } catch {
      Notification.error("Không thể chọn đề này");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSelectPersonal(source) {
    if (busyId) return;
    setBusyId(`personal:${source}`);
    try {
      await selectPersonal(source);
      onSelected?.();
      onClose();
    } catch (err) {
      Notification.error(err.message || "Không thể tải từ vựng này");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div id="modal-container" className="active">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal">
        <div className="modal-header">
          <h3>📚 Chọn đề luyện tập</h3>
          <input
            type="search"
            name="topic-search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            placeholder="Tìm theo source..."
            id="modal-header-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="modal-header-search"
            readOnly={searchReadOnly}
            onFocus={() => setSearchReadOnly(false)}
            onMouseDown={() => setSearchReadOnly(false)}
            style={{
              flex: 1,
              marginLeft: 16,
              marginRight: 8,
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-color)",
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              fontSize: 13,
            }}
          />
          <button className="icon-btn modal-close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="modal-body">
          <div className="topic-selection-container">
            <div className="topic-tabs">
              <button
                className={`tab-btn ${tab === "shared" ? "active" : ""}`}
                onClick={() => setTab("shared")}
              >
                <i className="fas fa-globe"></i> Từ vựng chung
              </button>
              <button
                className={`tab-btn ${tab === "personal" ? "active" : ""}`}
                onClick={() => setTab("personal")}
              >
                <i className="fas fa-user"></i> Từ vựng riêng
              </button>
            </div>

            {tab === "shared" ? (
              <div className="tab-content active">
                <p className="topic-hint">
                  Chọn bộ từ vựng bạn muốn luyện tập:
                </p>
                <div className="topics-list">
                  {loadingShared ? (
                    <p
                      style={{
                        textAlign: "center",
                        padding: 20,
                        color: "var(--text-secondary)",
                      }}
                    >
                      <i className="fas fa-spinner fa-spin"></i> Đang tải...
                    </p>
                  ) : filteredShared.length === 0 ? (
                    <p
                      style={{
                        textAlign: "center",
                        padding: 20,
                        color: "var(--text-secondary)",
                      }}
                    >
                      {query ? "Không tìm thấy đề phù hợp" : "Không có đề nào"}
                    </p>
                  ) : (
                    filteredShared.map((topic) => {
                      const isSelected = current?.id === topic.id;
                      const isBusy = busyId === topic.id;
                      return (
                        <div
                          key={topic.id}
                          className={`topic-card ${isSelected ? "selected" : ""} ${isBusy ? "loading" : ""}`}
                          onClick={() => handleSelectShared(topic.id)}
                        >
                          <div className="topic-icon">{topic.icon}</div>
                          <div className="topic-details">
                            <h4>{topic.name}</h4>
                            {topic.description && (
                              <p className="topic-description">
                                {topic.description}
                              </p>
                            )}
                            <div className="topic-meta">
                              <span className="word-count">
                                <i className="fas fa-book"></i>{" "}
                                {topic.wordCount} từ
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="current-badge">
                              <i className="fas fa-check-circle"></i> Đang chọn
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="tab-content active">
                <p className="topic-hint">Từ vựng bạn đã tải lên:</p>
                <div className="topics-list">
                  {loadingPersonal ? (
                    <p
                      style={{
                        textAlign: "center",
                        padding: 20,
                        color: "var(--text-secondary)",
                      }}
                    >
                      <i className="fas fa-spinner fa-spin"></i> Đang tải...
                    </p>
                  ) : personal.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "30px 20px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <i
                        className="fas fa-cloud-upload-alt"
                        style={{
                          fontSize: 40,
                          opacity: 0.4,
                          display: "block",
                          width: "fit-content",
                          margin: "0 auto 12px",
                        }}
                      ></i>
                      <p
                        style={{
                          margin: "0 0 8px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        Chưa có từ vựng riêng
                      </p>
                      <p style={{ margin: 0, fontSize: 13 }}>
                        Bấm nút tải lên ☁️ ở thanh điều hướng để thêm từ vựng
                        của bạn.
                      </p>
                    </div>
                  ) : (
                    personal.map((t) => {
                      const isSelected = current?.source === t.source;
                      const isBusy = busyId === `personal:${t.source}`;
                      return (
                        <div
                          key={t.source}
                          className={`topic-card ${isSelected ? "selected" : ""} ${isBusy ? "loading" : ""}`}
                          onClick={() => handleSelectPersonal(t.source)}
                        >
                          <div className="topic-icon">📤</div>
                          <div className="topic-details">
                            <h4>{t.source}</h4>
                            <div className="topic-meta">
                              <span className="word-count">
                                <i className="fas fa-book"></i> {t.wordCount} từ
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="current-badge">
                              <i className="fas fa-check-circle"></i> Đang chọn
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
