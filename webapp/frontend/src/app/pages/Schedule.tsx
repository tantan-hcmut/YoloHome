import {
  AlertCircle,
  Calendar,
  Clock,
  Eye,
  Fan,
  Palette,
  Plus,
  Power,
  Timer,
  Trash2,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { PageLoading } from "../components/PageLoading";

const API_BASE_URL = import.meta.env.VITE_API_URL;

type Device = {
  id: number | string;
  ten_thiet_bi: string;
  loai_thiet_bi: "den" | "quat" | string;
};

type ScheduleItem = {
  id: number;
  ten_lich_trinh?: string;
  thiet_bi_id: number | string;
  thiet_bi_ten: string;
  loai_thiet_bi: "den" | "quat" | string;
  action: string;
  action_config?: {
    action?: string;
    schedule_mode?: "time" | "countdown";
    target_at?: string;
    r?: number;
    g?: number;
    b?: number;
    brightness?: number;
    speed?: number;
    delay_minutes?: number;
    delay_seconds?: number;
  };
  time: string;
  repeat: string;
  schedule_mode?: "time" | "countdown";
  target_at?: string;
  remaining_seconds?: number;
  syncedAtMs?: number;
  active: boolean;
};

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex(r = 255, g = 255, b = 255) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function getBrightnessPreviewHex(r = 255, g = 255, b = 255, brightness = 100) {
  const ratio = Math.max(0, Math.min(100, Number(brightness))) / 100;
  return rgbToHex(
    Math.round(255 - (255 - r) * ratio),
    Math.round(255 - (255 - g) * ratio),
    Math.round(255 - (255 - b) * ratio)
  );
}

function formatRepeat(repeat: string) {
  if (!repeat) return "Hàng ngày";
  if (repeat === "Daily") return "Hàng ngày";
  if (repeat === "Weekdays") return "T2 - T6";
  if (repeat === "Weekends") return "Cuối tuần";
  if (repeat.includes("-")) return `Ngày ${repeat.split("-").reverse().join("/")}`;
  return repeat;
}

function formatRemainingSeconds(seconds?: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  return [hours, minutes, secs].map((value) => String(value).padStart(2, "0")).join(":");
}

function getCountdownInitialSeconds(schedule: ScheduleItem) {
  const config = schedule.action_config || {};
  const delaySeconds = Number(config.delay_seconds);
  if (Number.isFinite(delaySeconds) && delaySeconds > 0) return Math.floor(delaySeconds);

  const delayMinutes = Number(config.delay_minutes);
  if (Number.isFinite(delayMinutes) && delayMinutes > 0) return Math.floor(delayMinutes * 60);

  return Math.max(0, Math.floor(schedule.remaining_seconds || 0));
}

function getCountdownRemainingSeconds(schedule: ScheduleItem, targetAt?: string) {
  if (!schedule.active) return getCountdownInitialSeconds(schedule);

  if (typeof schedule.remaining_seconds === "number") {
    const syncedAtMs = schedule.syncedAtMs ?? Date.now();
    const elapsedSeconds = Math.floor((Date.now() - syncedAtMs) / 1000);
    return Math.max(0, Math.floor(schedule.remaining_seconds - elapsedSeconds));
  }

  if (!targetAt) return 0;
  const target = new Date(targetAt).getTime();
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.floor((target - Date.now()) / 1000));
}

function resolveCountdownRemaining(schedule: ScheduleItem, targetAt?: string) {
  return formatRemainingSeconds(getCountdownRemainingSeconds(schedule, targetAt));
}

