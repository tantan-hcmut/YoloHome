from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from dotenv import load_dotenv
import os
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timezone

# 1. Tải các biến môi trường từ file .env
load_dotenv()

# 2. Khởi tạo ứng dụng Flask
app = Flask(__name__)
CORS(app)

# 3. Cấu hình kết nối Database
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key')

# 4. Khởi tạo SQLAlchemy
from models import db
db.init_app(app)

# 5. Đăng ký authentication routes
from routes.auth import auth_bp
app.register_blueprint(auth_bp)

# Đăng ký route devices
from routes.devices import devices_bp
app.register_blueprint(devices_bp)

from routes.faces import faces_bp
app.register_blueprint(faces_bp)

# Đăng ký route sensors
from routes.sensors import sensors_bp
app.register_blueprint(sensors_bp)

# Đăng ký route schedules
from routes.schedules import schedules_bp
app.register_blueprint(schedules_bp)

# Đăng ký route history
from routes.history import history_bp
app.register_blueprint(history_bp)

# Đăng ký webhook Adafruit
from routes.adafruit_webhook import webhook_bp
app.register_blueprint(webhook_bp)

# ==========================================
# Background Task: Auto-sync từ Adafruit mỗi 30s
# ==========================================

def sync_sensor_from_adafruit_background():
    """
    Background task: Poll Adafruit feeds mỗi 30 giây
    """
    with app.app_context():
        from utils.adafruit_sync import sync_sensor_data_from_adafruit
        success, _, _, message = sync_sensor_data_from_adafruit()
        
        if success:
            print(f"[Sync] {datetime.now(timezone.utc).isoformat()} - {message}")
        else:
            # Only log brief messages, not full output
            if "Feeds not found" not in message:
                print(f"[Sync] {message}")

def check_and_execute_schedules_background():
    """
    Quét và thực thi lịch trình dựa trên giờ hẹn (TIME) và lặp lại.
    Hỗ trợ ngày cụ thể và tự động tắt lịch (One-time schedule).
    """
    with app.app_context():
        from models import db, LichTrinh, ThietBi, TrangThaiThietBi, LichSuHoatDong
        from routes.devices import send_command_to_adafruit
        from datetime import datetime

        now = datetime.now()
        current_time = now.time()
        current_weekday = now.weekday()
        today_str = now.strftime('%Y-%m-%d') # Lấy chuỗi ngày hôm nay YYYY-MM-DD

        tasks = LichTrinh.query.filter_by(trang_thai_kich_hoat=True).all()

        for task in tasks:
            # Kiểm tra giờ hẹn
            if task.thoi_gian_hen.hour != current_time.hour or task.thoi_gian_hen.minute != current_time.minute:
                continue
            
            # Kiểm tra điều kiện lặp lại
            repeat = task.ngay_trong_tuan or 'Daily'
            is_today_valid = False
            is_one_time = False
            
            if repeat == 'Daily':
                is_today_valid = True
            elif repeat == 'Weekdays' and current_weekday < 5:
                is_today_valid = True
            elif repeat == 'Weekends' and current_weekday >= 5:
                is_today_valid = True
            elif repeat == today_str: # NẾU LÀ NGÀY CỤ THỂ TRÙNG HÔM NAY
                is_today_valid = True
                is_one_time = True
                
            if not is_today_valid:
                continue

            device = ThietBi.query.get(task.thiet_bi_id)
            if not device:
                continue
            
            # Thực thi lệnh dựa trên trạng thái hiện tại của thiết bị để tránh gửi lệnh thừa nếu đã ở trạng thái mong muốn
            action = task.trang_thai_thiet_bi_muon_dat
            state = TrangThaiThietBi.query.filter_by(thiet_bi_id=device.id).first()
            is_on = state.trang_thai_bat_tat if state else False
            
            if action == 'off' and not is_on:
                pass # Đã tắt, bỏ qua lệnh nhưng vẫn cho code chạy tiếp để tự hủy lịch
            elif action == 'on' and is_on:
                pass # Đã bật, bỏ qua lệnh
            else:
                print(f"[Hẹn Giờ] THỰC THI lệnh {action.upper()} cho {device.ten_thiet_bi}")
                command = {'action': 'on' if action == 'on' else 'off', 'source': 'schedule'}
                if action == 'on':
                    command['action'] = 'light_on' if device.loai_thiet_bi == 'den' else 'fan_on'
                else:
                    command['action'] = 'light_off' if device.loai_thiet_bi == 'den' else 'fan_off'
                
                send_command_to_adafruit(command, device.loai_thiet_bi)
                
                if state:
                    state.trang_thai_bat_tat = (action == 'on')
                
                new_history = LichSuHoatDong(
                    nha_id=task.nha_id,
                    thiet_bi_id=device.id,
                    user_id=None,
                    hanh_dong=f"Auto Schedule: {action.upper()}",
                    thong_so_thay_doi=action,
                    thoi_gian=now
                )
                db.session.add(new_history)

            # Tự động tắt lịch nếu là lịch hẹn 1 lần (One-time schedule)
            if is_one_time:
                task.trang_thai_kich_hoat = False
                print(f"[Hẹn Giờ] Đã tự động tắt lịch '{task.ten_lich_trinh}' vì chỉ hẹn 1 lần.")

        db.session.commit()

# Initialize APScheduler
scheduler = BackgroundScheduler()
scheduler.add_job(
    func=check_and_execute_schedules_background,
    trigger="interval",
    seconds=10,
    id="execute_schedules",
    name="Check schedules every 10s",
    replace_existing=True
)
scheduler.start()
print("[Scheduler] Background sync task started (every 10s)")

with app.app_context():
    db.create_all()


# ==========================================
# Home route
# ==========================================
@app.route('/', methods=['GET'])
def home():
    return jsonify({"message": "YOLO-HOME Backend API"}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)
