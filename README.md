# YoloHome / Yolo_Uno

## 1. Giới thiệu

YoloHome là hệ thống IoT chạy trên ESP32, được xây dựng theo hướng **giám sát môi trường + điều khiển thiết bị + suy luận TinyML tại biên (edge)**. Thiết bị đọc dữ liệu nhiệt độ/độ ẩm, suy luận trạng thái bằng mô hình TinyML nhúng sẵn, sau đó tự động điều khiển quạt/đèn theo cấu hình runtime.

Hệ thống đồng thời cung cấp:
- **Web dashboard local** để giám sát và cấu hình trực tiếp
- **Wi-Fi AP/STA** để cấu hình mạng
- **WebSocket** để cập nhật dữ liệu thời gian thực
- **MQTT Adafruit IO** để đồng bộ cloud
- **LittleFS** để lưu cấu hình bền vững
- **OTA** để cập nhật firmware từ xa

---

## 2. Mục tiêu hệ thống

Dự án hướng đến một bộ điều khiển nhà thông minh cỡ nhỏ, có khả năng:
- Thu thập dữ liệu môi trường từ cảm biến
- Đánh giá trạng thái bất thường bằng TinyML
- Tự động ra quyết định điều khiển thiết bị chấp hành
- Cho phép người dùng can thiệp thủ công khi cần
- Đồng bộ trạng thái và cấu hình qua giao diện local/cloud

---

## 3. Chức năng chính

### 3.1. Giám sát môi trường
- Đọc **nhiệt độ** và **độ ẩm** từ cảm biến
- Cập nhật trạng thái theo chu kỳ
- Hiển thị dữ liệu trên giao diện web theo thời gian thực

### 3.2. TinyML tại thiết bị
- Mô hình `.tflite` được chuyển sang header C và nhúng trực tiếp vào firmware
- Suy luận từ chuỗi dữ liệu cảm biến
- Trả về điểm tin cậy hoặc phân loại để hỗ trợ logic tự động

### 3.3. Điều khiển thiết bị
- Điều khiển **quạt**
- Điều khiển **LED / RGB LED**
- Hỗ trợ **manual mode** và **auto mode**
- Có thể cấu hình ngưỡng và đặc tuyến quạt

### 3.4. Dashboard local
- Giao diện web đặt trong thư mục `data/`
- Hiển thị nhiệt độ, độ ẩm, trạng thái TinyML, tốc độ quạt, trạng thái I/O, cấu hình Wi-Fi và cloud
- Giao tiếp với ESP32 qua **WebSocket + HTTP API**

### 3.5. Kết nối mạng và cloud
- Hỗ trợ Wi-Fi:
  - **AP mode** để cấu hình ban đầu
  - **STA mode** để kết nối router
- Kết nối **Adafruit IO MQTT** để gửi nhận dữ liệu và lệnh

### 3.6. Quản lý cấu hình
- Lưu cấu hình vào **LittleFS**
- Lưu SSID/password, AIO username/key/feed prefix, ngưỡng điều khiển và tham số TinyML
- Có **factory reset** để xóa cấu hình và khởi tạo lại

---

## 4. Kiến trúc tổng quát

Luồng xử lý chính:
1. **Cảm biến** đọc nhiệt độ/độ ẩm
2. Dữ liệu được đưa vào **TinyML pipeline**
3. Kết quả suy luận được chuyển sang **control logic**
4. **Actuator task** thực thi điều khiển quạt/đèn
5. Trạng thái được phát lên:
   - **Web UI local**
   - **MQTT Adafruit IO**
6. Cấu hình được lưu bền vững bằng **LittleFS**

```text
Sensor -> TinyML -> Control Logic -> Actuator
                   -> WebSocket/UI
                   -> MQTT Cloud
```

---

## 5. Cấu trúc thư mục

```text
.
├── include/                # Header files, kiểu dữ liệu, cấu hình, khai báo task
├── src/                    # Hiện thực các task và luồng điều khiển chính
├── lib/                    # Thư viện phụ trợ
├── data/                   # Giao diện web local: HTML/CSS/JS
├── boards/                 # Cấu hình board
├── tinyml_training/        # Script train/export mô hình TinyML
├── platformio.ini          # Cấu hình build PlatformIO
└── .gitignore
```