function formatCountdownTargetTime(targetAt?: string, fallback = "--:--") {
  if (!targetAt) return fallback;

  const target = new Date(targetAt);
  if (Number.isNaN(target.getTime())) return fallback;

  return target.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function normalizeScheduleCountdown(item: ScheduleItem, syncedAtMs: number): ScheduleItem {
  const schedule = { ...item, syncedAtMs };
  const config = schedule.action_config || {};
  const mode = schedule.schedule_mode || config.schedule_mode || "time";
  const targetAt = schedule.target_at || config.target_at;

  if (mode !== "countdown" || !schedule.active || getCountdownRemainingSeconds(schedule, targetAt) > 0) {
    return schedule;
  }

  return {
    ...schedule,
    active: false,
    remaining_seconds: getCountdownInitialSeconds(schedule),
    syncedAtMs,
  };
}

function actionLabel(action: string) {
  return action === "off" ? "TẮT" : "BẬT";
}

export function Schedule() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const [name, setName] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"time" | "countdown">("time");
  const [time, setTime] = useState("");
  const [countdownMinutes, setCountdownMinutes] = useState(30);
  const [repeat, setRepeat] = useState("Daily");
  const [date, setDate] = useState("");
  const [deviceId, setDeviceId] = useState<string>("");
  const [action, setAction] = useState("on");
  const [lightColor, setLightColor] = useState("#ffffff");
  const [brightness, setBrightness] = useState(50);
  const [fanSpeed, setFanSpeed] = useState(50);
  const [error, setError] = useState("");
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);

  const selectedDevice = useMemo(
    () => devices.find((device) => String(device.id) === String(deviceId)),
    [devices, deviceId]
  );
  const isLight = selectedDevice?.loai_thiet_bi === "den";
  const isFan = selectedDevice?.loai_thiet_bi === "quat";

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [devicesRes, schedulesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/thiet-bi`, { headers }),
        fetch(`${API_BASE_URL}/api/schedules`, { headers }),
      ]);

      if (devicesRes.ok) {
        const data = await devicesRes.json();
        const list = (Array.isArray(data) ? data : data.data || []).filter(
          (device: Device) => device.loai_thiet_bi !== "sensor"
        );
        setDevices(list);
        setDeviceId((current) => current || (list[0] ? String(list[0].id) : ""));
      }

      if (schedulesRes.ok) {
        const data = await schedulesRes.json();
        const syncedAtMs = Date.now();
        setSchedules((data.data || []).map((item: ScheduleItem) => normalizeScheduleCountdown(item, syncedAtMs)));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const refreshInterval = window.setInterval(fetchData, 1000);
    const tickInterval = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => {
      window.clearInterval(refreshInterval);
      window.clearInterval(tickInterval);
    };
  }, []);

  useEffect(() => {
    setSelectedSchedule((current) => {
      if (!current) return current;
      return schedules.find((schedule) => schedule.id === current.id) || null;
    });
  }, [schedules]);

  useEffect(() => {
    setSchedules((currentSchedules) => {
      let changed = false;
      const nextSchedules = currentSchedules.map((schedule) => {
        const config = schedule.action_config || {};
        const mode = schedule.schedule_mode || config.schedule_mode || "time";
        const targetAt = schedule.target_at || config.target_at;

        if (mode !== "countdown" || !schedule.active || getCountdownRemainingSeconds(schedule, targetAt) > 0) {
          return schedule;
        }

        changed = true;
        return {
          ...schedule,
          active: false,
          remaining_seconds: getCountdownInitialSeconds(schedule),
          syncedAtMs: Date.now(),
        };
      });

      return changed ? nextSchedules : currentSchedules;
    });

    setSelectedSchedule((current) => {
      if (!current) return current;

      const config = current.action_config || {};
      const mode = current.schedule_mode || config.schedule_mode || "time";
      const targetAt = current.target_at || config.target_at;

      if (mode !== "countdown" || !current.active || getCountdownRemainingSeconds(current, targetAt) > 0) {
        return current;
      }

      return {
        ...current,
        active: false,
        remaining_seconds: getCountdownInitialSeconds(current),
        syncedAtMs: Date.now(),
      };
    });
  }, [tick]);

  useEffect(() => {
    if (isLight && action === "set_speed") setAction("on");
    if (isFan && action === "set_color") setAction("on");
  }, [isFan, isLight, action]);

  const resetForm = () => {
    setName("");
    setScheduleMode("time");
    setTime("");
    setCountdownMinutes(30);
    setRepeat("Daily");
    setDate("");
    setAction("on");
    setLightColor("#ffffff");
    setBrightness(50);
    setFanSpeed(50);
    setError("");
  };

  const handleCreate = async () => {
    if (!name.trim() || !deviceId) {
      setError("Vui lòng nhập tên lịch và chọn thiết bị.");
      return;
    }
    if (scheduleMode === "time" && !time) {
      setError("Vui lòng chọn giờ hẹn.");
      return;
    }
    if (scheduleMode === "time" && repeat === "Once" && !date) {
      setError("Vui lòng chọn ngày cụ thể.");
      return;
    }
    if (scheduleMode === "countdown" && countdownMinutes < 1) {
      setError("Thời gian đếm ngược phải từ 1 phút trở lên.");
      return;
    }

    const rgb = hexToRgb(lightColor);
    const finalAction = isLight && action === "set_color" ? "set_color" : isFan && action === "set_speed" ? "set_speed" : action;
    const payload: Record<string, unknown> = {
      ten_lich_trinh: name.trim(),
      schedule_mode: scheduleMode,
      thiet_bi_id: deviceId,
      action: finalAction,
    };

    if (scheduleMode === "countdown") {
      payload.delay_minutes = countdownMinutes;
    } else {
      payload.time = time;
      payload.repeat = repeat === "Once" ? date : repeat;
    }

    if (isLight && finalAction !== "off") {
      payload.r = rgb.r;
      payload.g = rgb.g;
      payload.b = rgb.b;
      payload.brightness = brightness;
    }
    if (isFan && finalAction !== "off") {
      payload.speed = fanSpeed;
    }

    try {
      setError("");
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/schedules`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Tạo lịch hẹn thất bại.");
        return;
      }

      setShowAddModal(false);
      resetForm();
      await fetchData();
    } catch {
      setError("Không kết nối được backend.");
    }
  };

  const toggleSchedule = async (id: number) => {
    const previousSchedules = schedules;
    setSchedules((prev) => prev.map((item) => (item.id === id ? { ...item, active: !item.active } : item)));
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/api/schedules/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        setSchedules(previousSchedules);
        return;
      }

      const data = await response.json().catch(() => null);
      if (typeof data?.active === "boolean") {
        setSchedules((prev) => prev.map((item) => (item.id === id ? { ...item, active: data.active } : item)));
      }
    } catch {
      setSchedules(previousSchedules);
    }
  };

  const deleteSchedule = async (id: number) => {
    setSchedules((prev) => prev.filter((item) => item.id !== id));
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_BASE_URL}/api/schedules/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      fetchData();
    }
  };

  const countdownPreview = useMemo(() => {
    const target = Date.now() + countdownMinutes * 60 * 1000 + tick * 0;
    return new Date(target).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }, [countdownMinutes, tick]);

  const formColorPreview = useMemo(() => {
    const rgb = hexToRgb(lightColor);
    return getBrightnessPreviewHex(rgb.r, rgb.g, rgb.b, brightness);
  }, [lightColor, brightness]);

  if (loading) {
    return <PageLoading />;
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/40 bg-white/70 p-6 shadow-xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-gray-800">Hẹn giờ tự động</h1>
          <p className="text-sm text-gray-500">Tạo lịch hẹn bật/tắt, đếm ngược</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowAddModal(true)}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-5 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg"
        >
          <Plus className="h-4 w-4 cursor-pointer" />
          Tạo lịch hẹn
        </motion.button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {schedules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-10 text-center text-gray-500">
            Chưa có lịch hẹn nào được thiết lập.
          </div>
        ) : (
          schedules.map((schedule, index) => {
            const config = schedule.action_config || {};
            const mode = schedule.schedule_mode || config.schedule_mode || "time";
            const targetAt = schedule.target_at || config.target_at;

            return (
              <motion.div
                key={schedule.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className={`rounded-2xl border border-white/40 bg-white/85 p-4 shadow-lg backdrop-blur-xl ${!schedule.active ? "opacity-60" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 rounded-xl px-3 py-2.5 ${schedule.active ? "bg-[#6366f1] text-white" : "bg-gray-200 text-gray-600"}`}>
                    <div className="mb-1 flex items-center gap-2 text-xs font-semibold">
                      {mode === "countdown" ? <Timer className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      {mode === "countdown" ? "Đếm ngược" : "Theo giờ"}
                    </div>
                    <div className="text-xl font-bold tracking-wider">
                      {mode === "countdown" ? resolveCountdownRemaining(schedule, targetAt) : schedule.time}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold text-gray-800">
                          {schedule.ten_lich_trinh || `Hẹn giờ ${schedule.thiet_bi_ten}`}
                        </h3>
                        <div className="mt-1 flex w-max items-center gap-2 rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-500">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{mode === "countdown" ? `Tới ${formatCountdownTargetTime(targetAt, schedule.time)}` : formatRepeat(schedule.repeat)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button onClick={() => setSelectedSchedule(schedule)} className="cursor-pointer rounded-lg p-2 hover:bg-gray-100" title="Chi tiết lịch">
                          <Eye className="h-4 w-4 text-gray-400 hover:text-[#6366f1]" />
                        </button>
                        <button onClick={() => deleteSchedule(schedule.id)} className="cursor-pointer rounded-lg p-2 hover:bg-gray-100" title="Xóa lịch">
                          <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                        </button>
                        <button
                          onClick={() => toggleSchedule(schedule.id)}
                          className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors ${schedule.active ? "bg-[#6366f1]" : "bg-gray-300"}`}
                          title={schedule.active ? "Tắt lịch" : "Bật lịch"}
                        >
                          <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${schedule.active ? "translate-x-5" : "translate-x-0"}`} />
                        </button>
                      </div>
                    </div>

                    <div className="flex">
                      <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold ${schedule.action === "off" ? "border-gray-200 bg-gray-100 text-gray-600" : "border-indigo-100 bg-indigo-50 text-[#6366f1]"}`}>
                        <Power className="h-3.5 w-3.5" />
                        {actionLabel(schedule.action)} - {schedule.thiet_bi_ten}
                      </div>                      
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {selectedSchedule && (() => {
        const config = selectedSchedule.action_config || {};
        const mode = selectedSchedule.schedule_mode || config.schedule_mode || "time";
        const targetAt = selectedSchedule.target_at || config.target_at;
        const colorHex = rgbToHex(config.r, config.g, config.b);
        const previewHex = getBrightnessPreviewHex(config.r, config.g, config.b, config.brightness ?? 100);
        const isDetailLight = selectedSchedule.loai_thiet_bi === "den";
        const isDetailFan = selectedSchedule.loai_thiet_bi === "quat";

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Chi tiết lịch hẹn</h2>
                  <p className="mt-1 text-sm text-gray-500">{selectedSchedule.ten_lich_trinh || selectedSchedule.thiet_bi_ten}</p>
                </div>
                <button onClick={() => setSelectedSchedule(null)} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 cursor-pointer">
                  Đóng
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <span className="font-semibold text-gray-500">Thiết bị</span>
                  <span className="font-bold text-gray-800">{selectedSchedule.thiet_bi_ten}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <span className="font-semibold text-gray-500">Kiểu hẹn</span>
                  <span className="font-bold text-gray-800">{mode === "countdown" ? "Đếm ngược" : "Theo giờ"}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <span className="font-semibold text-gray-500">Thời điểm chạy</span>
                  <span className="font-bold text-gray-800">{mode === "countdown" ? `${resolveCountdownRemaining(selectedSchedule, targetAt)} còn lại` : `${selectedSchedule.time} - ${formatRepeat(selectedSchedule.repeat)}`}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <span className="font-semibold text-gray-500">Trạng thái lịch</span>
                  <span className={`font-bold ${selectedSchedule.active ? "text-[#6366f1]" : "text-gray-500"}`}>
                    {selectedSchedule.active ? "Đang bật" : "Đang tắt"}
                  </span>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <div className="mb-2 font-semibold text-gray-500">
                    {selectedSchedule.action === "off" ? "Hành động đã cài đặt" : "Thông số đã cài đặt"}
                  </div>
                  {isDetailLight && selectedSchedule.action !== "off" && (
                    <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl bg-white p-3">
                      <div>
                        <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-gray-400">
                          <span>Màu sắc</span>
                          <span>{colorHex.toUpperCase()}</span>
                        </div>
                        <div className="h-16 rounded-xl border border-gray-200 shadow-inner" style={{ backgroundColor: previewHex }} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-gray-50 px-3 py-2">
                          <div className="text-xs font-semibold text-gray-500">Độ sáng</div>
                          <div className="mt-1 text-lg font-bold text-gray-800">{config.brightness ?? 50}%</div>
                        </div>
                        <div className="rounded-lg bg-gray-50 px-3 py-2">
                          <div className="text-xs font-semibold text-gray-500">RGB</div>
                          <div className="mt-1 font-bold text-gray-800">{config.r ?? 255}, {config.g ?? 255}, {config.b ?? 255}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  {isDetailFan && selectedSchedule.action !== "off" && (
                    <div className="mb-4 rounded-xl bg-white p-3">
                      <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-gray-400">
                        <span>Tốc độ quạt</span>
                        <span>{config.speed ?? 50}%</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-[#6366f1]" style={{ width: `${config.speed ?? 50}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-lg px-3 py-1.5 text-xs font-bold ${selectedSchedule.action === "off" ? "bg-gray-100 text-gray-600" : "bg-indigo-50 text-[#6366f1]"}`}>
                      {actionLabel(selectedSchedule.action)}
                    </span>
                  </div>
                  {selectedSchedule.action === "off" && (
                    <div className="mt-4 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-gray-600">
                      Tắt thiết bị
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Tạo lịch hẹn mới</h2>
                <p className="mt-1 text-sm text-gray-500">Chọn thiết bị trước, phần cấu hình sẽ đổi theo loại thiết bị.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 cursor-pointer">
                Đóng
              </button>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Tên lịch</label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ví dụ: 30 phút nữa tắt đèn"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#6366f1]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
                <button
                  onClick={() => setScheduleMode("time")}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold ${scheduleMode === "time" ? "bg-white text-[#6366f1] shadow-sm" : "text-gray-600"}`}
                >
                  <Clock className="h-4 w-4" />
                  Theo giờ
                </button>
                <button
                  onClick={() => setScheduleMode("countdown")}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold ${scheduleMode === "countdown" ? "bg-white text-[#6366f1] shadow-sm" : "text-gray-600"}`}
                >
                  <Timer className="h-4 w-4" />
                  Đếm ngược
                </button>
              </div>

              {scheduleMode === "time" ? (
                <>
                  <div className="flex flex-col items-center rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <label className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-400">Giờ hẹn</label>
                    <input
                      type="time"
                      value={time}
                      onChange={(event) => setTime(event.target.value)}
                      className="w-full max-w-[240px] border-b-2 border-gray-200 bg-transparent pb-1 text-center text-4xl font-bold tracking-wider text-gray-800 outline-none transition-colors focus:border-[#6366f1]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">Lặp lại</label>
                    <select value={repeat} onChange={(event) => setRepeat(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#6366f1] cursor-pointer">
                      <option value="Daily">Hàng ngày</option>
                      <option value="Weekdays">Ngày trong tuần (T2 - T6)</option>
                      <option value="Weekends">Cuối tuần (T7, CN)</option>
                      <option value="Once">Chỉ 1 ngày cụ thể</option>
                    </select>
                  </div>

                  {repeat === "Once" && (
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">Ngày cụ thể</label>
                      <input
                        type="date"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                        className="w-full rounded-xl border border-[#6366f1] bg-[#6366f1]/5 px-4 py-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#6366f1] cursor-pointer"
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-2xl border border-[#6366f1]/20 bg-[#6366f1]/5 p-4">
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Sau bao lâu?</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      value={countdownMinutes}
                      onChange={(event) => setCountdownMinutes(Math.max(1, Number(event.target.value) || 1))}
                      className="w-28 rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-lg font-bold text-gray-800 outline-none focus:ring-2 focus:ring-[#6366f1] cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-gray-600">phút sau</span>
                    <div className="ml-auto rounded-xl bg-white px-3 py-2 text-right text-xs font-semibold text-gray-500">
                      Dự kiến
                      <div className="text-base font-bold text-[#6366f1]">{countdownPreview}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Thiết bị</label>
                  <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#6366f1] cursor-pointer">
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.ten_thiet_bi}
                      </option>
                    ))}
                    {devices.length === 0 && <option value="">Không có thiết bị khả dụng</option>}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Hành động</label>
                  <select value={action} onChange={(event) => setAction(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#6366f1] cursor-pointer">
                    <option value="on">Bật thiết bị</option>
                    <option value="off">Tắt thiết bị</option>
                    {isLight && <option value="set_color">Đổi màu đèn</option>}
                    {isFan && <option value="set_speed">Đổi tốc độ quạt</option>}
                  </select>
                </div>
              </div>

              {isLight && action !== "off" && (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-700">
                    <Palette className="h-4 w-4" />
                    Màu sắc và độ sáng
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
                      <input
                        type="color"
                        value={lightColor}
                        onChange={(event) => setLightColor(event.target.value)}
                        className="h-12 w-20 cursor-pointer rounded-xl border border-gray-200 bg-white p-1"
                      />
                    </div>
                    <div>
                      <div className="mb-2 flex justify-between text-sm font-semibold text-gray-700">
                        <span>Độ sáng</span>
                        <span>{brightness}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={brightness}
                        onChange={(event) => setBrightness(Number(event.target.value))}
                        className="w-full accent-[#6366f1] cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="mb-2 flex justify-between text-xs font-bold uppercase tracking-wide text-gray-400">
                        <span>Xem trước</span>
                        <span>{formColorPreview.toUpperCase()}</span>
                      </div>
                      <div
                        className="h-14 w-full rounded-xl border border-gray-200 shadow-inner"
                        style={{ backgroundColor: formColorPreview }}
                        title="Brightness preview"
                      />
                    </div>
                  </div>
                </div>
              )}

              {isFan && action !== "off" && (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-700">
                    <Fan className="h-4 w-4" />
                    Tốc độ quạt
                  </div>
                  <div className="mb-2 flex justify-between text-sm font-semibold text-gray-700">
                    <span>Tốc độ</span>
                    <span>{fanSpeed}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={fanSpeed}
                    onChange={(event) => setFanSpeed(Number(event.target.value))}
                    className="w-full accent-[#6366f1] cursor-pointer"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 cursor-pointer rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleCreate} className="flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-4 py-3 text-sm font-semibold text-white hover:shadow-lg">
                Lưu lịch
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
