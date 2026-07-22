// ===================================================================
// TRÌNH DỰNG NHÓM CÂU HỎI (Part 3/4/6/7) — 1 ngữ cảnh, nhiều câu.
// Media chung (audio/ảnh) nhập MỘT LẦN; groupId + index do server tự sinh.
// Dùng chung các global: IMAGE_RULES, TOEIC_API_BASE, getToken, showToast,
// loadQuestions, loadTestSourceOptions (nạp sau toeic.js trong dashboard.html).
// ===================================================================
let groupImageUrls = [];        // ảnh chung của nhóm
let groupAudioUrl = '';         // audio chung của nhóm
let groupQCounter = 0;          // đảm bảo name radio duy nhất giữa các hàng

function openGroupModal() {
    groupImageUrls = [];
    groupAudioUrl = '';
    groupQCounter = 0;
    document.getElementById('group-part').value = '3';
    document.getElementById('group-source').value = '';
    document.getElementById('group-audio-file').value = '';
    document.getElementById('group-audio-preview').style.display = 'none';
    document.getElementById('group-audio-player').src = '';
    document.getElementById('group-audio-status').style.display = 'none';
    document.getElementById('group-image-file').value = '';
    document.getElementById('group-image-status').style.display = 'none';
    document.getElementById('group-passage-count').value = '';
    renderGroupImages();

    // 2 câu con mặc định (nhóm cần tối thiểu 2).
    const container = document.getElementById('group-questions-container');
    container.innerHTML = '';
    container.appendChild(makeGroupQuestionRow());
    container.appendChild(makeGroupQuestionRow());
    renumberGroupQuestions();

    // Reset tab JSON
    const gj = document.getElementById('group-json-input');
    const gr = document.getElementById('group-json-result');
    if (gj) gj.value = '';
    if (gr) gr.style.display = 'none';
    const gjp = document.getElementById('group-json-part');
    const gjs = document.getElementById('group-json-source');
    if (gjp) gjp.value = '3';
    if (gjs) gjs.value = '';
    switchGroupTab('manual');

    if (typeof loadTestSourceOptions === 'function') loadTestSourceOptions();
    groupUpdatePartVisibility();
    document.getElementById('group-modal').style.display = 'flex';
}

function closeGroupModal() {
    document.getElementById('group-modal').style.display = 'none';
}

// Chuyển tab Trình dựng / Nhập JSON trong modal nhóm.
function switchGroupTab(tab) {
    const manual = document.getElementById('group-manual-panel');
    const json = document.getElementById('group-json-panel');
    const tabManual = document.getElementById('group-tab-manual');
    const tabJson = document.getElementById('group-tab-json');
    const btnCreate = document.getElementById('btn-submit-group');
    const btnImport = document.getElementById('btn-group-submit-json');
    const on = { background: '#e11d48', color: '#fff' };
    const off = { background: '#f5f5f5', color: '#666' };
    const isJson = tab === 'json';
    manual.style.display = isJson ? 'none' : 'block';
    json.style.display = isJson ? 'block' : 'none';
    Object.assign(tabManual.style, isJson ? off : on);
    Object.assign(tabJson.style, isJson ? on : off);
    btnCreate.style.display = isJson ? 'none' : 'inline-block';
    btnImport.style.display = isJson ? 'inline-block' : 'none';
}

// Ẩn/hiện field media theo Part đang chọn trong modal nhóm.
function groupUpdatePartVisibility() {
    const part = parseInt(document.getElementById('group-part').value);
    const rule = IMAGE_RULES[part] || { min: 0, max: 0 };
    // Audio chỉ có ở Part nghe 3/4.
    document.getElementById('group-audio-field').style.display = (part === 3 || part === 4) ? 'block' : 'none';
    // Ảnh: Part 6/7 bắt buộc, 3/4 tùy chọn.
    const hint = document.getElementById('group-image-hint');
    if (hint) hint.textContent = rule.max > 1
        ? `— tối đa ${rule.max} ảnh${rule.min > 0 ? ' (bắt buộc)' : ''}`
        : (rule.min > 0 ? '— 1 ảnh (bắt buộc)' : '— tối đa 1 ảnh (tùy chọn)');
    document.getElementById('group-passage-count-field').style.display = part === 7 ? 'block' : 'none';
    syncGroupQuestionTextVisibility(part);
}

