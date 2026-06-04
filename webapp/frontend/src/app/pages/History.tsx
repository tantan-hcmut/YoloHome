import {
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Fan,
  Filter,
  Lightbulb,
  Loader2,
  Power,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = "http://localhost:5000";
const ITEMS_PER_PAGE = 10;
const PAGE_WINDOW_SIZE = 5;

interface HistoryItem {
  id: number;
  ten_thiet_bi: string;
  loai_thiet_bi: string;
  hanh_dong: string;
  thoi_gian: string;
  nguoi_dung: string;
}

const getDate = (value: string) => new Date(value);

const formatCommandAction = (value: string) => {
  const normalized = value.trim().toLowerCase();
  const map: Record<string, string> = {
    on: "Bật",
    off: "Tắt",
    auto: "Tự động",
    fan_auto: "Quạt về tự động",
    set_rgb: "Đổi màu đèn",
    light_rgb: "Đổi màu đèn",
    set_color: "Đổi màu đèn",
    set_brightness: "Đổi độ sáng đèn",
    increase_brightness: "Tăng độ sáng đèn",
    decrease_brightness: "Giảm độ sáng đèn",
    set_speed: "Đổi tốc độ quạt",
    fan_speed: "Đổi tốc độ quạt",
    light_on: "Bật đèn",
    light_off: "Tắt đèn",
    fan_on: "Bật quạt",
    fan_off: "Tắt quạt",
    all_off: "Tắt tất cả thiết bị",
  };

  return map[normalized] || value;
};

const formatDeviceType = (type: string) => {
  if (type === "den") return "Đèn";
  if (type === "quat") return "Quạt";
  if (type === "sensor") return "Cảm biến";
  return type || "Không xác định";
};

const formatHistoryAction = (action: string) => {
  const value = String(action || "").trim();
  const normalized = value.toLowerCase();

  const exactMap: Record<string, string> = {
    "tat toan bo thiet bi": "Tắt toàn bộ thiết bị",
    "cai dat mac dinh thiet bi": "Cài đặt mặc định thiết bị",
  };

  if (exactMap[normalized]) return exactMap[normalized];

  const controlPrefix = "Điều khiển thiết bị:";
  if (value.startsWith(controlPrefix)) {
    const command = value.slice(controlPrefix.length).trim();
    return `${controlPrefix} ${formatCommandAction(command)}`;
  }

  const schedulePrefix = "Auto Schedule:";
  if (value.startsWith(schedulePrefix)) {
    const command = value.slice(schedulePrefix.length).trim();
    return `Lịch tự động: ${formatCommandAction(command)}`;
  }

  const voicePrefix = "Voice Command:";
  if (value.startsWith(voicePrefix)) {
    const command = value.slice(voicePrefix.length).trim();
    return `Lệnh giọng nói: ${command}`;
  }

  return formatCommandAction(value);
};

const getDateKey = (value: string | Date) => {
  const date = value instanceof Date ? value : getDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function History() {
  const [histories, setHistories] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("all");
  const [exactDate, setExactDate] = useState("");
  const [selectedDevice, setSelectedDevice] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/lich-su`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistories(data.data || []);
      }
    } catch (err) {
      console.error("Lỗi fetch lịch sử:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, exactDate, selectedDevice]);

  const filteredHistories = useMemo(() => {
    return histories.filter((item) => {
      if (selectedDevice !== "all" && item.loai_thiet_bi !== selectedDevice) {
        return false;
      }

      if (exactDate && getDateKey(item.thoi_gian) !== exactDate) {
        return false;
      }

      if (selectedDate !== "all") {
        const itemDate = getDate(item.thoi_gian);
        const today = new Date();

        if (selectedDate === "today" && itemDate.toDateString() !== today.toDateString()) {
          return false;
        }

        if (selectedDate === "week") {
          const weekAgo = new Date();
          weekAgo.setDate(today.getDate() - 7);
          if (itemDate < weekAgo) return false;
        }
      }

      return true;
    });
  }, [histories, selectedDate, exactDate, selectedDevice]);

  const totalPages = Math.max(1, Math.ceil(filteredHistories.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedHistories = filteredHistories.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const pageWindowStart = Math.min(
    Math.max(1, safeCurrentPage - Math.floor(PAGE_WINDOW_SIZE / 2)),
    Math.max(1, totalPages - PAGE_WINDOW_SIZE + 1)
  );
  const visiblePages = Array.from(
    { length: Math.min(PAGE_WINDOW_SIZE, totalPages - pageWindowStart + 1) },
    (_, index) => pageWindowStart + index
  );
  const shouldShowFirstPage = totalPages > 1 && !visiblePages.includes(1);
  const shouldShowLastPage = totalPages > 1 && !visiblePages.includes(totalPages);

  const todayCount = histories.filter(
    (h) => getDate(h.thoi_gian).toDateString() === new Date().toDateString()
  ).length;

  const weekAgo = new Date();
  weekAgo.setDate(new Date().getDate() - 7);
  const weekCount = histories.filter((h) => getDate(h.thoi_gian) >= weekAgo).length;

  const deviceCounts = histories.reduce((acc, curr) => {
    acc[curr.ten_thiet_bi] = (acc[curr.ten_thiet_bi] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const mostUsedDevice = Object.keys(deviceCounts).sort(
    (a, b) => deviceCounts[b] - deviceCounts[a]
  )[0] || "Chưa có";

  const exportToExcel = () => {
    const bom = "\uFEFF";
    const headers = ["Thời gian,Thiết bị,Loại,Người thực hiện,Hành động"];
    const rows = filteredHistories.map((h) => {
      const dateStr = getDate(h.thoi_gian).toLocaleString("vi-VN");
      return `"${dateStr}","${h.ten_thiet_bi}","${formatDeviceType(h.loai_thiet_bi)}","${h.nguoi_dung}","${formatHistoryAction(h.hanh_dong)}"`;
    });

    const csvContent = bom + headers.concat(rows).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Lich_Su_Hoat_Dong_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getIcon = (type: string) => {
    if (type === "den") return <Lightbulb className="w-5 h-5 text-[#6366f1]" />;
    if (type === "quat") return <Fan className="w-5 h-5 text-cyan-600" />;
    return <Power className="w-5 h-5 text-gray-500" />;
  };

  const getIconBoxClass = (type: string) => {
    if (type === "den") return "bg-indigo-50 border-indigo-100";
    if (type === "quat") return "bg-cyan-50 border-cyan-100";
    return "bg-gray-100 border-gray-200";
  };

  if (loading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin text-[#6366f1] w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-8 mb-6 border border-white/40 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Lịch sử hoạt động</h1>
            <p className="text-sm text-gray-500">Theo dõi toàn bộ thao tác bật/tắt và điều khiển thiết bị</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={exportToExcel}
            className="px-6 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white rounded-xl hover:shadow-lg transition-all text-sm font-semibold flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Xuất file Excel
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg flex items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-cyan-50 border border-cyan-100 flex items-center justify-center">
            <Activity className="w-6 h-6 text-cyan-600" />
          </div>
          <div>
            <div className="text-sm text-gray-500 font-medium mb-1">Hôm nay</div>
            <div className="text-2xl font-bold text-gray-800">{todayCount} <span className="text-sm font-normal text-gray-500">lượt</span></div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg flex items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-[#6366f1]" />
          </div>
          <div>
            <div className="text-sm text-gray-500 font-medium mb-1">7 ngày qua</div>
            <div className="text-2xl font-bold text-gray-800">{weekCount} <span className="text-sm font-normal text-gray-500">lượt</span></div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg flex items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
            <Power className="w-6 h-6 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-500 font-medium mb-1">Tương tác nhiều nhất</div>
            <div className="text-lg font-bold text-gray-800 truncate">{mostUsedDevice}</div>
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Bộ lọc tìm kiếm</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-600 block mb-2 font-medium">Thời gian</label>
            <select
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                if (e.target.value !== "all") setExactDate("");
              }}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all text-sm bg-white"
            >
              <option value="all">Tất cả thời gian</option>
              <option value="today">Hôm nay</option>
              <option value="week">7 ngày qua</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600 block mb-2 font-medium">Ngày cụ thể</label>
            <input
              type="date"
              value={exactDate}
              onChange={(e) => {
                setExactDate(e.target.value);
                if (e.target.value) setSelectedDate("all");
              }}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all text-sm bg-white"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 block mb-2 font-medium">Loại thiết bị</label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all text-sm bg-white"
            >
              <option value="all">Tất cả thiết bị</option>
              <option value="den">Đèn</option>
              <option value="quat">Quạt</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-lg">
            Danh sách chi tiết
          </h2>
          <div className="text-sm text-gray-500">
            {filteredHistories.length === 0
              ? "0 kết quả"
              : `${pageStart + 1}-${Math.min(pageStart + ITEMS_PER_PAGE, filteredHistories.length)} / ${filteredHistories.length} kết quả`}
          </div>
        </div>

        {filteredHistories.length === 0 ? (
          <div className="text-center py-10 text-gray-500">Không có dữ liệu lịch sử nào phù hợp.</div>
        ) : (
          <>
            <motion.div
              key={`${safeCurrentPage}-${selectedDate}-${exactDate}-${selectedDevice}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="space-y-3"
            >
              {paginatedHistories.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-all group"
                >
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${getIconBoxClass(item.loai_thiet_bi)}`}>
                    {getIcon(item.loai_thiet_bi)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-gray-800">{item.ten_thiet_bi}</span>
                      <span className="text-sm font-medium px-2 py-0.5 rounded-md bg-indigo-50 text-[#6366f1] border border-indigo-100">
                        {formatHistoryAction(item.hanh_dong)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Thực hiện bởi: <span className="font-medium text-gray-700">{item.nguoi_dung}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-gray-700">
                      {getDate(item.thoi_gian).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {getDate(item.thoi_gian).toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <div className="flex items-center justify-between gap-4 mt-6">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safeCurrentPage === 1}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Trước
              </button>

              <div className="flex items-center gap-2 overflow-x-auto">
                {shouldShowFirstPage && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(1)}
                      className="w-9 h-9 shrink-0 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
                    >
                      1
                    </button>
                    <span className="text-gray-400">...</span>
                  </>
                )}

                {visiblePages.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-9 shrink-0 rounded-xl text-sm font-bold transition-all ${
                      page === safeCurrentPage
                        ? "bg-[#6366f1] text-white shadow-md"
                        : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                {shouldShowLastPage && (
                  <>
                    <span className="text-gray-400">...</span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(totalPages)}
                      className="w-9 h-9 shrink-0 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safeCurrentPage === totalPages}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-all"
              >
                Sau
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
