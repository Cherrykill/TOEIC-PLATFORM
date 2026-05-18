// ===================================
// SHARE CARD - Tạo ảnh chia sẻ bằng Canvas
// ===================================

const ShareCard = (() => {
    const W = 800, H = 420;

    function createCanvas() {
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        return c;
    }

    // Vẽ hình chữ nhật bo góc (không dùng roundRect để tránh lỗi browser cũ)
    function rRect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    }

    function drawBase(ctx, accentColor) {
        // Nền
        const bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#0f172a');
        bg.addColorStop(1, '#1e293b');
        rRect(ctx, 0, 0, W, H, 0);
        ctx.fillStyle = bg;
        ctx.fill();

        // Viền màu accent trên đầu
        ctx.fillStyle = accentColor;
        ctx.fillRect(0, 0, W, 5);

        // Dot pattern
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        for (let x = 20; x < W; x += 40) {
            for (let y = 20; y < H; y += 40) {
                ctx.beginPath();
                ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Watermark
        ctx.save();
        ctx.font = '600 13px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.13)';
        ctx.textAlign = 'right';
        ctx.fillText('TOEIC Vocabulary', W - 24, H - 18);
        ctx.restore();
    }

    function drawAvatar(ctx, name, x, y, r) {
        const palette = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444'];
        const color = palette[(name.charCodeAt(0) || 65) % palette.length];
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.font = `bold ${Math.round(r * 0.95)}px Arial`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((name[0] || 'U').toUpperCase(), x, y + 1);
        ctx.restore();
    }

    function statBox(ctx, x, y, w, h, label, value, icon) {
        ctx.save();
        rRect(ctx, x, y, w, h, 12);
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fill();

        ctx.textAlign = 'center';
        // Icon
        ctx.font = '22px Arial';
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'top';
        ctx.fillText(icon, x + w / 2, y + 12);
        // Value
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'top';
        ctx.fillText(value, x + w / 2, y + 44);
        // Label
        ctx.font = '12px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.textBaseline = 'top';
        ctx.fillText(label, x + w / 2, y + 68);
        ctx.restore();
    }

    function drawUserBlock(ctx, name, userId, accentColor) {
        drawAvatar(ctx, name, 50, 64, 32);

        ctx.save();
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(name, 92, 58);

        ctx.font = '12px Arial';
        ctx.fillStyle = accentColor;
        ctx.fillText('ID: ' + userId, 92, 76);
        ctx.restore();
    }

    // ── Leaderboard ──────────────────────────────────────────────
    function drawLeaderboard({ name, userId, xp, rank, period }) {
        const canvas = createCanvas();
        const ctx = canvas.getContext('2d');

        drawBase(ctx, '#f59e0b');
        drawUserBlock(ctx, name, userId, '#fbbf24');

        // Trophy emoji
        ctx.save();
        ctx.font = '60px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('🏆', W / 2, 22);
        ctx.restore();

        // Title
        ctx.save();
        ctx.font = 'bold 26px Arial';
        ctx.fillStyle = '#f59e0b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('BANG XEP HANG', W / 2, 128);
        ctx.restore();

        // Period tag
        ctx.save();
        rRect(ctx, W / 2 - 56, 136, 112, 24, 12);
        ctx.fillStyle = 'rgba(245,158,11,0.18)';
        ctx.fill();
        ctx.font = '600 12px Arial';
        ctx.fillStyle = '#f59e0b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(period, W / 2, 148);
        ctx.restore();

        // Divider
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(60, 178); ctx.lineTo(W - 60, 178);
        ctx.stroke();
        ctx.restore();

        // Stat boxes
        const rankLabel = rank === 1 ? 'Hang 1 🥇' : rank === 2 ? 'Hang 2 🥈' : rank === 3 ? 'Hang 3 🥉' : '#' + rank;
        statBox(ctx, 72, 192, 192, 96, 'Xep hang', rankLabel, '🎖');
        statBox(ctx, 304, 192, 192, 96, 'Tong XP', xp.toLocaleString(), '⚡');
        statBox(ctx, 536, 192, 192, 96, 'Chu ky', period, '📅');

        // CTA
        ctx.save();
        ctx.font = '600 13px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('Cung luyen tu vung TOEIC nao! 💪', W / 2, 358);
        ctx.restore();

        return canvas.toDataURL('image/png');
    }

    // ── Achievements ─────────────────────────────────────────────
    function drawAchievements({ name, userId, unlocked, total, xp }) {
        const canvas = createCanvas();
        const ctx = canvas.getContext('2d');

        drawBase(ctx, '#8b5cf6');
        drawUserBlock(ctx, name, userId, '#a78bfa');

        // Medal emoji
        ctx.save();
        ctx.font = '60px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('🏅', W / 2, 22);
        ctx.restore();

        // Title
        ctx.save();
        ctx.font = 'bold 26px Arial';
        ctx.fillStyle = '#a78bfa';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('THANH TICH CUA TOI', W / 2, 128);
        ctx.restore();

        // Divider
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(60, 150); ctx.lineTo(W - 60, 150);
        ctx.stroke();
        ctx.restore();

        const pct = total > 0 ? Math.round(unlocked / total * 100) : 0;
        statBox(ctx, 72, 168, 192, 96, 'Da mo khoa', `${unlocked}/${total}`, '🔓');
        statBox(ctx, 304, 168, 192, 96, 'Hoan thanh', `${pct}%`, '✅');
        statBox(ctx, 536, 168, 192, 96, 'Tong XP', xp.toLocaleString(), '⚡');

        // Progress bar
        const bx = 72, by = 284, bw = W - 144, bh = 10;
        ctx.save();
        rRect(ctx, bx, by, bw, bh, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fill();
        const fill = Math.max(bh, bw * pct / 100);
        const gr = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        gr.addColorStop(0, '#8b5cf6');
        gr.addColorStop(1, '#ec4899');
        rRect(ctx, bx, by, fill, bh, 5);
        ctx.fillStyle = gr;
        ctx.fill();
        ctx.font = '12px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`${pct}% hoan thanh`, W / 2, by + bh + 6);
        ctx.restore();

        // CTA
        ctx.save();
        ctx.font = '600 13px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('Cung luyen tu vung TOEIC nao! 💪', W / 2, 382);
        ctx.restore();

        return canvas.toDataURL('image/png');
    }

    // ── Share dispatcher ─────────────────────────────────────────
    function doShare(dataUrl, filename, text, title) {
        showShareModal(dataUrl, filename, text, title);
    }

    function showShareModal(dataUrl, filename, text, title) {
        const existing = document.getElementById('share-card-modal');
        if (existing) existing.remove();

        // Kiểm tra có hỗ trợ native share không
        let canNativeShare = false;
        if (dataUrl && navigator.share && navigator.canShare) {
            // Thử tạo file từ dataUrl để kiểm tra
            try {
                const dummyFile = new File([''], filename, { type: 'image/png' });
                canNativeShare = navigator.canShare({ files: [dummyFile] });
            } catch (e) {}
        }

        const modal = document.createElement('div');
        modal.id = 'share-card-modal';
        modal.className = 'share-card-modal';
        modal.innerHTML = `
            <div class="share-card-inner">
                <div class="share-card-header">
                    <span>Chia sẻ</span>
                    <button id="share-card-close"><i class="fas fa-times"></i></button>
                </div>
                ${dataUrl
                    ? `<img src="${dataUrl}" class="share-card-preview" alt="Share card">`
                    : `<p style="color:#9ca3af;text-align:center;padding:20px">Không tạo được ảnh</p>`
                }
                <div class="share-card-actions">
                    ${canNativeShare ? `<button class="btn-native-share" id="share-native-btn"><i class="fas fa-share-alt"></i> Chia sẻ</button>` : ''}
                    ${dataUrl ? `<a href="${dataUrl}" download="${filename}" class="btn-download"><i class="fas fa-download"></i> Tải ảnh</a>` : ''}
                    <button class="btn-copy-text" id="share-copy-text"><i class="fas fa-copy"></i> Sao chép</button>
                </div>
                <p class="share-card-text">${text}</p>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', e => { if (e.target === modal) closeShareModal(modal); });
        document.getElementById('share-card-close').addEventListener('click', () => closeShareModal(modal));

        document.getElementById('share-copy-text')?.addEventListener('click', () => {
            navigator.clipboard?.writeText(text).then(() => {
                Notification.show({ type: 'success', message: '✅ Đã sao chép!' });
            });
        });

        document.getElementById('share-native-btn')?.addEventListener('click', async () => {
            if (!dataUrl) return;
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const file = new File([blob], filename, { type: 'image/png' });
            navigator.share({ title, text, files: [file] }).catch(() => {});
        });

        requestAnimationFrame(() => modal.classList.add('open'));
    }

    function closeShareModal(modal) {
        modal.classList.remove('open');
        setTimeout(() => modal.remove(), 300);
    }

    return { drawLeaderboard, drawAchievements, doShare };
})();