### Một số file quan trọng

#### `include/`
- `app_types.h`: định nghĩa enum/struct dùng chung
- `global.h`: biến toàn cục, config mặc định, queue/mutex/event flag
- `hw_pins.h`: ánh xạ chân phần cứng
- `dht_anomaly_model.h`: mô hình TinyML nhúng
- `task_*.h`: interface cho từng task hệ thống

#### `src/`
- `main.cpp`: điểm vào hệ thống, khởi tạo runtime và task
- `global.cpp`: cấp phát tài nguyên dùng chung
- `temp_humi_monitor.cpp`: đọc cảm biến môi trường
- `tinyml.cpp`: suy luận mô hình TinyML
- `task_control_logic.cpp`: logic quyết định điều khiển
- `task_actuator.cpp`: điều khiển phần cứng đầu ra
- `task_webserver.cpp`: web server, websocket, OTA
- `task_wifi.cpp`: quản lý AP/STA, reconnect
- `task_handler.cpp`: xử lý message/giao tiếp runtime
- `task_adafruit_io.cpp`: MQTT Adafruit IO
- `task_status_led.cpp`: LED trạng thái hệ thống
- `task_toogle_boot.cpp`: xử lý nút BOOT / reset
- `task_check_info.cpp`: kiểm tra và nạp cấu hình

#### `data/`
- `index.html`: giao diện dashboard local
- `styles.css`: giao diện hiển thị
- `script.js`: xử lý UI, WebSocket, API tương tác

#### `tinyml_training/`
- `train_tinyml_project_model.py`: train mô hình TinyML
- `export_tflite_to_header.py`: chuyển `.tflite` sang header C
- `dataset/`: dữ liệu huấn luyện
- `output/`: file mô hình sinh ra

---

## 6. Công nghệ sử dụng

- **ESP32**
- **PlatformIO**
- **Arduino framework**
- **FreeRTOS**
- **LittleFS**
- **ESP Async WebServer / WebSocket / OTA**
- **Adafruit IO MQTT**
- **TensorFlow Lite Micro**
- **HTML / CSS / JavaScript**

---

## 7. Phần cứng dự kiến

Tùy cấu hình board thực tế, hệ thống có thể sử dụng các phần tử sau:
- ESP32
- Cảm biến nhiệt độ/độ ẩm (DHT20 hoặc tương đương)
- Quạt DC/PWM
- LED đơn trạng thái
- LED RGB
- Nút BOOT / nút cấu hình
- LCD hoặc phần tử hiển thị phụ

> Chi tiết chân kết nối xem trong `include/hw_pins.h`.

---

## 8. Yêu cầu môi trường phát triển

- **VS Code**
- **PlatformIO extension**
- Python 3.x (nếu muốn train/export lại TinyML model)

---

## 9. Hướng dẫn build và nạp firmware

### 9.1. Clone mã nguồn
```bash
git clone <repository-url>
cd <project-folder>
```

### 9.2. Build firmware
```bash
pio run
```

### 9.3. Nạp firmware cho ESP32
```bash
pio run -t upload
```

### 9.4. Upload giao diện web vào LittleFS
```bash
pio run -t uploadfs
```

### 9.5. Mở monitor serial
```bash
pio device monitor
```

---

## 10. Quy trình khởi động hệ thống

1. ESP32 khởi động
2. Nạp cấu hình từ LittleFS
3. Khởi tạo Wi-Fi
4. Khởi tạo webserver + websocket + OTA
5. Khởi tạo cảm biến, TinyML, actuator và các task runtime
6. Nếu có cấu hình cloud hợp lệ, hệ thống kết nối Adafruit IO
7. Dashboard local bắt đầu nhận dữ liệu thời gian thực

---

## 11. Dashboard local

Giao diện local được đặt trong `data/` và phục vụ bởi ESP32. Các trang/chức năng chính gồm:
- **Tổng quan hệ thống**
- **Ngoại vi & điều khiển**
- **TinyML & tự động hóa**
- **Kết nối mạng & cloud**
- **Quản lý hệ thống**
- **Thông tin tác giả**

