import { Lightbulb, Fan, Loader } from "lucide-react";
import { motion } from "motion/react";
import { useState, useEffect } from "react";

interface Device {
  id: string;
  ten_thiet_bi: string;
  loai_thiet_bi: "den" | "quat" | "sensor";
  nha_id: number;
  vi_tri_lap_dat: string;
  trang_thai?: {
    trang_thai_bat_tat: boolean;
    toc_do?: number;
    mau_sac?: string;
  };
}

const API_BASE = "http://localhost:5000/api";

// Convert hex to RGB
const hexToRgb = (hex: string): {r: number; g: number; b: number} => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : {r: 255, g: 255, b: 255};
};

export function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [controlLoading, setControlLoading] = useState<string | null>(null);

  // Fetch devices từ API
  useEffect(() => {
    fetchDevices();
    // Polling every 5 seconds
    const interval = setInterval(fetchDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/cam-bien/devices`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDevices(data.data || []);
      }
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch devices:", error);
      setLoading(false);
    }
  };

  // Control device
  const handleControl = async (
    deviceId: string,
    action: "on" | "off" | "set_rgb" | "set_speed",
    additionalData?: any
  ) => {
    setControlLoading(deviceId);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/thiet-bi/${deviceId}/control`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          ...additionalData,
        }),
      });

      if (response.ok) {
        // Refresh devices
        await fetchDevices();
      }
    } catch (error) {
      console.error("Failed to control device:", error);
    } finally {
      setControlLoading(null);
    }
  };

  const lights = devices.filter((d) => d.loai_thiet_bi === "den");
  const fans = devices.filter((d) => d.loai_thiet_bi === "quat");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-8 mb-6 border border-white/40 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Thiết Bị</h1>
          <p className="text-sm text-gray-500">Điều khiển đèn và quạt</p>
        </div>
      </div>

      {/* Lights Section */}
      <div className="mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="bg-gradient-to-r from-yellow-500/90 to-amber-400/70 backdrop-blur-xl rounded-2xl px-6 py-4 mb-4 border border-white/30 shadow-lg flex items-center gap-3"
        >
          <Lightbulb className="w-6 h-6 text-white" />
          <h2 className="text-xl font-bold text-white">Đèn</h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lights.map((device, index) => (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg"
            >
              {/* Device Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 bg-gradient-to-br ${
                    device.trang_thai?.trang_thai_bat_tat ? 'from-yellow-400 to-orange-400' : 'from-gray-200 to-gray-300'
                  } rounded-xl flex items-center justify-center`}>
                    <Lightbulb className={`w-6 h-6 ${device.trang_thai?.trang_thai_bat_tat ? 'text-white' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{device.ten_thiet_bi}</h3>
                    <p className="text-xs text-gray-500">{device.vi_tri_lap_dat}</p>
                  </div>
                </div>
              </div>

              {/* Power Toggle Section */}
              <div className="flex items-center justify-between mb-4 p-4 bg-gradient-to-br from-cyan-50 to-purple-50 rounded-xl">
                <span className="text-sm font-semibold text-gray-700">Power</span>
                <button
                  onClick={() => {
                    console.log("Light power clicked:", device.id);
                    handleControl(
                      device.id,
                      device.trang_thai?.trang_thai_bat_tat ? "off" : "on"
                    );
                  }}
                  disabled={controlLoading === device.id}
                  className={`relative w-14 h-8 rounded-full transition-all cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed ${
                    device.trang_thai?.trang_thai_bat_tat
                      ? 'bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]'
                      : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform pointer-events-none ${
                    device.trang_thai?.trang_thai_bat_tat ? 'translate-x-6' : ''
                  }`}></div>
                </button>
              </div>

              {/* Color Picker */}
              {device.trang_thai?.trang_thai_bat_tat && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Color</span>
                    <input
                      type="color"
                      defaultValue="#FFFFFF"
                      onChange={(e) => {
                        const rgb = hexToRgb(e.target.value);
                        handleControl(device.id, "set_rgb", {
                          r: rgb.r,
                          g: rgb.g,
                          b: rgb.b,
                          brightness: 96,
                        });
                      }}
                      disabled={controlLoading === device.id}
                      className="w-10 h-10 cursor-pointer rounded-full border-2 border-white shadow-[0_0_4px_rgba(0,0,0,0.5)] bg-transparent overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-moz-color-swatch]:border-none"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Fans Section */}
      <div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-indigo-400/90 to-purple-400/70 backdrop-blur-xl rounded-2xl px-6 py-4 mb-4 border border-white/30 shadow-lg flex items-center gap-3"
        >
          <Fan className="w-6 h-6 text-white" />
          <h2 className="text-xl font-bold text-white">Quạt</h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fans.map((device, index) => (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg"
            >
              {/* Device Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 bg-gradient-to-br ${
                    device.trang_thai?.trang_thai_bat_tat ? 'from-blue-400 to-purple-400' : 'from-gray-200 to-gray-300'
                  } rounded-xl flex items-center justify-center`}>
                    <Fan className={`w-6 h-6 ${device.trang_thai?.trang_thai_bat_tat ? 'text-white animate-spin' : 'text-gray-500'}`}
                      style={{ animationDuration: device.trang_thai?.trang_thai_bat_tat ? `${2 - (device.trang_thai?.toc_do || 0) / 100}s` : 'auto' }}
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{device.ten_thiet_bi}</h3>
                    <p className="text-xs text-gray-500">{device.vi_tri_lap_dat}</p>
                  </div>
                </div>
              </div>

              {/* Power Toggle Section */}
              <div className="flex items-center justify-between mb-4 p-4 bg-gradient-to-br from-cyan-50 to-purple-50 rounded-xl">
                <span className="text-sm font-semibold text-gray-700">Power</span>
                <button
                  onClick={() => {
                    console.log("Fan power clicked:", device.id);
                    handleControl(
                      device.id,
                      device.trang_thai?.trang_thai_bat_tat ? "off" : "on"
                    );
                  }}
                  disabled={controlLoading === device.id}
                  className={`relative w-14 h-8 rounded-full transition-all cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed ${
                    device.trang_thai?.trang_thai_bat_tat
                      ? 'bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]'
                      : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform pointer-events-none ${
                    device.trang_thai?.trang_thai_bat_tat ? 'translate-x-6' : ''
                  }`}></div>
                </button>
              </div>

              {/* Speed Slider */}
              {device.trang_thai?.trang_thai_bat_tat && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Speed</span>
                    <span className="text-sm font-bold text-[#6366f1]">{device.trang_thai?.toc_do || 0}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={device.trang_thai?.toc_do || 0}
                    onChange={(e) => handleControl(device.id, "set_speed", {
                      speed: parseInt(e.target.value),
                    })}
                    disabled={controlLoading === device.id}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, #6366f1 0%, #8b5cf6 ${device.trang_thai?.toc_do || 0}%, #e5e7eb ${device.trang_thai?.toc_do || 0}%, #e5e7eb 100%)`
                    }}
                  />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {lights.length === 0 && fans.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Không có thiết bị nào</p>
        </div>
      )}
    </div>
  );
}
