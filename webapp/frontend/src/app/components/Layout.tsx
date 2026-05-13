import { Outlet, NavLink, useNavigate } from "react-router";
import { 
  LayoutDashboard, 
  Cpu, 
  Calendar,
  Home as HomeIcon, 
  Settings as SettingsIcon,
  Menu,
  LogOut,
  Mic,
  MicOff
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, color: "pastel-sky" },
  { path: "/devices", label: "Devices", icon: Cpu, color: "pastel-mint" },
  { path: "/schedule", label: "Schedule", icon: Calendar, color: "pastel-lavender" },
  { path: "/settings", label: "Settings", icon: SettingsIcon, color: "pastel-sage" },
];

export function Layout({ children }: { children?: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const navigate = useNavigate();

  const toggleMic = () => {
    setIsMicActive(!isMicActive);
    // Simulate voice command listening
    if (!isMicActive) {
      setTimeout(() => setIsMicActive(false), 3000);
    }
  };

  const handleLogout = () => {
    // Xóa token và user info
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("isLoggedIn");
    
    // Redirect về login
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e0f2fe] via-[#fae8ff] to-[#f3e8ff]">
      {/* Mobile sidebar backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white/80 backdrop-blur-xl border-r border-white/20 z-50 transition-transform duration-300 shadow-xl
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="flex flex-col h-full p-6">
          {/* Logo and Title */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shrink-0">
              H
            </div>
            
            {/* App Title */}
            <div>
              <h1 className="text-xl font-bold text-gray-800">YOLO-HOME</h1>
              <p className="text-sm font-medium text-gray-500 mt-0.5">Smart Home Control</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto">
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === "/"}
                    onClick={() => setIsSidebarOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                      ${isActive 
                        ? 'bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white shadow-lg' 
                        : 'text-gray-600 hover:bg-gray-100/50'
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Log Out */}
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-red-100/50 hover:text-red-600 transition-all mt-4"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-gray-200/60 sticky top-0 z-30">
          <div className="px-4 py-3.5 flex items-center justify-between">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-[#7B68EE] to-[#9B8AFF] rounded-lg flex items-center justify-center text-white">
                <HomeIcon className="w-4 h-4" />
              </div>
              <span className="font-semibold text-gray-800 text-[15px]">YOLO-HOME</span>
            </div>
            <div className="w-9"></div>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-screen p-6 lg:p-8">
          {children || <Outlet />}
        </main>
      </div>

      {/* Floating Mic Button */}
      <button
        onClick={toggleMic}
        className={`fixed bottom-8 right-8 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all z-40 ${
          isMicActive 
            ? 'bg-gradient-to-r from-red-500 to-pink-500 animate-pulse' 
            : 'bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:shadow-xl hover:scale-110'
        }`}
      >
        {isMicActive ? (
          <MicOff className="w-7 h-7 text-white" />
        ) : (
          <Mic className="w-7 h-7 text-white" />
        )}
      </button>

      {/* Voice Command Indicator */}
      {isMicActive && (
        <div className="fixed bottom-28 right-8 bg-white/90 backdrop-blur-xl rounded-2xl px-6 py-4 shadow-xl border border-white/40 z-40">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-semibold text-gray-800">Listening...</span>
          </div>
        </div>
      )}
    </div>
  );
}