Dashboard cho phép:
- theo dõi sensor realtime
- bật/tắt quạt, đèn
- chuyển manual/auto
- chỉnh ngưỡng tự động
- cấu hình Wi-Fi
- cấu hình MQTT Adafruit IO
- factory reset

---

## 12. TinyML training pipeline

Thư mục `tinyml_training/` dùng để huấn luyện và xuất mô hình nhúng.

### Quy trình tổng quát
1. Chuẩn bị dataset
2. Train mô hình bằng Python
3. Sinh file `.tflite`
4. Chuyển `.tflite` thành file header C
5. Chép header mới vào firmware
6. Build lại dự án

Ví dụ:
```bash
python tinyml_training/src/train_tinyml_project_model.py
python tinyml_training/src/export_tflite_to_header.py
```

> Tham số cụ thể phụ thuộc script thực tế trong thư mục `tinyml_training/`.

---

## 13. Cơ chế lưu cấu hình

Hệ thống lưu cấu hình runtime trong flash thông qua **LittleFS**. Các nhóm thông tin có thể được lưu:
- cấu hình Wi-Fi
- thông tin Adafruit IO
- ngưỡng nhiệt độ / độ ẩm
- ngưỡng AI on/off
- thời gian override manual
- đặc tuyến tốc độ quạt

Điều này giúp thiết bị **không mất cấu hình sau khi reset hoặc mất điện**.

---

## 14. Chế độ điều khiển

### Manual mode
- Người dùng chủ động bật/tắt thiết bị
- Dùng khi cần can thiệp trực tiếp
- Có thể có timeout để trả về auto mode

### Auto mode
- Hệ thống tự quyết định từ:
  - dữ liệu cảm biến
  - ngưỡng cấu hình
  - kết quả TinyML

---

## 15. Điểm kỹ thuật nổi bật

- Thiết kế theo **module/task** rõ ràng
- Có **giao diện local hoàn chỉnh**
- Có **cloud integration**
- Có **OTA**
- Có **persistent config**
- Có **TinyML inference on-device**
- Có khả năng mở rộng thêm sensor/actuator

---

## 16. Hạn chế hiện tại

- Phụ thuộc cấu hình phần cứng cụ thể của board
- Hiệu năng TinyML phụ thuộc tập dữ liệu train
- Cần hiệu chỉnh ngưỡng điều khiển để phù hợp môi trường thực tế
- Một số thành phần cloud/UI phụ thuộc cấu hình runtime hợp lệ

---

## 17. Hướng phát triển

- Mở rộng thêm cảm biến môi trường
- Ghi log lịch sử dài hạn
- Cải thiện mô hình TinyML
- Hỗ trợ nhiều profile thiết bị
- Tích hợp thêm nền tảng cloud khác
- Tối ưu dashboard và phân quyền truy cập

---

## 18. Thông tin nhóm thực hiện

Theo giao diện dự án, nhóm thực hiện thuộc **Khoa Khoa học và Kỹ thuật Máy tính**. Một số thành viên hiển thị trên dashboard gồm:
- Trần Phương Trường An
- Nguyễn Trần Đức Hoàng
- Bành Phú Hội
- Nguyễn Lâm Huy
- Nguyễn Anh Khánh Sơn
- Giang Phi Vân
- Huỳnh Duy Chương

---

## 19. Ghi chú sử dụng

- Kiểm tra đúng cấu hình chân trong `hw_pins.h` trước khi nạp
- Upload filesystem sau khi thay đổi giao diện `data/`
- Nếu đổi mô hình TinyML, cần build lại toàn bộ firmware
- Nên kiểm tra Serial Monitor khi khởi động lần đầu để xác định:
  - trạng thái Wi-Fi
  - lỗi cảm biến
  - trạng thái MQTT
  - trạng thái nạp model TinyML

---

## 20. Tóm tắt

Đây là một dự án IoT edge hoàn chỉnh trên ESP32, kết hợp:
- **cảm biến môi trường**
- **điều khiển thiết bị**
- **dashboard web local**
- **MQTT cloud**
- **TinyML nhúng tại thiết bị**

Dự án phù hợp cho các bài toán nhà thông minh, giám sát môi trường và demo hệ thống nhúng có tích hợp AI tại biên.
