# YoloHome

YoloHome là hệ thống IoT thông minh sử dụng **ESP32 + TinyML + Web Dashboard** để giám sát và điều khiển môi trường theo thời gian thực.

## 🚀 Tổng quan hệ thống

Hệ thống gồm 3 thành phần chính:

- **Firmware (ESP32)**: đọc dữ liệu cảm biến, chạy TinyML, điều khiển thiết bị
- **TinyML Training**: huấn luyện model và xuất ra file `.h` để dùng trong firmware
- **Web Dashboard**: giao diện web để theo dõi và điều khiển
