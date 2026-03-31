"""
Webhook để nhận dữ liệu từ Adafruit IO
Adafruit sẽ POST JSON tới đây khi dữ liệu thay đổi
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from models import db, ThietBi, TrangThaiCamBien, LichSuCamBien, TrangThaiThietBi, AdafruitFeedMapping

webhook_bp = Blueprint('webhook', __name__, url_prefix='/api/webhook')


@webhook_bp.route('/adafruit/sensor', methods=['POST'])
def adafruit_sensor_webhook():
    """
    Nhận dữ liệu cảm biến từ Adafruit.
    Adafruit sẽ POST JSON như:
    {
        "feed_key": "yolohome-temp",
        "value": 27.5,
        "created_at": "2026-03-28T10:00:00Z"
    }
    
    Lookup device_id từ bảng adafruit_feed_mapping
    """
    try:
        payload = request.get_json()
        
        if not payload:
            return jsonify({'status': 'error', 'message': 'No JSON body'}), 400
        
        feed_key = payload.get('feed_key', '')
        value = payload.get('value')
        
        # Lookup feed → device ID từ database
        mapping = AdafruitFeedMapping.query.filter_by(feed_key=feed_key).first()
        if not mapping:
            return jsonify({'status': 'error', 'message': f'Unknown feed: {feed_key}'}), 400
        
        device_id = mapping.thiet_bi_id
        
        # Kiểm tra thiết bị có tồn tại không
        device = ThietBi.query.filter_by(id=device_id).first()
        if not device:
            return jsonify({'status': 'error', 'message': f'Device {device_id} not found'}), 404
        
        # Cập nhật hoặc tạo TrangThaiCamBien (current state)
        sensor_state = TrangThaiCamBien.query.filter_by(thiet_bi_id=device_id).first()
        
        if not sensor_state:
            sensor_state = TrangThaiCamBien(thiet_bi_id=device_id)
            db.session.add(sensor_state)
        
        # Ghi giá trị tương ứng dựa trên sensor_type từ mapping
        if mapping.sensor_type == 'temperature':
            sensor_state.nhiet_do = float(value)
            history_nhiet_do = float(value)
            history_do_am = None
        elif mapping.sensor_type == 'humidity':
            sensor_state.do_am = float(value)
            history_nhiet_do = None
            history_do_am = float(value)
        else:
            history_nhiet_do = None
            history_do_am = None
        
        sensor_state.thoi_gian_cap_nhat = datetime.utcnow()
        
        # Lưu history
        history = LichSuCamBien(
            thiet_bi_id=device_id,
            nhiet_do=history_nhiet_do,
            do_am=history_do_am,
            thoi_gian_ghi_nhan=datetime.utcnow()
        )
        db.session.add(history)
        db.session.commit()
        
        print(f"[Webhook] {feed_key} (type={mapping.sensor_type}) = {value} → {device_id}")
        
        return jsonify({
            'status': 'success',
            'message': f'Received {feed_key}: {value}',
            'device_id': device_id,
            'sensor_type': mapping.sensor_type
        }), 200
        
    except ValueError as e:
        return jsonify({'status': 'error', 'message': f'Invalid value: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500


@webhook_bp.route('/adafruit/device', methods=['POST'])
def adafruit_device_webhook():
    """
    Nhận thay đổi trạng thái thiết bị từ Adafruit / local dashboard.
    JSON format:
    {
        "feed_key": "yolohome-light",
        "action": "on|off|set_rgb",
        "value": "1|0",
        "brightness": 96,
        "r": 255, "g": 255, "b": 255
    }
    
    Feed mapping:
    - yolohome-light → DEN_001, DEN_002, DEN_003
    - yolohome-fan → QUAT_001, QUAT_002
    """
    try:
        payload = request.get_json()
        
        if not payload:
            return jsonify({'status': 'error', 'message': 'No JSON body'}), 400
        
        feed_key = payload.get('feed_key', '')
        action = payload.get('action', '')
        value = payload.get('value')
        brightness = payload.get('brightness', 96)
        r = payload.get('r', 255)
        g = payload.get('g', 255)
        b = payload.get('b', 255)
        
        # Map feed → device list
        feed_device_map = {
            'yolohome-light': ['DEN_001', 'DEN_002', 'DEN_003'],
            'yolohome-fan': ['QUAT_001', 'QUAT_002']
        }
        
        devices = feed_device_map.get(feed_key)
        if not devices:
            return jsonify({'status': 'error', 'message': f'Unknown feed: {feed_key}'}), 400
        
        # Cập nhật tất cả devices loại đó
        updated_count = 0
        for device_id in devices:
            device = ThietBi.query.filter_by(id=device_id).first()
            if not device:
                continue
            
            if not device.trang_thai:
                device.trang_thai = TrangThaiThietBi(thiet_bi_id=device_id)
                db.session.add(device.trang_thai)
            
            # Parse action
            if action == 'on' or value == '1':
                device.trang_thai.trang_thai_bat_tat = True
                device.trang_thai.toc_do = 100
            elif action == 'off' or value == '0':
                device.trang_thai.trang_thai_bat_tat = False
                device.trang_thai.toc_do = 0
            elif action == 'set_rgb':
                device.trang_thai.trang_thai_bat_tat = True
                device.trang_thai.mau_sac = f'#{r:02x}{g:02x}{b:02x}'
            elif action == 'set_speed':
                device.trang_thai.toc_do = int(value) if value else 50
            
            updated_count += 1
        
        db.session.commit()
        
        print(f"[Webhook] {feed_key} {action} → {updated_count} devices")
        
        return jsonify({
            'status': 'success',
            'message': f'Updated {updated_count} devices',
            'feed_key': feed_key,
            'action': action
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500
