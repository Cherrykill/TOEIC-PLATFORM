const UploadUI = {
  // Word types (single)
  TYPE1_OPTIONS: [
    'noun', 'verb', 'adjective', 'adverb',
    'pronoun', 'preposition', 'conjunction',
    'interjection', 'article', 'determiner', 'auxiliary'
  ],
  // Phrase types
  TYPE2_OPTIONS: [
    'noun phrase', 'verb phrase', 'adjective phrase',
    'adverb phrase', 'prepositional phrase',
    'participle phrase', 'gerund phrase', 'infinitive phrase'
  ],

  _activeTab: 'add', // 'add' | 'manage' | 'json'
  _lastSource: '',
  _lastPart: '',

  showUploadModal() {
    this._activeTab = 'add';
    this._openModal();
  },

  _openModal() {
    Modal.show({
      title: '☁️ Từ vựng riêng',
      content: this._modalContent(),
      buttons: [
        { text: 'Đóng', className: 'btn-secondary', onClick: () => Modal.close() },
      ]
    });
    setTimeout(() => this._attachModalHandlers(), 50);
  },

  _modalContent() {
    const tabStyle = (name) => `flex:1; padding:10px; border:none; background:${this._activeTab === name ? 'var(--primary)' : 'var(--bg-secondary)'}; color:${this._activeTab === name ? '#fff' : 'var(--text-primary)'}; cursor:pointer; font-size:13px; font-weight:600; border-radius:0;`;
    let tabContent;
    if (this._activeTab === 'add') tabContent = this._addTabHtml();
    else if (this._activeTab === 'manage') tabContent = this._manageTabHtml();
    else tabContent = this._jsonTabHtml();
    return `
      <div style="padding: 0;">
        <div style="display:flex; border-bottom:1px solid var(--border-color); margin-bottom:0;">
          <button id="upload-tab-add" class="upload-tab-btn" style="${tabStyle('add')}">
            <i class="fas fa-plus"></i> Thêm từ mới
          </button>
          <button id="upload-tab-manage" class="upload-tab-btn" style="${tabStyle('manage')}">
            <i class="fas fa-list"></i> Quản lý từ vựng
          </button>
          <button id="upload-tab-json" class="upload-tab-btn" style="${tabStyle('json')}">
            <i class="fas fa-robot"></i> Prompt AI
          </button>
        </div>
        <div id="upload-tab-content" style="padding:16px;">
          ${tabContent}
        </div>
      </div>
    `;
  },

  _addTabHtml() {
    const typeOptions1 = ['<option value="">— Loại từ —</option>',
      ...this.TYPE1_OPTIONS.map(t => `<option value="${t}">${t}</option>`)].join('');
    const typeOptions2 = ['<option value="">— Cụm từ —</option>',
      ...this.TYPE2_OPTIONS.map(t => `<option value="${t}">${t}</option>`)].join('');

    return `
      <p style="margin: 0 0 14px 0; font-size: 13px; color: var(--text-secondary);">
        Điền thông tin từ vựng. Các trường <span style="color:#ef4444">*</span> là bắt buộc.
        <br><small>• <code>part</code> và <code>level</code> sẽ viết HOA. Các trường khác viết thường. <code>example</code> tự viết hoa chữ cái đầu.</small>
      </p>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        ${this.field('en', 'English *', 'caterer', true)}
        ${this.field('vn', 'Vietnamese', 'người cung cấp đồ ăn')}
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        ${this.field('part', 'Part *', 'ETS26T10-RC', true)}
        ${this.field('source', 'Source *', 'ets2026', true)}
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px; color: var(--text-primary);">Type (đơn)</label>
          <select id="vocab-type1" style="width:100%; padding:8px 10px; border:1px solid var(--border-color); border-radius:6px; font-size:13px; background: var(--bg-tertiary); color: var(--text-primary);">${typeOptions1}</select>
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px; color: var(--text-primary);">Type (cụm)</label>
          <select id="vocab-type2" style="width:100%; padding:8px 10px; border:1px solid var(--border-color); border-radius:6px; font-size:13px; background: var(--bg-tertiary); color: var(--text-primary);">${typeOptions2}</select>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        ${this.field('level', 'Level', 'B2')}
        ${this.field('phonetic', 'Phonetic', 'ˈkeɪtərər')}
      </div>

      <div style="margin-bottom: 10px;">
        ${this.field('example', 'Example', 'The caterer provided lunch for the entire staff.')}
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
        ${this.field('synonyms', 'Synonyms', 'food provider')}
        ${this.field('image', 'Image path', 'images/pages/ets26t10-rc/caterer.jpg')}
      </div>

      <div style="text-align:right; margin-bottom: 10px;">
        <button id="vocab-save-btn" class="btn btn-primary" style="min-width:100px;">
          <i class="fas fa-save"></i> Lưu từ
        </button>
      </div>

      <details style="margin-bottom: 10px; border: 1px dashed var(--border-color); border-radius: 6px; padding: 8px;">
        <summary style="cursor:pointer; font-size:13px; font-weight:600; color: var(--text-primary);">
          <i class="fas fa-code"></i> Dán JSON (nhanh, nhiều từ cùng lúc)
        </summary>
        <textarea id="vocab-json" rows="6" placeholder='[{"en":"caterer","vn":"người cung cấp","part":"ETS26T10-RC","source":"ets2026","type":"noun","level":"B2","example":"The caterer provided lunch.","synonyms":"food provider","phonetic":"ˈkeɪtərər","image":""}]' style="width:100%; margin-top:8px; padding:8px 10px; border:1px solid var(--border-color); border-radius:6px; font-size:12px; font-family: monospace; background: var(--bg-tertiary); color: var(--text-primary); resize: vertical;"></textarea>
        <button id="vocab-json-submit" class="btn btn-primary" style="margin-top:8px; width:100%;">
          <i class="fas fa-upload"></i> Gửi JSON
        </button>
      </details>

      <div id="upload-form-result" style="margin-top: 10px;"></div>
    `;
  },

  _jsonTabHtml() {
    const src = this._lastSource || (typeof TopicSelector !== 'undefined' && TopicSelector.currentTopic?.source) || '';
    const part = this._lastPart || '';
    return `
      <p style="margin:0 0 12px 0; font-size:13px; color:var(--text-secondary);">
        <i class="fas fa-robot"></i> Tạo prompt cho AI (ChatGPT / Claude...) để chuyển danh sách từ sang JSON đúng định dạng.
      </p>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px; color:var(--text-primary);">Source <span style="color:#ef4444">*</span></label>
          <input id="json-source" type="text" value="${src}" placeholder="ets2026"
            style="width:100%; padding:8px 10px; border:1px solid var(--border-color); border-radius:6px; font-size:13px; background:var(--bg-tertiary); color:var(--text-primary); text-transform:lowercase;" />
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px; color:var(--text-primary);">Part <span style="color:#ef4444">*</span></label>
          <input id="json-part" type="text" value="${part}" placeholder="ETS26T10-RC"
            style="width:100%; padding:8px 10px; border:1px solid var(--border-color); border-radius:6px; font-size:13px; background:var(--bg-tertiary); color:var(--text-primary); text-transform:uppercase;" />
        </div>
      </div>
      <button id="json-copy-prompt-btn" class="btn btn-primary" style="width:100%; margin-bottom:14px; font-size:13px;">
        <i class="fas fa-copy"></i> Copy Prompt cho AI
      </button>
      <div style="margin-bottom:6px; font-size:12px; font-weight:600; color:var(--text-primary);">
        <i class="fas fa-paste"></i> Dán JSON kết quả từ AI vào đây:
      </div>
      <textarea id="json-result-area" rows="8"
        placeholder='[{"en":"caterer","vn":"người cung cấp đồ ăn","phonetic":"ˈkeɪtərər","part":"ETS26T10-RC","synonyms":"food provider","type":"noun","image":"images/pages/ets26t10-rc/caterer.jpg","example":"The caterer provided lunch.","level":"B2","source":"ets2026"}]'
        style="width:100%; padding:10px; border:1px solid var(--border-color); border-radius:6px; font-size:12px; font-family:monospace; background:var(--bg-tertiary); color:var(--text-primary); resize:vertical; margin-bottom:10px;"></textarea>
      <button id="json-submit-btn" class="btn btn-primary" style="width:100%;">
        <i class="fas fa-upload"></i> Gửi JSON vào hệ thống
      </button>
      <div id="json-tab-result" style="margin-top:10px;"></div>
    `;
  },

  _manageTabHtml() {
    return `
      <div id="manage-container">
        <p style="font-size:13px; color:var(--text-secondary); margin:0 0 12px 0;">
          <i class="fas fa-spinner fa-spin"></i> Đang tải danh sách...
        </p>
      </div>
    `;
  },

  _attachModalHandlers() {
    document.getElementById('upload-tab-add')?.addEventListener('click', () => {
      this._saveJsonTabState();
      this._activeTab = 'add';
      document.getElementById('upload-tab-content').innerHTML = this._addTabHtml();
      this._styleTabBtns();
      this._attachAddHandlers();
    });

    document.getElementById('upload-tab-manage')?.addEventListener('click', () => {
      this._saveJsonTabState();
      this._activeTab = 'manage';
      document.getElementById('upload-tab-content').innerHTML = this._manageTabHtml();
      this._styleTabBtns();
      this._loadMyTopics();
    });

    document.getElementById('upload-tab-json')?.addEventListener('click', () => {
      this._saveAddTabState();
      this._activeTab = 'json';
      document.getElementById('upload-tab-content').innerHTML = this._jsonTabHtml();
      this._styleTabBtns();
      this._attachJsonHandlers();
    });

    if (this._activeTab === 'add') {
      this._attachAddHandlers();
    } else if (this._activeTab === 'json') {
      this._attachJsonHandlers();
    } else {
      this._loadMyTopics();
    }
  },

  _saveAddTabState() {
    const src = document.getElementById('vocab-source')?.value.trim();
    const part = document.getElementById('vocab-part')?.value.trim();
    if (src) this._lastSource = src.toLowerCase();
    if (part) this._lastPart = part.toUpperCase();
  },

  _saveJsonTabState() {
    const src = document.getElementById('json-source')?.value.trim();
    const part = document.getElementById('json-part')?.value.trim();
    if (src) this._lastSource = src.toLowerCase();
    if (part) this._lastPart = part.toUpperCase();
  },

  _styleTabBtns() {
    const tabs = ['add', 'manage', 'json'];
    tabs.forEach(name => {
      const btn = document.getElementById(`upload-tab-${name}`);
      if (!btn) return;
      const active = this._activeTab === name;
      btn.style.background = active ? 'var(--primary)' : 'var(--bg-secondary)';
      btn.style.color = active ? '#fff' : 'var(--text-primary)';
    });
  },

  _attachJsonHandlers() {
    document.getElementById('json-copy-prompt-btn')?.addEventListener('click', () => this._copyPrompt());
    document.getElementById('json-submit-btn')?.addEventListener('click', () => this._submitJsonTab());
  },

  _copyPrompt() {
    const source = (document.getElementById('json-source')?.value.trim() || 'ets2026').toLowerCase();
    const part   = (document.getElementById('json-part')?.value.trim() || 'PART').toUpperCase();
    const imgFolder = source.replace(/\d+$/, match => match); // giữ nguyên
    const prompt = `Chuyển danh sách từ vựng sau sang định dạng JSON. Trả về ĐÚNG một mảng JSON, không có giải thích thêm.

Mỗi từ có cấu trúc:
{
  "en": "từ tiếng anh (viết thường)",
  "vn": "nghĩa tiếng việt (viết thường)",
  "phonetic": "/phiên âm IPA/ (nếu không có thì để chuỗi rỗng)",
  "part": "${part}",
  "synonyms": "từ đồng nghĩa, cách nhau bằng dấu phẩy (viết thường, để trống nếu không có)",
  "type": "noun / verb / adjective / adverb / phrasal verb / noun phrase / ... (viết thường)",
  "image": "images/pages/${part.toLowerCase()}/ten_tu_viet_thuong_gach_duoi.jpg",
  "example": "Câu ví dụ bằng tiếng anh (viết hoa chữ cái đầu câu).",
  "level": "A1 / A2 / B1 / B2 / C1 / C2",
  "source": "${source}"
}

Quy tắc:
- "en", "vn", "phonetic", "synonyms", "type", "image", "source" → viết thường
- "part" → "${part}" (viết HOA, giữ nguyên)
- "level" → viết HOA (A1, B2, ...)
- "example" → viết hoa chữ cái đầu câu
- "image" → dùng định dạng: images/pages/${part.toLowerCase()}/ten_tu.jpg (gạch dưới thay khoảng trắng)
- Nếu không có dữ liệu, để chuỗi rỗng ""

Danh sách từ vựng cần chuyển:
[DÁN DANH SÁCH TỪ VÀO ĐÂY]`;

    navigator.clipboard.writeText(prompt).then(() => {
      const btn = document.getElementById('json-copy-prompt-btn');
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Đã copy!';
        btn.style.background = '#16a34a';
        setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 2000);
      }
      if (typeof Notification !== 'undefined' && Notification.show) {
        Notification.show({ type: 'success', message: 'Đã copy prompt vào clipboard!' });
      }
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = prompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  },

  async _submitJsonTab() {
    const ta = document.getElementById('json-result-area');
    const raw = ta?.value.trim();
    const resultDiv = document.getElementById('json-tab-result');

    if (!raw) {
      resultDiv.innerHTML = this._resultHtml('error', 'Textarea JSON rỗng');
      return;
    }

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (err) { resultDiv.innerHTML = this._resultHtml('error', `JSON không hợp lệ: ${err.message}`); return; }

    const items = Array.isArray(parsed) ? parsed : [parsed];
    resultDiv.innerHTML = `<p style="color:var(--text-secondary); font-size:13px;"><i class="fas fa-spinner fa-spin"></i> Đang lưu ${items.length} từ...</p>`;

    let ok = 0, failed = 0, errors = [];
    for (const raw of items) {
      const item = this.normalize(raw);
      if (!item.en || !item.part || !item.source) {
        failed++;
        errors.push(`Thiếu en/part/source: ${JSON.stringify(raw).slice(0, 60)}`);
        continue;
      }
      try {
        const res = await fetch('/api/upload/vocabulary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ServerStorage.getToken()}` },
          body: JSON.stringify(item)
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        ok++;
      } catch (err) {
        failed++;
        errors.push(`${item.en}: ${err.message}`);
      }
    }

    const msg = `✓ ${ok} thành công, ✗ ${failed} lỗi` + (errors.length ? '\n' + errors.slice(0, 3).join('\n') : '');
    resultDiv.innerHTML = this._resultHtml(failed === 0 ? 'success' : 'error', msg);
    if (typeof Notification !== 'undefined' && Notification.show) {
      Notification.show({ type: failed === 0 ? 'success' : 'warning', title: 'Hoàn tất', message: `${ok} từ đã lưu, ${failed} lỗi` });
    }
    if (failed === 0 && ta) ta.value = '';
  },

  _resultHtml(type, message) {
    const c = type === 'success'
      ? { bg: '#dcfce7', border: '#86efac', text: '#16a34a', icon: 'fa-check-circle' }
      : { bg: '#fee2e2', border: '#fca5a5', text: '#dc2626', icon: 'fa-exclamation-circle' };
    return `<div style="background:${c.bg}; border:1px solid ${c.border}; border-radius:6px; padding:10px 12px;">
      <div style="color:${c.text}; font-weight:600; font-size:13px; white-space:pre-line;">
        <i class="fas ${c.icon}"></i> ${message}
      </div></div>`;
  },

  _attachAddHandlers() {
    const t1 = document.getElementById('vocab-type1');
    const t2 = document.getElementById('vocab-type2');
    t1?.addEventListener('change', () => { if (t1.value) t2.value = ''; });
    t2?.addEventListener('change', () => { if (t2.value) t1.value = ''; });
    document.getElementById('vocab-save-btn')?.addEventListener('click', () => this.submit());
    document.getElementById('vocab-json-submit')?.addEventListener('click', () => this.submitJson());
  },

  // ── Manage tab ──────────────────────────────────────────────────────────────

  async _loadMyTopics() {
    const container = document.getElementById('manage-container');
    if (!container) return;
    try {
      const res = await fetch('/api/upload/my-topics', {
        headers: { Authorization: `Bearer ${ServerStorage.getToken()}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      if (!data.data.length) {
        container.innerHTML = `
          <div style="text-align:center; padding:24px 0; color:var(--text-secondary); font-size:13px;">
            <i class="fas fa-inbox" style="font-size:32px; margin-bottom:8px; display:block; opacity:0.4;"></i>
            Bạn chưa có từ vựng nào.<br>
            <button id="switch-to-add-btn" class="btn btn-primary" style="margin-top:12px; font-size:12px;">
              <i class="fas fa-plus"></i> Thêm từ mới
            </button>
          </div>`;
        document.getElementById('switch-to-add-btn')?.addEventListener('click', () => {
          document.getElementById('upload-tab-add')?.click();
        });
        return;
      }

      container.innerHTML = `
        <div style="font-size:13px; color:var(--text-secondary); margin-bottom:10px;">
          ${data.data.length} nguồn từ vựng — nhấn để xem từ
        </div>
        <div id="topic-list">
          ${data.data.map(t => this._topicRowHtml(t)).join('')}
        </div>
        <div id="word-list-panel" style="margin-top:12px;"></div>
      `;

      container.querySelectorAll('.topic-row').forEach(row => {
        row.querySelector('.topic-expand-btn')?.addEventListener('click', () => {
          this._loadWords(row.dataset.source);
        });
        row.querySelector('.topic-delete-all-btn')?.addEventListener('click', () => {
          this._deleteSource(row.dataset.source, row.dataset.count);
        });
      });
    } catch (err) {
      container.innerHTML = `<p style="color:#dc2626; font-size:13px;">Lỗi: ${err.message}</p>`;
    }
  },

  _topicRowHtml(topic) {
    const date = topic.lastUpload ? new Date(topic.lastUpload).toLocaleDateString('vi-VN') : '';
    return `
      <div class="topic-row" data-source="${topic.source}" data-count="${topic.wordCount}"
        style="display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid var(--border-color); border-radius:8px; margin-bottom:6px; background:var(--bg-secondary);">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; font-size:13px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${topic.source}</div>
          <div style="font-size:11px; color:var(--text-secondary);">${topic.wordCount} từ · ${date}</div>
        </div>
        <button class="topic-expand-btn btn btn-secondary" style="padding:4px 10px; font-size:12px; white-space:nowrap;">
          <i class="fas fa-eye"></i> Xem
        </button>
        <button class="topic-delete-all-btn btn" style="padding:4px 10px; font-size:12px; background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:6px; white-space:nowrap;">
          <i class="fas fa-trash"></i> Xóa tất
        </button>
      </div>
    `;
  },

  async _loadWords(source) {
    const panel = document.getElementById('word-list-panel');
    if (!panel) return;
    panel.innerHTML = `<p style="font-size:13px; color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Đang tải "${source}"...</p>`;

    try {
      const res = await fetch(`/api/upload/my-vocabulary/${encodeURIComponent(source)}`, {
        headers: { Authorization: `Bearer ${ServerStorage.getToken()}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      if (!data.data.length) {
        panel.innerHTML = `<p style="font-size:13px; color:var(--text-secondary); padding:8px 0;">Không có từ nào trong "${source}".</p>`;
        return;
      }

      panel.innerHTML = `
        <div style="font-weight:600; font-size:13px; color:var(--text-primary); margin-bottom:8px; border-top:1px solid var(--border-color); padding-top:10px;">
          <i class="fas fa-list"></i> ${source} — ${data.data.length} từ
        </div>
        <div style="max-height:260px; overflow-y:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead>
              <tr style="background:var(--bg-tertiary);">
                <th style="padding:6px 8px; text-align:left; color:var(--text-secondary); font-weight:600; border-bottom:1px solid var(--border-color);">English</th>
                <th style="padding:6px 8px; text-align:left; color:var(--text-secondary); font-weight:600; border-bottom:1px solid var(--border-color);">Vietnamese</th>
                <th style="padding:6px 8px; text-align:left; color:var(--text-secondary); font-weight:600; border-bottom:1px solid var(--border-color);">Part</th>
                <th style="padding:6px 8px; border-bottom:1px solid var(--border-color);"></th>
              </tr>
            </thead>
            <tbody id="word-rows">
              ${data.data.map(w => this._wordRowHtml(w)).join('')}
            </tbody>
          </table>
        </div>
      `;

      panel.querySelectorAll('.word-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => this._deleteWord(btn.dataset.id, btn.dataset.en, source));
      });
    } catch (err) {
      panel.innerHTML = `<p style="color:#dc2626; font-size:13px;">Lỗi: ${err.message}</p>`;
    }
  },

  _wordRowHtml(word) {
    return `
      <tr id="word-row-${word._id}" style="border-bottom:1px solid var(--border-color);">
        <td style="padding:6px 8px; color:var(--text-primary); font-weight:500;">${word.en}</td>
        <td style="padding:6px 8px; color:var(--text-secondary);">${word.vn || '—'}</td>
        <td style="padding:6px 8px; color:var(--text-secondary);">${word.part || '—'}</td>
        <td style="padding:6px 8px; text-align:right;">
          <button class="word-delete-btn" data-id="${word._id}" data-en="${word.en}"
            style="padding:3px 8px; background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:4px; font-size:11px; cursor:pointer;">
            <i class="fas fa-times"></i>
          </button>
        </td>
      </tr>
    `;
  },

  async _deleteWord(wordId, wordEn, source) {
    if (!confirm(`Xóa từ "${wordEn}"?`)) return;
    try {
      const res = await fetch(`/api/upload/my-vocabulary/${wordId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ServerStorage.getToken()}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      // Remove row from table
      document.getElementById(`word-row-${wordId}`)?.remove();
      // Update count on topic row
      const topicRow = document.querySelector(`.topic-row[data-source="${source}"]`);
      if (topicRow) {
        const newCount = parseInt(topicRow.dataset.count, 10) - 1;
        topicRow.dataset.count = newCount;
        topicRow.querySelector('.topic-row div:first-child div:last-child').textContent =
          `${newCount} từ`;
        if (newCount <= 0) topicRow.remove();
      }

      Notification.show({ type: 'success', message: `Đã xóa "${wordEn}"` });
    } catch (err) {
      Notification.show({ type: 'error', message: err.message });
    }
  },

  async _deleteSource(source, count) {
    if (!confirm(`Xóa toàn bộ ${count} từ trong "${source}"? Thao tác này không thể hoàn tác.`)) return;
    try {
      const res = await fetch(`/api/upload/my-source/${encodeURIComponent(source)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ServerStorage.getToken()}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      document.querySelector(`.topic-row[data-source="${source}"]`)?.remove();
      document.getElementById('word-list-panel').innerHTML = '';
      Notification.show({ type: 'success', message: data.message });

      // If no more topics, refresh to show empty state
      if (!document.querySelectorAll('.topic-row').length) this._loadMyTopics();
    } catch (err) {
      Notification.show({ type: 'error', message: err.message });
    }
  },

  // ── Add tab helpers ─────────────────────────────────────────────────────────

  openForm() {
    this.showUploadModal();
  },

  field(name, label, placeholder, required = false) {
    const reqMark = required ? ' <span style="color:#ef4444">*</span>' : '';
    const upperFields = ['part', 'level'];
    const noTransform = ['example'];
    const transform = upperFields.includes(name)
      ? 'uppercase'
      : (noTransform.includes(name) ? 'none' : 'lowercase');
    return `
      <div>
        <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px; color: var(--text-primary);">
          ${label}${reqMark}
        </label>
        <input
          type="text"
          id="vocab-${name}"
          placeholder="${placeholder}"
          style="width:100%; padding:8px 10px; border:1px solid var(--border-color); border-radius:6px; font-size:13px; background: var(--bg-tertiary); color: var(--text-primary); text-transform: ${transform};"
        />
      </div>
    `;
  },

  normalize(obj) {
    const capFirst = (s) => s ? (s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()) : '';
    const lower = (s) => (s || '').toLowerCase().trim();
    const upper = (s) => (s || '').toUpperCase().trim();
    return {
      en: lower(obj.en),
      vn: lower(obj.vn),
      part: upper(obj.part),
      source: lower(obj.source),
      type: lower(obj.type),
      level: upper(obj.level),
      phonetic: lower(obj.phonetic),
      example: obj.example ? capFirst(obj.example.trim()) : '',
      synonyms: lower(obj.synonyms),
      image: lower(obj.image),
    };
  },

  async submit() {
    const getVal = (id) => document.getElementById(id)?.value.trim() || '';
    const t1 = getVal('vocab-type1');
    const t2 = getVal('vocab-type2');

    if (t1 && t2) {
      return this.showResult('error', 'Chỉ chọn 1 trong 2 cột Type (đơn hoặc cụm)');
    }

    const payload = this.normalize({
      en: getVal('vocab-en'),
      vn: getVal('vocab-vn'),
      part: getVal('vocab-part'),
      source: getVal('vocab-source'),
      type: t1 || t2,
      level: getVal('vocab-level'),
      phonetic: getVal('vocab-phonetic'),
      example: getVal('vocab-example'),
      synonyms: getVal('vocab-synonyms'),
      image: getVal('vocab-image'),
    });

    if (!payload.en) return this.showResult('error', 'English là bắt buộc');
    if (!payload.part) return this.showResult('error', 'Part là bắt buộc');
    if (!payload.source) return this.showResult('error', 'Source là bắt buộc');

    await this.sendOne(payload);
  },

  async sendOne(payload) {
    const resultDiv = document.getElementById('upload-form-result');
    resultDiv.innerHTML = `<p style="color: var(--text-secondary); font-size:13px;"><i class="fas fa-spinner fa-spin"></i> Đang lưu...</p>`;

    try {
      const response = await fetch('/api/upload/vocabulary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ServerStorage.getToken()}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      this.showResult('success', `Đã lưu "${payload.en}" vào source "${payload.source}"`);
      ['vocab-en', 'vocab-vn', 'vocab-example', 'vocab-phonetic', 'vocab-synonyms', 'vocab-image']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      document.getElementById('vocab-en')?.focus();

      Notification.show({ type: 'success', title: 'Thành công', message: data.message });
    } catch (err) {
      this.showResult('error', err.message);
      Notification.show({ type: 'error', title: 'Lỗi', message: err.message });
    }
  },

  async submitJson() {
    const ta = document.getElementById('vocab-json');
    const raw = ta?.value.trim();
    if (!raw) return this.showResult('error', 'Textarea JSON rỗng');

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return this.showResult('error', `JSON không hợp lệ: ${err.message}`);
    }

    const items = Array.isArray(parsed) ? parsed : [parsed];
    const resultDiv = document.getElementById('upload-form-result');
    resultDiv.innerHTML = `<p style="color: var(--text-secondary); font-size:13px;"><i class="fas fa-spinner fa-spin"></i> Đang lưu ${items.length} từ...</p>`;

    let ok = 0, failed = 0;
    const errors = [];

    for (const raw of items) {
      const item = this.normalize(raw);
      if (!item.en || !item.part || !item.source) {
        failed++;
        errors.push(`Thiếu en/part/source: ${JSON.stringify(raw).slice(0, 60)}`);
        continue;
      }
      try {
        const response = await fetch('/api/upload/vocabulary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ServerStorage.getToken()}`
          },
          body: JSON.stringify(item)
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.message);
        ok++;
      } catch (err) {
        failed++;
        errors.push(`${item.en}: ${err.message}`);
      }
    }

    const msg = `✓ ${ok} thành công, ✗ ${failed} lỗi` + (errors.length ? `\n${errors.slice(0, 3).join('\n')}` : '');
    this.showResult(failed === 0 ? 'success' : 'error', msg);
    Notification.show({
      type: failed === 0 ? 'success' : 'warning',
      title: 'Hoàn tất',
      message: `${ok} từ đã lưu, ${failed} lỗi`
    });

    if (failed === 0 && ta) ta.value = '';
  },

  showResult(type, message) {
    const div = document.getElementById('upload-form-result');
    if (!div) return;
    const colors = type === 'success'
      ? { bg: '#dcfce7', border: '#86efac', text: '#16a34a', icon: 'fa-check-circle' }
      : { bg: '#fee2e2', border: '#fca5a5', text: '#dc2626', icon: 'fa-exclamation-circle' };
    div.innerHTML = `
      <div style="background:${colors.bg}; border:1px solid ${colors.border}; border-radius:6px; padding:10px 12px;">
        <div style="color:${colors.text}; font-weight:600; font-size:13px; white-space: pre-line;">
          <i class="fas ${colors.icon}"></i> ${message}
        </div>
      </div>
    `;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UploadUI;
}
