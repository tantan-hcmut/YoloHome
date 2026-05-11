# YOLO HOME - Smart Home IoT Control System

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
