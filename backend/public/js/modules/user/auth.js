// ===================================
// AUTH MODULE - MERGED (auth.js + authUI.js)
// ===================================

const Auth = {
    // UI Elements
    modal: null,
    loginForm: null,
    registerForm: null,

    // State
    isLoggedIn: false,
    currentUser: null,

    // ===================================
    // INITIALIZATION
    // ===================================
    async init() {
        console.log('%cAuth: Initializing...', 'color: #00d4ff; font-weight: bold');

        // Init UI elements
        this.modal = document.getElementById('auth-modal');
        this.loginForm = document.getElementById('login-form');
        this.registerForm = document.getElementById('register-form');

        // Check existing token
        let token = null;

        try {
            const tokenObj = localStorage.getItem('authToken');

            if (tokenObj) {
                try {
                    const parsed = JSON.parse(tokenObj);
                    token = parsed.token || null;

                    // Reject token if it's past its expiry timestamp
                    if (token && parsed.expiresAt && Date.now() > parsed.expiresAt) {
                        console.log('%cToken expired (local check) — clearing', 'color: #ff6b6b');
                        token = null;
                        localStorage.removeItem('authToken');
                    }
                } catch (parseError) {
                    // If not JSON, treat as plain string
                    token = tokenObj;
                }
            }

            console.log('%cToken from localStorage:', 'color: cyan', token ? token.substring(0, 30) + '...' : 'NULL');

        } catch (error) {
            console.error('%cError reading token:', 'color: red', error);
            token = null;
            localStorage.removeItem('authToken');
        }

        if (token && token.length > 20) {
            // Có token → validate
            console.log('%cAuth: Token found → validating...', 'color: #00ff9d');
            const success = await this.validateToken(token);
            if (success) {
                console.log('%c✅ Auto login thành công!', 'color: #00ff9d; font-weight: bold; font-size: 16px');
                this.isLoggedIn = true;
                this.attachListeners();
                this.updateUIButtons();
                return;
            } else {
                console.log('%c❌ Token hết hạn hoặc invalid → xóa token', 'color: #ff6b6b; font-weight: bold');
                this.clearToken();
                // Clear cached gameState to prevent showing previous user's data in guest mode
                localStorage.removeItem('gameState');
            }
        } else {
            console.log('%cNo valid token found', 'color: #ffd93d');
        }

        // Fallback: Create guest
        console.log('%c👤 Tạo tài khoản khách...', 'color: #ffd93d');
        this.createGuestAccount();
        this.isLoggedIn = false;

        // Attach UI listeners
        this.attachListeners();
        this.updateUIButtons();
    },

    // ===================================
    // VALIDATE TOKEN KHI F5 – ĐỒNG BỘ TOÀN BỘ DATA TỪ SERVER (FIX HOÀN CHỈNH)
    // ===================================
    async validateToken(token) {
        console.log('');
        console.log('%c╔══════════════════════════════════════════════════════╗', 'color: #00ff9d');
        console.log('%c║             KIỂM TRA TOKEN KHI TẢI LẠI TRANG          ║', 'color: #00ff9d; font-weight: bold');
        console.log('%c╚══════════════════════════════════════════════════════╝', 'color: #00ff9d');

        try {
            // ✅ FIX: Use the API module for consistency
            const response = await API.auth.getMe();

            if (!response.success) {
                console.log('%cToken không hợp lệ hoặc hết hạn:', 'color: #ff6b6b', response.error);
                return false;
            }

            const data = response.data;
            if (!data.success || !data.data) { // Backend response has a nested success/data
                console.log('%cServer trả về success = false hoặc không có data', 'color: #ff6b6b');
                return false;
            }

            const serverData = data.data;

            // ✅ SECURITY CHECK: Reject admin tokens in user interface
            const userRole = serverData.user?.role || serverData.role;
            if (userRole === 'admin') {
                console.log('%c🚫 ADMIN TOKEN DETECTED - Clearing token for security', 'color: #ff6b6b; font-weight: bold; font-size: 14px');
                this.clearToken();
                return false;
            }

            const newToken = serverData.token || token; // backend có thể refresh token

            console.log('%cTOKEN HỢP LỆ → ĐANG ĐỒNG BỘ TOÀN BỘ DỮ LIỆU TỪ SERVER...', 'color: lime; font-size: 16px; font-weight: bold');

            // === ĐỒNG BỘ TOÀN BỘ GAMESTATE TỪ SERVER ===
            GameState.state = {
                user: {
                    id: serverData.id,
                    username: serverData.username,
                    avatar: (serverData.avatar || serverData.username?.[0] || 'U').toUpperCase(),
                    level: serverData.level || 1,
                    xp: serverData.xp || 0,
                    totalXp: serverData.totalXp || 0,
                    createdAt: new Date(serverData.createdAt || Date.now()).getTime(),
                    lastLoginAt: Date.now()
                },
                resources: serverData.resources || GameState.state.resources,
                progress: serverData.progress || GameState.state.progress,
                streak: serverData.streak || { current: 0, longest: 0 },
                quests: serverData.quests || { daily: [], lastResetDate: null },
                achievements: serverData.achievements || [],
                boosts: serverData.boosts || { xp: { active: false }, coins: { active: false } },
                settings: serverData.settings || {
                    soundEnabled: true,
                    musicEnabled: true,
                    vibrationEnabled: true,
                    notificationsEnabled: true,
                    soundVolume: 1.0,
                    musicVolume: 0.7,
                    randomQuestions: false,
                    volume: 70,
                    autoPronunciation: false,
                    questionsPerSession: 10,
                    timePerQuestion: 30,
                    difficulty: 'medium',
                    autoSync: true
                },
                session: GameState.state.session // giữ lại màn hình hiện tại
            };

            // ❌ REMOVE: Don't save here. GameState.init() will be called right after this
            // and will handle the initial save. This prevents a request storm.
            // await GameState.save();

            // Cập nhật token mới (nếu có)
            localStorage.setItem('authToken', JSON.stringify({
                token: newToken,
                expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
            }));
            ServerStorage.setToken(newToken);

            // Cập nhật trạng thái auth
            this.isLoggedIn = true;
            this.currentUser = serverData;

            // CẬP NHẬT UI NGAY LẬP TỨC (quan trọng!)
            if (window.game?.updateUI) {
                await window.game.updateUI();
            }

            this.updateUIButtons();
            EventBus.emit(GameEvents.USER_LOGIN, serverData);

            console.log('%cĐĂNG NHẬP TỰ ĐỘNG THÀNH CÔNG!', 'color: lime; font-size: 20px; font-weight: bold');
            console.log(`→ ${serverData.username} | Level ${serverData.level} | ${serverData.resources?.energy || 100} năng lượng | Streak ${serverData.streak?.current || 0} ngày`);

            return true;

        } catch (err) {
            console.error('Lỗi khi validate token:', err);
            return false;
        }
    },

    // ===================================
    // GUEST ACCOUNT
    // ===================================
    createGuestAccount() {
        const adj = ['Red', 'Blue', 'Golden', 'Silver', 'Dark', 'Swift', 'Brave', 'Wise'];
        const noun = ['Ninja', 'Samurai', 'Dragon', 'Phoenix', 'Tiger', 'Wolf', 'Storm', 'Knight'];
        const username = Utils.randomElement(adj) + Utils.randomElement(noun) + Utils.randomInt(10, 99);

        GameState.updateUser({
            id: Utils.generateId(),
            username: username,
            avatar: username[0].toUpperCase(),
            level: 1,
            xp: 0,
            totalXp: 0,
            isGuest: true
        });

        this.currentUser = null;
        console.log('%cGuest created: ' + username, 'color: #ffd93d; font-weight: bold');
    },

    // ===================================
    // UI LISTENERS
    // ===================================
    attachListeners() {
        document.getElementById('login-menu-btn')?.addEventListener('click', () => this.showLogin());
        document.getElementById('register-menu-btn')?.addEventListener('click', () => this.showRegister());
        document.getElementById('logout-menu-btn')?.addEventListener('click', () => this.logout());

        document.getElementById('auth-close-btn')?.addEventListener('click', () => this.closeModal());

        document.getElementById('login-form-element')?.addEventListener('submit', e => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('register-form-element')?.addEventListener('submit', e => {
            e.preventDefault();
            this.handleSendRegisterOtp();
        });

        document.getElementById('show-register')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegister();
        });

        document.getElementById('show-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLogin();
        });

        // Show/hide password toggle
        document.getElementById('toggle-login-password')?.addEventListener('click', () => {
            const input = document.getElementById('login-password');
            const icon = document.querySelector('#toggle-login-password i');
            if (!input) return;
            const isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            icon?.classList.toggle('fa-eye', !isHidden);
            icon?.classList.toggle('fa-eye-slash', isHidden);
        });

        // Forgot password flow
        document.getElementById('show-forgot-password')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showForgotPassword();
        });
        document.getElementById('send-reset-otp-btn')?.addEventListener('click', () => this.handleSendResetOtp());
        document.getElementById('back-to-login-from-forgot')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLogin();
        });
        document.getElementById('confirm-reset-btn')?.addEventListener('click', () => this.handleResetPassword());
        document.getElementById('back-to-login-from-reset')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLogin();
        });
        document.getElementById('resend-reset-otp')?.addEventListener('click', async (e) => {
            e.preventDefault();
            if (this._resetEmail) await this.handleSendResetOtp(this._resetEmail);
        });

        // Register OTP flow
        document.getElementById('confirm-register-otp-btn')?.addEventListener('click', () => this.handleVerifyRegisterOtp());
        document.getElementById('back-to-register')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegister();
        });
        document.getElementById('resend-register-otp')?.addEventListener('click', async (e) => {
            e.preventDefault();
            if (this._pendingRegister) await this.handleSendRegisterOtp(true);
        });

        // OTP digit inputs — auto-advance, paste support
        this._attachOtpInputs();
    },

    // ===================================
    // OTP INPUT HELPERS
    // ===================================
    _attachOtpInputs() {
        document.querySelectorAll('.otp-input-group').forEach(group => {
            const digits = Array.from(group.querySelectorAll('.otp-digit'));

            digits.forEach((input, i) => {
                input.addEventListener('input', (e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    e.target.value = val ? val[0] : '';
                    e.target.classList.toggle('otp-filled', !!e.target.value);
                    if (val && i < digits.length - 1) digits[i + 1].focus();
                });

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !e.target.value && i > 0) {
                        digits[i - 1].value = '';
                        digits[i - 1].classList.remove('otp-filled');
                        digits[i - 1].focus();
                    }
                });

                input.addEventListener('paste', (e) => {
                    e.preventDefault();
                    const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
                    digits.forEach((d, j) => {
                        d.value = text[j] || '';
                        d.classList.toggle('otp-filled', !!d.value);
                    });
                    const next = digits.find(d => !d.value);
                    if (next) next.focus(); else digits[digits.length - 1].focus();
                });
            });
        });
    },

    _getOtpValue(group) {
        return Array.from(group.querySelectorAll('.otp-digit')).map(d => d.value).join('');
    },

    _clearOtpGroup(group) {
        group.querySelectorAll('.otp-digit').forEach(d => {
            d.value = '';
            d.classList.remove('otp-filled');
        });
        const first = group.querySelector('.otp-digit');
        if (first) first.focus();
    },

    updateUIButtons() {
        const loginBtn = document.getElementById('login-menu-btn');
        const registerBtn = document.getElementById('register-menu-btn');
        const logoutBtn = document.getElementById('logout-menu-btn');

        if (this.isLoggedIn) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (registerBtn) registerBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'flex';
        } else {
            if (loginBtn) loginBtn.style.display = 'flex';
            if (registerBtn) registerBtn.style.display = 'flex';
            if (logoutBtn) logoutBtn.style.display = 'none';
        }
    },

    // ===================================
    // MODAL CONTROLS
    // ===================================
    _allAuthForms() {
        return ['login-form', 'register-form', 'register-otp-form', 'forgot-password-form', 'reset-password-form']
            .map(id => document.getElementById(id))
            .filter(Boolean);
    },

    _showOnlyForm(id) {
        if (this.modal) this.modal.classList.add('active');
        this._allAuthForms().forEach(f => f.style.display = 'none');
        const target = document.getElementById(id);
        if (target) target.style.display = 'block';
    },

    showLogin() {
        this._showOnlyForm('login-form');
        setTimeout(() => this._initLoginEmailWatcher(), 50);
    },

    showRegister() {
        this._showOnlyForm('register-form');
    },

    showForgotPassword() {
        this._showOnlyForm('forgot-password-form');
        setTimeout(() => document.getElementById('forgot-email')?.focus(), 100);
    },

    closeModal() {
        if (this.modal) this.modal.classList.remove('active');
    },

    // ===================================
    // FORGOT PASSWORD – Step 1: Send OTP
    // ===================================
    async handleSendResetOtp(emailOverride) {
        const email = emailOverride || document.getElementById('forgot-email')?.value?.trim();
        if (!email) return Notification.show({ type: 'error', message: 'Vui lòng nhập email' });

        const btn = document.getElementById('send-reset-otp-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Đang gửi...'; }

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();

            if (!data.success) throw new Error(data.message);

            this._resetEmail = email;
            document.getElementById('reset-otp-email-display').textContent = email;

            this._showOnlyForm('reset-password-form');
            const group = document.querySelector('#reset-password-form .otp-input-group');
            if (group) this._clearOtpGroup(group);
            document.getElementById('new-password-reset').value = '';
            document.getElementById('confirm-password-reset').value = '';
            this._startOtpCountdown('reset-otp-timer', 'reset-otp-countdown');

            Notification.show({ type: 'success', message: data.message });
        } catch (err) {
            Notification.show({ type: 'error', message: err.message || 'Gửi mã thất bại' });
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi mã'; }
        }
    },

    // ===================================
    // FORGOT PASSWORD – Step 2: Verify + Reset
    // ===================================
    async handleResetPassword() {
        const group = document.querySelector('#reset-password-form .otp-input-group');
        const code = this._getOtpValue(group);
        const newPassword = document.getElementById('new-password-reset')?.value;
        const confirmPassword = document.getElementById('confirm-password-reset')?.value;

        if (code.length !== 6) return Notification.show({ type: 'error', message: 'Vui lòng nhập đủ 6 chữ số' });
        if (!newPassword || newPassword.length < 6) return Notification.show({ type: 'error', message: 'Mật khẩu phải ít nhất 6 ký tự' });
        if (newPassword !== confirmPassword) return Notification.show({ type: 'error', message: 'Mật khẩu không khớp' });

        const btn = document.getElementById('confirm-reset-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Đang xử lý...'; }

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: this._resetEmail, code, newPassword }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);

            Notification.show({ type: 'success', message: data.message });
            this._resetEmail = null;
            this.showLogin();
        } catch (err) {
            Notification.show({ type: 'error', message: err.message || 'Đặt lại thất bại' });
            if (group) this._clearOtpGroup(group);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-lock"></i> Xác nhận đặt lại'; }
        }
    },

    // ===================================
    // REGISTER – Step 1: Send OTP
    // ===================================
    async handleSendRegisterOtp(isResend = false) {
        let username, email, password;
        if (isResend && this._pendingRegister) {
            ({ username, email, password } = this._pendingRegister);
        } else {
            username = document.getElementById('register-username')?.value?.trim();
            email = document.getElementById('register-email')?.value?.trim();
            password = document.getElementById('register-password')?.value;
        }

        if (!username || !email || !password) return Notification.show({ type: 'error', message: 'Vui lòng điền đầy đủ thông tin' });

        const btn = document.querySelector('#register-form-element button[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Đang gửi...'; }

        try {
            const res = await fetch('/api/auth/send-register-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);

            this._pendingRegister = { username, email, password };
            document.getElementById('register-otp-email-display').textContent = email;

            this._showOnlyForm('register-otp-form');
            const group = document.querySelector('#register-otp-form .otp-input-group');
            if (group) this._clearOtpGroup(group);
            this._startOtpCountdown('register-otp-timer', 'register-otp-countdown');

            Notification.show({ type: 'success', message: 'Mã xác nhận đã được gửi!' });
        } catch (err) {
            Notification.show({ type: 'error', message: err.message || 'Gửi mã thất bại' });
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi mã xác nhận'; }
        }
    },

    // ===================================
    // REGISTER – Step 2: Verify OTP
    // ===================================
    async handleVerifyRegisterOtp() {
        const group = document.querySelector('#register-otp-form .otp-input-group');
        const code = this._getOtpValue(group);
        const email = this._pendingRegister?.email;

        if (code.length !== 6) return Notification.show({ type: 'error', message: 'Vui lòng nhập đủ 6 chữ số' });
        if (!email) return Notification.show({ type: 'error', message: 'Phiên đăng ký đã hết hạn, vui lòng thử lại' });

        const btn = document.getElementById('confirm-register-otp-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Đang xử lý...'; }

        try {
            const res = await fetch('/api/auth/verify-register-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);

            this._pendingRegister = null;
            await this.setUser(data.user, data.token);
            sessionStorage.setItem('login_welcome', data.user?.username || '');
            sessionStorage.setItem('login_welcome_type', 'new');
            this.closeModal();
            setTimeout(() => window.location.reload(), 300);
        } catch (err) {
            Notification.show({ type: 'error', message: err.message || 'Xác nhận thất bại' });
            if (group) this._clearOtpGroup(group);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> Xác nhận & Đăng ký'; }
        }
    },

    // ===================================
    // LOGIN
    // ===================================
    _setPasswordError(msg) {
        const el = document.getElementById('login-password-error');
        const input = document.getElementById('login-password');
        if (!el) return;
        el.textContent = msg;
        el.classList.toggle('visible', !!msg);
        if (msg && input) {
            input.focus();
            input.select();
            input.addEventListener('input', () => this._setPasswordError(''), { once: true });
        }
    },

    _setLockError(msg) {
        const el = document.getElementById('login-lock-error');
        const pwInput = document.getElementById('login-password');
        const pwToggle = document.getElementById('toggle-login-password');
        if (!el) return;
        // If clearing the error, also stop any running countdown
        if (!msg && this._lockTimer) {
            clearInterval(this._lockTimer);
            this._lockTimer = null;
        }
        el.textContent = msg;
        el.classList.toggle('visible', !!msg);
        if (pwInput) pwInput.disabled = !!msg;
        if (pwToggle) pwToggle.disabled = !!msg;
    },

    _startLockCountdown(lockUntil) {
        // Clear any existing countdown
        if (this._lockTimer) clearInterval(this._lockTimer);
        const el = document.getElementById('login-lock-error');
        if (!el) return;

        const update = () => {
            const remaining = lockUntil - Date.now();
            if (remaining <= 0) {
                clearInterval(this._lockTimer);
                this._lockTimer = null;
                this._setLockError('');
                return;
            }
            const m = String(Math.floor(remaining / 60000)).padStart(2, '0');
            const s = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
            this._setLockError(`🔒 Tài khoản tạm thời bị khóa. Thử lại sau ${m}:${s}`);
        };
        update();
        this._lockTimer = setInterval(update, 1000);
    },

    // OTP countdown (10 min)
    _startOtpCountdown(timerId, countdownId) {
        if (this[`_otpTimer_${timerId}`]) clearInterval(this[`_otpTimer_${timerId}`]);
        let seconds = 10 * 60;
        const timerEl = document.getElementById(timerId);
        const countdownEl = document.getElementById(countdownId);

        const update = () => {
            if (!timerEl) return;
            seconds--;
            if (seconds <= 0) {
                clearInterval(this[`_otpTimer_${timerId}`]);
                timerEl.textContent = '00:00';
                if (countdownEl) countdownEl.classList.add('expired');
                return;
            }
            const m = String(Math.floor(seconds / 60)).padStart(2, '0');
            const s = String(seconds % 60).padStart(2, '0');
            timerEl.textContent = `${m}:${s}`;
        };
        if (timerEl) timerEl.textContent = '10:00';
        if (countdownEl) countdownEl.classList.remove('expired');
        this[`_otpTimer_${timerId}`] = setInterval(update, 1000);
    },

    // ===================================
    // LOCK PERSISTENCE (localStorage)
    // ===================================
    async _checkEmailLockFromServer(email) {
        if (!email) return null;
        try {
            const res = await fetch('/api/auth/check-lock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!data.locked) return null;
            return { lockType: data.lockType, lockUntil: data.lockUntil ? new Date(data.lockUntil).getTime() : null };
        } catch (_) { return null; }
    },

    _initLoginEmailWatcher() {
        const emailInput = document.getElementById('login-email');
        if (!emailInput) return;

        let _debounceTimer = null;
        const checkNow = () => {
            const email = emailInput.value.trim();
            if (!email) { this._setLockError(''); return; }
            clearTimeout(_debounceTimer);
            _debounceTimer = setTimeout(async () => {
                const lock = await this._checkEmailLockFromServer(email);
                // Only apply if email hasn't changed while we were waiting
                if (emailInput.value.trim() !== email) return;
                if (lock) {
                    if (lock.lockType === 'admin') {
                        this._setLockError('🔒 Tài khoản bị khóa bởi quản trị viên. Vui lòng liên hệ hỗ trợ.');
                    } else {
                        this._startLockCountdown(lock.lockUntil);
                    }
                } else {
                    this._setLockError('');
                }
            }, 400);
        };

        emailInput.addEventListener('input', checkNow);
        emailInput.addEventListener('blur', checkNow);
        // Run once on modal open
        checkNow();
    },

    async handleLogin() {
        const email = document.getElementById('login-email')?.value?.trim();
        const password = document.getElementById('login-password')?.value;

        this._setPasswordError('');
        this._setLockError('');

        if (!email || !password) return Notification.show({ type: "error", message: "Nhập đầy đủ đi bro" });

        // Validate email format before sending to server
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this._setLockError('Email không hợp lệ. Vui lòng nhập đúng định dạng (vd: ten@gmail.com)');
            return;
        }

        try {
            // Use raw fetch to preserve structured error data (lockUntil, lockType etc.)
            const token = typeof ServerStorage !== 'undefined' ? ServerStorage.token : null;
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();

            // Handle locked account
            if (data.locked) {
                if (data.lockType === 'admin') {
                    this._setLockError('🔒 ' + (data.message || 'Tài khoản bị khóa bởi quản trị viên'));
                } else if (data.lockUntil) {
                    this._startLockCountdown(new Date(data.lockUntil).getTime());
                } else {
                    this._setLockError('🔒 ' + data.message);
                }
                return;
            }

            this._setLockError('');

            if (!res.ok || !data.success) throw new Error(data.message || "Login failed");

            // TỰ ĐỘNG TÌM TOKEN DÙ NẰM Ở ĐÂU
            const authToken = data.token || data.accessToken || data.jwt || data.access_token || data.data?.token || data.data?.accessToken;
            let user = data.user || data.data?.user || data.data;

            if (!authToken || !user) {
                console.error('KHÔNG TÌM THẤY TOKEN HOẶC USER!', data);
                throw new Error("Backend trả dữ liệu sai format");
            }

            // ✅ SECURITY CHECK: Prevent admin from logging into user interface
            const userRole = user.user?.role || user.role;
            if (userRole === 'admin') {
                throw new Error("Tài khoản admin không thể đăng nhập vào giao diện người chơi. Vui lòng sử dụng /dashboard");
            }
            console.log('%cTÌM THẤY TOKEN RỒI! Đang lưu...', 'color: #00ff00; font-size: 18px; font-weight: bold');

            await this.setUser(user, authToken);
            sessionStorage.setItem('login_welcome', user.username || '');
            sessionStorage.setItem('login_welcome_type', 'returning');
            this.closeModal();

            setTimeout(() => { window.location.reload(); }, 300);

        } catch (err) {
            const msg = err.message || '';
            // Parse lock info from error (Http.request throws with data.message)
            // We need to check the raw response — re-fetch to get structured data
            // Actually Http wraps non-ok as throw new Error(data.message), so we lose structured data.
            // Handle by pattern-matching the message:
            if (msg.includes('bị khóa bởi quản trị viên')) {
                this._setLockError('🔒 ' + msg);
            } else if (msg.includes('bị khóa') || msg.includes('Nhập sai')) {
                this._setLockError(msg);
            } else if (msg.toLowerCase().includes('admin')) {
                this._setLockError('⛔ Tài khoản admin không thể đăng nhập tại đây. Vui lòng truy cập trang quản trị.');
            } else if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('incorrect')) {
                this._setPasswordError('Mật khẩu không đúng, vui lòng nhập lại');
            } else {
                Notification.show({ type: "error", message: msg });
            }
            console.error('Login error:', err);
        }
    },


    // ===================================
    // REGISTER
    // ===================================
    async handleRegister() {
        const username = document.getElementById('register-username')?.value?.trim();
        const email = document.getElementById('register-email')?.value?.trim();
        const password = document.getElementById('register-password')?.value;

        if (!username || !email || !password) {
            Notification.show({ type: "error", message: "Vui lòng nhập đầy đủ" });
            return;
        }

        if (password.length < 6) {
            Notification.show({ type: "error", message: "Mật khẩu phải >= 6 ký tự" });
            return;
        }

        try {
            // ✅ FIX: Use the API module
            const response = await API.auth.register({ username, email, password });

            if (!response.success) {
                throw new Error(response.error || "Đăng ký thất bại");
            }

            // ✅ SECURITY CHECK: Prevent admin registration from user interface
            const user = response.data.user;
            const userRole = user?.user?.role || user?.role;
            if (userRole === 'admin') {
                throw new Error("Không thể đăng ký tài khoản admin từ giao diện này");
            }

            await this.setUser(response.data.user, response.data.token);
            sessionStorage.setItem('login_welcome', username || '');
            sessionStorage.setItem('login_welcome_type', 'new');
            this.closeModal();

            setTimeout(() => { window.location.reload(); }, 300);

        } catch (err) {
            Notification.show({ type: "error", title: "Lỗi", message: err.message });
        }
    },

    // ===================================
    // SET USER (after login/register) – FIXED 100%
    // ===================================
    // ===================================
    // SET USER (after login/register) – FIXED 100%
    // ===================================
    async setUser(user, token) {
        if (typeof token !== 'string') token = String(token);

        console.log('%cSETUSER ĐƯỢC GỌI – BẮT ĐẦU CẬP NHẬT...', 'color: #ff00ff; font-size: 18px; font-weight: bold; background: black; padding: 10px');

        this.isLoggedIn = true;
        this.currentUser = user;

        // 1. Lưu token trước tiên (kèm expiresAt để check phía client, JWT 7d)
        localStorage.setItem('authToken', JSON.stringify({
            token,
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        }));
        localStorage.setItem('currentUser', JSON.stringify(user));

        // 2. CẬP NHẬT TOÀN BỘ GAMESTATE TỪ DỮ LIỆU SERVER (FIX: Đồng bộ coins/resources)

        // ĐỒNG BỘ CÁC FIELD CỦA GAMESTATE (resources, progress, streak,...)
        // Đây là bước quan trọng nhất để fix lỗi không cập nhật coins
        GameState.state.resources = user.resources || GameState.state.resources;
        GameState.state.progress = user.progress || GameState.state.progress;
        GameState.state.streak = user.streak || { current: 0, longest: 0 };
        GameState.state.quests = user.quests || { daily: [], lastResetDate: null };
        GameState.state.achievements = user.achievements || [];
        GameState.state.boosts = user.boosts || { xp: { active: false }, coins: { active: false } };
        GameState.state.settings = user.settings || GameState.state.settings;

        // Cập nhật các trường cơ bản của user
        await GameState.updateUser({
            id: user.id,
            username: user.username,
            avatar: (user.username?.[0] || 'U').toUpperCase(),
            level: user.level || 1,
            xp: user.xp || 0,
            totalXp: user.totalXp || 0,
            isGuest: false
        });

        // ✅ FIX: DO NOT SAVE HERE!
        // We just synced FROM server, don't immediately save BACK to server.
        // This was causing the coins to be overwritten with stale data.
        // Auto-save will handle saves when user actually makes changes.
        // await GameState.save(); // ❌ REMOVED - was overwriting server data

        // 3. Cập nhật ServerStorage
        ServerStorage.setToken(token);

        // 4. Update UI ngay lập tức (await để chắc chắn)
        if (window.game?.updateUI) {
            console.log('%cĐang gọi window.game.updateUI()...', 'color: cyan');
            await window.game.updateUI();  // Đảm bảo chờ UI render xong
            console.log('%cUI đã được cập nhật xong!', 'color: #00ff00; font-weight: bold');
        }

        // 5. Update buttons
        this.updateUIButtons();

        // 6. Emit event
        EventBus.emit(GameEvents.USER_LOGIN, user);

        console.log('%cĐĂNG NHẬP HOÀN TẤT – KHÔNG CÒN VỀ GUEST NỮA!', 'color: #00ff00; font-size: 20px; font-weight: bold; background: black; padding: 15px');
    },

    // ===================================
    // LOGOUT
    // ===================================
    forceLogout(reason) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('gameState');
        this.isLoggedIn = false;
        this.currentUser = null;
        ServerStorage.clearToken();

        const msg = reason === 'admin'
            ? '🔒 Tài khoản của bạn đã bị khóa bởi quản trị viên. Đang đăng xuất...'
            : '⏳ Tài khoản của bạn tạm thời bị khóa. Đang đăng xuất...';
        Notification.show({ type: 'error', title: 'Tài khoản bị khóa', message: msg, duration: 4000 });
        setTimeout(() => location.reload(), 2000);
    },

    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('gameState');

        this.isLoggedIn = false;
        this.currentUser = null;

        ServerStorage.clearToken();

        // Reset CSS màu về mặc định (giữ nguyên key lưu trong localStorage để lần sau login lại còn dùng)
        const root = document.documentElement;
        root.style.setProperty('--primary-color', '#E11D48');
        root.style.setProperty('--primary', '#E11D48');
        root.style.setProperty('--primary-dark', '#be1238');
        root.style.setProperty('--primary-light', '#f87171');
        root.style.setProperty('--secondary-color', '#F97316');
        root.style.setProperty('--secondary-dark', '#c2590a');
        root.style.setProperty('--secondary-light', '#fdba74');

        // Đóng menu trước để header lộ ra
        if (typeof UI !== 'undefined' && UI.closeMenu) UI.closeMenu();

        // Cập nhật header về guest ngay lập tức
        const usernameEl = document.getElementById('username');
        const levelEl = document.getElementById('user-level');
        const avatarEl = document.getElementById('user-avatar');
        if (usernameEl) usernameEl.textContent = 'Khách';
        if (levelEl) levelEl.textContent = '1';
        if (avatarEl) avatarEl.textContent = 'K';

        Notification.show({ type: "info", message: "Đã đăng xuất. Đang tải lại..." });

        setTimeout(() => location.reload(), 1000);
    }
    ,

    // ===================================
    // UTILITY
    // ===================================
    clearToken() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
    },

    getAuthHeader() {
        const tokenObj = localStorage.getItem('authToken');
        if (!tokenObj) return {};

        try {
            const parsed = JSON.parse(tokenObj);
            const token = parsed.token;
            return token ? { Authorization: `Bearer ${token}` } : {};
        } catch {
            return {};
        }
    },

    // ===================================
    // USERNAME CHANGE
    // ===================================
    async updateUsername(newUsername) {
        if (!newUsername || newUsername.trim().length < 3 || newUsername.length > 20) {
            return { success: false, error: 'Tên phải 3-20 ký tự' };
        }

        const trimmed = newUsername.trim();

        try {
            const response = await API.auth.updateProfile({ username: trimmed });
            if (!response.success) {
                const msg = response.error || '';
                const localMsg = msg.toLowerCase().includes('already taken') || msg.toLowerCase().includes('username')
                    ? 'Tên này đã được sử dụng, vui lòng chọn tên khác'
                    : (msg || 'Đổi tên thất bại');
                return { success: false, error: localMsg };
            }

            // Update local state
            GameState.updateUser({
                username: trimmed,
                avatar: trimmed[0].toUpperCase()
            });

            // Update nav bar immediately
            const usernameEl = document.getElementById('username');
            const avatarEl = document.getElementById('user-avatar');
            if (usernameEl) usernameEl.textContent = trimmed;
            if (avatarEl) avatarEl.textContent = trimmed[0].toUpperCase();

            Notification.show({
                type: 'success',
                title: 'Thành công',
                message: `Đổi tên thành "${trimmed}"`
            });

            EventBus.emit('user:usernameChanged', { username: trimmed });
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message || 'Lỗi kết nối' };
        }
    },

    showUsernameChangeDialog() {
        const current = GameState.getUser().username || 'Player';
        Modal.show({
            title: 'Đổi tên',
            content: `
                <div class="form-group">
                    <label>Tên hiện tại: <strong>${current}</strong></label>
                    <input type="text" id="new-username" class="form-input" value="${current}" maxlength="20" placeholder="3-20 ký tự">
                    <small>Chỉ chữ, số và khoảng trắng</small>
                </div>
            `,
            buttons: [
                { text: 'Hủy', className: 'btn-secondary', onClick: () => Modal.close() },
                {
                    text: 'Lưu',
                    className: 'btn-primary',
                    onClick: async () => {
                        const val = document.getElementById('new-username')?.value || '';
                        const result = await this.updateUsername(val);
                        if (result.success) Modal.close();
                        else Notification.show({ type: 'error', message: result.error });
                    }
                }
            ]
        });
        setTimeout(() => document.getElementById('new-username')?.select(), 100);
    },

    // ===================================
    // DATA EXPORT/IMPORT
    // ===================================
    exportData() {
        const data = {
            user: GameState.getUser(),
            resources: GameState.getResources(),
            progress: GameState.state.progress,
            streak: GameState.state.streak,
            quests: GameState.state.quests,
            achievements: GameState.state.achievements,
            settings: GameState.state.settings,
            exportedAt: Date.now()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `toeic-data-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        Notification.show({
            type: 'success',
            title: 'Export thành công!',
            message: 'Dữ liệu đã được tải xuống'
        });
    },

    importData(fileInput) {
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.user || !data.resources) throw new Error('Invalid format');

                Modal.show({
                    title: 'Xác nhận import',
                    content: `
                        <div class="import-confirmation">
                            <p><strong>Cảnh báo:</strong> Dữ liệu hiện tại sẽ bị ghi đè!</p>
                            <ul>
                                <li>Username: ${data.user.username}</li>
                                <li>Level: ${data.user.level || 1}</li>
                                <li>Coins: ${data.resources.coins || 0}</li>
                                <li>Gems: ${data.resources.gems || 0}</li>
                            </ul>
                            <p>Bạn có chắc chắn?</p>
                        </div>
                    `,
                    buttons: [
                        { text: 'Hủy', className: 'btn-secondary', onClick: () => Modal.close() },
                        {
                            text: 'Import',
                            className: 'btn-primary',
                            onClick: () => {
                                this.doImport(data);
                                Modal.close();
                            }
                        }
                    ]
                });
            } catch (err) {
                Notification.show({
                    type: 'error',
                    title: 'Import thất bại',
                    message: 'File không hợp lệ'
                });
            }
        };
        reader.readAsText(file);
    },

    // ===================================
    // IMPORT DỮ LIỆU (CHUẨN, KHÔNG TRÙNG)
    // ===================================
    doImport(data) {
        GameState.state.user = data.user;
        GameState.state.resources = data.resources;
        GameState.state.progress = data.progress || {};
        GameState.state.streak = data.streak || { current: 0, longest: 0 };
        GameState.state.quests = data.quests || { daily: [], lastResetDate: null };
        GameState.state.achievements = data.achievements || [];
        GameState.state.settings = data.settings || GameState.state.settings;

        GameState.save();

        Notification.show({
            type: 'success',
            title: 'Import thành công!',
            message: 'Dữ liệu đã được khôi phục'
        });

        if (window.game?.updateUI) {
            window.game.updateUI();
        }
    }
    ,

    // Trong resetAllData() → XÓA reload, thay bằng tạo guest
    resetAllData() {
        Modal.show({
            title: 'Reset dữ liệu',
            content: `
            <div class="reset-warning">
                <p><strong>CẢNH BÁO:</strong> Toàn bộ dữ liệu sẽ bị xóa vĩnh viễn!</p>
                <ul><li>Tiến độ, coins, gems, streak...</li></ul>
                <p><strong>Không thể khôi phục!</strong></p>
            </div>
        `,
            buttons: [
                { text: 'Hủy', className: 'btn-secondary', onClick: () => Modal.close() },
                {
                    text: 'Reset tất cả',
                    className: 'btn-error',
                    onClick: () => {
                        GameState.reset();
                        Modal.close();

                        // Tạo lại guest ngay lập tức
                        Auth.createGuestAccount();
                        Auth.isLoggedIn = false;
                        Auth.updateUIButtons();
                        if (window.game?.updateUI) {
                            window.game.updateUI();
                        }

                        Notification.show({
                            type: 'info',
                            title: 'Đã reset!',
                            message: 'Tất cả dữ liệu đã bị xóa. Đã chuyển về chế độ khách.'
                        });

                        // XÓA DÒNG NÀY ĐI!!!
                        // setTimeout(() => location.reload(), 1000);
                    }
                }
            ]
        });
    }
};

// Export
window.Auth = Auth;
window.AuthUI = Auth; // Backward compatibility

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Auth;
}