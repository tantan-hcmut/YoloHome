import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Lock, Mail, ScanFace } from "lucide-react";
import { createFaceChallenge, faceLogin, getFaceStatus, API_BASE_URL, type CapturedFrame, type FaceChallengeStep } from "../api/faceApi";
import { FaceChallengeCapture } from "../components/FaceChallengeCapture";

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

type LoginMode = "password" | "face";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<LoginMode>("password");
  const [isLoading, setIsLoading] = useState(false);
  const [faceLoading, setFaceLoading] = useState(false);
  const [error, setError] = useState("");
  const [faceMessage, setFaceMessage] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [challengeSteps, setChallengeSteps] = useState<FaceChallengeStep[]>([]);
  const navigate = useNavigate();

  const completeLogin = (data: { data: { token: string; user: unknown } }) => {
    localStorage.setItem("token", data.data.token);
    localStorage.setItem("user", JSON.stringify(data.data.user));
    navigate("/dashboard", { replace: true });
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (!email || !password) {
        setError("Vui lòng nhập email và mật khẩu");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Đăng nhập thất bại");
        return;
      }

      completeLogin(data);
    } catch (err) {
      setError("Kết nối backend thất bại. Vui lòng kiểm tra server.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const startFaceFlow = async () => {
    setError("");
    setFaceMessage("");
    setChallengeId("");
    setChallengeSteps([]);
    setFaceLoading(true);

    try {
      const status = await getFaceStatus();
      if (!status.hasFaces) {
        setFaceMessage("Chưa có khuôn mặt nào được đăng ký. Vui lòng đăng nhập bằng mật khẩu, sau đó vào Quản lý khuôn mặt để thêm khuôn mặt.");
        return;
      }

      const challenge = await createFaceChallenge();
      setChallengeId(challenge.challengeId);
      setChallengeSteps(challenge.steps);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể khởi tạo đăng nhập bằng khuôn mặt.");
    } finally {
      setFaceLoading(false);
    }
  };

  useEffect(() => {
    if (mode === "face") {
      startFaceFlow();
    }
  }, [mode]);

  const handleFaceComplete = async (frames: CapturedFrame[]) => {
    if (!challengeId) {
      setError("Phiên xác thực đã hết hạn. Vui lòng thử lại.");
      return;
    }

    setError("");
    setFaceLoading(true);
    try {
      const data = await faceLogin(challengeId, frames);
      completeLogin(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không nhận diện được khuôn mặt. Vui lòng thử lại.");
      setChallengeId("");
      setChallengeSteps([]);
    } finally {
      setFaceLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#e0f2fe] via-[#fae8ff] to-[#f3e8ff] p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-3xl font-bold text-white shadow-lg">
            H
          </div>
          <h1 className="mb-2 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-5xl font-bold text-transparent">
            YOLO:HOME
          </h1>
          <p className="text-xl font-semibold text-gray-400">Smart Home Control System</p>
        </div>

        <div className="mb-8 rounded-3xl border border-white/20 bg-white/80 p-8 shadow-lg backdrop-blur-xl">
          <div className="mb-6 grid grid-cols-2 gap-3 rounded-2xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setMode("password")}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition-all ${mode === "password" ? "bg-white text-[#6366f1] shadow" : "text-gray-500"}`}
            >
              Đăng nhập bằng mật khẩu
            </button>
            <button
              type="button"
              onClick={() => setMode("face")}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${mode === "face" ? "bg-white text-[#6366f1] shadow" : "text-gray-500"}`}
            >
              <ScanFace className="h-4 w-4" />
              Đăng nhập bằng khuôn mặt
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {mode === "password" ? (
            <form onSubmit={handleLogin}>
              <div className="mb-6">
                <label className="mb-2 block text-sm font-semibold text-gray-700">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Nhập email tài khoản"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 pl-12 pr-4 text-gray-800 outline-none transition-all placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-[#6366f1]"
                  />
                </div>
              </div>

              <div className="mb-8">
                <label className="mb-2 block text-sm font-semibold text-gray-700">Mật khẩu</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Nhập mật khẩu"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 pl-12 pr-4 text-gray-800 outline-none transition-all placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-[#6366f1]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] py-3 font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-lg disabled:scale-100 disabled:opacity-70"
              >
                {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              {faceMessage && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
                  {faceMessage}
                </div>
              )}

              {challengeSteps.length > 0 ? (
                <FaceChallengeCapture
                  steps={challengeSteps}
                  onComplete={handleFaceComplete}
                  onCancel={() => setMode("password")}
                  busy={faceLoading}
                />
              ) : (
                <button
                  type="button"
                  onClick={startFaceFlow}
                  disabled={faceLoading}
                  className="w-full rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] py-3 font-semibold text-white transition-all hover:shadow-lg disabled:opacity-70"
                >
                  {faceLoading ? "Đang kiểm tra khuôn mặt..." : "Thử lại đăng nhập bằng khuôn mặt"}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mb-8 text-center">
          <p className="mb-2 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-xl font-bold text-transparent">NHÓM 1 - HK252</p>
          <p className="mb-6 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-lg font-bold text-transparent">GVHD: TÔN HUỲNH LONG</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {teamMembers.map((member) => (
              <div key={member.role} className="rounded-2xl border border-white/30 bg-white/70 p-4 shadow-md backdrop-blur-md transition-all hover:-translate-y-1 hover:shadow-lg">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-lg font-bold text-white shadow-md">
                  {member.name[0]}
                </div>
                <p className="text-sm font-semibold text-gray-800">{member.name}</p>
                <p className="text-xs text-gray-500">{member.role}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center text-xs text-gray-500">
          <p>@ 2026 YOLO:HOME | ĐỒ ÁN ĐA NGÀNH HƯỚNG TRÍ TUỆ NHÂN TẠO</p>
        </div>
      </div>
    </div>
  );
}
