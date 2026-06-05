from flask import Blueprint, request, jsonify, current_app
from models import db, ThietBi, Nha, TrangThaiThietBi, LichSuHoatDong
from utils.security import require_auth
import requests
import json
import os
from datetime import datetime, timedelta, timezone
import threading

devices_bp = Blueprint('devices', __name__, url_prefix='/api/thiet-bi')
FAN_AUTO_TIMEOUT_TIMER = None
FAN_AUTO_TIMEOUT_EXPIRES_AT = None
FAN_AUTO_TIMEOUT_LOCK = threading.Lock()


def get_or_create_device_state(thiet_bi_id):
    state = TrangThaiThietBi.query.filter_by(thiet_bi_id=thiet_bi_id).first()
    if not state:
        state = TrangThaiThietBi(thiet_bi_id=thiet_bi_id)
        db.session.add(state)
    return state


def clamp_brightness(value):
    try:
        return max(0, min(100, int(value)))
    except (TypeError, ValueError):
        return 96


def send_fan_auto_command(device, debug=True):
    try:
        from routes.sensors import set_fan_mode_override
        set_fan_mode_override('AUTO')
    except Exception:
        pass
    return send_command_to_adafruit({
        'action': 'fan_auto',
        'source': 'webapp'
    }, device.loai_thiet_bi, debug=debug)


def _clear_fan_auto_timeout_locked():
    global FAN_AUTO_TIMEOUT_TIMER, FAN_AUTO_TIMEOUT_EXPIRES_AT
    if FAN_AUTO_TIMEOUT_TIMER:
        FAN_AUTO_TIMEOUT_TIMER.cancel()
    FAN_AUTO_TIMEOUT_TIMER = None
    FAN_AUTO_TIMEOUT_EXPIRES_AT = None


def _serialize_fan_auto_timeout():
    if not FAN_AUTO_TIMEOUT_EXPIRES_AT:
        return {
            'active': False,
            'expires_at': None,
            'remaining_seconds': 0
        }

    remaining_seconds = max(0, int((FAN_AUTO_TIMEOUT_EXPIRES_AT - datetime.now(timezone.utc)).total_seconds()))
    return {
        'active': remaining_seconds > 0,
        'expires_at': FAN_AUTO_TIMEOUT_EXPIRES_AT.isoformat(),
        'remaining_seconds': remaining_seconds
    }


def _execute_fan_auto_timeout(app):
    global FAN_AUTO_TIMEOUT_TIMER, FAN_AUTO_TIMEOUT_EXPIRES_AT
    with app.app_context():
        try:
            fan = ThietBi.query.filter_by(loai_thiet_bi='quat').first()
            if not fan:
                return

            response = send_fan_auto_command(fan, debug=False)
            if not response.get('success'):
                print(f"[FanTimeout] Failed to send fan_auto: {response.get('message')}")
                return

        except Exception as e:
            db.session.rollback()
            print(f"[FanTimeout] Error: {e}")
        finally:
            with FAN_AUTO_TIMEOUT_LOCK:
                FAN_AUTO_TIMEOUT_TIMER = None
                FAN_AUTO_TIMEOUT_EXPIRES_AT = None


