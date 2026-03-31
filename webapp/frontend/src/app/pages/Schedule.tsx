import { Calendar, Clock, Plus, Trash2, Power } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

const scheduleData = [
  { id: 1, name: "Morning Lights On", time: "06:00", devices: ["Living Room Light", "Kitchen Light"], repeat: "Daily", active: true },
  { id: 2, name: "Evening Fan On", time: "18:30", devices: ["Bedroom Fan"], repeat: "Daily", active: true },
  { id: 3, name: "Night Mode", time: "22:00", devices: ["All Lights"], repeat: "Daily", active: true },
  { id: 4, name: "Fan Timer", time: "13:00", devices: ["Living Room Fan"], repeat: "Weekdays", active: false },
];

export function Schedule() {
  const [schedules, setSchedules] = useState(scheduleData);
  const [showAddModal, setShowAddModal] = useState(false);

  const toggleSchedule = (id: number) => {
    setSchedules(schedules.map(schedule => 
      schedule.id === id ? { ...schedule, active: !schedule.active } : schedule
    ));
  };

  const deleteSchedule = (id: number) => {
    setSchedules(schedules.filter(schedule => schedule.id !== id));
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-8 mb-6 border border-white/40 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Power Schedule</h1>
            <p className="text-sm text-gray-500">Automate your devices on schedule</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white rounded-xl hover:shadow-lg transition-all text-sm font-semibold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Schedule
          </motion.button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg"
        >
          <div className="text-sm text-gray-500 mb-2">Total Schedules</div>
          <div className="text-3xl font-bold text-gray-800">{schedules.length}</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg"
        >
          <div className="text-sm text-gray-500 mb-2">Active</div>
          <div className="text-3xl font-bold bg-gradient-to-r from-[#22d3ee] to-[#06b6d4] bg-clip-text text-transparent">
            {schedules.filter(s => s.active).length}
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg"
        >
          <div className="text-sm text-gray-500 mb-2">Next Schedule</div>
          <div className="text-lg font-bold bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">06:00 AM</div>
        </motion.div>
      </div>

      {/* Schedule List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {schedules.map((schedule, index) => (
          <motion.div
            key={schedule.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.01 }}
            className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg group"
          >
            <div className="flex items-start gap-4">
              {/* Time Badge */}
              <div className={`px-5 py-4 rounded-xl shrink-0 ${
                schedule.active 
                  ? 'bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]' 
                  : 'bg-gray-100'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <Clock className={`w-4 h-4 ${schedule.active ? 'text-white/80' : 'text-gray-500'}`} />
                </div>
                <div className={`text-2xl font-bold ${schedule.active ? 'text-white' : 'text-gray-800'}`}>
                  {schedule.time}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-1 text-lg">{schedule.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <span>{schedule.repeat}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => deleteSchedule(schedule.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                    <button
                      onClick={() => toggleSchedule(schedule.id)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        schedule.active ? 'bg-[#6366f1]' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          schedule.active ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Devices */}
                <div className="flex flex-wrap gap-2">
                  {schedule.devices.map((device, index) => (
                    <div
                      key={index}
                      className="px-3 py-1.5 bg-gradient-to-r from-cyan-50 to-purple-50 border border-[#6366f1]/20 rounded-lg text-sm text-gray-700 flex items-center gap-1.5"
                    >
                      <Power className="w-3.5 h-3.5 text-[#6366f1]" />
                      {device}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add Schedule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Create New Schedule</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Schedule Name</label>
                <input
                  type="text"
                  placeholder="e.g., Morning Lights On"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">Time</label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Repeat</label>
                <select className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all">
                  <option>No Repeat</option>
                  <option>Daily</option>
                  <option>Weekly</option>
                  <option>Weekdays</option>
                  <option>Weekends</option>
                  <option>Custom</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Devices</label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-3">
                  {["Living Room Light", "Bedroom Light", "Ceiling Fan", "AC", "TV"].map((device) => (
                    <label key={device} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg">
                      <input type="checkbox" className="rounded border-gray-300" />
                      <span className="text-sm text-gray-700">{device}</span>
                    </label>
                  ))}
                </div>
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
                Create
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}