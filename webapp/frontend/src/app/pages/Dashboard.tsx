import { useState, useEffect } from "react";
import { Thermometer, Droplets, Power, Lightbulb, Fan, BrainCircuit, Gauge } from "lucide-react";
import { motion } from "motion/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const API_BASE_URL = "http://localhost:5000";

interface SensorData {
  id: number;
  thiet_bi_id: string;
  thiet_bi_ten: string;
  nhiet_do?: number;
  do_am?: number;
  thoi_gian_cap_nhat?: string;
}

interface RuntimeState {
  overrideModeText?: string;
  tinymlHot?: boolean;
  tinymlScore?: number;
  tinymlSmooth?: number;
  autoFanRequest?: boolean;
  fanOn?: boolean;
  fanSpeedPercent?: number;
  temperature?: number;
  humidity?: number;
  aiCoolingElapsedMs?: number;
  aiTargetFanSpeedPercent?: number;
}

const getSensorTimestamp = (item: any) =>
  item.thoi_gian || item.thoi_gian_ghi_nhan || item.thoi_gian_cap_nhat || item.created_at;

const isValidDate = (date: Date) => !Number.isNaN(date.getTime());

const resolveModeLabel = (mode?: string) => {
  if (mode === "FORCE_OFF" || mode === "FORCED_OFF") return "FORCE_OFF";
  if (mode === "FORCE_ON" || mode === "FORCED_ON") return "FORCE_ON";
  if (mode === "AUTO") return "AUTO";
  return "AUTO";
};

const resolveModeClass = (mode?: string) => {
  const resolved = resolveModeLabel(mode);
  if (resolved === "AUTO") return "bg-cyan-50 text-cyan-700 border-cyan-100";
  if (resolved === "FORCE_OFF") return "bg-gray-100 text-gray-600 border-gray-200";
  if (resolved === "FORCE_ON") return "bg-indigo-50 text-[#6366f1] border-indigo-100";
  return "bg-gray-100 text-gray-600 border-gray-200";
};

const resolveActualState = (temp?: number, humidity?: number) => {
  if (temp === undefined && humidity === undefined) {
    return { label: "Chưa có dữ liệu", detail: "Đang chờ cảm biến", className: "bg-gray-100 text-gray-600" };
  }
  if ((temp ?? 0) > 32 || (humidity ?? 0) > 80) {
    return { label: "Ngưỡng cao", detail: "Nhiệt độ/độ ẩm vượt ngưỡng", className: "bg-indigo-50 text-[#6366f1]" };
  }
  if ((temp ?? 100) < 24 || (humidity ?? 100) < 30) {
    return { label: "Ngưỡng thấp", detail: "Nhiệt độ/độ ẩm thấp", className: "bg-amber-100 text-amber-700" };
  }
  return { label: "Ổn định", detail: "Thông số trong ngưỡng", className: "bg-cyan-50 text-cyan-700" };
};

const resolveAiState = (runtime: RuntimeState | null) => {
  if (!runtime) {
    return { label: "Chưa có dữ liệu", detail: "Đang chờ telemetry", className: "bg-gray-100 text-gray-600" };
  }
  if (runtime.tinymlHot) {
    return { label: "AI: Nóng", detail: "AI yêu cầu làm mát", className: "bg-indigo-50 text-[#6366f1]" };
  }
  return { label: "AI: Bình thường", detail: "AI chưa yêu cầu làm mát", className: "bg-cyan-50 text-cyan-700" };
};

