import { useState, useEffect } from "react";
import { Thermometer, Droplets, Power, Lightbulb, Fan, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const API_BASE_URL = "http://localhost:5000";

interface SensorData {
  id: number;
  thiet_bi_id: string;
  thiet_bi_ten: string;
  nhiet_do?: number;
  do_am?: number;
  thoi_gian_cap_nhat?: string;
}

const aiPredictionData = [
  { time: "Mon", value: 85 },
  { time: "Tue", value: 78 },
  { time: "Wed", value: 92 },
  { time: "Thu", value: 88 },
  { time: "Fri", value: 95 },
  { time: "Sat", value: 72 },
  { time: "Sun", value: 80 },
];

export function Dashboard() {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [allSensors, setAllSensors] = useState<SensorData[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [totalDevices, setTotalDevices] = useState(0);
  const [lightsOn, setLightsOn] = useState(0);
  const [fansOn, setFansOn] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSensorData();
    fetchDeviceStats();
    // Poll every 5 seconds for real-time updates
    const interval = setInterval(() => {
      fetchSensorData();
      fetchDeviceStats();
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
        const chartDataFormatted = result.data.map((item: any) => ({
          time: new Date(item.thoi_gian).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          temp: item.nhiet_do || 0,
          humidity: item.do_am || 0
        }));
        
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
      name: "Living Room", 
      temp: sensorData?.nhiet_do || 0, 
      humidity: sensorData?.do_am || 0, 
      devices: 3, 
      active: 2 
    },
  ];
  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-8 mb-6 border border-white/40 shadow-xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Dashboard</h1>
        <p className="text-sm text-gray-500">Monitor your smart home environment</p>
        {error && <p className="text-sm text-red-600 mt-2">Lỗi: {error}</p>}
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
            <span className="text-xs font-semibold px-3 py-1 bg-green-100 text-green-700 rounded-full">Tổng</span>
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
            <span className="text-xs font-semibold px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full">Đang bật</span>
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
            <span className="text-xs font-semibold px-3 py-1 bg-blue-100 text-blue-700 rounded-full">Đang bật</span>
          </div>
          <div className="text-3xl font-bold text-gray-800 mb-1">{fansOn}</div>
          <div className="text-sm text-gray-500">Quạt đang bật</div>
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
                  <span className="text-xs font-semibold px-2 py-1 bg-white/80 text-gray-600 rounded-lg">
                    {room.active}/{room.devices} Active
                  </span>
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

        {/* AI Prediction Chart */}
        {/* <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Thông tin chi tiết</h2>
              <p className="text-sm text-gray-500">Cập nhật tại: {sensorData?.thoi_gian_cap_nhat ? new Date(sensorData.thoi_gian_cap_nhat).toLocaleString('vi-VN') : 'N/A'}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={aiPredictionData}>
              <defs>
                <linearGradient id="colorPrediction" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
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
              <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPrediction)" name="Efficiency Score" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-4 p-4 bg-gradient-to-r from-cyan-50 to-purple-50 border border-[#6366f1]/20 rounded-xl">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Thiết bị:</span> YOLO:BIT - Kết nối qua Serial USB, cập nhật dữ liệu mỗi 5 giây.
            </p>
          </div>
        </motion.div> */}
      </div>
    </div>
  );
}
