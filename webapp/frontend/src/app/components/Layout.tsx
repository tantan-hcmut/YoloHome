import { Outlet, NavLink, useNavigate } from "react-router";
import { 
  LayoutDashboard, 
  Cpu, 
  Home as HomeIcon, 
  Menu,
  LogOut,
  Mic,
  MicOff,
  ScanFace,
  SettingsIcon,
  Calendar,
  HistoryIcon
} from "lucide-react";
import { useState, useEffect } from "react";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, color: "pastel-sky" },
  { path: "/devices", label: "Devices", icon: Cpu, color: "pastel-mint" },
  { path: "/faces", label: "FaceID", icon: ScanFace, color: "pastel-lavender" },
  { path: "/schedule", label: "Schedule", icon: Calendar, color: "pastel-lavender" },
  { path: "/settings", label: "Settings", icon: SettingsIcon, color: "pastel-sage" },
  { path: "/history", label: "History", icon: HistoryIcon, color: "pastel-amber" },
];

export function Layout({ children }: { children?: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();

  // ==========================================
  // VOICE COMMAND STATES
  // ==========================================
  const [isMicActive, setIsMicActive] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [commandJson, setCommandJson] = useState<any>(null);
  const [sendStatus, setSendStatus] = useState<string>('');

  // Tự động gửi lệnh xuống Backend khi commandJson được tạo ra
  useEffect(() => {
    if (commandJson) {
      sendCommandToBackend(commandJson);
    }
  }, [commandJson]);

  const sendCommandToBackend = async (command: any) => {
    try {
      setSendStatus('Đang gửi lệnh...');
      const response = await fetch('http://127.0.0.1:5000/api/voice-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
      });

      if (response.ok) {
        setSendStatus('Lệnh đã được gửi thành công!');
        console.log('Voice command sent successfully:', command);
      } else {
        setSendStatus('Lỗi khi gửi lệnh!');
        console.error('Failed to send voice command:', response.statusText);
      }
    } catch (error) {
      setSendStatus('Lỗi kết nối!');
      console.error('Error sending voice command:', error);
    }

    setTimeout(() => setSendStatus(''), 3000);
  };

  const parseVoiceCommand = (text: string): any => {
    const lowerText = text.toLowerCase();
    let action = '';
    let device = '';
    let room = '';
    let speed: string | number | null = null;
    let color: string | null = null;

    if (lowerText.includes('đèn')) device = 'light';
    else if (lowerText.includes('quạt')) device = 'fan';

    if (lowerText.includes('bật') || lowerText.includes('mở')) action = 'on';
    else if (lowerText.includes('tắt') || lowerText.includes('đóng')) action = 'off';
    else if (lowerText.includes('tăng tốc') || lowerText.includes('tăng tốc độ')) action = 'increase_speed';
    else if (lowerText.includes('giảm tốc') || lowerText.includes('giảm tốc độ')) action = 'decrease_speed';
    else if (lowerText.includes('đặt tốc độ') || lowerText.includes('chạy ở tốc độ')) action = 'set_speed';
    else if (lowerText.includes('đổi màu') || lowerText.includes('đặt màu') || lowerText.includes('màu')) action = 'set_color';

    if (lowerText.includes('phòng khách')) room = 'living_room';
    else if (lowerText.includes('phòng ngủ')) room = 'bedroom';
    else if (lowerText.includes('phòng bếp')) room = 'kitchen';
    else if (lowerText.includes('phòng tắm')) room = 'bathroom';

    if (device === 'fan') {
      if (action === 'on') {
        if (lowerText.includes('nhẹ') || lowerText.includes('chậm')) speed = 'low';
        else if (lowerText.includes('trung bình') || lowerText.includes('vừa')) speed = 'medium';
        else if (lowerText.includes('mạnh') || lowerText.includes('nhanh')) speed = 'high';
      }
      
      if (action === 'set_speed') {
        const speedMatch = lowerText.match(/tốc độ\s*(\d+)/);
        if (speedMatch) speed = parseInt(speedMatch[1]);
        else if (lowerText.includes('chậm') || lowerText.includes('nhẹ')) speed = 'low';
        else if (lowerText.includes('trung bình') || lowerText.includes('vừa')) speed = 'medium';
        else if (lowerText.includes('nhanh') || lowerText.includes('mạnh')) speed = 'high';
      }
    }

    if (device === 'light') {
      if (action === 'set_color' || lowerText.includes('màu')) {
        if (lowerText.includes('đỏ')) color = 'red';
        else if (lowerText.includes('xanh dương')) color = 'blue';
        else if (lowerText.includes('xanh lá') || lowerText.includes('xanh lục')) color = 'green';
        else if (lowerText.includes('vàng')) color = 'yellow';
        else if (lowerText.includes('tím')) color = 'purple';
        else if (lowerText.includes('cam')) color = 'orange';
        else if (lowerText.includes('hồng')) color = 'pink';
        else if (lowerText.includes('trắng')) color = 'white';
        else if (lowerText.includes('xanh')) color = 'cyan'; 
      }
    }

    if (!action && device === 'fan') {
      if (lowerText.includes('tăng tốc') || lowerText.includes('tăng tốc độ')) action = 'increase_speed';
      else if (lowerText.includes('giảm tốc') || lowerText.includes('giảm tốc độ')) action = 'decrease_speed';
      else if (lowerText.includes('tốc độ')) {
        action = 'set_speed';
        const speedMatch = lowerText.match(/tốc độ\s*(\d+)/);
        if (speedMatch) speed = parseInt(speedMatch[1]);
        else if (lowerText.includes('chậm') || lowerText.includes('nhẹ')) speed = 'low';
        else if (lowerText.includes('trung bình') || lowerText.includes('vừa')) speed = 'medium';
        else if (lowerText.includes('nhanh') || lowerText.includes('mạnh')) speed = 'high';
      }
    }

    if (!action && device === 'light' && lowerText.includes('màu')) {
      action = 'set_color';
      if (lowerText.includes('đỏ')) color = 'red';
      else if (lowerText.includes('xanh dương')) color = 'blue';
      else if (lowerText.includes('xanh lá') || lowerText.includes('xanh lục')) color = 'green';
      else if (lowerText.includes('vàng')) color = 'yellow';
      else if (lowerText.includes('tím')) color = 'purple';
      else if (lowerText.includes('cam')) color = 'orange';
      else if (lowerText.includes('hồng')) color = 'pink';
      else if (lowerText.includes('trắng')) color = 'white';
      else if (lowerText.includes('xanh')) color = 'cyan';
    }

    const result: any = { action, device, room, original_text: text };
    if (speed !== null) result.speed = speed;
    if (color !== null) result.color = color;
    return result;
  };

  const toggleMic = () => {
    if (!isMicActive) {
      const speechRecognition = new (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition();
      if (!speechRecognition) {
        alert('Trình duyệt không hỗ trợ nhận diện giọng nói.');
        return;
      }
      
      speechRecognition.lang = 'vi-VN';
      speechRecognition.continuous = false;
      speechRecognition.interimResults = false;
      
      speechRecognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setRecognizedText(text);
        const command = parseVoiceCommand(text);
        setCommandJson(command);
      };
      
      speechRecognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsMicActive(false);
      };
      
      speechRecognition.onend = () => {
        setIsMicActive(false);
      };
      
      speechRecognition.start();

      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((mediaStream) => {
          setStream(mediaStream);
          const mediaRecorder = new MediaRecorder(mediaStream);
          setRecorder(mediaRecorder);
          const chunks: Blob[] = [];
          
          mediaRecorder.ondataavailable = (event) => {
            chunks.push(event.data);
          };
          
          mediaRecorder.onstop = () => {
            const audioBlob = new Blob(chunks, { type: 'audio/wav' });
            const url = URL.createObjectURL(audioBlob);
            setAudioUrl(url);
          };
          
          mediaRecorder.start();
          setIsMicActive(true);
        })
        .catch((error) => {
          console.error('Error accessing microphone:', error);
          alert('Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.');
          speechRecognition.stop();
        });
    } else {
      if (recorder) {
        recorder.stop();
        setRecorder(null);
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      setIsMicActive(false);
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
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-red-100/50 hover:text-red-600 cursor-pointer transition-all mt-4"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 relative">
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

        {/* Audio Player + Command Box */}
        {audioUrl && (
          <div className="fixed bottom-24 right-8 bg-white p-5 rounded-2xl shadow-2xl z-40 max-w-sm border border-gray-100">
            <p className="text-sm font-bold text-gray-800 mb-3">Phân tích giọng nói:</p>
            <audio controls src={audioUrl} className="w-full mb-3 h-10" />
            
            {recognizedText && (
              <div className="bg-gray-50 p-3 rounded-xl mb-3 border border-gray-100">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-[#6366f1]">Bạn nói: </span> 
                  "{recognizedText}"
                </p>
              </div>
            )}
            
            {commandJson && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Dữ liệu bóc tách (JSON):</p>
                <pre className="text-xs bg-gray-800 text-green-400 p-3 rounded-xl overflow-x-auto shadow-inner">
                  {JSON.stringify(commandJson, null, 2)}
                </pre>
                {sendStatus && (
                  <p className={`text-sm font-medium mt-3 flex items-center gap-2 ${sendStatus.includes('thành công') ? 'text-green-600' : 'text-amber-600'}`}>
                    <span className={`w-2 h-2 rounded-full ${sendStatus.includes('thành công') ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`}></span>
                    {sendStatus}
                  </p>
                )}
              </div>
            )}
            
            <button 
              onClick={() => { 
                setAudioUrl(null); 
                setRecognizedText(''); 
                setCommandJson(null); 
              }} 
              className="mt-2 w-full py-2 bg-gray-100 text-sm text-gray-600 hover:bg-gray-200 hover:text-gray-800 font-semibold cursor-pointer rounded-xl transition-colors"
            >
              Đóng hộp thoại
            </button>
          </div>
        )}
      </div>

      {/* Floating Mic Button */}
      <button
        onClick={toggleMic}
        className={`fixed bottom-8 right-8 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all z-40 cursor-pointer ${
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
            <span className="text-sm font-semibold text-gray-800">Đang lắng nghe...</span>
          </div>
        </div>
      )}
    </div>
  );
}