@devices_bp.route('', methods=['POST'])
def create_thiet_bi():
    payload = request.get_json() or {}
    required = ['id', 'nha_id', 'ten_thiet_bi', 'loai_thiet_bi']
    if not all(payload.get(k) for k in required):
        return jsonify({'status': 'error', 'message': 'Thiếu dữ liệu bắt buộc'}), 400

    nha = Nha.query.filter_by(id=payload['nha_id']).first()
    if not nha:
        return jsonify({'status': 'error', 'message': 'Không tìm thấy nhà'}), 404

    existed = ThietBi.query.filter_by(id=payload['id']).first()
    if existed:
        return jsonify({'status': 'error', 'message': 'ID thiết bị đã tồn tại'}), 400

    obj = ThietBi(
        id=payload['id'],
        nha_id=payload['nha_id'],
        ten_thiet_bi=payload['ten_thiet_bi'],
        loai_thiet_bi=payload['loai_thiet_bi'],
        nha_san_xuat=payload.get('nha_san_xuat'),
        vi_tri_lap_dat=payload.get('vi_tri_lap_dat')
    )

    try:
        db.session.add(obj)
        db.session.flush()

        state = TrangThaiThietBi(thiet_bi_id=obj.id)
        db.session.add(state)

        db.session.commit()
        db.session.refresh(obj)

        return jsonify({'status': 'success', 'message': 'Tạo thiết bị thành công', 'data': {'id': obj.id, 'ten_thiet_bi': obj.ten_thiet_bi}}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500


@devices_bp.route('', methods=['GET'])
@require_auth
def get_all_thiet_bi():
    if request.args.get('sync') not in ['1', 'true', 'True']:
        objs = ThietBi.query.all()
        return jsonify([{
            'id': x.id,
            'nha_id': x.nha_id,
            'ten_thiet_bi': x.ten_thiet_bi,
            'loai_thiet_bi': x.loai_thiet_bi,
            'nha_san_xuat': x.nha_san_xuat,
            'vi_tri_lap_dat': x.vi_tri_lap_dat,
            'trang_thai': x.trang_thai.to_dict() if x.trang_thai else None
        } for x in objs]), 200

    try:
        house = Nha.query.filter(
            Nha.adafruit_username.isnot(None), 
            Nha.adafruit_key.isnot(None)
        ).first()
        
        if house:
            user = house.adafruit_username.strip()
            key = house.adafruit_key.strip()
            group = house.adafruit_group_key.strip() if house.adafruit_group_key else 'yolohome'
            headers = {'X-AIO-Key': key, 'Content-Type': 'application/json'}
            
            # Khai báo các Feed cần kiểm tra (Đèn và Quạt)
            feeds_to_check = {
                'DEN_001': f'{group}.yolohome-light',
                'QUAT_001': f'{group}.yolohome-fan'
            }
            
            for tb_id, feed_name in feeds_to_check.items():
                url = f'https://io.adafruit.com/api/v2/{user}/feeds/{feed_name}/data/last'
                res = requests.get(url, headers=headers, timeout=5) # Timeout 5s để không làm chậm web
                
                if res.status_code == 200:
                    val_str = str(res.json().get('value', '')).strip().lower()
                    is_on = None
                    
                    # Phân tích giá trị trả về từ Adafruit (chuỗi thường hoặc JSON)
                    if val_str in ['on', '1', 'true', 'light_on', 'fan_on']: 
                        is_on = True
                    elif val_str in ['off', '0', 'false', 'light_off', 'fan_off']: 
                        is_on = False
                    else:
                        try:
                            # Nếu board ESP32 đẩy lên nguyên cục JSON
                            import json
                            data = json.loads(val_str)
                            action = data.get('action', '')
                            if action in ['light_on', 'fan_on', 'on']: is_on = True
                            if action in ['light_off', 'fan_off', 'off']: is_on = False
                        except:
                            pass
                    
                    # Nếu phân tích thành công, lưu trạng thái thực tế vào DB
                    if is_on is not None:
                        state = get_or_create_device_state(tb_id)
                        state.trang_thai_bat_tat = is_on

            db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"[Sync] Lỗi đồng bộ trạng thái thiết bị từ Adafruit: {e}")
        
    objs = ThietBi.query.all()
    return jsonify([{
        'id': x.id,
        'nha_id': x.nha_id,
        'ten_thiet_bi': x.ten_thiet_bi,
        'loai_thiet_bi': x.loai_thiet_bi,
        'nha_san_xuat': x.nha_san_xuat,
        'vi_tri_lap_dat': x.vi_tri_lap_dat,
        'trang_thai': x.trang_thai.to_dict() if x.trang_thai else None
    } for x in objs]), 200