export function Dashboard() {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [allSensors, setAllSensors] = useState<SensorData[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [totalDevices, setTotalDevices] = useState(0);
  const [lightsOn, setLightsOn] = useState(0);
  const [fansOn, setFansOn] = useState(0);
  const [runtimeState, setRuntimeState] = useState<RuntimeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSensorData();
    fetchDeviceStats();
    fetchRuntimeState();
    // Poll every 5 seconds for real-time updates
    const interval = setInterval(() => {
      fetchSensorData();
      fetchDeviceStats();
      fetchRuntimeState();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDeviceStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/api/thiet-bi`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`Device fetch failed: ${response.status} ${response.statusText}`);
        return;
      }

      const result = await response.json();
      console.log("Device response:", result);
      const devices = Array.isArray(result.data) ? result.data : result;
      console.log("Devices parsed:", devices);

      const total = devices.length;
      const lights = devices.filter((item: any) => item.loai_thiet_bi?.toLowerCase() === 'den' && item.trang_thai?.trang_thai_bat_tat).length;
      const fans = devices.filter((item: any) => item.loai_thiet_bi?.toLowerCase() === 'quat' && item.trang_thai?.trang_thai_bat_tat).length;

      console.log(`Total: ${total}, Lights: ${lights}, Fans: ${fans}`);
      setTotalDevices(total);
      setLightsOn(lights);
      setFansOn(fans);
    } catch (err) {
      console.error("Error fetching device stats:", err);
    }
  };

  const fetchRuntimeState = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/api/cam-bien/runtime`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return;

      const result = await response.json();
      setRuntimeState(result.data || null);
    } catch (err) {
      console.error("Error fetching runtime state:", err);
    }
  };

  const fetchSensorData = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/api/cam-bien`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`Sensor fetch failed: ${response.status} ${response.statusText}`);
        throw new Error("Failed to fetch sensor data");
      }

      const result = await response.json();
      console.log("Sensor response:", result);
      
      if (result.data && result.data.length > 0) {
        console.log("Sensors found:", result.data.length, result.data);
        setAllSensors(result.data);
        // Lấy sensor đầu tiên làm sensor chính
        setSensorData(result.data[0]);
        
        // Fetch lịch sử dữ liệu cho biểu đồ
        fetchSensorHistory(result.data[0].thiet_bi_id);
      } else {
        console.warn("No sensor data returned");
      }
      
      setLoading(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error";
      console.error("Sensor fetch error:", errorMsg);
      setError(errorMsg);
      setLoading(false);
    }
  };

  const fetchSensorHistory = async (thiet_bi_id: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE_URL}/api/cam-bien/${thiet_bi_id}/lich-su?hours=24&limit=24`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const result = await response.json();
        
        // Transform dữ liệu cho biểu đồ
        const chartDataFormatted = result.data
          .map((item: any) => {
            const timestamp = getSensorTimestamp(item);
            const date = new Date(timestamp);

            if (!timestamp || !isValidDate(date)) {
              return null;
            }

            return {
              time: date.toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit'
              }),
              temp: item.nhiet_do || 0,
              humidity: item.do_am || 0
            };
          })
          .filter(Boolean);
        
        setChartData(chartDataFormatted);
      }
    } catch (err) {
      console.error("Error fetching sensor history:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#6366f1] border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  const rooms = [
    { 
      name: "Phòng khách", 
      temp: sensorData?.nhiet_do || 0, 
      humidity: sensorData?.do_am || 0, 
    },
  ];
  const actualTemp = runtimeState?.temperature ?? sensorData?.nhiet_do;
  const actualHumidity = runtimeState?.humidity ?? sensorData?.do_am;
  const actualState = resolveActualState(actualTemp, actualHumidity);
  const aiState = resolveAiState(runtimeState);
  const operationMode = resolveModeLabel(runtimeState?.overrideModeText);

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="relative bg-white/60 backdrop-blur-xl rounded-3xl p-8 mb-6 border border-white/40 shadow-xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Bảng điều khiển</h1>
        <p className="text-sm text-gray-500">Giám sát môi trường nhà thông minh của bạn</p>
        {error && <p className="text-sm text-red-600 mt-2">Lỗi: {error}</p>}
        <div className={`absolute right-8 top-8 inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold ${resolveModeClass(operationMode)}`}>
          <Gauge className="w-4 h-4" />
          {operationMode}
        </div>
      </div>

      {/* Active Devices Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#22d3ee] to-[#06b6d4] rounded-xl flex items-center justify-center">
              <Power className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-cyan-50 text-cyan-700 border border-cyan-100 rounded-full">Tổng</span>
          </div>
          <div className="text-3xl font-bold text-gray-800 mb-1">{totalDevices}</div>
          <div className="text-sm text-gray-500">Tổng thiết bị</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] rounded-xl flex items-center justify-center">
              <Lightbulb className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-indigo-50 text-[#6366f1] border border-indigo-100 rounded-full">Đang bật</span>
          </div>
          <div className="text-3xl font-bold text-gray-800 mb-1">{lightsOn}</div>
          <div className="text-sm text-gray-500">Đèn đang bật</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#22d3ee] to-[#06b6d4] rounded-xl flex items-center justify-center">
              <Fan className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-cyan-50 text-cyan-700 border border-cyan-100 rounded-full">Đang bật</span>
          </div>
          <div className="text-3xl font-bold text-gray-800 mb-1">{fansOn}</div>
          <div className="text-sm text-gray-500">Quạt đang bật</div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg"
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center">
                <Thermometer className="w-6 h-6 text-cyan-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500 font-medium mb-1">State theo ngưỡng thực tế</div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-lg font-bold text-gray-800">
                  <span>{actualState.label}</span>
                  <span className="text-lg text-gray-500">-</span>
                  <span className="text-lg text-gray-700">
                    {actualTemp?.toFixed(1) ?? "--"}°C / {actualHumidity?.toFixed(0) ?? "--"}%
                  </span>
                </div>
                <div className="text-xs text-gray-500">{actualState.detail}</div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg"
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <BrainCircuit className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500 font-medium mb-1">State theo AI</div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-lg font-bold text-gray-800">
                  <span>{aiState.label}</span>
                  <span className="text-lg text-gray-500">-</span>
                  <span className="text-lg text-gray-700">
                    {runtimeState?.tinymlSmooth !== undefined ? runtimeState.tinymlSmooth.toFixed(3) : "--"}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {aiState.detail}
                  {runtimeState?.autoFanRequest ? " · Auto fan đang yêu cầu làm mát" : ""}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Temperature & Humidity Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg mb-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">Nhiệt độ & Độ ẩm</h2>
            <p className="text-sm text-gray-500">Dữ liệu lịch sử từ cảm biến</p>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-[#6366f1] rounded-full"></div>
              <span className="text-sm text-gray-600">Nhiệt độ (°C)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-[#22d3ee] rounded-full"></div>
              <span className="text-sm text-gray-600">Độ ẩm (%)</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData.length > 0 ? chartData : [{ time: "N/A", temp: 0, humidity: 0 }]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="time" stroke="#9ca3af" style={{ fontSize: '12px' }} />
            <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: '12px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Line type="monotone" dataKey="temp" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} name="Nhiệt độ (°C)" />
            <Line type="monotone" dataKey="humidity" stroke="#22d3ee" strokeWidth={3} dot={{ r: 4 }} name="Độ ẩm (%)" />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Room Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg"
        >
          <h2 className="text-xl font-bold text-gray-800 mb-6">Trạng thái phòng</h2>
          <div className="space-y-4">
            {rooms.map((room) => (
              <div key={room.name} className="bg-gradient-to-br from-cyan-50 to-purple-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-800">{room.name}</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-[#6366f1]" />
                    <div>
                      <div className="text-xs text-gray-600">Nhiệt độ</div>
                      <div className="font-bold text-gray-800">{room.temp.toFixed(2)}°C</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-[#22d3ee]" />
                    <div>
                      <div className="text-xs text-gray-600">Độ ẩm</div>
                      <div className="font-bold text-gray-800">{room.humidity.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
