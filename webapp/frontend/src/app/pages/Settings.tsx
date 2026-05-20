import { User, Mail, LogOut, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";

const API_BASE_URL = "http://localhost:5000";

export function Settings() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Gọi API lấy dữ liệu thực tế từ Database ngay khi mở trang
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Không thể tải thông tin tài khoản.");
        }

        const result = await response.json();
        if (result.status === "success" && result.data) {
          setFullName(result.data.ho_va_ten || "");
          setEmail(result.data.email || "");
          localStorage.setItem("user", JSON.stringify(result.data));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Đã xảy ra lỗi khi kết nối dữ liệu.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Xử lý sự kiện Submit Form cập nhật profile lên Backend
  const handleUpdateProfile = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!fullName.trim() || !email.trim()) {
      setError("Vui lòng điền đầy đủ họ tên và địa chỉ email.");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ho_va_ten: fullName.trim(),
          email: email.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Cập nhật dữ liệu thất bại.");
      }

      setMessage("Cập nhật thông tin tài khoản thành công!");
      if (result.data) {
        // Cập nhật lại thông tin user trong bộ nhớ đệm
        localStorage.setItem("user", JSON.stringify(result.data));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể kết nối đến máy chủ.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("isLoggedIn");
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-[#6366f1]" size={40} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Tiêu đề trang */}
      <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-8 border border-white/40 shadow-xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Cài đặt hệ thống</h1>
        <p className="text-sm text-gray-500">Quản lý thông tin hồ sơ cá nhân và tài khoản YoloHome của bạn</p>
      </div>

      {/* Thông báo trạng thái */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 shadow-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          {message}
        </div>
      )}

      {/* Form cấu hình tài khoản */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-8 border border-white/40 shadow-lg">
        <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-[#22d3ee] via-[#6366f1] to-[#8b5cf6] rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-md shrink-0">
            {fullName ? fullName[0].toUpperCase() : "U"}
          </div>
          <div>
            <h2 className="font-bold text-gray-800 text-xl">{fullName}</h2>
            <p className="text-sm text-gray-500">{email}</p>
          </div>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-5">
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Họ và tên người dùng</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nhập họ và tên đầy đủ"
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 pl-12 pr-4 text-gray-800 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-[#6366f1]"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Địa chỉ Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập địa chỉ email đăng nhập"
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 pl-12 pr-4 text-gray-800 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-[#6366f1]"
              />
            </div>
          </div>

          <div className="pt-4">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-70 flex items-center gap-2 cursor-pointer"
            >
              {saving && <Loader2 className="animate-spin w-4 h-4" />}
              Lưu thay đổi
            </motion.button>
          </div>
        </form>
      </div>
    </div>
  );
}