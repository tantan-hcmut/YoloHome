import { Home, Plus, Users, Settings, Key, Trash2, UserPlus } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

const homesData = [
  { id: 1, name: "My Home", address: "123 Ocean Drive, Miami, FL", role: "Owner", devices: 18, members: 3 },
  { id: 2, name: "Beach House", address: "456 Sunset Blvd, Malibu, CA", role: "Guest", devices: 12, members: 2 },
  { id: 3, name: "Office Space", address: "789 Tech Park, San Francisco, CA", role: "Owner", devices: 24, members: 5 },
];

export function Homes() {
  const [homes, setHomes] = useState(homesData);
  const [showAddHomeModal, setShowAddHomeModal] = useState(false);
  const [showJoinHomeModal, setShowJoinHomeModal] = useState(false);

  const deleteHome = (id: number) => {
    setHomes(homes.filter(home => home.id !== id));
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-8 mb-6 border border-white/40 shadow-xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">My Homes</h1>
        <p className="text-sm text-gray-500">Manage your properties and access permissions</p>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowAddHomeModal(true)}
          className="p-6 bg-gradient-to-br from-cyan-50 to-purple-50 rounded-2xl border-2 border-dashed border-[#6366f1]/30 hover:border-[#6366f1] transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-[#6366f1] group-hover:to-[#8b5cf6] transition-all shadow-md">
              <Plus className="w-7 h-7 text-[#6366f1] group-hover:text-white transition-colors" />
            </div>
            <div className="text-left">
              <div className="font-bold text-gray-800 mb-1">Add New Home</div>
              <div className="text-sm text-gray-500">Create your new property</div>
            </div>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowJoinHomeModal(true)}
          className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-dashed border-[#8b5cf6]/30 hover:border-[#8b5cf6] transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-[#8b5cf6] group-hover:to-[#a855f7] transition-all shadow-md">
              <UserPlus className="w-7 h-7 text-[#8b5cf6] group-hover:text-white transition-colors" />
            </div>
            <div className="text-left">
              <div className="font-bold text-gray-800 mb-1">Join Home</div>
              <div className="text-sm text-gray-500">Enter invitation code</div>
            </div>
          </div>
        </motion.button>
      </div>

      {/* Homes Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {homes.map((home, index) => (
          <motion.div
            key={home.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
            className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg group"
          >
            <div className="flex items-start gap-4">
              {/* Home Icon */}
              <div className={`w-16 h-16 bg-gradient-to-br ${
                index % 3 === 0 ? 'from-[#22d3ee] to-[#06b6d4]' :
                index % 3 === 1 ? 'from-[#6366f1] to-[#8b5cf6]' :
                'from-[#c084fc] to-[#a855f7]'
              } rounded-2xl flex items-center justify-center shrink-0 shadow-lg`}>
                <Home className="w-8 h-8 text-white" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg mb-1">{home.name}</h3>
                    <p className="text-sm text-gray-500">{home.address}</p>
                  </div>
                  <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm ${
                    home.role === 'Owner' 
                      ? 'bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {home.role}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Settings className="w-4 h-4 text-[#6366f1]" />
                    </div>
                    <div className="text-xs text-gray-600">Devices</div>
                    <div className="font-bold text-gray-800 text-lg">{home.devices}</div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-[#8b5cf6]" />
                    </div>
                    <div className="text-xs text-gray-600">Members</div>
                    <div className="font-bold text-gray-800 text-lg">{home.members}</div>
                  </div>

                  <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Key className="w-4 h-4 text-[#f59e0b]" />
                    </div>
                    <div className="text-xs text-gray-600">Code</div>
                    <div className="font-bold text-gray-800 text-sm">H{home.id}23X</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button className="px-4 py-2 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 text-gray-700 rounded-lg transition-all text-sm font-semibold flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                  {home.role === 'Owner' && (
                    <>
                      <button className="px-4 py-2 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 text-gray-700 rounded-lg transition-all text-sm font-semibold flex items-center gap-2">
                        <UserPlus className="w-4 h-4" />
                        Invite
                      </button>
                      <button 
                        onClick={() => deleteHome(home.id)}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all text-sm font-semibold flex items-center gap-2 ml-auto opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add Home Modal */}
      {showAddHomeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Add New Home</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Home Name</label>
                <input
                  type="text"
                  placeholder="e.g., My Home"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Address</label>
                <input
                  type="text"
                  placeholder="Enter full address"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Adafruit Username</label>
                <input
                  type="text"
                  placeholder="Enter Adafruit username"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Adafruit API Key</label>
                <input
                  type="password"
                  placeholder="Enter Adafruit API key"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all"
                />
              </div>

              <div className="bg-gradient-to-r from-cyan-50 to-purple-50 border border-[#6366f1]/20 rounded-xl p-4">
                <div className="text-sm text-gray-700">
                  <span className="font-semibold">💡 Note:</span> You need an Adafruit IO account to connect IoT devices.
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowAddHomeModal(false)}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowAddHomeModal(false)}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white rounded-xl hover:shadow-lg transition-all font-semibold"
              >
                Add Home
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Join Home Modal */}
      {showJoinHomeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Join Home</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Home Code (ID)</label>
                <input
                  type="text"
                  placeholder="Enter shared home code"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all text-center text-lg tracking-wider font-mono"
                />
              </div>

              <div className="bg-gradient-to-r from-cyan-50 to-purple-50 border border-[#6366f1]/20 rounded-xl p-4">
                <div className="text-sm text-gray-700">
                  <span className="font-semibold">ℹ️ Instructions:</span> Request the home owner to share the ID code so you can join and control devices.
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowJoinHomeModal(false)}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowJoinHomeModal(false)}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white rounded-xl hover:shadow-lg transition-all font-semibold"
              >
                Join
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
