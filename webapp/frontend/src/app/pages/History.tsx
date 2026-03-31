import { Calendar, Filter, Download, Power, Lightbulb, Fan, Thermometer, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const historyData = [
  { id: 1, device: "Living Room Light", action: "On", time: "09:15", date: "22/03/2026", user: "Alex Nguyen", icon: "Lightbulb" },
  { id: 2, device: "Ceiling Fan", action: "Off", time: "09:00", date: "22/03/2026", user: "Auto Schedule", icon: "Fan" },
  { id: 3, device: "Bedroom AC", action: "On", time: "08:30", date: "22/03/2026", user: "Alex Nguyen", icon: "Thermometer" },
  { id: 4, device: "Office Lamp", action: "On", time: "08:00", date: "22/03/2026", user: "Auto Schedule", icon: "Lightbulb" },
  { id: 5, device: "All Lights", action: "Off", time: "22:00", date: "21/03/2026", user: "Auto Schedule", icon: "Power" },
  { id: 6, device: "Kitchen Fan", action: "On", time: "19:30", date: "21/03/2026", user: "Alex Nguyen", icon: "Fan" },
  { id: 7, device: "Living Room Light", action: "Off", time: "18:00", date: "21/03/2026", user: "Alex Nguyen", icon: "Lightbulb" },
  { id: 8, device: "AC", action: "Off", time: "17:30", date: "21/03/2026", user: "Auto Schedule", icon: "Thermometer" },
  { id: 9, device: "Smart TV", action: "On", time: "20:00", date: "21/03/2026", user: "Alex Nguyen", icon: "Power" },
  { id: 10, device: "WiFi Router", action: "Restarted", time: "14:15", date: "21/03/2026", user: "System", icon: "Power" },
];

const savingsData = [
  { day: "Mon", savings: 12 },
  { day: "Tue", savings: 18 },
  { day: "Wed", savings: 15 },
  { day: "Thu", savings: 22 },
  { day: "Fri", savings: 19 },
  { day: "Sat", savings: 25 },
  { day: "Sun", savings: 20 },
];

const iconMap: { [key: string]: any } = {
  Lightbulb,
  Fan,
  Thermometer,
  Power,
};

export function History() {
  const [selectedDate, setSelectedDate] = useState("all");
  const [selectedDevice, setSelectedDevice] = useState("all");

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-8 mb-6 border border-white/40 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Savings & History</h1>
            <p className="text-sm text-gray-500">Track your energy savings and device activity</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all text-sm font-semibold flex items-center gap-2 shadow-md"
          >
            <Download className="w-4 h-4" />
            Export Report
          </motion.button>
        </div>
      </div>

      {/* Savings Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-[#22d3ee] to-[#06b6d4] rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium opacity-90">This Week</div>
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="text-3xl font-bold mb-1">$24.50</div>
          <div className="text-sm opacity-80">Energy saved</div>
        </div>

        <div className="bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium opacity-90">This Month</div>
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="text-3xl font-bold mb-1">$98.20</div>
          <div className="text-sm opacity-80">Total savings</div>
        </div>

        <div className="bg-gradient-to-br from-[#c084fc] to-[#a855f7] rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium opacity-90">CO₂ Reduced</div>
            <TrendingDown className="w-5 h-5" />
          </div>
          <div className="text-3xl font-bold mb-1">45 kg</div>
          <div className="text-sm opacity-80">This month</div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
          <div className="text-sm text-gray-500 mb-3">Efficiency</div>
          <div className="text-3xl font-bold bg-gradient-to-r from-[#22d3ee] to-[#6366f1] bg-clip-text text-transparent mb-1">
            87%
          </div>
          <div className="text-sm text-gray-500">Optimization rate</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Savings Chart */}
        <div className="lg:col-span-2 bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#6366f1]" />
            Weekly Savings Trend
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={savingsData}>
                <defs>
                  <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="day" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value: number) => [`$${value}`, 'Saved']}
                />
                <Line
                  type="monotone"
                  dataKey="savings"
                  stroke="url(#lineGradient)"
                  strokeWidth={3}
                  dot={{ fill: '#6366f1', strokeWidth: 2, r: 5 }}
                  fill="url(#savingsGradient)"
                />
                <defs>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Stats */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
          <h2 className="font-semibold text-gray-800 mb-4">Activity Summary</h2>
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-cyan-50 to-purple-50 rounded-xl p-4">
              <div className="text-sm text-gray-600 mb-1">Today</div>
              <div className="text-2xl font-bold text-gray-800">24</div>
              <div className="text-xs text-gray-500 mt-1">activities</div>
            </div>
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4">
              <div className="text-sm text-gray-600 mb-1">This Week</div>
              <div className="text-2xl font-bold text-gray-800">156</div>
              <div className="text-xs text-gray-500 mt-1">activities</div>
            </div>
            <div className="bg-gradient-to-r from-pink-50 to-orange-50 rounded-xl p-4">
              <div className="text-sm text-gray-600 mb-1">Most Used</div>
              <div className="text-lg font-bold bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
                Living Room Light
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Filters</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-600 block mb-2 font-medium">Date</label>
            <select 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all text-sm bg-white"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600 block mb-2 font-medium">Device</label>
            <select 
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all text-sm bg-white"
            >
              <option value="all">All Devices</option>
              <option value="light">Lights</option>
              <option value="fan">Fans</option>
              <option value="ac">Air Conditioners</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600 block mb-2 font-medium">Action</label>
            <select className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all text-sm bg-white">
              <option value="all">All Actions</option>
              <option value="on">Turned On</option>
              <option value="off">Turned Off</option>
            </select>
          </div>
        </div>
      </div>

      {/* History Timeline */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
        <h2 className="font-semibold text-gray-800 mb-6 flex items-center gap-2 text-lg">
          <Calendar className="w-5 h-5" />
          Activity Details
        </h2>

        <div className="space-y-2">
          {historyData.map((item, index) => {
            const Icon = iconMap[item.icon];

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-gradient-to-r hover:from-cyan-50 hover:to-purple-50 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6366f1]/10 to-[#8b5cf6]/10 flex items-center justify-center shrink-0 group-hover:from-[#6366f1]/20 group-hover:to-[#8b5cf6]/20 transition-all">
                  <Icon className="w-6 h-6 text-[#6366f1]" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-semibold text-gray-800">{item.device}</span>
                    <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                      item.action === 'On' 
                        ? 'bg-green-100 text-green-700' 
                        : item.action === 'Off'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {item.action}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {item.user} • {item.date}
                  </div>
                </div>

                <div className="text-sm font-semibold text-gray-600 shrink-0">
                  {item.time}
                </div>
              </motion.div>
            );
          })}
        </div>

        <button className="w-full mt-6 py-3 text-sm text-gray-600 hover:text-gray-800 font-semibold transition-colors hover:bg-gray-50 rounded-xl">
          Load More →
        </button>
      </div>
    </div>
  );
}
