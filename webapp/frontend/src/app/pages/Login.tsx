import { useState } from "react";
import { useNavigate } from "react-router";
import { Lock, Mail } from "lucide-react";

interface TeamMember {
  name: string;
  role: string;
}

const teamMembers: TeamMember[] = [
  { name: "Trần Phương Trường An", role: "2310041" },
  { name: "Nguyễn Trần Đức Hoàng", role: "2311064" },
  { name: "Bành Phú Hội", role: "2311111" },
  { name: "Nguyễn Lâm Huy", role: "2311188" },
  { name: "Nguyễn Anh Khánh Sơn", role: "2312961" },
  { name: "Giang Phi Vân", role: "2313867" }
];

const API_BASE_URL = "http://localhost:5000";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Basic validation
      if (!email || !password) {
        setError("Vui lòng nhập email và mật khẩu");
        setIsLoading(false);
        return;
      }

      // Call backend login API
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email: email.trim(), 
          password: password 
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Đăng nhập thất bại");
        setIsLoading(false);
        return;
      }

      // Login successful
      localStorage.setItem("token", data.data.token);
      localStorage.setItem("user", JSON.stringify(data.data.user));

      // Navigate to dashboard
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError("Kết nối backend thất bại. Vui lòng kiểm tra server.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e0f2fe] via-[#fae8ff] to-[#f3e8ff] flex flex-col items-center justify-center p-4">
      {/* Main Login Container */}
      <div className="w-full max-w-2xl">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg mx-auto mb-6">
            H
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent mb-2">
            YOLO:HOME
          </h1>
          <p className="font-semibold text-gray-400 text-xl">Smart Home Control System</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-lg border border-white/20 mb-8">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Email Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập email tài khoản"
                className="w-full pl-12 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:bg-white transition-all text-gray-800 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                className="w-full pl-12 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:bg-white transition-all text-gray-800 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white font-semibold py-3 rounded-xl hover:shadow-lg hover:scale-105 transition-all disabled:opacity-70 disabled:scale-100"
          >
            {isLoading ? "Đang đăng nhập..." : "Đăng Nhập"}
          </button>
        </form>

        {/* Team Section */}
        <div className="text-center mb-8">
          <p className="text-xl font-bold bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent mb-2">NHÓM 1 - HK252</p>
          <p className="text-lg font-bold bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent mb-6">GVHD: TÔN HUỲNH LONG</p>
          <div className="grid grid-cols-3 gap-3">
            {teamMembers.map((member, index) => (
              <div
                key={index}
                className="group relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-md p-4 border border-white/30 hover:border-white/50 cursor-pointer shadow-md hover:shadow-lg hover:transform hover:-translate-y-2 transition-all duration-200"
              >
                {/* Gradient Background on Hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#6366f1]/5 to-[#8b5cf6]/5 group-hover:from-[#6366f1]/15 group-hover:to-[#8b5cf6]/15 transition-all duration-300" />

                {/* Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 transform -translate-x-full group-hover:translate-x-full transition-transform duration-500" />

                {/* Avatar Circle */}
                <div className="relative z-10 w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {member.name[0]}
                </div>

                {/* Content */}
                <div className="relative z-10">
                  <p className="font-semibold text-gray-800 text-sm group-hover:text-[#6366f1] transition-colors">
                    {member.name}
                  </p>
                  <p className="text-xs text-gray-500 group-hover:text-[#8b5cf6] transition-colors">
                    {member.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500">
          <p>@ 2026 YOLO:HOME | ĐỒ ÁN ĐA NGÀNH HƯỚNG TRÍ TUỆ NHÂN TẠO</p>
        </div>
      </div>
    </div>
  );
}
