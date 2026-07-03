// modules/item-defs-admin.js — CRUD catalog vật phẩm (item_definitions).
// Dùng chung ô upload ảnh với shop (POST /admin/upload-image?role=...).
(function () {
  let ALL = [];

  const iconCell = (d) => {
    if (d.image) return `<img src="${d.image}" alt="" style="width:30px;height:30px;object-fit:contain;border-radius:6px">`;
    const ic = d.icon || '';
    if (ic.startsWith('fa-')) return `<i class="fas ${ic}" style="font-size:18px"></i>`;
    return `<span style="font-size:20px">${ic || '📦'}</span>`;
  };

  const fmtDuration = (d) => {
    if (d.durationType === 'permanent' || !d.durationSec) return 'vĩnh viễn';
    const s = d.durationSec;
    const t = s % 86400 === 0 ? `${s / 86400} ngày` : s % 3600 === 0 ? `${s / 3600} giờ` : `${s}s`;
    return `${d.durationType} · ${t}`;
  };

  function render() {
    const tbody = document.getElementById('itemdef-tbody');
    if (!tbody) return;
    const q = (document.getElementById('itemdef-search')?.value || '').trim().toLowerCase();
    const type = document.getElementById('itemdef-filter-type')?.value || '';
    const rows = ALL.filter(d => {
      if (type && d.type !== type) return false;
      if (q && !((d.name || '') + (d.itemId || '') + (d.type || '')).toLowerCase().includes(q)) return false;
      return true;
    });
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary);padding:20px">Không có vật phẩm</td></tr>'; return; }
    tbody.innerHTML = rows.map(d => `<tr>
      <td style="text-align:center">${iconCell(d)}</td>
      <td><strong>${d.name || ''}</strong><br><small style="color:var(--text-secondary);font-family:monospace">${d.itemId}</small></td>
      <td><span class="badge neutral">${d.type}</span></td>
      <td>${d.rarity || 'common'}</td>
      <td style="font-size:12px">${fmtDuration(d)}</td>
      <td>${d.order || 0}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-secondary btn-sm btn-itemdef-edit" data-id="${d._id}"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-itemdef-del" data-id="${d._id}" data-name="${(d.name || '').replace(/"/g, '&quot;')}" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('');

    tbody.querySelectorAll('.btn-itemdef-edit').forEach(b => b.onclick = async () => {
      const r = await fetch(`${API_URL}/admin/item-defs/${b.dataset.id}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const j = await r.json();
      if (j.success) openModal(j.data);
    });
    tbody.querySelectorAll('.btn-itemdef-del').forEach(b => b.onclick = async () => {
      if (!confirm(`Xóa vật phẩm "${b.dataset.name}"?`)) return;
      const r = await fetch(`${API_URL}/admin/item-defs/${b.dataset.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
      const j = await r.json();
      showToast(j.message || 'Đã xóa', j.success ? 'success' : 'error');
      if (j.success) load();
    });
  }

  async function load() {
    const tbody = document.getElementById('itemdef-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="loading"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>';
    try {
      const r = await fetch(`${API_URL}/admin/item-defs`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const j = await r.json();
      ALL = j.success ? (j.data || []) : [];
      render();
    } catch (e) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--danger)">${e.message}</td></tr>`;
    }
  }

  function setImage(url) {
    document.getElementById('itemdef-image').value = url || '';
    const img = document.getElementById('itemdef-image-preview');
    if (url) { img.src = url; img.style.display = ''; }
    else { img.removeAttribute('src'); img.style.display = 'none'; }
  }

  function openModal(data) {
    data = data || {};
    const isEdit = !!data._id;
    document.getElementById('itemdef-id').value = data._id || '';
    document.getElementById('itemdef-modal-title').textContent = isEdit ? 'Sửa vật phẩm' : 'Thêm vật phẩm';
    document.getElementById('itemdef-name').value = data.name || '';
    document.getElementById('itemdef-icon').value = data.icon || '';
    const idInp = document.getElementById('itemdef-item-id');
    idInp.value = data.itemId || '';
    idInp.readOnly = isEdit; idInp.style.opacity = isEdit ? '0.6' : '1';
    document.getElementById('itemdef-type').value = data.type || 'consumable';
    document.getElementById('itemdef-rarity').value = data.rarity || 'common';
    document.getElementById('itemdef-duration-type').value = data.durationType || 'permanent';
    document.getElementById('itemdef-duration-sec').value = data.durationSec || 0;
    document.getElementById('itemdef-order').value = data.order || 0;
    document.getElementById('itemdef-desc').value = data.description || '';
    document.getElementById('itemdef-effect').value = data.effect ? JSON.stringify(data.effect, null, 2) : '';
    document.getElementById('itemdef-stackable').checked = data.stackable !== false;
    document.getElementById('itemdef-tradable').checked = !!data.tradable;
    document.getElementById('itemdef-active').checked = data.isActive !== false;
    setImage(data.image || '');
    document.getElementById('itemdef-modal').style.display = 'flex';
  }

  function initModal() {
    document.getElementById('btn-add-item-def')?.addEventListener('click', () => openModal());
    document.getElementById('btn-itemdef-cancel')?.addEventListener('click', () => { document.getElementById('itemdef-modal').style.display = 'none'; });
    document.getElementById('itemdef-search')?.addEventListener('input', render);
    document.getElementById('itemdef-filter-type')?.addEventListener('change', render);

    // Upload ảnh
    document.getElementById('itemdef-image-file')?.addEventListener('change', async function () {
      const file = this.files && this.files[0];
      if (!file) return;
      const role = document.getElementById('itemdef-image-role').value || 'item';
      const fd = new FormData(); fd.append('image', file);
      showToast('Đang tải ảnh...', 'info');
      try {
        const r = await fetch(`${API_URL}/admin/upload-image?role=${encodeURIComponent(role)}`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
        const j = await r.json();
        if (j.success) { setImage(j.url); showToast('Đã tải ảnh', 'success'); }
        else showToast(j.message || 'Tải ảnh thất bại', 'error');
      } catch (e) { showToast(e.message, 'error'); }
      this.value = '';
    });
    document.getElementById('itemdef-image-clear')?.addEventListener('click', () => setImage(''));

    document.getElementById('itemdef-form')?.addEventListener('submit', async function (e) {
      e.preventDefault();
      const id = document.getElementById('itemdef-id').value;
      let effect = undefined;
      const raw = document.getElementById('itemdef-effect').value.trim();
      if (raw) { try { effect = JSON.parse(raw); } catch { showToast('Effect không phải JSON hợp lệ', 'error'); return; } }
      const payload = {
        itemId: document.getElementById('itemdef-item-id').value.trim(),
        name: document.getElementById('itemdef-name').value.trim(),
        description: document.getElementById('itemdef-desc').value.trim(),
        icon: document.getElementById('itemdef-icon').value.trim(),
        image: document.getElementById('itemdef-image').value.trim(),
        type: document.getElementById('itemdef-type').value,
        rarity: document.getElementById('itemdef-rarity').value,
        stackable: document.getElementById('itemdef-stackable').checked,
        tradable: document.getElementById('itemdef-tradable').checked,
        durationType: document.getElementById('itemdef-duration-type').value,
        durationSec: Number(document.getElementById('itemdef-duration-sec').value) || 0,
        order: Number(document.getElementById('itemdef-order').value) || 0,
        isActive: document.getElementById('itemdef-active').checked,
      };
      if (effect !== undefined) payload.effect = effect;
      const url = id ? `${API_URL}/admin/item-defs/${id}` : `${API_URL}/admin/item-defs`;
      const r = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      showToast(j.message || (id ? 'Đã cập nhật' : 'Đã tạo'), j.success ? 'success' : 'error');
      if (j.success) { document.getElementById('itemdef-modal').style.display = 'none'; load(); }
    });
  }

  let inited = false;
  window.loadItemDefs = function () {
    if (!inited) { inited = true; initModal(); }
    load();
  };
})();
