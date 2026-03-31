import { User, Bell, Lock, Palette, Globe, Info, LogOut, Shield, Smartphone, CreditCard } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

export function Settings() {
  const [theme, setTheme] = useState("light");

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-8 mb-6 border border-white/40 shadow-xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Settings</h1>
        <p className="text-sm text-gray-500">Manage your account and app preferences</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-8 border border-white/40 shadow-lg mb-6">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-gradient-to-br from-[#22d3ee] via-[#6366f1] to-[#8b5cf6] rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-xl">
            A
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-gray-800 text-xl mb-1">Alex Nguyen</h2>
            <p className="text-sm text-gray-500 mb-3">alex.nguyen@example.com</p>
            <button className="px-4 py-2 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all">
              Edit Profile
            </button>
          </div>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-4">
        {/* Account Settings */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-gradient-to-br from-[#22d3ee]/20 to-[#6366f1]/20 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-[#6366f1]" />
            </div>
            <h3 className="font-bold text-gray-800">Account</h3>
          </div>

          <div className="space-y-2">
            <button className="w-full flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-purple-50 rounded-xl transition-all group">
              <div className="text-left">
                <div className="font-semibold text-gray-800 text-sm mb-0.5">Display Name</div>
                <div className="text-sm text-gray-500">Alex Nguyen</div>
              </div>
              <span className="text-gray-400 group-hover:text-[#6366f1] transition-colors">→</span>
            </button>

            <button className="w-full flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-purple-50 rounded-xl transition-all group">
              <div className="text-left">
                <div className="font-semibold text-gray-800 text-sm mb-0.5">Email</div>
                <div className="text-sm text-gray-500">alex.nguyen@example.com</div>
              </div>
              <span className="text-gray-400 group-hover:text-[#6366f1] transition-colors">→</span>
            </button>

            <button className="w-full flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-purple-50 rounded-xl transition-all group">
              <div className="text-left">
                <div className="font-semibold text-gray-800 text-sm mb-0.5">Phone Number</div>
                <div className="text-sm text-gray-500">+84 123 456 789</div>
              </div>
              <span className="text-gray-400 group-hover:text-[#6366f1] transition-colors">→</span>
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-gradient-to-br from-[#c084fc]/20 to-[#a855f7]/20 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-[#a855f7]" />
            </div>
            <h3 className="font-bold text-gray-800">Notifications</h3>
          </div>

          <div className="space-y-3">
            {[
              { label: "Device Activity Alerts", enabled: true },
              { label: "Security Warnings", enabled: true },
              { label: "Energy Reports", enabled: true },
              { label: "System Updates", enabled: false },
              { label: "Promotions & News", enabled: false },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-purple-50 rounded-xl transition-all">
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
                <button
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    item.enabled ? 'bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-md ${
                      item.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Security */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-gradient-to-br from-[#22d3ee]/20 to-[#06b6d4]/20 rounded-xl flex items-center justify-center">
              <Lock className="w-5 h-5 text-[#06b6d4]" />
            </div>
            <h3 className="font-bold text-gray-800">Security</h3>
          </div>

          <div className="space-y-2">
            <button className="w-full flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-purple-50 rounded-xl transition-all group">
              <div className="text-left">
                <div className="font-semibold text-gray-800 text-sm mb-0.5">Change Password</div>
                <div className="text-sm text-gray-500">Update your password</div>
              </div>
              <span className="text-gray-400 group-hover:text-[#6366f1] transition-colors">→</span>
            </button>

            <button className="w-full flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-purple-50 rounded-xl transition-all group">
              <div className="text-left flex items-center gap-3">
                <Shield className="w-5 h-5 text-green-500" />
                <div>
                  <div className="font-semibold text-gray-800 text-sm mb-0.5">Two-Factor Authentication</div>
                  <div className="text-sm text-green-600 font-medium">Enabled</div>
                </div>
              </div>
              <span className="text-gray-400 group-hover:text-[#6366f1] transition-colors">→</span>
            </button>

            <button className="w-full flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-purple-50 rounded-xl transition-all group">
              <div className="text-left flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-[#6366f1]" />
                <div>
                  <div className="font-semibold text-gray-800 text-sm mb-0.5">Connected Devices</div>
                  <div className="text-sm text-gray-500">3 devices</div>
                </div>
              </div>
              <span className="text-gray-400 group-hover:text-[#6366f1] transition-colors">→</span>
            </button>
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-gradient-to-br from-[#f97316]/20 to-[#fb923c]/20 rounded-xl flex items-center justify-center">
              <Palette className="w-5 h-5 text-[#f97316]" />
            </div>
            <h3 className="font-bold text-gray-800">Appearance</h3>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-3 block">Theme Mode</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "light", label: "Light", emoji: "☀️" },
                { value: "dark", label: "Dark", emoji: "🌙" },
                { value: "auto", label: "Auto", emoji: "⚡" }
              ].map((themeOption) => (
                <motion.button
                  key={themeOption.value}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setTheme(themeOption.value)}
                  className={`px-4 py-4 rounded-xl border-2 transition-all ${
                    theme === themeOption.value
                      ? 'border-[#6366f1] bg-gradient-to-br from-[#6366f1]/10 to-[#8b5cf6]/10'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-2xl mb-1">{themeOption.emoji}</div>
                  <span className={`text-sm font-semibold ${
                    theme === themeOption.value ? 'text-[#6366f1]' : 'text-gray-700'
                  }`}>
                    {themeOption.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Language & Region */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-gradient-to-br from-[#8b5cf6]/20 to-[#a855f7]/20 rounded-xl flex items-center justify-center">
              <Globe className="w-5 h-5 text-[#8b5cf6]" />
            </div>
            <h3 className="font-bold text-gray-800">Language & Region</h3>
          </div>

          <div className="space-y-2">
            <button className="w-full flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-purple-50 rounded-xl transition-all group">
              <div className="text-left">
                <div className="font-semibold text-gray-800 text-sm mb-0.5">Language</div>
                <div className="text-sm text-gray-500">English (US)</div>
              </div>
              <span className="text-gray-400 group-hover:text-[#6366f1] transition-colors">→</span>
            </button>

            <button className="w-full flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-purple-50 rounded-xl transition-all group">
              <div className="text-left">
                <div className="font-semibold text-gray-800 text-sm mb-0.5">Time Zone</div>
                <div className="text-sm text-gray-500">GMT+7 (Bangkok, Hanoi)</div>
              </div>
              <span className="text-gray-400 group-hover:text-[#6366f1] transition-colors">→</span>
            </button>
          </div>
        </div>

        {/* Billing */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-gradient-to-br from-[#10b981]/20 to-[#059669]/20 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-[#10b981]" />
            </div>
            <h3 className="font-bold text-gray-800">Billing & Subscription</h3>
          </div>

          <div className="space-y-2">
            <button className="w-full flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-purple-50 rounded-xl transition-all group">
              <div className="text-left">
                <div className="font-semibold text-gray-800 text-sm mb-0.5">Current Plan</div>
                <div className="text-sm text-gray-500">Free Plan</div>
              </div>
              <span className="px-3 py-1 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white text-xs font-semibold rounded-full">
                Upgrade
              </span>
            </button>

            <button className="w-full flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-purple-50 rounded-xl transition-all group">
              <div className="text-left">
                <div className="font-semibold text-gray-800 text-sm mb-0.5">Payment Methods</div>
                <div className="text-sm text-gray-500">No payment method added</div>
              </div>
              <span className="text-gray-400 group-hover:text-[#6366f1] transition-colors">→</span>
            </button>
          </div>
        </div>

        {/* About */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-gradient-to-br from-[#64748b]/20 to-[#475569]/20 rounded-xl flex items-center justify-center">
              <Info className="w-5 h-5 text-[#64748b]" />
            </div>
            <h3 className="font-bold text-gray-800">About</h3>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between p-3 bg-gradient-to-r from-cyan-50 to-purple-50 rounded-xl">
              <span className="font-medium text-gray-700">Version</span>
              <span className="font-semibold text-gray-800">1.0.0</span>
            </div>
            <div className="flex justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
              <span className="font-medium text-gray-700">Last Update</span>
              <span className="font-semibold text-gray-800">22/03/2026</span>
            </div>
            <button className="w-full p-3 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-purple-50 rounded-xl transition-all text-left">
              <span className="text-[#6366f1] font-semibold hover:underline">Check for Updates</span>
            </button>
          </div>
        </div>

        {/* Logout */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-2xl p-4 shadow-lg transition-all font-semibold flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          Log Out
        </motion.button>
      </div>
    </div>
  );
}
