DROP TABLE IF EXISTS lich_su_tieu_thu_dien CASCADE;
DROP TABLE IF EXISTS lich_su_cam_bien CASCADE;
DROP TABLE IF EXISTS trang_thai_cam_bien CASCADE;
DROP TABLE IF EXISTS lich_su_hoat_dong CASCADE;
DROP TABLE IF EXISTS lich_trinh CASCADE;
DROP TABLE IF EXISTS trang_thai_thiet_bi CASCADE;
DROP TABLE IF EXISTS adafruit_feed_mapping CASCADE;
DROP TABLE IF EXISTS thiet_bi CASCADE;
DROP TABLE IF EXISTS nguoi_dung_nha CASCADE;
DROP TABLE IF EXISTS nha CASCADE;
DROP TABLE IF EXISTS nguoi_dung CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE nguoi_dung (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    mat_khau VARCHAR(255) NOT NULL,
    ho_va_ten VARCHAR(255) NOT NULL,
    vai_tro VARCHAR(50) DEFAULT 'user',
    du_lieu_khuon_mat TEXT,
    trang_thai_cap_quyen BOOLEAN DEFAULT TRUE
);

CREATE TABLE nha (
    id VARCHAR(50) PRIMARY KEY,
    ten_nha VARCHAR(255) NOT NULL,
    adafruit_username VARCHAR(255),
    adafruit_key VARCHAR(255)
);

CREATE TABLE nguoi_dung_nha (
    user_id INT REFERENCES nguoi_dung(id) ON DELETE CASCADE,
    nha_id VARCHAR(50) REFERENCES nha(id) ON DELETE CASCADE,
    vai_tro_trong_nha VARCHAR(50) NOT NULL,
    PRIMARY KEY (user_id, nha_id)
);