// Part 6 (điền chỗ trống) KHÔNG có câu hỏi riêng — giống Part 1, chỉ 4 đáp án.
// Ẩn ô "Nội dung câu hỏi" ở mọi hàng khi Part = 6.
function syncGroupQuestionTextVisibility(part) {
    const hide = parseInt(part) === 6;
    document.querySelectorAll('#group-questions-container .gq-text').forEach(inp => {
        inp.style.display = hide ? 'none' : 'block';
        if (hide) inp.value = '';
    });
}

function renderGroupImages() {
    const box = document.getElementById('group-images-container');
    if (!box) return;
    box.innerHTML = groupImageUrls.map((url, i) => `
        <div style="position:relative;border:2px solid #e0e0e0;border-radius:8px;overflow:hidden">
            <img src="${url}" alt="" style="width:96px;height:70px;object-fit:cover;display:block"
                 onerror="this.style.display='none';this.parentNode.querySelector('.gimg-fb').style.display='flex'">
            <div class="gimg-fb" style="display:none;width:96px;height:70px;align-items:center;justify-content:center;color:#9ca3af;font-size:10px;text-align:center;padding:4px">${url.split('/').pop()}</div>
            <button type="button" data-gimg="${i}" title="Xóa ảnh"
                style="position:absolute;top:2px;right:2px;background:rgba(220,38,38,.9);color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;line-height:1">×</button>
        </div>`).join('');
    box.querySelectorAll('[data-gimg]').forEach(btn => {
        btn.onclick = () => { groupImageUrls.splice(parseInt(btn.dataset.gimg), 1); renderGroupImages(); };
    });
}

// 1 hàng câu hỏi con: nội dung + 4 đáp án (radio chọn đúng) + giải thích + xóa.
function makeGroupQuestionRow() {
    const id = ++groupQCounter;
    const wrap = document.createElement('div');
    wrap.className = 'group-q-row';
    wrap.dataset.qid = id;
    wrap.style.cssText = 'border:1.5px solid #e5e7eb;border-radius:10px;padding:12px;margin-bottom:10px;position:relative';
    const opt = (L) => `
        <div style="display:flex;gap:6px;align-items:center">
            <input type="radio" name="gq-correct-${id}" value="${L}" style="width:16px;height:16px;flex-shrink:0" title="Đáp án đúng">
            <span style="width:16px;font-weight:600">${L}</span>
            <input type="text" class="gq-opt" data-label="${L}" placeholder="Đáp án ${L}${L === 'D' ? ' (tùy chọn)' : ''}"
                style="flex:1;padding:7px;border:1.5px solid #e0e0e0;border-radius:6px">
        </div>`;
    wrap.innerHTML = `
        <button type="button" class="gq-del" title="Xóa câu này"
            style="position:absolute;top:8px;right:8px;background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;width:26px;height:26px;cursor:pointer">×</button>
        <div style="font-weight:600;color:#6366f1;margin-bottom:8px"><i class="fas fa-circle-question"></i> <span class="gq-num"></span></div>
        <input type="text" class="gq-text" placeholder="Nội dung câu hỏi..."
            style="width:100%;padding:8px;border:1.5px solid #e0e0e0;border-radius:6px;margin-bottom:8px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;margin-bottom:8px">
            ${opt('A')}${opt('B')}${opt('C')}${opt('D')}
        </div>
        <textarea class="gq-exp" rows="2" placeholder='Giải thích (tùy chọn) — có thể dán JSON {"A":"...","B":"..."}'
            style="width:100%;padding:8px;border:1.5px solid #e0e0e0;border-radius:6px;font-family:inherit"></textarea>`;
    wrap.querySelector('.gq-del').onclick = () => {
        const container = document.getElementById('group-questions-container');
        if (container.querySelectorAll('.group-q-row').length <= 2) {
            alert('Nhóm cần tối thiểu 2 câu.');
            return;
        }
        wrap.remove();
        renumberGroupQuestions();
    };
    return wrap;
}

function renumberGroupQuestions() {
    document.querySelectorAll('#group-questions-container .group-q-row').forEach((row, i) => {
        const num = row.querySelector('.gq-num');
        if (num) num.textContent = `Câu ${i + 1}`;
    });
}

