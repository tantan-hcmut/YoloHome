from flask import Blueprint, request, jsonify
from models import db, TrangThaiCamBien, LichSuCamBien, ThietBi, TrangThaiThietBi, Nha
from utils.security import require_auth
from datetime import datetime, timedelta, timezone
import json
import requests

sensors_bp = Blueprint('sensors', __name__, url_prefix='/api/cam-bien')


def get_last_adafruit_value(feed_suffix):
    house = Nha.query.filter(
        Nha.adafruit_username.isnot(None),
        Nha.adafruit_key.isnot(None)
    ).first()

    if not house or not house.adafruit_username or not house.adafruit_key:
        return None

    user = house.adafruit_username.strip()
    key = house.adafruit_key.strip()
    group = house.adafruit_group_key.strip() if house.adafruit_group_key else 'yolohome'
    feed_key = f'{group}.yolohome-{feed_suffix}'
    url = f'https://io.adafruit.com/api/v2/{user}/feeds/{feed_key}/data/last'
    response = requests.get(url, headers={'X-AIO-Key': key}, timeout=4)
    if response.status_code not in [200, 201]:
        return None

    return response.json().get('value')


def override_mode_to_text(value, fallback=None):
    if isinstance(value, str):
        normalized = value.strip().upper()
        if normalized in ['AUTO', 'FORCED_ON', 'FORCE_ON', 'FORCE-ON']:
            return 'FORCE_ON' if normalized != 'AUTO' else 'AUTO'
        if normalized in ['FORCED_OFF', 'FORCE_OFF', 'FORCE-OFF']:
            return 'FORCE_OFF'

    try:
        mode = int(value)
        if mode == 1:
            return 'FORCE_ON'
        if mode == 2:
            return 'FORCE_OFF'
        return 'AUTO'
    except (TypeError, ValueError):
        return fallback or 'AUTO'

# Helper: Convert UTC to Vietnam time (UTC+7)
def to_vietnam_time(utc_datetime):
    """Convert UTC datetime to Vietnam time (UTC+7) and return formatted string"""
    if utc_datetime is None:
        return None
    # Ensure it's timezone-aware
    if utc_datetime.tzinfo is None:
        utc_datetime = utc_datetime.replace(tzinfo=timezone.utc)
    vn_tz = timezone(timedelta(hours=7))
    vn_time = utc_datetime.astimezone(vn_tz)
    return vn_time.isoformat()  # Returns format like "2026-03-29T12:25:11+07:00"


