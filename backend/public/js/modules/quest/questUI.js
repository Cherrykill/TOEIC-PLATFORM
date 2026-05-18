// ===================================
// QUEST UI - multi-type tabs
// ===================================

const QuestUI = {
    activeType: 'daily',

    init() {
        // Home-screen mini quest container (daily only)
        EventBus.on(GameEvents.QUEST_PROGRESS, () => this.renderMini());
        EventBus.on(GameEvents.QUEST_COMPLETED, q => this.onQuestCompleted(q));
        EventBus.on('quest:timerUpdate', d => this.updateTimers(d));

        // Quest screen tabs
        document.querySelectorAll('.quest-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.quest-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeType = btn.dataset.questType;
                this.renderScreen(this.activeType);
                Quest.loadType(this.activeType);
            });
        });

        // Initial mini render (home screen)
        this.renderMini();
    },

    // ── Mini render (home screen, daily only) ────────────────────────────────

    renderMini() {
        const el = document.getElementById('daily-quests');
        if (!el) return;
        const quests = Quest.getQuests('daily');
        if (!quests.length) {
            el.innerHTML = `<div class="empty-state"><i class="fas fa-tasks"></i><p>Không có nhiệm vụ nào</p></div>`;
            return;
        }
        el.innerHTML = quests.map(q => this._cardHtml(q, 'daily')).join('');
        el.querySelectorAll('.quest-claim-btn').forEach(btn => {
            btn.addEventListener('click', () => this._handleClaim('daily', btn.dataset.code, btn));
        });
    },

    // ── Full quest screen render ──────────────────────────────────────────────

    render(type) {
        type = type || this.activeType;
        if (document.getElementById('quest-screen')?.classList.contains('active')) {
            this.renderScreen(type);
        }
        if (type === 'daily') this.renderMini();
    },

    renderScreen(type = 'daily') {
        const el = document.getElementById('quest-screen-list');
        if (!el) return;

        const quests = Quest.getQuests(type);
        if (!quests.length) {
            el.innerHTML = `<div class="empty-state"><i class="fas fa-tasks"></i><p>Chưa có nhiệm vụ — quay lại sau!</p></div>`;
            return;
        }
        el.innerHTML = quests.map(q => this._cardHtml(q, type)).join('');
        el.querySelectorAll('.quest-claim-btn').forEach(btn => {
            btn.addEventListener('click', () => this._handleClaim(type, btn.dataset.code, btn));
        });
    },

    // ── Card HTML ─────────────────────────────────────────────────────────────

    _cardHtml(quest, type) {
        const pct = Math.min(100, Math.round((quest.progress / quest.target) * 100));
        const isCompleted = quest.completed;
        const isClaimed   = !!quest.claimedAt;
        const name = (quest.name || '').replace('{target}', quest.target);

        const rewards = [];
        if (quest.rewardCoins) rewards.push(`<span><i class="fas fa-coins"></i> ${quest.rewardCoins}</span>`);
        if (quest.rewardXp)    rewards.push(`<span><i class="fas fa-star"></i> ${quest.rewardXp} XP</span>`);
        if (quest.rewardGems)  rewards.push(`<span><i class="fas fa-gem"></i> ${quest.rewardGems}</span>`);

        const claimBtn = isCompleted && !isClaimed
            ? `<button class="quest-claim-btn btn btn-primary btn-sm" data-code="${quest.code}">Nhận thưởng</button>`
            : '';
        const claimedBadge = isClaimed
            ? `<div class="quest-claimed-badge"><i class="fas fa-check-circle"></i> Đã nhận</div>`
            : '';

        return `
        <div class="quest-card ${isCompleted ? 'completed' : ''} ${isClaimed ? 'claimed' : ''}" data-code="${quest.code}">
            <div class="quest-header">
                <div class="quest-title">
                    <div class="quest-icon">${quest.icon || '🎯'}</div>
                    <span>${name}</span>
                </div>
                <div class="quest-reward">${rewards.join(' ')}</div>
            </div>
            ${quest.description ? `<div class="quest-description">${quest.description}</div>` : ''}
            <div class="quest-progress">
                <div class="quest-progress-bar">
                    <div class="quest-progress-fill" style="width:${pct}%"></div>
                </div>
                <div class="quest-progress-text">${quest.progress} / ${quest.target}</div>
            </div>
            ${claimBtn}
            ${claimedBadge}
        </div>`;
    },

    // ── Claim ─────────────────────────────────────────────────────────────────

    async _handleClaim(type, code, btn) {
        if (!btn) return;
        btn.disabled = true;
        btn.textContent = 'Đang xử lý...';
        const rewards = await Quest.claimReward(type, code);
        if (rewards) {
            this._showRewardToast(rewards);
            // Refresh resources in GameState
            if (GameState?.state?.resources) {
                GameState.state.resources.coins += rewards.coins || 0;
                GameState.state.resources.gems  += rewards.gems  || 0;
                EventBus.emit(GameEvents.RESOURCES_UPDATED, GameState.state.resources);
            }
        } else {
            btn.disabled = false;
            btn.textContent = 'Nhận thưởng';
        }
    },

    _showRewardToast(rewards) {
        const parts = [];
        if (rewards.coins) parts.push(`+${rewards.coins} 🪙`);
        if (rewards.xp)    parts.push(`+${rewards.xp} XP ⭐`);
        if (rewards.gems)  parts.push(`+${rewards.gems} 💎`);
        if (typeof Notification !== 'undefined') {
            Notification.show({ type: 'success', message: `Nhận thưởng: ${parts.join('  ')}` });
        }
    },

    onQuestCompleted(quest) {
        const name = (quest.name || '').replace('{target}', quest.target);
        if (typeof Notification !== 'undefined') {
            Notification.show({ type: 'success', message: `🎉 Hoàn thành: ${name}` });
        }
    },

    // ── Timer ─────────────────────────────────────────────────────────────────

    updateTimers({ timeRemaining }) {
        const fmt = s => {
            const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
            return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
        };
        const text = fmt(timeRemaining);
        const t1 = document.getElementById('quest-timer');
        const t2 = document.getElementById('quest-screen-timer');
        if (t1) { t1.textContent = text; t1.style.color = timeRemaining < 3600 ? 'var(--error-color)' : ''; }
        if (t2) { t2.textContent = text; t2.style.color = timeRemaining < 3600 ? 'var(--error-color)' : ''; }
    },
};