async function handleGroupAudioUpload(file) {
    const status = document.getElementById('group-audio-status');
    const preview = document.getElementById('group-audio-preview');
    const player = document.getElementById('group-audio-player');
    const fileInput = document.getElementById('group-audio-file');
    if (!file.type.startsWith('audio') && !file.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
        alert('Chỉ nhận file audio (MP3, WAV, OGG, M4A, AAC)!'); fileInput.value = ''; return;
    }
    if (file.size > 10 * 1024 * 1024) { alert('File audio tối đa 10MB!'); fileInput.value = ''; return; }
    status.style.display = 'block';
    try {
        const fd = new FormData(); fd.append('audio', file);
        const src = encodeURIComponent(document.getElementById('group-source')?.value.trim() || '');
        const res = await fetch(`${TOEIC_API_BASE}/upload/audio?source=${src}`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${getToken()}` }, body: fd,
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Upload failed');
        groupAudioUrl = data.audioUrl;
        player.src = data.audioUrl;
        preview.style.display = 'block';
    } catch (e) {
        alert('Tải audio lỗi: ' + e.message);
    } finally {
        status.style.display = 'none';
    }
}

async function handleGroupImageUpload(file) {
    const status = document.getElementById('group-image-status');
    const fileInput = document.getElementById('group-image-file');
    const part = parseInt(document.getElementById('group-part').value);
    const max = IMAGE_RULES[part]?.max || 0;
    if (groupImageUrls.length >= max) {
        alert(max === 0 ? `Part ${part} không dùng ảnh.` : `Part ${part} tối đa ${max} ảnh.`);
        fileInput.value = ''; return;
    }
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
        alert('Chỉ nhận file ảnh (JPEG, PNG, GIF, WEBP)!'); fileInput.value = ''; return;
    }
    if (file.size > 5 * 1024 * 1024) { alert('Ảnh tối đa 5MB!'); fileInput.value = ''; return; }
    status.style.display = 'block';
    try {
        const fd = new FormData(); fd.append('image', file);
        const src = encodeURIComponent(document.getElementById('group-source')?.value.trim() || '');
        const res = await fetch(`${TOEIC_API_BASE}/upload/part1-image?source=${src}`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${getToken()}` }, body: fd,
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Upload failed');
        groupImageUrls.push(data.imageUrl);
        renderGroupImages();
        fileInput.value = '';
    } catch (e) {
        alert('Tải ảnh lỗi: ' + e.message);
    } finally {
        status.style.display = 'none';
    }
}

function collectGroupQuestions() {
    return Array.from(document.querySelectorAll('#group-questions-container .group-q-row')).map(row => {
        const options = Array.from(row.querySelectorAll('.gq-opt'))
            .map(inp => ({ label: inp.dataset.label, text: inp.value.trim() }))
            .filter(o => o.text);
        const correctAnswer = row.querySelector('input[type="radio"]:checked')?.value || null;
        const expRaw = row.querySelector('.gq-exp').value.trim();
        let explanation;
        if (expRaw) { try { explanation = JSON.parse(expRaw); } catch { explanation = { note: expRaw }; } }
        return { questionText: row.querySelector('.gq-text').value.trim(), options, correctAnswer, explanation };
    });
}

async function submitGroup() {
    const part = parseInt(document.getElementById('group-part').value);
    const source = document.getElementById('group-source').value.trim();
    if (!source) { alert('Vui lòng nhập Source (mã đề)!'); return; }

    const rule = IMAGE_RULES[part] || { min: 0, max: 0 };
    if (rule.min > 0 && groupImageUrls.length < rule.min) {
        alert(`Part ${part} cần ít nhất ${rule.min} ảnh chung.`); return;
    }
    if ((part === 3 || part === 4) && !groupAudioUrl) {
        alert(`Part ${part} cần file audio chung.`); return;
    }

    const questions = collectGroupQuestions();
    if (questions.length < 2) { alert('Nhóm cần tối thiểu 2 câu.'); return; }
    for (let i = 0; i < questions.length; i++) {
        if (questions[i].options.length < 3) { alert(`Câu ${i + 1}: cần tối thiểu 3 đáp án.`); return; }
        if (!questions[i].correctAnswer) { alert(`Câu ${i + 1}: chưa chọn đáp án đúng.`); return; }
    }

    const btn = document.getElementById('btn-submit-group');
    btn.disabled = true; btn.textContent = 'Đang tạo...';
    try {
        const res = await fetch(`${TOEIC_API_BASE}/questions/group`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({
                part, source,
                audioUrl: groupAudioUrl || undefined,
                imageUrls: groupImageUrls,
                passageCount: document.getElementById('group-passage-count').value || undefined,
                questions,
            }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Server error');
        showToast(data.message || 'Đã tạo nhóm', 'success');
        closeGroupModal();
        if (typeof loadQuestions === 'function') loadQuestions();
    } catch (e) {
        alert('Tạo nhóm lỗi: ' + e.message);
    } finally {
        btn.disabled = false; btn.textContent = 'Tạo nhóm';
    }
}
