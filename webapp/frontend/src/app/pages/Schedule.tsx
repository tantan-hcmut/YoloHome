import { Calendar, Clock, Plus, Trash2, Power, Loader2, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { useState, useEffect } from "react";

const API_BASE_URL = "http://localhost:5000";

export function Schedule() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Form States
  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  const [repeat, setRepeat] = useState("Daily");
  const [date, setDate] = useState(""); // Thêm state cho ngày cụ thể
  const [deviceId, setDeviceId] = useState("");
  const [action, setAction] = useState("on");
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { 'Authorization': `Bearer ${token}` };
      
      try {
        const devRes = await fetch(`${API_BASE_URL}/api/thiet-bi`, { headers });
        if (devRes.ok) {
          const devData = await devRes.json();
          let devicesList = Array.isArray(devData) ? devData : (devData.data || []);
          devicesList = devicesList.filter((d: any) => d.loai_thiet_bi !== 'sensor');
          setDevices(devicesList);
          if (devicesList.length > 0 && !deviceId) {
            setDeviceId(devicesList[0].id);
          }
        }
      } catch (err) {}

      try {
        const schedRes = await fetch(`${API_BASE_URL}/api/schedules`, { headers });
        if (schedRes.ok) {
          const schedData = await schedRes.json();
          setSchedules(schedData.data || []);
        }
      } catch (err) {}

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    if (!name.trim() || !time || !deviceId) {
      setError("Vui lòng nhập đầy đủ thông tin");
      return;
    }
    
    // Nếu chọn Một ngày cụ thể thì lấy giá trị date
    const finalRepeat = repeat === "Once" ? date : repeat;
    if (repeat === "Once" && !date) {
      setError("Vui lòng chọn ngày cụ thể");
      return;
    }
    setError("");

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/schedules`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ten_lich_trinh: name.trim(),
          time: time,
          repeat: finalRepeat,
          thiet_bi_id: deviceId,
          action: action
        })
      });

      if (res.ok) {
        setShowAddModal(false);
        setName(""); setTime(""); setRepeat("Daily"); setDate("");
        fetchData();
      } else {
        setError("Tạo lịch trình thất bại");
      }
    } catch (err) {
      setError("Lỗi kết nối");
    }
  };

  const toggleSchedule = async (id: number) => {
    // Optimistic Update: Đổi trạng thái UI ngay lập tức cho mượt
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
    
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_BASE_URL}/api/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Không cần fetchData() ngay lập tức để tránh UI bị giật, interval sẽ tự lo việc đồng bộ
    } catch (err) {
      console.error(err);
      fetchData(); // Nếu lỗi thì revert lại
    }
  };

  const deleteSchedule = async (id: number) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_BASE_URL}/api/schedules/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-[#6366f1] w-8 h-8"/></div>;

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-8 mb-6 border border-white/40 shadow-xl flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Hẹn giờ tự động</h1>
          <p className="text-sm text-gray-500">Tự động bật/tắt thiết bị theo thời gian định sẵn</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowAddModal(true)}
          className="px-6 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white rounded-xl hover:shadow-lg transition-all text-sm font-semibold flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Tạo Lịch Hẹn
        </motion.button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {schedules.length === 0 ? (
          <p className="text-gray-500">Chưa có lịch hẹn nào được thiết lập.</p>
        ) : (
          schedules.map((schedule, index) => {
            const isActive = schedule.active;
            // Hiển thị format ngày đẹp nếu là lịch "1 ngày cụ thể"
            const displayRepeat = schedule.repeat.includes('-') 
              ? `Ngày ${schedule.repeat.split('-').reverse().join('/')}` 
              : schedule.repeat;
            
            return (
              <motion.div
                key={schedule.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/40 shadow-lg group ${!isActive ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`px-5 py-4 rounded-xl shrink-0 ${isActive ? 'bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]' : 'bg-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className={`w-4 h-4 ${isActive ? 'text-white/80' : 'text-gray-500'}`} />
                    </div>
                    <div className={`text-2xl font-bold tracking-wider ${isActive ? 'text-white' : 'text-gray-800'}`}>
                      {schedule.time}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-gray-800 mb-1 text-lg truncate">
                          {schedule.ten_lich_trinh || `Hẹn giờ ${schedule.thiet_bi_ten}`}
                        </h3>
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-md w-max">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{displayRepeat}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => deleteSchedule(schedule.id)} className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer">
                          <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                        </button>
                        <button
                          onClick={() => toggleSchedule(schedule.id)}
                          className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${isActive ? 'bg-[#6366f1]' : 'bg-gray-300'}`}
                        >
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <div className={`px-3 py-1.5 border rounded-lg text-xs font-bold flex items-center gap-1.5 ${schedule.action === 'on' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                        <Power className="w-3.5 h-3.5" />
                        {schedule.action === 'on' ? 'BẬT' : 'TẮT'} - {schedule.thiet_bi_ten}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Tạo lịch hẹn mới</h2>
            {error && <div className="mb-4 text-sm text-red-600 flex items-center gap-2"><AlertCircle className="w-4 h-4"/>{error}</div>}
            
            <div className="space-y-4">
              <div className="flex flex-col items-center mb-4 border-b border-gray-100 pb-4">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Chọn giờ hẹn</label>
                <input 
                  type="time" 
                  value={time} 
                  onChange={e => setTime(e.target.value)} 
                  className="text-4xl font-bold tracking-wider text-center bg-transparent outline-none border-b-2 border-gray-200 focus:border-[#6366f1] transition-colors pb-1 w-full max-w-[240px] text-gray-800" 
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Tên lịch trình</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="Ví dụ: Tắt quạt đi ngủ..." 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#6366f1] text-sm text-gray-800" 
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Lặp lại</label>
                <select value={repeat} onChange={e => setRepeat(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#6366f1] text-sm bg-white text-gray-800">
                  <option value="Daily">Hàng ngày</option>
                  <option value="Weekdays">Ngày trong tuần (T2 - T6)</option>
                  <option value="Weekends">Cuối tuần (T7, CN)</option>
                  <option value="Once">Chỉ 1 ngày cụ thể</option>
                </select>
              </div>

              {/* NẾU CHỌN NGÀY CỤ THỂ, HIỆN LÊN KHUNG CHỌN NGÀY */}
              {repeat === "Once" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">Chọn ngày</label>
                  <input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)} 
                    className="w-full px-4 py-3 border border-[#6366f1] bg-[#6366f1]/5 rounded-xl outline-none focus:ring-2 focus:ring-[#6366f1] text-sm text-gray-800" 
                  />
                </motion.div>
              )}

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Hành động</label>
                <select value={action} onChange={e => setAction(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#6366f1] text-sm bg-white text-gray-800">
                  <option value="on">BẬT thiết bị</option>
                  <option value="off">TẮT thiết bị</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Thiết bị</label>
                <select value={deviceId} onChange={e => setDeviceId(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#6366f1] text-sm bg-white text-gray-800">
                  {devices.map(d => (
                    <option key={d.id} value={d.id}>{d.ten_thiet_bi}</option>
                  ))}
                  {devices.length === 0 && <option value="">Không có thiết bị khả dụng</option>}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm cursor-pointer">Hủy</button>
              <button onClick={handleCreate} className="flex-1 px-4 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white rounded-xl hover:shadow-lg font-semibold text-sm cursor-pointer">Lưu Lịch</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}