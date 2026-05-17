# YOLO HOME - Smart Home IoT Control System

Hệ thống quản lý và điều khiển thiết bị IoT thông minh (đèn, quạt, cảm biến nhiệt độ/độ ẩm) thông qua giao diện web.

---

## 1. TECH STACK

### Frontend
- **Vite 5.x** - Build tool & dev server
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Material-UI (MUI)** - Component library
- **Radix UI** - Accessible UI primitives
- **Motion** - Animation library
- **Axios** - HTTP client

### Backend
- **Flask 2.3.3** - Web framework
- **Flask-SQLAlchemy 3.0.5** - ORM
- **Flask-CORS 4.0.0** - Cross-origin support
- **PostgreSQL 14+** - Database
- **PyJWT 2.12.1** - JWT authentication
- **python-dotenv 1.0.0** - Environment variables
- **psycopg2-binary** - PostgreSQL driver

### Hardware & IoT
- **ESP32** - Microcontroller
- **Adafruit IO** - IoT cloud platform
- **ngrok** - Public tunnel for webhooks

---

## 2. PROJECT ARCHITECTURE & FLOW

```
USER -> FRONTEND (React/Vite) -> BACKEND (Flask) -> DATABASE (PostgreSQL)
                                    ^
                                    |
                         ADAFRUIT IO (MQTT)
                                    |
                                    v
                              ESP32 (Hardware)
                            (Lights, Fans, Sensors)
```

### Chi tiết Flow:

1. **User Dashboard:**
   - Xem trạng thái đèn, quạt, cảm biến
   - Hiển thị nhiệt độ & độ ẩm real-time
   - Biểu đồ lịch sử dữ liệu cảm biến (2 giờ gần nhất)

2. **User Control Devices:**
   - Bật/tắt đèn & quạt
   - Điều chỉnh màu sắc đèn (RGB color picker)
   - Điều chỉnh tốc độ quạt (slider 0-100%)

3. **Request Flow (UI -> Backend -> Adafruit -> ESP32):**
   - Frontend gửi POST request: `/api/thiet-bi/{id}/control`
   - Backend nhận JSON command: `{"action": "on|off|set_rgb|set_speed", ...}`
   - Backend gửi command tới Adafruit IO REST API
   - Adafruit relay lệnh tới ESP32 qua MQTT
   - ESP32 nhận & thực thi (bật relay, điều chỉnh GPIO)
   - ESP32 gửi status JSON ngược lại Adafruit

4. **Status Update Flow (ESP32 -> Adafruit -> Backend -> Database -> Frontend):**
   - ESP32 publish trạng thái thiết bị tới Adafruit feed
   - Adafruit trigger webhook: POST `/api/webhook/adafruit/device`
   - Backend nhận status, cập nhật table `trang_thai_thiet_bi`
   - Frontend polling (5s) GET `/api/thiet-bi` để lấy trạng thái mới
   - UI update hiển thị trạng thái mới

5. **Sensor Data Flow (ESP32 Sensors -> Adafruit -> Backend -> Database):**
   - ESP32 đọc DHT20 (nhiệt độ + độ ẩm)
   - Gửi tới Adafruit feed `yolohome-sensor`
   - Webhook gọi `/api/webhook/adafruit/sensor`
   - Backend lưu vào `trang_thai_cam_bien` & `lich_su_cam_bien`
   - Frontend hiển thị trên Dashboard

---

## 3. INSTALLATION GUIDE

### 3.1 Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- pip & npm/yarn

### 3.2 Clone Repository

```bash
git clone <your-repo-url>
cd DADN-TTNT/SourceCode
```

### 3.3 Backend Setup

#### 1. Tạo Virtual Environment

```bash
cd backend
python -m venv venv
```

#### 2. Kích hoạt Virtual Environment

**Windows PowerShell:**
```powershell
.\venv\Scripts\Activate.ps1
```

**Windows Command Prompt:**
```cmd
venv\Scripts\Activate.bat
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

#### 3. Cài đặt Dependencies

```bash
pip install -r requirements.txt
```

#### 4. Tạo File .env

Tạo file `.env` trong thư mục `backend/`:

```
# Database Configuration
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/YH_DB

```

**Các thông số cần cập nhật:**
- `your_password`: Mật khẩu PostgreSQL của bạn
- `YH_DB`: Tên database (chỉnh sửa hoặc giữ tên này)

#### 5. Tạo Database & Load Schema

```bash
# Tạo database
psql -U postgres -h localhost -c "CREATE DATABASE YH_DB;"

