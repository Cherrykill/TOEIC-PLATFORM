import { useState } from "react";
import { useAuth } from "@components/auth/AuthContext.jsx";
import { useGame } from "@game/GameContext.jsx";
import { API } from "@api/http.js";
import { Notification } from "@ui/Toaster.jsx";
import LoginForm from "./forms/LoginForm.jsx";
import RegisterForm from "./forms/RegisterForm.jsx";
import RegisterOtpForm from "./forms/RegisterOtpForm.jsx";
import ForgotPasswordForm from "./forms/ForgotPasswordForm.jsx";
import ResetPasswordForm from "./forms/ResetPasswordForm.jsx";

export default function AuthModal() {
  const { authModal, setAuthModal, setUser } = useAuth();
  const { syncFromState } = useGame();

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [forgotEmail, setForgotEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  if (!authModal) return null;

  const close = () => {
    setAuthModal(null);
    setLoginError("");
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm),
    })
      .then((r) => r.json())
      .catch(() => ({ success: false, message: "Lỗi kết nối" }));
    setLoading(false);
    if (res.success && res.token) {
      setUser(res.user, res.token);
      syncFromState();
      close();
      Notification.success("Đăng nhập thành công!");
    } else {
      setLoginError(res.message || "Đăng nhập thất bại");
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await API.auth.register(registerForm);
    setLoading(false);
    if (res.success) {
      setOtpSent(true);
    } else {
      setLoginError(res.error || "Không thể gửi OTP");
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otp = otpDigits.join("");
    if (otp.length !== 6) {
      setLoginError("Nhập đủ 6 số OTP");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/verify-register-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: registerForm.email, otp }),
    })
      .then((r) => r.json())
      .catch(() => ({ success: false }));
    setLoading(false);
    if (res.success && res.token) {
      setUser(res.user, res.token);
      syncFromState();
      close();
      Notification.success("Đăng ký thành công!");
    } else {
      setLoginError(res.message || "OTP không đúng");
    }
  };

  const handleSendResetOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail }),
    })
      .then((r) => r.json())
      .catch(() => ({ success: false }));
    setLoading(false);
    if (res.success) {
      setOtpSent(true);
    } else {
      setLoginError(res.message || "Không thể gửi OTP");
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      setLoginError("Mật khẩu không khớp");
      return;
    }
    const otp = otpDigits.join("");
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail, otp, newPassword: newPwd }),
    })
      .then((r) => r.json())
      .catch(() => ({ success: false }));
    setLoading(false);
    if (res.success) {
      Notification.success("Đặt lại mật khẩu thành công!");
      setAuthModal("login");
    } else {
      setLoginError(res.message || "Thất bại");
    }
  };

  const handleOtpChange = (i, val) => {
    const digits = [...otpDigits];
    digits[i] = val.slice(-1);
    setOtpDigits(digits);
    if (val && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
  };

  return (
    <div id="auth-modal" className="auth-modal active">
      <div className="auth-modal-content">
        <button className="auth-close-btn" onClick={close}>
          <i className="fas fa-times"></i>
        </button>

        {authModal === "login" && (
          <LoginForm
            loginError={loginError}
            loginForm={loginForm}
            setLoginForm={setLoginForm}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            loading={loading}
            handleLogin={handleLogin}
            setAuthModal={setAuthModal}
            setLoginError={setLoginError}
          />
        )}

        {authModal === "register" && !otpSent && (
          <RegisterForm
            loginError={loginError}
            registerForm={registerForm}
            setRegisterForm={setRegisterForm}
            loading={loading}
            handleSendOtp={handleSendOtp}
            setAuthModal={setAuthModal}
            setLoginError={setLoginError}
            setOtpSent={setOtpSent}
          />
        )}

        {authModal === "register" && otpSent && (
          <RegisterOtpForm
            loginError={loginError}
            registerForm={registerForm}
            otpDigits={otpDigits}
            handleOtpChange={handleOtpChange}
            loading={loading}
            handleVerifyOtp={handleVerifyOtp}
          />
        )}

        {authModal === "forgotPassword" && !otpSent && (
          <ForgotPasswordForm
            loginError={loginError}
            forgotEmail={forgotEmail}
            setForgotEmail={setForgotEmail}
            loading={loading}
            handleSendResetOtp={handleSendResetOtp}
            setAuthModal={setAuthModal}
            setLoginError={setLoginError}
          />
        )}

        {authModal === "forgotPassword" && otpSent && (
          <ResetPasswordForm
            loginError={loginError}
            otpDigits={otpDigits}
            handleOtpChange={handleOtpChange}
            newPwd={newPwd}
            setNewPwd={setNewPwd}
            confirmPwd={confirmPwd}
            setConfirmPwd={setConfirmPwd}
            loading={loading}
            handleResetPassword={handleResetPassword}
          />
        )}
      </div>
    </div>
  );
}
