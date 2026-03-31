import { Lightbulb, Fan, Plus, Trash2, Settings, Gauge } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

interface Device {
  id: number;
  name: string;
  type: "light" | "fan";
  room: string;
  status: boolean;
  color?: string;
  speed?: number;
  threshold?: { min: number; max: number; };
}

const initialDevices: Device[] = [
  { id: 1, name: "Living Room Light", type: "light", room: "Living Room", status: true, color: "#FFFF00" },
  { id: 2, name: "Bedroom Light", type: "light", room: "Bedroom", status: false, color: "#FFFFFF" },
  { id: 3, name: "Kitchen Light", type: "light", room: "Kitchen", status: true, color: "#FFB84D" },
  { id: 4, name: "Living Room Fan", type: "fan", room: "Living Room", status: true, speed: 60 },
  { id: 5, name: "Bedroom Fan", type: "fan", room: "Bedroom", status: false, speed: 0 },
];

export function Devices() {
  const [devices, setDevices] = useState<Device[]>(initialDevices);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  const toggleDevice = (id: number) => {
    setDevices(devices.map(device => 
      device.id === id ? { ...device, status: !device.status } : device
    ));
  };

  const updateColor = (id: number, color: string) => {
    setDevices(devices.map(device => 
      device.id === id ? { ...device, color } : device
    ));
  };

  const updateSpeed = (id: number, speed: number) => {
    setDevices(devices.map(device => 
      device.id === id ? { ...device, speed, status: speed > 0 } : device
    ));
  };

  const deleteDevice = (id: number) => {
    setDevices(devices.filter(device => device.id !== id));
  };

  const openThresholdModal = (device: Device) => {
    setSelectedDevice(device);
    setShowThresholdModal(true);
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-8 mb-6 border border-white/40 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Devices</h1>
            <p className="text-sm text-gray-500">Control your lights and fans</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white rounded-xl hover:shadow-lg transition-all font-semibold flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Device
          </button>
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
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Lights
          </h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.filter(d => d.type === "light").map((device, index) => (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 bg-gradient-to-br ${
                    device.status ? 'from-yellow-400 to-orange-400' : 'from-gray-200 to-gray-300'
                  } rounded-xl flex items-center justify-center`}>
                    <Lightbulb className={`w-6 h-6 ${device.status ? 'text-white' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{device.name}</h3>
                    <p className="text-xs text-gray-500">{device.room}</p>
                  </div>
                </div>
                <button
                  onClick={() => deleteDevice(device.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center justify-between mb-4 p-4 bg-gradient-to-br from-cyan-50 to-purple-50 rounded-xl">
                <span className="text-sm font-semibold text-gray-700">Power</span>
                <button
                  onClick={() => toggleDevice(device.id)}
                  className={`relative w-14 h-8 rounded-full transition-all ${
                    device.status ? 'bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]' : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                    device.status ? 'translate-x-6' : ''
                  }`}></div>
                </button>
              </div>

              {/* Color Picker */}
              {device.status && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Color</span>
                    <input
                      type="color"
                      value={device.color}
                      onChange={(e) => updateColor(device.id, e.target.value)}
                      className="w-10 h-10 cursor-pointer rounded-full border-2 border-white shadow-[0_0_4px_rgba(0,0,0,0.5)] bg-transparent overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-moz-color-swatch]:border-none"
                    />
                  </div>
                  <button
                    onClick={() => openThresholdModal(device)}
                    className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Set Threshold
                  </button>
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
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Fans
          </h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.filter(d => d.type === "fan").map((device, index) => (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 bg-gradient-to-br ${
                    device.status ? 'from-blue-400 to-purple-400' : 'from-gray-200 to-gray-300'
                  } rounded-xl flex items-center justify-center`}>
                    <Fan className={`w-6 h-6 ${device.status ? 'text-white animate-spin' : 'text-gray-500'}`} 
                      style={{ animationDuration: device.status ? `${2 - (device.speed || 0) / 100}s` : 'auto' }}
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{device.name}</h3>
                    <p className="text-xs text-gray-500">{device.room}</p>
                  </div>
                </div>
                <button
                  onClick={() => deleteDevice(device.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center justify-between mb-4 p-4 bg-gradient-to-br from-cyan-50 to-purple-50 rounded-xl">
                <span className="text-sm font-semibold text-gray-700">Power</span>
                <button
                  onClick={() => toggleDevice(device.id)}
                  className={`relative w-14 h-8 rounded-full transition-all ${
                    device.status ? 'bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]' : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                    device.status ? 'translate-x-6' : ''
                  }`}></div>
                </button>
              </div>

              {/* Speed Slider */}
              {device.status && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Speed</span>
                    <span className="text-sm font-bold text-[#6366f1]">{device.speed}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={device.speed}
                    onChange={(e) => updateSpeed(device.id, parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, #6366f1 0%, #8b5cf6 ${device.speed}%, #e5e7eb ${device.speed}%, #e5e7eb 100%)`
                    }}
                  />
                  <button
                    onClick={() => openThresholdModal(device)}
                    className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Set Threshold
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Add New Device</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Device Type</label>
                <select className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all">
                  <option>Light</option>
                  <option>Fan</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Device Name</label>
                <input
                  type="text"
                  placeholder="e.g., Living Room Light"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Room</label>
                <input
                  type="text"
                  placeholder="e.g., Living Room"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Adafruit Feed Key</label>
                <input
                  type="text"
                  placeholder="Enter feed key"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white rounded-xl hover:shadow-lg transition-all font-semibold"
              >
                Add Device
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Threshold Modal */}
      {showThresholdModal && selectedDevice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] rounded-xl flex items-center justify-center">
                <Gauge className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Set Threshold</h2>
                <p className="text-sm text-gray-500">{selectedDevice.name}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  {selectedDevice.type === "fan" ? "Temperature Range (°C)" : "Brightness Level (%)"}
                </label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <input
                      type="number"
                      placeholder="Min"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      placeholder="Max"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowThresholdModal(false)}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowThresholdModal(false)}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white rounded-xl hover:shadow-lg transition-all font-semibold"
              >
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