@devices_bp.route('/fan-auto-timeout', methods=['GET'])
@require_auth
def get_fan_auto_timeout():
    with FAN_AUTO_TIMEOUT_LOCK:
        return jsonify({
            'status': 'success',
            'data': _serialize_fan_auto_timeout()
        }), 200


@devices_bp.route('/fan-auto-timeout', methods=['POST'])
@require_auth
def schedule_fan_auto_timeout():
    global FAN_AUTO_TIMEOUT_TIMER, FAN_AUTO_TIMEOUT_EXPIRES_AT
    payload = request.get_json() or {}
    minutes = payload.get('minutes')

    try:
        minutes = int(minutes)
    except (TypeError, ValueError):
        return jsonify({'status': 'error', 'message': 'Timeout phải là số phút phù hợp'}), 400

    if minutes < 1 or minutes > 1440:
        return jsonify({'status': 'error', 'message': 'Timeout phải từ 1 đến 1440 phút'}), 400

    fan = ThietBi.query.filter_by(loai_thiet_bi='quat').first()
    if not fan:
        return jsonify({'status': 'error', 'message': 'Không tìm thấy quạt'}), 404

    app = current_app._get_current_object()
    with FAN_AUTO_TIMEOUT_LOCK:
        _clear_fan_auto_timeout_locked()
        FAN_AUTO_TIMEOUT_EXPIRES_AT = datetime.now(timezone.utc) + timedelta(minutes=minutes)
        FAN_AUTO_TIMEOUT_TIMER = threading.Timer(minutes * 60, _execute_fan_auto_timeout, args=(app,))
        FAN_AUTO_TIMEOUT_TIMER.daemon = True
        FAN_AUTO_TIMEOUT_TIMER.start()
        timeout_data = _serialize_fan_auto_timeout()

    return jsonify({
        'status': 'success',
        'message': f'Đã đặt timeout {minutes} phút trở về chế độ AUTO',
        'data': timeout_data
    }), 200


@devices_bp.route('/fan-auto-timeout', methods=['DELETE'])
@require_auth
def cancel_fan_auto_timeout():
    with FAN_AUTO_TIMEOUT_LOCK:
        _clear_fan_auto_timeout_locked()

    return jsonify({
        'status': 'success',
        'message': 'Đã hủy timeout trở về chế độ AUTO',
        'data': _serialize_fan_auto_timeout()
    }), 200


@devices_bp.route('/<thiet_bi_id>', methods=['GET'])
@require_auth
def get_thiet_bi_detail(thiet_bi_id):
    obj = ThietBi.query.filter_by(id=thiet_bi_id).first()
    if not obj:
        return jsonify({'status': 'error', 'message': 'Không tìm thấy thiết bị'}), 404

    return jsonify({
        'id': obj.id,
        'nha_id': obj.nha_id,
        'ten_thiet_bi': obj.ten_thiet_bi,
        'loai_thiet_bi': obj.loai_thiet_bi,
        'vi_tri_lap_dat': obj.vi_tri_lap_dat,
        'trang_thai': obj.trang_thai.to_dict() if obj.trang_thai else None
    }), 200


@devices_bp.route('/<thiet_bi_id>/trang-thai', methods=['PUT'])
def update_trang_thai(thiet_bi_id):
    payload = request.get_json() or {}
    obj = TrangThaiThietBi.query.filter_by(thiet_bi_id=thiet_bi_id).first()
    if not obj:
        return jsonify({'status': 'error', 'message': 'Không tìm thấy trạng thái thiết bị'}), 404

    if 'trang_thai_bat_tat' in payload:
        obj.trang_thai_bat_tat = bool(payload['trang_thai_bat_tat'])
    if 'toc_do' in payload:
        obj.toc_do = payload['toc_do']
    if 'mau_sac' in payload:
        obj.mau_sac = payload['mau_sac']

    log = LichSuHoatDong(
        thiet_bi_id=thiet_bi_id,
        user_id=None,
        hanh_dong='Cập nhật trạng thái thiết bị',
        thong_so_thay_doi=str(payload)
    )

    try:
        db.session.add(log)
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Cập nhật trạng thái thành công'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500