CREATE TABLE thiet_bi (
    id VARCHAR(50) PRIMARY KEY,
    nha_id VARCHAR(50) REFERENCES nha(id) ON DELETE CASCADE,
    ten_thiet_bi VARCHAR(255) NOT NULL,
    loai_thiet_bi VARCHAR(50) NOT NULL,
    nha_san_xuat VARCHAR(255),
    vi_tri_lap_dat VARCHAR(255),
    ngay_kich_hoat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trang_thai_thiet_bi (
    thiet_bi_id VARCHAR(50) PRIMARY KEY REFERENCES thiet_bi(id) ON DELETE CASCADE,
    trang_thai_bat_tat BOOLEAN DEFAULT FALSE,
    toc_do INT DEFAULT 0,
    mau_sac VARCHAR(50) DEFAULT '#FFFFFF'
);

CREATE TABLE adafruit_feed_mapping (
    id SERIAL PRIMARY KEY,
    feed_key VARCHAR(100) UNIQUE NOT NULL,
    thiet_bi_id VARCHAR(50) REFERENCES thiet_bi(id) ON DELETE CASCADE,
    sensor_type VARCHAR(50), 
    config JSON DEFAULT '{}'  
);
CREATE INDEX idx_feed_key ON adafruit_feed_mapping(feed_key);

CREATE TABLE lich_trinh (
    id SERIAL PRIMARY KEY,
    thiet_bi_id VARCHAR(50) REFERENCES thiet_bi(id) ON DELETE CASCADE,
    thoi_gian_hen TIME NOT NULL,
    ngay_trong_tuan VARCHAR(100),
    trang_thai_thiet_bi_muon_dat VARCHAR(50),
    trang_thai_kich_hoat BOOLEAN DEFAULT TRUE
);

CREATE TABLE lich_su_hoat_dong (
    id SERIAL PRIMARY KEY,
    thiet_bi_id VARCHAR(50) REFERENCES thiet_bi(id) ON DELETE CASCADE,
    user_id INT REFERENCES nguoi_dung(id) ON DELETE SET NULL,
    hanh_dong VARCHAR(255) NOT NULL,
    thong_so_thay_doi VARCHAR(255),
    thoi_gian TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trang_thai_cam_bien (
    thiet_bi_id VARCHAR(50) PRIMARY KEY REFERENCES thiet_bi(id) ON DELETE CASCADE,
    nhiet_do FLOAT, 
    do_am FLOAT,    
    thoi_gian_cap_nhat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lich_su_cam_bien (
    id SERIAL PRIMARY KEY,
    thiet_bi_id VARCHAR(50) REFERENCES thiet_bi(id) ON DELETE CASCADE,
    nhiet_do FLOAT,
    do_am FLOAT,
    thoi_gian_ghi_nhan TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_cam_bien_thoi_gian ON lich_su_cam_bien(thoi_gian_ghi_nhan);
CREATE INDEX idx_cam_bien_thiet_bi ON lich_su_cam_bien(thiet_bi_id);

CREATE TABLE lich_su_tieu_thu_dien (
    id SERIAL PRIMARY KEY,
    thiet_bi_id VARCHAR(50) REFERENCES thiet_bi(id) ON DELETE CASCADE,
    dien_nang_tieu_thu FLOAT NOT NULL, 
    thoi_gian_ghi_nhan TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
);
CREATE INDEX idx_tieu_thu_thiet_bi ON lich_su_tieu_thu_dien(thiet_bi_id);
CREATE INDEX idx_tieu_thu_thoi_gian ON lich_su_tieu_thu_dien(thoi_gian_ghi_nhan);


-- ==========================================================
-- THÊM DỮ LIỆU MẪU ĐỂ TEST
-- ==========================================================

INSERT INTO nguoi_dung (email, mat_khau, ho_va_ten, vai_tro) 
VALUES ('admin@hcmut.edu.vn', 'HK252@', 'Admin YoloHome', 'chu_nha');

INSERT INTO nha (id, ten_nha, adafruit_username, adafruit_key) 
VALUES ('HOME_001', 'Nhà thông minh HCMUT', 'yolo_student', 'aio_key_123456789');

INSERT INTO nguoi_dung_nha (user_id, nha_id, vai_tro_trong_nha) 
VALUES (1, 'HOME_001', 'chu_nha');

INSERT INTO thiet_bi (id, nha_id, ten_thiet_bi, loai_thiet_bi, nha_san_xuat, vi_tri_lap_dat) 
VALUES 
    ('DEN_001', 'HOME_001', 'Đèn Phòng Khách', 'den', 'Rạng Đông', 'Phòng Khách'),
    ('QUAT_001', 'HOME_001', 'Quạt Trần', 'quat', 'Panasonic', 'Phòng Khách'),
    ('SENSOR_001', 'HOME_001', 'Cảm Biến Nhiệt Độ & Độ Ẩm', 'sensor', 'DHT20', 'Phòng Khách');

INSERT INTO trang_thai_thiet_bi (thiet_bi_id, trang_thai_bat_tat, toc_do, mau_sac) 
VALUES 
    ('DEN_001', TRUE, 0, '#FFFFFF'), 
    ('QUAT_001', TRUE, 50, '#000000');

-- Thêm dữ liệu mẫu vào trang_thai_cam_bien (trạng thái hiện tại)
-- Sẽ được cập nhật từ Adafruit feed khi ESP32 connect

-- Thêm dữ liệu lịch sử cảm biến để test Dashboard chart
-- Sẽ được tự động thêm từ background sync task
-- INSERT INTO lich_su_cam_bien (thiet_bi_id, nhiet_do, do_am, thoi_gian_ghi_nhan) 
-- VALUES 
--     ('SENSOR_001', 25.0, 62.0, CURRENT_TIMESTAMP - INTERVAL '2 hours'),
--     ('SENSOR_001', 26.2, 63.5, CURRENT_TIMESTAMP - INTERVAL '1 hour 30 minutes'),
--     ('SENSOR_001', 27.1, 64.2, CURRENT_TIMESTAMP - INTERVAL '1 hour'),
--     ('SENSOR_001', 27.5, 65.0, CURRENT_TIMESTAMP);

-- Bảng Adafruit Feed Mapping - Liên kết feed từ Adafruit với thiết bị trong hệ thống
INSERT INTO adafruit_feed_mapping (feed_key, thiet_bi_id, sensor_type, config) 
VALUES 
    ('yolohome-temp', 'SENSOR_001', 'temperature', '{"unit":"celsius","min":0,"max":50}'),
    ('yolohome-humi', 'SENSOR_001', 'humidity', '{"unit":"percent","min":0,"max":100}'),
    ('yolohome-light', 'DEN_001', 'light', '{"has_rgb":true,"has_brightness":true}'),
    ('yolohome-fan', 'QUAT_001', 'fan', '{"min_speed":0,"max_speed":100}');

SELECT * FROM nguoi_dung;
SELECT * FROM thiet_bi;
SELECT * FROM trang_thai_cam_bien;
SELECT * FROM adafruit_feed_mapping;