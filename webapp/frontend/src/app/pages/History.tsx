import { Calendar, Filter, Download, Power, Lightbulb, Fan, Loader2, Activity } from "lucide-react";
import { motion } from "motion/react";
import { useState, useEffect } from "react";

const API_BASE_URL = "http://localhost:5000";

interface HistoryItem {
  id: number;
  ten_thiet_bi: string;
  loai_thiet_bi: string;
  hanh_dong: string;
  thoi_gian: string;
  nguoi_dung: string;
}

export function History() {
  const [histories, setHistories] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States cho Filter
  const [selectedDate, setSelectedDate] = useState("all");
  const [selectedDevice, setSelectedDevice] = useState("all");

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/lich-su`, {
        headers: { 'Authorization': `Bearer ${token}` }
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

  // LỌC DỮ LIỆU LOGIC
  const filteredHistories = histories.filter(item => {
    // 1. Lọc theo Thiết bị
    if (selectedDevice !== "all" && item.loai_thiet_bi !== selectedDevice) return false;
    
    // 2. Lọc theo Thời gian
    if (selectedDate !== "all") {
      const itemDate = new Date(item.thoi_gian);
      const today = new Date();
      if (selectedDate === "today") {
        if (itemDate.toDateString() !== today.toDateString()) return false;
      } else if (selectedDate === "week") {
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);
        if (itemDate < weekAgo) return false;
      }
    }
    return true;
  });

  // TÍNH TOÁN THỐNG KÊ (Activity Summary)
  const todayCount = histories.filter(h => new Date(h.thoi_gian).toDateString() === new Date().toDateString()).length;
  
  const weekAgo = new Date();
  weekAgo.setDate(new Date().getDate() - 7);
  const weekCount = histories.filter(h => new Date(h.thoi_gian) >= weekAgo).length;

  const deviceCounts = histories.reduce((acc, curr) => {
    acc[curr.ten_thiet_bi] = (acc[curr.ten_thiet_bi] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const mostUsedDevice = Object.keys(deviceCounts).sort((a, b) => deviceCounts[b] - deviceCounts[a])[0] || "Chưa có";

  // HÀM XUẤT FILE EXCEL (CSV)
  const exportToExcel = () => {
    // Thêm BOM (\uFEFF) để Excel đọc được Tiếng Việt có dấu chuẩn xác
    const bom = "\uFEFF";
    const headers = ["Thời gian,Thiết bị,Loại,Người thực hiện,Hành động"];
    
    const rows = filteredHistories.map(h => {
      const dateStr = new Date(h.thoi_gian).toLocaleString('vi-VN');
      // Đặt trong dấu ngoặc kép để tránh lỗi dấu phẩy trong chuỗi
      return `"${dateStr}","${h.ten_thiet_bi}","${h.loai_thiet_bi}","${h.nguoi_dung}","${h.hanh_dong}"`;
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
  };

  const getIcon = (type: string) => {
    if (type === 'den') return <Lightbulb className="w-5 h-5 text-yellow-500" />;
    if (type === 'quat') return <Fan className="w-5 h-5 text-blue-500" />;
    return <Power className="w-5 h-5 text-gray-500" />;
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-[#6366f1] w-8 h-8"/></div>;

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-8 mb-6 border border-white/40 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Lịch sử hoạt động</h1>
            <p className="text-sm text-gray-500">Theo dõi toàn bộ thao tác bật/tắt thiết bị trong nhà</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={exportToExcel}
            className="px-6 py-3 bg-gradient-to-r from-[#10b981] to-[#059669] text-white rounded-xl hover:shadow-lg transition-all text-sm font-semibold flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Xuất file Excel
          </motion.button>
        </div>
      </div>

      {/* Activity Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg flex items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-cyan-100 flex items-center justify-center">
            <Activity className="w-6 h-6 text-cyan-600" />
          </div>
          <div>
            <div className="text-sm text-gray-500 font-medium mb-1">Hôm nay</div>
            <div className="text-2xl font-bold text-gray-800">{todayCount} <span className="text-sm font-normal text-gray-500">lượt</span></div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg flex items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <div className="text-sm text-gray-500 font-medium mb-1">7 ngày qua</div>
            <div className="text-2xl font-bold text-gray-800">{weekCount} <span className="text-sm font-normal text-gray-500">lượt</span></div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg flex items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
            <Power className="w-6 h-6 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-500 font-medium mb-1">Tương tác nhiều nhất</div>
            <div className="text-lg font-bold text-gray-800 truncate">{mostUsedDevice}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Bộ lọc tìm kiếm</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600 block mb-2 font-medium">Thời gian</label>
            <select 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all text-sm bg-white"
            >
              <option value="all">Tất cả thời gian</option>
              <option value="today">Hôm nay</option>
              <option value="week">7 ngày qua</option>
            </select>
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

      {/* History Timeline List */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
        <h2 className="font-semibold text-gray-800 mb-6 flex items-center gap-2 text-lg">
          Danh sách chi tiết
        </h2>

        {filteredHistories.length === 0 ? (
          <div className="text-center py-10 text-gray-500">Không có dữ liệu lịch sử nào phù hợp.</div>
        ) : (
          <div className="space-y-3">
            {filteredHistories.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                  {getIcon(item.loai_thiet_bi)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-semibold text-gray-800">{item.ten_thiet_bi}</span>
                    <span className="text-sm font-medium px-2 py-0.5 rounded-md bg-gray-200 text-gray-700">
                      {item.hanh_dong}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Thực hiện bởi: <span className="font-medium text-gray-700">{item.nguoi_dung}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-gray-700">
                    {new Date(item.thoi_gian).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {new Date(item.thoi_gian).toLocaleDateString('vi-VN')}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}