# Load SQL schema
psql -U postgres -h localhost YH_DB < ../databaseIOT.sql
```

#### 6. Chạy Backend Server

```bash
python app.py
```

Backend sẽ chạy tại: **http://localhost:5000**

---

### 3.4 Frontend Setup

#### 1. Cài đặt Dependencies

```bash
cd frontend
npm install
```

#### 2. Chạy Dev Server

```bash
npm run dev
```

Frontend sẽ chạy tại: **http://localhost:5173**

---

## 4. RUNNING THE PROJECT

### Step-by-Step:

#### Terminal 1 - Backend:
```bash
cd backend
.\venv\Scripts\Activate.ps1  # Activate virtual env
python app.py               # Chạy Flask server
```

#### Terminal 2 - Frontend:
```bash
cd frontend
npm run dev                 # Chạy Vite dev server
```

#### Terminal 3 - ngrok (nếu connect ESP32):
```bash
cd backend
python start_ngrok.py       # Khởi động ngrok tunnel
```

#### Truy cập ứng dụng:
```
http://localhost:5173
```

---

## 5. DEFAULT LOGIN

Sau khi load databaseIOT.sql, sử dụng tài khoản test:

```
Email: admin@hcmut.edu.vn
Password: HK252@
```

---

## 6. API ENDPOINTS

### Authentication
- `POST /api/auth/login` - Đăng nhập, trả JWT token

### Devices Control
- `GET /api/thiet-bi` - Lấy danh sách tất cả thiết bị
- `GET /api/thiet-bi/{id}` - Lấy chi tiết thiết bị
- `POST /api/thiet-bi/{id}/control` - Điều khiển thiết bị (bật/tắt, đổi màu, etc)
  - Body: `{"action": "on|off|set_rgb|set_speed", "data": {...}}`

### Sensors
- `GET /api/cam-bien` - Lấy danh sách cảm biến
- `GET /api/cam-bien/devices` - Lấy trạng thái cảm biến (nhiệt độ, độ ẩm)

### Webhooks (Adafruit callback)
- `POST /api/webhook/adafruit/device` - Nhận cập nhật trạng thái thiết bị
- `POST /api/webhook/adafruit/sensor` - Nhận dữ liệu cảm biến

---

## 7. DATABASE SCHEMA

Main tables:
- `nha` - Thông tin nhà (home)
- `nguoi_dung` - User accounts
- `thiet_bi` - Devices (lights, fans, sensors)
- `trang_thai_thiet_bi` - Current device status
- `trang_thai_cam_bien` - Current sensor readings
- `lich_su_cam_bien` - Sensor history
- `adafruit_feed_mapping` - Map Adafruit feeds to devices

---

## 8. TROUBLESHOOTING

### Backend won't start
- Check `.env` file exists & có DATABASE_URL correct
- PostgreSQL service chạy? `psql -U postgres -h localhost` test
- Virtual env activate rồi chưa?

### Frontend fetch error
- Backend server chạy ở port 5000 chưa?
- JWT token hết hạn? Đăng nhập lại

### Sensor data không update
- Check Adafruit credentials trong `.env`
- Webhook URL trong Adafruit applet đúng không?

---

## 9. PRODUCTION BUILD

### Frontend:
```bash
cd frontend
npm run build
```

Output sẽ ở `frontend/dist/`

### Backend:
- Thay đổi `FLASK_ENV=production` trong `.env`
- Deploy lên server với gunicorn hoặc waitress

---

## Face++ face login

Backend Flask hỗ trợ đăng nhập bằng khuôn mặt song song với đăng nhập mật khẩu:

- `GET /api/faces/status`: kiểm tra đã có khuôn mặt đăng ký chưa.
- `POST /api/faces/challenge`: tạo challenge head-pose dùng một lần, hết hạn sau 60 giây.
- `POST /api/auth/face-login`: xác thực các frame theo challenge và trả token cùng format với password login.
- `GET /api/faces`, `POST /api/faces`, `DELETE /api/faces/:id`: quản lý khuôn mặt sau khi đã đăng nhập.

Cấu hình trong `webapp/backend/.env`:

```env
FACEPP_API_KEY=your_facepp_api_key
FACEPP_API_SECRET=your_facepp_api_secret
FACEPP_API_BASE=https://api-us.faceplusplus.com/facepp/v3
FACE_MATCH_THRESHOLD=75
FACE_STRICT_THRESHOLD=80
FACE_LIVENESS_MIN_POSE_DELTA=12
FACE_MAX_COMPARE_PROFILES=20
```

Không commit `.env`, ảnh khuôn mặt thật, thư mục `uploads/` hoặc `face-captures/`. Frontend có tab đăng nhập bằng khuôn mặt ở màn hình login và trang `Quản lý khuôn mặt` trong sidebar sau khi đăng nhập.