@sensors_bp.route('', methods=['GET'])
@require_auth
def get_all_sensor_data():
    """
    GET /api/cam-bien
    Lấy dữ liệu cảm biến mới nhất từ tất cả cảm biến
    """
    try:
        sensors = TrangThaiCamBien.query.all()
        
        result = []
        for sensor in sensors:
            device = ThietBi.query.filter_by(id=sensor.thiet_bi_id).first()
            result.append({
                'id': sensor.thiet_bi_id,
                'thiet_bi_id': sensor.thiet_bi_id,
                'thiet_bi_ten': device.ten_thiet_bi if device else 'Unknown',
                'nhiet_do': sensor.nhiet_do,
                'do_am': sensor.do_am,
                'thoi_gian_cap_nhat': sensor.thoi_gian_cap_nhat.isoformat() if sensor.thoi_gian_cap_nhat else None,
                'thoi_gian_hien_thi': to_vietnam_time(sensor.thoi_gian_cap_nhat)  # Giờ Việt Nam
            })
        
        return jsonify({'status': 'success', 'data': result}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@sensors_bp.route('/runtime', methods=['GET'])
@require_auth
def get_runtime_state():
    try:
        telemetry_value = get_last_adafruit_value('telemetry')
        status_value = get_last_adafruit_value('status')

        telemetry = {}
        if telemetry_value:
            try:
                telemetry = json.loads(telemetry_value)
            except (TypeError, ValueError, json.JSONDecodeError):
                telemetry = {}

        override_text = override_mode_to_text(
            telemetry.get('overrideMode'),
            override_mode_to_text(status_value, 'AUTO')
        )

        latest_sensor = TrangThaiCamBien.query.order_by(
            TrangThaiCamBien.thoi_gian_cap_nhat.desc()
        ).first()

        return jsonify({
            'status': 'success',
            'data': {
                'overrideMode': telemetry.get('overrideMode'),
                'overrideModeText': override_text,
                'statusText': status_value,
                'fanOn': telemetry.get('fanOn'),
                'fanSpeedPercent': telemetry.get('fanSpeedPercent'),
                'autoFanRequest': telemetry.get('autoFanRequest'),
                'tinymlHot': telemetry.get('tinymlHot'),
                'tinymlScore': telemetry.get('tinymlScore'),
                'tinymlSmooth': telemetry.get('tinymlSmooth'),
                'aiCoolingElapsedMs': telemetry.get('aiCoolingElapsedMs'),
                'aiTargetFanSpeedPercent': telemetry.get('aiTargetFanSpeedPercent'),
                'temperature': telemetry.get('temp', latest_sensor.nhiet_do if latest_sensor else None),
                'humidity': telemetry.get('humi', latest_sensor.do_am if latest_sensor else None),
                'sensorValid': telemetry.get('sensorValid'),
                'updatedAt': datetime.utcnow().isoformat()
            }
        }), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@sensors_bp.route('/latest', methods=['GET'])
@require_auth
def get_latest_sensor_data():
    """
    GET /api/cam-bien/latest
    Lấy dữ liệu cảm biến LATEST bằng cách FORCE SYNC từ Adafruit ngay
    Dùng cho room status display - luôn hiển thị dữ liệu mới nhất
    """
    try:
        from utils.adafruit_sync import sync_sensor_data_from_adafruit
        
        # Force sync ngay lập tức trước khi trả về
        success, temp, humi, message = sync_sensor_data_from_adafruit()
        
        if success:
            # Lấy sensor vừa cập nhật
            sensors = TrangThaiCamBien.query.all()
            result = []
            for sensor in sensors:
                result.append({
                    'thiet_bi_id': sensor.thiet_bi_id,
                    'nhiet_do': sensor.nhiet_do,
                    'do_am': sensor.do_am,
                    'thoi_gian_cap_nhat': sensor.thoi_gian_cap_nhat.isoformat() if sensor.thoi_gian_cap_nhat else None,
                    'thoi_gian_hien_thi': to_vietnam_time(sensor.thoi_gian_cap_nhat)  # Giờ Việt Nam
                })
            
            return jsonify({
                'status': 'success', 
                'data': result,
                'sync_message': message
            }), 200
        else:
            # Nếu sync thất bại, vẫn trả dữ liệu cũ trong DB
            sensors = TrangThaiCamBien.query.all()
            result = []
            for sensor in sensors:
                result.append({
                    'thiet_bi_id': sensor.thiet_bi_id,
                    'nhiet_do': sensor.nhiet_do,
                    'do_am': sensor.do_am,
                    'thoi_gian_cap_nhat': sensor.thoi_gian_cap_nhat.isoformat() if sensor.thoi_gian_cap_nhat else None,
                    'thoi_gian_hien_thi': to_vietnam_time(sensor.thoi_gian_cap_nhat)
                })
            
            return jsonify({
                'status': 'warning',
                'message': f'Không sync được: {message}',
                'data': result  # Trả dữ liệu cũ
            }), 200
            
    except Exception as e:
        print(f"[Error] {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@sensors_bp.route('/sync-from-adafruit', methods=['POST'])
@require_auth
def sync_sensor_from_adafruit():
    """
    POST /api/cam-bien/sync-from-adafruit
    Lấy dữ liệu mới nhất từ Adafruit feeds và cập nhật database
    Gọi endpoint này mỗi khi cần sync dữ liệu từ Adafruit
    """
    try:
        from utils.adafruit_sync import sync_sensor_data_from_adafruit
        
        success, temp_value, humi_value, message = sync_sensor_data_from_adafruit()
        
        if success:
            # Lấy sensor vừa cập nhật để trả về
            sensor = TrangThaiCamBien.query.filter_by(thiet_bi_id='SENSOR_001').first()
            return jsonify({
                'status': 'success',
                'data': {
                    'thiet_bi_id': 'SENSOR_001',
                    'nhiet_do': temp_value,
                    'do_am': humi_value,
                    'thoi_gian_cap_nhat': sensor.thoi_gian_cap_nhat.isoformat(),
                    'thoi_gian_hien_thi': to_vietnam_time(sensor.thoi_gian_cap_nhat)  # Giờ Việt Nam
                }
            }), 200
        else:
            return jsonify({'status': 'error', 'message': message}), 400
        
    except Exception as e:
        print(f"[Sync Error] {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': str(e)}), 500



@sensors_bp.route('/devices', methods=['GET'])
@require_auth
def get_all_devices_with_sensors():
    """
    GET /api/cam-bien/devices
    Lấy devices điều khiển (DEN, QUAT) - LOẠI BỎ SENSOR
    Sensor data chỉ dùng cho Dashboard charts, không hiển thị ở Devices page
    """
    try:
        # Chỉ lấy thiết bị điều khiển (den, quat), BỎ sensor
        devices = ThietBi.query.filter(ThietBi.loai_thiet_bi.in_(['den', 'quat'])).all()
        
        result = []
        for device in devices:
            device_data = {
                'id': device.id,
                'nha_id': device.nha_id,
                'ten_thiet_bi': device.ten_thiet_bi,
                'loai_thiet_bi': device.loai_thiet_bi,
                'nha_san_xuat': device.nha_san_xuat,
                'vi_tri_lap_dat': device.vi_tri_lap_dat,
                'ngay_kich_hoat': device.ngay_kich_hoat.isoformat() if device.ngay_kich_hoat else None
            }
            
            # Thêm trạng thái nếu là device (LED, FAN)
            if device.trang_thai:
                device_data['trang_thai'] = {
                    'trang_thai_bat_tat': device.trang_thai.trang_thai_bat_tat,
                    'toc_do': device.trang_thai.toc_do,
                    'mau_sac': device.trang_thai.mau_sac
                }
            
            result.append(device_data)
        
        return jsonify({'status': 'success', 'data': result}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@sensors_bp.route('/<thiet_bi_id>', methods=['GET'])
@require_auth
def get_sensor_by_device(thiet_bi_id):
    """
    GET /api/cam-bien/<thiet_bi_id>
    Lấy dữ liệu cảm biến mới nhất của một thiết bị
    """
    try:
        sensor = TrangThaiCamBien.query.filter_by(thiet_bi_id=thiet_bi_id).first()
        
        if not sensor:
            return jsonify({'status': 'error', 'message': 'Cảm biến không tìm thấy'}), 404
        
        device = ThietBi.query.filter_by(id=thiet_bi_id).first()
        
        return jsonify({
            'status': 'success',
            'data': {
                'id': sensor.thiet_bi_id,
                'thiet_bi_id': sensor.thiet_bi_id,
                'thiet_bi_ten': device.ten_thiet_bi if device else 'Unknown',
                'nhiet_do': sensor.nhiet_do,
                'do_am': sensor.do_am,
                'thoi_gian_cap_nhat': sensor.thoi_gian_cap_nhat.isoformat() if sensor.thoi_gian_cap_nhat else None
            }
        }), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@sensors_bp.route('/<thiet_bi_id>/lich-su', methods=['GET'])
@require_auth
def get_sensor_history(thiet_bi_id):
    """
    GET /api/cam-bien/<thiet_bi_id>/lich-su?limit=24&hours=24
    Lấy lịch sử dữ liệu cảm biến (mặc định 24 giờ gần nhất, max 100 records)
    """
    try:
        hours = request.args.get('hours', 24, type=int)
        limit = request.args.get('limit', 100, type=int)
        
        # Tính thời gian bắt đầu
        start_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        history = LichSuCamBien.query.filter_by(thiet_bi_id=thiet_bi_id).filter(
            LichSuCamBien.thoi_gian_ghi_nhan >= start_time
        ).order_by(LichSuCamBien.thoi_gian_ghi_nhan.desc()).limit(limit).all()
        
        if not history:
            return jsonify({
                'status': 'success',
                'data': [],
                'message': f'Không có dữ liệu từ {hours} giờ trước'
            }), 200
        
        # Reverse để hiển thị theo thứ tự thời gian tăng dần
        history.reverse()
        
        device = ThietBi.query.filter_by(id=thiet_bi_id).first()
        
        return jsonify({
            'status': 'success',
            'thiet_bi_ten': device.ten_thiet_bi if device else 'Unknown',
            'data': [{
                'id': h.id,
                'thiet_bi_id': h.thiet_bi_id,
                'nhiet_do': h.nhiet_do,
                'do_am': h.do_am,
                'thoi_gian_ghi_nhan': h.thoi_gian_ghi_nhan.isoformat() if h.thoi_gian_ghi_nhan else None,
                'thoi_gian_hien_thi': to_vietnam_time(h.thoi_gian_ghi_nhan)  # Giờ Việt Nam
            } for h in history]
        }), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@sensors_bp.route('/<thiet_bi_id>', methods=['POST'])
def update_sensor_data(thiet_bi_id):
    """
    POST /api/cam-bien/<thiet_bi_id>
    Cập nhật dữ liệu cảm biến (ghi dữ liệu mới nhất và lưu lịch sử)
    Body: {"nhiet_do": 27.5, "do_am": 62}
    """
    payload = request.get_json() or {}
    
    device = ThietBi.query.filter_by(id=thiet_bi_id).first()
    if not device:
        return jsonify({'status': 'error', 'message': 'Thiết bị không tìm thấy'}), 404
    
    nhiet_do = payload.get('nhiet_do')
    do_am = payload.get('do_am')
    
    try:
        # Cập nhật hoặc tạo mới TrangThaiCamBien (trạng thái hiện tại)
        sensor_state = TrangThaiCamBien.query.filter_by(thiet_bi_id=thiet_bi_id).first()
        
        if sensor_state:
            sensor_state.nhiet_do = nhiet_do
            sensor_state.do_am = do_am
            sensor_state.thoi_gian_cap_nhat = datetime.now(timezone.utc)
        else:
            sensor_state = TrangThaiCamBien(
                thiet_bi_id=thiet_bi_id,
                nhiet_do=nhiet_do,
                do_am=do_am
            )
            db.session.add(sensor_state)
        
        # Lưu vào LichSuCamBien (lịch sử)
        history = LichSuCamBien(
            thiet_bi_id=thiet_bi_id,
            nhiet_do=nhiet_do,
            do_am=do_am
        )
        db.session.add(history)
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': f'Cập nhật dữ liệu cảm biến {device.ten_thiet_bi} thành công',
            'data': sensor_state.to_dict()
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500
