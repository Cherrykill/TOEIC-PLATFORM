// Quét bảng đáp án từ ảnh → đối chiếu → sửa đáp án câu hỏi.
(function () {
    let inited = false;
    let lastCompare = null;   // kết quả đối chiếu gần nhất { source, comparison }
    const auth = () => ({ Authorization: `Bearer ${getToken()}` });
    const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    ));

    // ── Danh sách bộ đáp án đã lưu ──────────────────────────────────────────
    async function loadKeys() {
        const tbody = document.getElementById('ak-tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>';
        try {
            const r = await fetch(`${TOEIC_API_BASE}/answer-keys`, { headers: auth() });
            const j = await r.json();
            renderKeys(j.success ? (j.data || []) : []);
        } catch (e) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger)">${esc(e.message)}</td></tr>`;
        }
    }

    function renderKeys(list) {
        const tbody = document.getElementById('ak-tbody');
        if (!tbody) return;
        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);padding:20px">Chưa quét bộ đáp án nào</td></tr>';
            return;
        }
        tbody.innerHTML = list.map(k => `<tr>
            <td><strong>${esc(k.source)}</strong></td>
            <td><span class="badge neutral">${k.count} câu</span></td>
            <td><small style="color:var(--text-secondary)">${esc((k.scannedRanges || []).join(', ') || '—')}</small></td>
            <td><small>${k.updatedAt ? new Date(k.updatedAt).toLocaleString('vi-VN') : '—'}</small></td>
            <td style="white-space:nowrap">
              <button class="btn btn-secondary btn-sm ak-compare" data-src="${esc(k.source)}"><i class="fas fa-code-compare"></i> Đối chiếu</button>
              <button class="btn btn-sm ak-del" data-src="${esc(k.source)}"
                style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5"><i class="fas fa-trash"></i></button>
            </td>
          </tr>`).join('');

        tbody.querySelectorAll('.ak-compare').forEach(b => b.onclick = () => compareSource(b.dataset.src));
        tbody.querySelectorAll('.ak-del').forEach(b => b.onclick = async () => {
            if (!confirm(`Xoá bộ đáp án của "${b.dataset.src}"? (Câu hỏi giữ nguyên, chỉ xoá bản đáp án đã quét)`)) return;
            const r = await fetch(`${TOEIC_API_BASE}/answer-keys/${encodeURIComponent(b.dataset.src)}`, {
                method: 'DELETE', headers: auth(),
            });
            const j = await r.json();
            showToast(j.message || 'Đã xoá', j.success ? 'success' : 'error');
            if (j.success) loadKeys();
        });
    }

    // ── Quét ảnh ────────────────────────────────────────────────────────────
    async function scan(btn) {
        const source = document.getElementById('ak-source')?.value.trim();
        const range = document.getElementById('ak-range')?.value.trim();
        const file = document.getElementById('ak-image')?.files?.[0];

        if (!source) return showToast('Nhập mã đề trước đã', 'error');
        if (!file) return showToast('Chọn ảnh bảng đáp án', 'error');

        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI đang đọc ảnh...';
        try {
            const fd = new FormData();
            fd.append('image', file);
            fd.append('source', source);
            if (range) fd.append('range', range);

            const r = await fetch(`${TOEIC_API_BASE}/answer-keys/scan`, {
                method: 'POST', headers: auth(), body: fd,
            });
            const j = await r.json();
            if (!j.success) {
                showToast(j.message || 'Quét lỗi', 'error');
                return;
            }
            showToast(j.message, 'success');
            lastCompare = { source: j.data.source, ...j.data };
            renderResult(j.data);
            loadKeys();
        } catch (e) {
            showToast(`Quét lỗi: ${e.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }

    async function compareSource(source) {
        try {
            const r = await fetch(`${TOEIC_API_BASE}/answer-keys/${encodeURIComponent(source)}/compare`, { headers: auth() });
            const j = await r.json();
            if (!j.success) return showToast(j.message || 'Không đối chiếu được', 'error');
            lastCompare = { source, ...j.data };
            renderResult(j.data);
            document.getElementById('ak-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {
            showToast(`Đối chiếu lỗi: ${e.message}`, 'error');
        }
    }

    // ── Bảng kết quả đối chiếu ──────────────────────────────────────────────
    function renderResult(d) {
        const box = document.getElementById('ak-result');
        if (!box) return;
        const c = d.comparison || {};
        const mism = c.mismatched || [];

        const stat = (label, n, color) =>
            `<div style="flex:1;min-width:120px;padding:10px;border-radius:10px;background:var(--bg-secondary);text-align:center">
               <div style="font-size:20px;font-weight:700;color:${color}">${n}</div>
               <div style="font-size:12px;color:var(--text-secondary)">${label}</div>
             </div>`;

        box.innerHTML = `
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
            ${stat('Khớp', (c.matched || []).length, 'var(--success, #16a34a)')}
            ${stat('LỆCH — cần sửa', mism.length, 'var(--danger, #dc2626)')}
            ${stat('Đề chưa có câu này', (c.notInTest || []).length, 'var(--text-secondary)')}
            ${stat('Câu chưa quét đáp án', (c.notInKey || []).length, 'var(--text-secondary)')}
          </div>
          ${(d.skipped || []).length ? `<div style="font-size:12px;color:var(--warning,#f59e0b);margin-bottom:10px">
            <i class="fas fa-triangle-exclamation"></i> Bỏ qua ${d.skipped.length} mục AI đọc không chắc/ngoài dải.
          </div>` : ''}
          ${mism.length ? `
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" id="ak-apply-all">
                <i class="fas fa-bolt"></i> Áp dụng tất cả (${mism.length} câu)
              </button>
              <button class="btn btn-secondary btn-sm" id="ak-apply-selected">
                <i class="fas fa-check"></i> Chỉ áp dụng câu đã tick
              </button>
              <span style="font-size:12px;color:var(--text-secondary)">
                Tick từng câu nếu muốn sửa tay thay vì sửa hàng loạt.
              </span>
            </div>
            <div class="table-container">
              <table class="data-table">
                <thead><tr>
                  <th style="width:40px"><input type="checkbox" id="ak-check-all" /></th>
                  <th style="width:90px">Số câu</th><th style="width:80px">Part</th>
                  <th style="width:130px">Đang lưu</th><th style="width:130px">Theo bảng đáp án</th>
                </tr></thead>
                <tbody>
                  ${mism.map(m => `<tr>
                    <td><input type="checkbox" class="ak-row" value="${m.number}" /></td>
                    <td><strong>${m.number}</strong></td>
                    <td>Part ${m.part}</td>
                    <td><span class="badge neutral">${esc(m.current || '—')}</span></td>
                    <td><span class="badge success">${esc(m.expected)}</span></td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>`
            : '<div style="padding:14px;text-align:center;color:var(--success,#16a34a)"><i class="fas fa-circle-check"></i> Mọi câu đã khớp bảng đáp án</div>'}
        `;

        document.getElementById('ak-check-all')?.addEventListener('change', (e) => {
            box.querySelectorAll('.ak-row').forEach(cb => { cb.checked = e.target.checked; });
        });
        document.getElementById('ak-apply-all')?.addEventListener('click', (e) => apply(e.currentTarget, null));
        document.getElementById('ak-apply-selected')?.addEventListener('click', (e) => {
            const nums = [...box.querySelectorAll('.ak-row:checked')].map(cb => Number(cb.value));
            if (!nums.length) return showToast('Chưa tick câu nào', 'error');
            apply(e.currentTarget, nums);
        });
    }

    async function apply(btn, numbers) {
        const source = lastCompare?.source;
        if (!source) return;
        const label = numbers ? `${numbers.length} câu đã tick` : 'TẤT CẢ câu đang lệch';
        if (!confirm(`Ghi đè đáp án cho ${label} của đề "${source}"?\nThao tác này sửa thẳng ngân hàng câu hỏi.`)) return;

        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang sửa...';
        try {
            const r = await fetch(`${TOEIC_API_BASE}/answer-keys/${encodeURIComponent(source)}/apply`, {
                method: 'POST',
                headers: { ...auth(), 'Content-Type': 'application/json' },
                body: JSON.stringify(numbers ? { numbers } : {}),
            });
            const j = await r.json();
            showToast(j.message || 'Xong', j.success ? 'success' : 'error');
            if (j.success) compareSource(source); // vẽ lại để thấy còn lệch gì không
        } catch (e) {
            showToast(`Sửa lỗi: ${e.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }

    // Gợi ý mã đề có thật, khỏi gõ sai.
    async function loadSourceHints() {
        try {
            const r = await fetch(`${TOEIC_API_BASE}/questions/sources`, { headers: auth() });
            const j = await r.json();
            const dl = document.getElementById('ak-source-list');
            if (dl && j.success) dl.innerHTML = (j.data || []).map(s => `<option value="${esc(s)}"></option>`).join('');
        } catch (_) { /* gõ tay vẫn được */ }
    }

    window.loadAnswerKeysTab = function () {
        if (!inited) {
            inited = true;
            document.getElementById('btn-ak-scan')?.addEventListener('click', (e) => scan(e.currentTarget));
            document.getElementById('btn-ak-reload')?.addEventListener('click', loadKeys);
            loadSourceHints();
        }
        loadKeys();
    };
})();