@devices_bp.route('/<thiet_bi_id>/control', methods=['POST'])
@require_auth
def control_thiet_bi(thiet_bi_id):
    """
    POST /api/thiet-bi/<thiet_bi_id>/control
    
    Gửi command tới Adafruit Cloud để điều khiển thiết bị
    
    Body:
    {
        "action": "on|off|auto|set_rgb|set_speed",
        "brightness": 96,        [optional, for light RGB 0-255]
        "r": 255, "g": 255, "b": 255,  [optional, for light RGB]
        "speed": 50              [optional, for fan speed 0-100]
    }
    """
    try:
        payload = request.get_json() or {}
        action = payload.get('action')
        
        if not action:
            return jsonify({'status': 'error', 'message': 'Chưa cung cấp action'}), 400
        
        # Kiểm tra thiết bị tồn tại
        device = ThietBi.query.filter_by(id=thiet_bi_id).first()
        if not device:
            return jsonify({'status': 'error', 'message': 'Không tìm thấy thiết bị'}), 404
        
        # Cấu trúc command JSON để gửi tới Adafruit
        command = {
            'action': action,
            'source': 'webapp'
        }
        
        # Xử lý theo loại action
        if action == 'on':
            command['action'] = 'light_on' if device.loai_thiet_bi == 'den' else 'fan_on'
            
        elif action == 'off':
            command['action'] = 'light_off' if device.loai_thiet_bi == 'den' else 'fan_off'

        elif action in ['auto', 'fan_auto'] and device.loai_thiet_bi == 'quat':
            command['action'] = 'fan_auto'
            
        elif action == 'set_rgb' and device.loai_thiet_bi == 'den':
            r = payload.get('r', payload.get('LightR', 255))
            g = payload.get('g', payload.get('lightG', 255))
            b = payload.get('b', payload.get('lightB', 255))
            command['action'] = 'light_rgb'
            command['r'] = r
            command['g'] = g
            command['b'] = b
            command['brightness'] = clamp_brightness(payload.get('brightness', 96))
            
        elif action == 'set_speed' and device.loai_thiet_bi == 'quat':
            command['action'] = 'fan_speed'
            command['speed'] = payload.get('speed', 50)
        
        # Gửi tới Adafruit REST API (truyền device type để biết send tới feed nào)
        if command.get('action') == 'fan_auto' and device.loai_thiet_bi == 'quat':
            response = send_fan_auto_command(device)
        else:
            response = send_command_to_adafruit(command, device.loai_thiet_bi)
        
        if not response['success']:
            return jsonify({'status': 'error', 'message': response['message']}), 500

        if device.loai_thiet_bi == 'quat':
            try:
                from routes.sensors import set_fan_mode_override
                if command.get('action') in ['fan_on', 'fan_speed']:
                    set_fan_mode_override('FORCE_ON')
                elif command.get('action') == 'fan_off':
                    set_fan_mode_override('FORCE_OFF')
                elif command.get('action') == 'fan_auto':
                    set_fan_mode_override('AUTO')
            except Exception:
                pass
        
        # Cập nhật trạng thái trong DB (optimistic update)
        state = get_or_create_device_state(thiet_bi_id)
        if state:
            if action in ['on', 'light_on', 'fan_on']:
                state.trang_thai_bat_tat = True
            elif action in ['off', 'light_off', 'fan_off']:
                state.trang_thai_bat_tat = False
            elif action in ['auto', 'fan_auto']:
                # AUTO returns control to the board AI. Keep the latest on/off
                # state until the board publishes its next runtime state.
                pass
            elif action == 'set_rgb':
                state.mau_sac = json.dumps({
                    'r': payload.get('r', payload.get('LightR', 255)),
                    'g': payload.get('g', payload.get('lightG', 255)),
                    'b': payload.get('b', payload.get('lightB', 255)),
                    'brightness': clamp_brightness(payload.get('brightness', 96))
                }, ensure_ascii=False, separators=(',', ':'))
                state.trang_thai_bat_tat = True  # Assume light turns on
            elif action == 'set_speed':
                state.toc_do = payload.get('speed', 50)
                state.trang_thai_bat_tat = True  # Assume fan turns on
            
            # Ghi lịch sử với ID người dùng thực tế
            current_user_id = None
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
                try:
                    import jwt
                    decoded = jwt.decode(token, options={"verify_signature": False})
                    current_user_id = decoded.get('id') or decoded.get('user_id') or decoded.get('sub')
                except Exception as e:
                    print("Lỗi giải mã token:", e)
            
            log = LichSuHoatDong(
                nha_id=device.nha_id,
                thiet_bi_id=thiet_bi_id,
                user_id=current_user_id,
                hanh_dong=f'Điều khiển thiết bị: {action}',
                thong_so_thay_doi=json.dumps(payload)
            )
            db.session.add(log)
            db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': f'Gửi command tới Adafruit thành công',
            'data': {
                'thiet_bi_id': thiet_bi_id,
                'action': action,
                'trang_thai': state.to_dict(),
                'adafruit_response': response.get('data', {})
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500


@devices_bp.route('/control-all', methods=['POST'])
@require_auth
def control_all_thiet_bi():
    try:
        payload = request.get_json() or {}
        action = payload.get('action')

        if action != 'off':
            return jsonify({'status': 'error', 'message': 'Action khong hop le'}), 400

        devices = ThietBi.query.filter(ThietBi.loai_thiet_bi.in_(['den', 'quat'])).all()
        updated_devices = []
        current_user_id = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                import jwt
                decoded = jwt.decode(token, options={"verify_signature": False})
                current_user_id = decoded.get('id') or decoded.get('user_id') or decoded.get('sub')
            except Exception as e:
                print("Loi giai ma token:", e)

        for device in devices:
            command = {
                'action': 'light_off' if device.loai_thiet_bi == 'den' else 'fan_off',
                'source': 'webapp'
            }
            response = send_command_to_adafruit(command, device.loai_thiet_bi)
            if not response['success']:
                db.session.rollback()
                return jsonify({'status': 'error', 'message': response['message']}), 500

            state = get_or_create_device_state(device.id)
            state.trang_thai_bat_tat = False
            if device.loai_thiet_bi == 'quat':
                try:
                    from routes.sensors import set_fan_mode_override
                    set_fan_mode_override('FORCE_OFF')
                except Exception:
                    pass
                state.toc_do = 0

            log = LichSuHoatDong(
                nha_id=device.nha_id,
                thiet_bi_id=device.id,
                user_id=current_user_id,
                hanh_dong='Tat toan bo thiet bi',
                thong_so_thay_doi=json.dumps({'action': 'off'})
            )
            db.session.add(log)
            updated_devices.append({
                'id': device.id,
                'trang_thai': state.to_dict()
            })

        db.session.commit()

        return jsonify({
            'status': 'success',
            'message': 'Da tat toan bo thiet bi',
            'data': updated_devices
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500


@devices_bp.route('/defaults', methods=['POST'])
@require_auth
def apply_default_device_settings():
    try:
        devices = ThietBi.query.filter(ThietBi.loai_thiet_bi.in_(['den', 'quat'])).all()
        updated_devices = []
        current_user_id = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                import jwt
                decoded = jwt.decode(token, options={"verify_signature": False})
                current_user_id = decoded.get('id') or decoded.get('user_id') or decoded.get('sub')
            except Exception as e:
                print("Loi giai ma token:", e)

        for device in devices:
            state = get_or_create_device_state(device.id)

            if device.loai_thiet_bi == 'den':
                state.mau_sac = json.dumps({
                    'r': 255,
                    'g': 255,
                    'b': 255,
                    'brightness': 50
                }, ensure_ascii=False, separators=(',', ':'))
            elif device.loai_thiet_bi == 'quat':
                state.toc_do = 50
                response = send_command_to_adafruit({
                    'action': 'fan_auto',
                    'source': 'webapp'
                }, device.loai_thiet_bi)
                if not response['success']:
                    db.session.rollback()
                    return jsonify({'status': 'error', 'message': response['message']}), 500
                try:
                    from routes.sensors import set_fan_mode_override
                    set_fan_mode_override('AUTO')
                except Exception:
                    pass

            log = LichSuHoatDong(
                nha_id=device.nha_id,
                thiet_bi_id=device.id,
                user_id=current_user_id,
                hanh_dong='Cai dat mac dinh thiet bi',
                thong_so_thay_doi=json.dumps({
                    'light': {'r': 255, 'g': 255, 'b': 255, 'brightness': 50},
                    'fan': {'mode': 'auto', 'speed': 50}
                })
            )
            db.session.add(log)
            updated_devices.append({
                'id': device.id,
                'trang_thai': state.to_dict()
            })

        db.session.commit()

        return jsonify({
            'status': 'success',
            'message': 'Da ap dung cai dat mac dinh',
            'data': updated_devices
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500


def send_command_to_adafruit(command, device_type='den', debug=True):
    """
    Gửi command tới Adafruit Cloud thông qua REST API
    
    POST https://io.adafruit.com/api/v2/{username}/groups/{group}/feeds/yolohome-command/data
    Body: {"value": "<JSON_STRING_hoặc_TEXT>"}
    Header: X-AIO-Key: {key}
    
    Theo tài liệu spec: Tất cả commands gửi tới yolohome-command feed
    yolohome-light & yolohome-fan chỉ là OUTPUT feeds (board publish status)
    """
    try:
        house = Nha.query.filter(
            Nha.adafruit_username.isnot(None),
            Nha.adafruit_key.isnot(None)
        ).first()

        if not house or not house.adafruit_username or not house.adafruit_key or not house.adafruit_group_key:
            print("[ERROR] Credentials missing in DB!")
            return {
                'success': False,
                'message': 'Chưa cấu hình Adafruit IO credentials trong bảng Nha'
            }
        
        adafruit_user = house.adafruit_username.strip()
        adafruit_key = house.adafruit_key.strip()
        
        adafruit_group_key = house.adafruit_group_key.strip() if house.adafruit_group_key else 'yolohome'
        
        if debug:
            print(f"[DEBUG] Adafruit User: {adafruit_user}")
            print(f"[DEBUG] Adafruit Group: {adafruit_group_key}")
            print(f"[DEBUG] Command: {command}")
        
        if not adafruit_user or not adafruit_key or not adafruit_group_key:
            print("[ERROR] Credentials missing!")
            return {
                'success': False,
                'message': 'Chưa cấu hình Adafruit IO credentials'
            }
        
        # Tất cả commands gửi tới yolohome-command feed
        feed_key = f'{adafruit_group_key}.yolohome-command'
        
        # URL: POST /api/v2/{username}/feeds/{feed}/data
        url = f'https://io.adafruit.com/api/v2/{adafruit_user}/feeds/{feed_key}/data'
        if debug:
            print(f"[DEBUG] URL: {url}")
        
        headers = {
            'Content-Type': 'application/json',
            'X-AIO-Key': adafruit_key
        }
        
        # Payload: {"value": "<JSON hoặc TEXT>"}
        # Command phải được stringify thành JSON string nếu là object
        command_value = json.dumps(command) if isinstance(command, dict) else str(command)
        payload = {
            'value': command_value
        }
        if debug:
            print(f"[DEBUG] Payload: {payload}")
        
        response = requests.post(url, json=payload, headers=headers, timeout=5)
        if debug:
            print(f"[DEBUG] Response Status: {response.status_code}")
            print(f"[DEBUG] Response: {response.text}")
        
        if response.status_code in [200, 201]:
            return {
                'success': True,
                'message': 'Command sent to Adafruit successfully',
                'data': response.json()
            }
        else:
            return {
                'success': False,
                'message': f'Adafruit API error: {response.status_code} - {response.text}'
            }
    except Exception as e:
        print(f"[ERROR] Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'message': f'Error: {str(e)}'
        }
