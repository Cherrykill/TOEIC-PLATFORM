// modules/spin-admin.js — chỉnh phần thưởng & tỷ lệ Vòng quay
(function () {
  const hdr = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });
  const TYPES = ['coins', 'gems', 'xp', 'energy', 'hints'];
  let inited = false;

  const inp = (cls, val, w, extra = '') =>
    `<input class="${cls}" value="${String(val ?? '').replace(/"/g, '&quot;')}" ${extra}
      style="width:${w}px;padding:5px 7px;border:1px solid var(--border-color);border-radius:5px;background:var(--bg-secondary);color:var(--text-primary)">`;

  function rowHtml(p) {
    const opts = TYPES.map(t => `<option value="${t}"${p.type === t ? ' selected' : ''}>${t}</option>`).join('');
    return `<tr>
      <td><input type="color" class="sc-color" value="${p.color || '#888888'}" style="width:34px;height:30px;padding:2px;border:1px solid var(--border-color);border-radius:5px;cursor:pointer"></td>
      <td>${inp('sc-icon', p.icon || '🎁', 44)}</td>
      <td>${inp('sc-label', p.label || '', 110)}</td>
      <td><select class="sc-type" style="padding:5px;border:1px solid var(--border-color);border-radius:5px;background:var(--bg-secondary);color:var(--text-primary)">${opts}</select></td>
      <td>${inp('sc-amount', p.amount ?? 0, 70, 'type="number"')}</td>
      <td>${inp('sc-free', p.prob?.free ?? 0, 64, 'type="number" step="0.01"')}</td>
      <td>${inp('sc-coin', p.prob?.coin ?? 0, 64, 'type="number" step="0.01"')}</td>
      <td>${inp('sc-gem', p.prob?.gem ?? 0, 64, 'type="number" step="0.01"')}</td>
    </tr>`;
  }

  function setStatus(msg, ok) {
    const el = document.getElementById('spin-config-status');
    if (el) { el.textContent = msg; el.style.color = ok ? '#22c55e' : '#ef4444'; }
  }

  async function load() {
    try {
      const r = await fetch(`${API_URL}/spin/config`, { headers: hdr() });
      const j = await r.json();
      if (!j.success) return;
      const cfg = j.data;
      const cc = document.getElementById('spin-cost-coin'); if (cc) cc.value = cfg.costs?.coin ?? 100;
      const cg = document.getElementById('spin-cost-gem'); if (cg) cg.value = cfg.costs?.gem ?? 5;
      const tbody = document.getElementById('spin-config-rows');
      if (tbody) tbody.innerHTML = (cfg.prizes || []).map(rowHtml).join('');
    } catch (_) {}
  }

  async function save() {
    const tbody = document.getElementById('spin-config-rows');
    if (!tbody) return;
    const prizes = [...tbody.querySelectorAll('tr')].map(tr => ({
      color: tr.querySelector('.sc-color').value,
      icon: tr.querySelector('.sc-icon').value,
      label: tr.querySelector('.sc-label').value,
      type: tr.querySelector('.sc-type').value,
      amount: Number(tr.querySelector('.sc-amount').value) || 0,
      prob: {
        free: Number(tr.querySelector('.sc-free').value) || 0,
        coin: Number(tr.querySelector('.sc-coin').value) || 0,
        gem: Number(tr.querySelector('.sc-gem').value) || 0,
      },
    }));
    const body = {
      costs: {
        coin: Number(document.getElementById('spin-cost-coin').value) || 100,
        gem: Number(document.getElementById('spin-cost-gem').value) || 5,
      },
      prizes,
    };
    try {
      const r = await fetch(`${API_URL}/spin/config`, { method: 'PUT', headers: hdr(), body: JSON.stringify(body) });
      const j = await r.json();
      setStatus(j.success ? '✅ Đã lưu (áp dụng ngay)' : '❌ ' + (j.message || 'Lỗi'), j.success);
    } catch (e) { setStatus('❌ ' + e.message, false); }
  }

  function initSpinAdmin() {
    load();
    if (!inited) {
      inited = true;
      document.getElementById('spin-config-save')?.addEventListener('click', save);
    }
  }

  window.refreshSpinAdmin = load;
  window.initSpinAdmin = initSpinAdmin;
})();
