from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from dotenv import load_dotenv
import os
import json
import re
import unicodedata
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timezone

# 1. Tải các biến môi trường từ file .env
load_dotenv()

# 2. Khởi tạo ứng dụng Flask
app = Flask(__name__)
# CORS(app)
CORS(app, resources={r"/*": {"origins": "*"}}) # cho việc deloy trên render.com

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

VOICE_COLOR_RGB = {
    'red': (255, 0, 0),
    'green': (0, 255, 0),
    'blue': (0, 0, 255),
    'yellow': (255, 255, 0),
    'purple': (128, 0, 128),
    'orange': (255, 165, 0),
    'pink': (255, 105, 180),
    'white': (255, 255, 255),
    'cyan': (0, 255, 255),
    'gray': (31, 31, 31),
    'grey': (31, 31, 31),
    'do': (255, 0, 0),
    'xanh_la': (0, 255, 0),
    'xanh_duong': (0, 0, 255),
    'vang': (255, 255, 0),
    'tim': (128, 0, 128),
    'cam': (255, 165, 0),
    'hong': (255, 105, 180),
    'trang': (255, 255, 255),
    'xam': (31, 31, 31),
    'mau do': (255, 0, 0),
    'mau xanh la': (0, 255, 0),
    'mau xanh luc': (0, 255, 0),
    'mau xanh duong': (0, 0, 255),
    'mau vang': (255, 255, 0),
    'mau tim': (128, 0, 128),
    'mau cam': (255, 165, 0),
    'mau hong': (255, 105, 180),
    'mau trang': (255, 255, 255),
    'mau xam': (31, 31, 31),
    'xanh luc': (0, 255, 0),
    'xanh la': (0, 255, 0),
    'xanh duong': (0, 0, 255),
    'xanh': (0, 255, 255),
}


def normalize_voice_text(text):
    normalized = unicodedata.normalize('NFD', str(text).strip().lower())
    normalized = ''.join(ch for ch in normalized if unicodedata.category(ch) != 'Mn')
    normalized = normalized.replace('đ', 'd')
    normalized = normalized.replace('_', ' ').replace('-', ' ')
    return ' '.join(normalized.split())


def voice_has_any(text, keywords):
    return any(keyword in text for keyword in keywords)


def extract_voice_percent(text):
    match = re.search(r'(\d{1,3})\s*(%|phan tram|percent)?', text)
    return clamp_percent(match.group(1), None) if match else None


def is_all_off_voice_command(text):
    return voice_has_any(text, [
        'toi di ra khoi nha',
        'toi ra khoi nha',
        'di ra khoi nha',
        'ra khoi nha',
        'tat tat ca',
        'tat het',
        'tat toan bo',
        'tat moi thiet bi',
        'tat tat ca thiet bi',
        'tat het thiet bi',
        'tat ca thiet bi',
    ])


def parse_voice_color(color):
    if not color:
        return None

    if isinstance(color, dict):
        try:
            return (
                max(0, min(255, int(color.get('LightR', color.get('r', 255))))),
                max(0, min(255, int(color.get('lightG', color.get('g', 255))))),
                max(0, min(255, int(color.get('lightB', color.get('b', 255)))))
            )
        except (TypeError, ValueError):
            return None

    color_text = normalize_voice_text(color)
    if color_text in VOICE_COLOR_RGB:
        return VOICE_COLOR_RGB[color_text]

    for color_key in sorted(VOICE_COLOR_RGB, key=len, reverse=True):
        pattern = r'(?<!\w)' + re.escape(color_key) + r'(?!\w)'
        if re.search(pattern, color_text):
            return VOICE_COLOR_RGB[color_key]

    if color_text.startswith('#') and len(color_text) == 7:
        try:
            return (
                int(color_text[1:3], 16),
                int(color_text[3:5], 16),
                int(color_text[5:7], 16)
            )
        except ValueError:
            return None

    parts = [part.strip() for part in color_text.split(',')]
    if len(parts) == 3:
        try:
            return tuple(max(0, min(255, int(part))) for part in parts)
        except ValueError:
            return None

    return None


def build_light_rgb_payload(r, g, b, source='webapp', brightness=96):
    return {
        'action': 'light_rgb',
        'source': source,
        'r': r,
        'g': g,
        'b': b,
        'brightness': brightness
    }


def clamp_int(value, default=50, min_value=0, max_value=100):
    try:
        return max(min_value, min(max_value, int(value)))
    except (TypeError, ValueError):
        return default


def clamp_percent(value, default=50):
    return clamp_int(value, default, 0, 100)


def clamp_brightness(value, default=96):
    return clamp_int(value, default, 0, 100)


def parse_state_color(state):
    if not state or not state.mau_sac:
        return 255, 255, 255, 96

    try:
        color = json.loads(state.mau_sac)
        return (
            clamp_int(color.get('r', color.get('LightR', 255)), 255, 0, 255),
            clamp_int(color.get('g', color.get('lightG', 255)), 255, 0, 255),
            clamp_int(color.get('b', color.get('lightB', 255)), 255, 0, 255),
            clamp_brightness(color.get('brightness', 96), 96)
        )
    except (TypeError, ValueError, json.JSONDecodeError):
        return 255, 255, 255, 96


@app.route('/api/voice-command', methods=['POST'])
def receive_voice_command():
    from models import db, VoiceCommand, ThietBi, TrangThaiThietBi, LichSuHoatDong
    from routes.devices import get_or_create_device_state, send_command_to_adafruit
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Không có dữ liệu gửi lên'}), 400

        original_text = data.get('original_text', '')
        normalized_text = normalize_voice_text(original_text)
        action = data.get('action') or ''
        device_name = data.get('device') or ''
        voice_percent = extract_voice_percent(normalized_text)
        is_voice_source = data.get('source') == 'voice' or bool(data.get('requires_voice_active'))

        if action in ['fan_on', 'fan_off', 'fan_auto', 'fan_speed']:
            device_name = 'fan'
        elif action in ['light_on', 'light_off', 'light_rgb']:
            device_name = 'light'

        def send_voice_active_if_needed():
            if is_voice_source:
                return send_command_to_adafruit({
                    'action': 'voice_active',
                    'source': 'voice'
                }, 'voice')
            return None

        if is_all_off_voice_command(normalized_text):
            action = 'all_off'
            device_name = 'all'
        else:
            if not device_name:
                if 'den' in normalized_text:
                    device_name = 'light'
                elif 'quat' in normalized_text:
                    device_name = 'fan'
                elif voice_has_any(normalized_text, ['do sang', 'tang sang', 'giam sang', 'sang hon', 'toi hon', 'brightness']):
                    device_name = 'light'

            if device_name == 'light':
                if voice_has_any(normalized_text, ['tang do sang', 'tang sang', 'sang hon']):
                    action = 'increase_brightness'
                    data['brightness_delta'] = data.get('brightness_delta') or voice_percent or 10
                elif voice_has_any(normalized_text, ['giam do sang', 'giam sang', 'toi hon']):
                    action = 'decrease_brightness'
                    data['brightness_delta'] = data.get('brightness_delta') or voice_percent or 30
                elif voice_has_any(normalized_text, ['do sang', 'brightness']) and voice_percent is not None:
                    action = 'set_brightness'
                    data['brightness'] = data.get('brightness') or voice_percent

        data['action'] = action
        data['device'] = device_name

        # 1. Lưu lệnh vào DB
        command = VoiceCommand(
            action=action,
            device=device_name,
            room=data.get('room', ''),
            speed=str(data.get('speed', '')) if data.get('speed') else None,
            color=str(data.get('color', '')) if data.get('color') else None,
            original_text=original_text,
            command_json=json.dumps(data, ensure_ascii=False)
        )
        db.session.add(command)
        db.session.commit()

        # 2. Thực thi lệnh thực tế (Kết nối với luồng điều khiển của cậu)
        if action == 'all_off' or device_name == 'all':
            devices = ThietBi.query.filter(ThietBi.loai_thiet_bi.in_(['den', 'quat'])).all()
            adafruit_commands = []
            send_voice_active_if_needed()

            for device in devices:
                cmd_payload = {
                    'action': 'light_off' if device.loai_thiet_bi == 'den' else 'fan_off',
                    'source': 'voice' if is_voice_source else 'webapp'
                }
                adafruit_response = send_command_to_adafruit(cmd_payload, device.loai_thiet_bi)
                adafruit_commands.append({
                    'thiet_bi_id': device.id,
                    'command': cmd_payload,
                    'success': adafruit_response.get('success', False)
                })

                state = get_or_create_device_state(device.id)
                state.trang_thai_bat_tat = False
                if device.loai_thiet_bi == 'quat':
                    state.toc_do = 0

                db.session.add(LichSuHoatDong(
                    nha_id=device.nha_id,
                    thiet_bi_id=device.id,
                    user_id=None,
                    hanh_dong=f"Voice Command: {data.get('original_text')}",
                    thong_so_thay_doi=json.dumps({
                        'action': 'all_off',
                        'adafruit_command': cmd_payload
                    }, ensure_ascii=False)
                ))

            command.action = 'all_off'
            command.command_json = json.dumps({
                **data,
                'adafruit_commands': adafruit_commands
            }, ensure_ascii=False)
            command.status = 'processed'
            command.processed_at = datetime.utcnow()
            db.session.commit()

            return jsonify({
                'success': True,
                'message': 'Đã tắt tất cả thiết bị',
                'id': command.id,
                'data': {
                    'action': 'all_off',
                    'affected_devices': len(devices),
                    'adafruit_commands': adafruit_commands
                }
            }), 200

        device_type = 'den' if device_name == 'light' else 'quat' if device_name == 'fan' else None

        if not action or not device_type:
            return jsonify({'message': 'Lưu lệnh thành công, nhưng không đủ thông tin để bật/tắt', 'id': command.id}), 200

        # Tìm thiết bị đầu tiên khớp loại trong nhà
        device = ThietBi.query.filter_by(loai_thiet_bi=device_type).first()
        if not device:
            return jsonify({'message': 'Lệnh lưu thành công, nhưng không tìm thấy thiết bị phù hợp', 'id': command.id}), 404

        # Gửi lệnh xuống Adafruit
        color_rgb = parse_voice_color(data.get('color')) or parse_voice_color(data.get('original_text'))
        speed_value = data.get('speed')
        if isinstance(speed_value, str):
            speed_value = {
                'low': 30,
                'medium': 60,
                'high': 100
            }.get(speed_value.lower(), speed_value)

        speed_value = clamp_percent(speed_value, 50)
        brightness_value = clamp_brightness(data.get('brightness'), 96)
        state = get_or_create_device_state(device.id)
        current_r, current_g, current_b, current_brightness = parse_state_color(state)

        if action in ['increase_brightness', 'decrease_brightness'] and device_type == 'den':
            default_delta = 30 if action == 'decrease_brightness' else 10
            brightness_delta = clamp_percent(data.get('brightness_delta'), default_delta)
            if action == 'increase_brightness':
                brightness_value = clamp_brightness(current_brightness + brightness_delta, current_brightness)
            else:
                brightness_value = clamp_brightness(current_brightness - brightness_delta, current_brightness)

        command_source = 'voice' if is_voice_source else 'webapp'

        if color_rgb and device_type == 'den' and action not in ['off', 'light_off', 'light_rgb']:
            action = 'set_color'
        elif device_type == 'den' and data.get('brightness') is not None and action not in ['off', 'light_off', 'light_rgb', 'increase_brightness', 'decrease_brightness']:
            action = 'set_brightness'
        elif device_type == 'quat' and data.get('speed') is not None and action not in ['off', 'fan_off', 'fan_auto', 'fan_speed']:
            action = 'set_speed'

        cmd_payload = {'source': command_source}
        if action in ['fan_on', 'fan_off', 'fan_auto']:
            if device_type != 'quat':
                return jsonify({'error': 'Lenh quat chi ho tro thiet bi quat', 'id': command.id}), 400
            cmd_payload['action'] = action
        elif action in ['fan_speed', 'set_speed'] and device_type == 'quat':
            cmd_payload.update({
                'action': 'fan_speed',
                'speed': speed_value
            })
        elif action in ['light_on', 'light_off']:
            if device_type != 'den':
                return jsonify({'error': 'Lenh den chi ho tro thiet bi den', 'id': command.id}), 400
            cmd_payload['action'] = action
        elif action == 'light_rgb':
            if device_type != 'den':
                return jsonify({'error': 'Lenh doi mau chi ho tro den', 'id': command.id}), 400

            r = clamp_int(data.get('r'), current_r, 0, 255)
            g = clamp_int(data.get('g'), current_g, 0, 255)
            b = clamp_int(data.get('b'), current_b, 0, 255)
            if color_rgb:
                r, g, b = color_rgb
            cmd_payload = build_light_rgb_payload(
                r,
                g,
                b,
                source=command_source,
                brightness=brightness_value
            )
            color_rgb = (r, g, b)
        elif action == 'set_color':
            if device_type != 'den':
                return jsonify({'error': 'Lenh doi mau chi ho tro den', 'id': command.id}), 400
            if not color_rgb:
                return jsonify({'error': 'Khong nhan dien duoc mau can doi', 'id': command.id}), 400

            r, g, b = color_rgb
            cmd_payload = build_light_rgb_payload(
                r,
                g,
                b,
                source=command_source,
                brightness=brightness_value
            )
        elif action == 'set_brightness' and device_type == 'den':
            cmd_payload = build_light_rgb_payload(
                current_r,
                current_g,
                current_b,
                source=command_source,
                brightness=brightness_value
            )
        elif action in ['increase_brightness', 'decrease_brightness'] and device_type == 'den':
            cmd_payload = build_light_rgb_payload(
                current_r,
                current_g,
                current_b,
                source=command_source,
                brightness=brightness_value
            )
        else:
            should_turn_on = action in ['on', 'increase_speed']
            if device_type == 'den':
                cmd_payload['action'] = 'light_on' if should_turn_on else 'light_off'
            else:
                cmd_payload['action'] = 'fan_on' if should_turn_on else 'fan_off'
            
        send_voice_active_if_needed()
        adafruit_response = send_command_to_adafruit(cmd_payload, device.loai_thiet_bi)

        # Cập nhật trạng thái và ghi log Lịch sử hoạt động
        if action in ['set_color', 'light_rgb']:
            r, g, b = color_rgb
            state.trang_thai_bat_tat = True
            state.mau_sac = json.dumps({
                'r': r,
                'g': g,
                'b': b,
                'brightness': brightness_value
            }, ensure_ascii=False, separators=(',', ':'))
        elif action == 'set_brightness' and device_type == 'den':
            state.trang_thai_bat_tat = True
            state.mau_sac = json.dumps({
                'r': current_r,
                'g': current_g,
                'b': current_b,
                'brightness': brightness_value
            }, ensure_ascii=False, separators=(',', ':'))
        elif action in ['increase_brightness', 'decrease_brightness'] and device_type == 'den':
            state.trang_thai_bat_tat = True
            state.mau_sac = json.dumps({
                'r': current_r,
                'g': current_g,
                'b': current_b,
                'brightness': brightness_value
            }, ensure_ascii=False, separators=(',', ':'))
        elif action in ['set_speed', 'fan_speed'] and device_type == 'quat':
            state.trang_thai_bat_tat = True
            state.toc_do = speed_value
        elif action == 'fan_auto' and device_type == 'quat':
            pass
        else:
            state.trang_thai_bat_tat = (cmd_payload['action'] in ['light_on', 'fan_on'])
            if cmd_payload['action'] == 'fan_off':
                state.toc_do = 0
        
        new_history = LichSuHoatDong(
            nha_id=device.nha_id,
            thiet_bi_id=device.id,
            user_id=None,
            hanh_dong=f"Voice Command: {data.get('original_text')}",
            thong_so_thay_doi=json.dumps({
                'action': action,
                'color': data.get('color'),
                'rgb': {
                    'r': color_rgb[0],
                    'g': color_rgb[1],
                    'b': color_rgb[2]
                } if color_rgb else None,
                'brightness': brightness_value if action in ['set_color', 'light_rgb', 'set_brightness', 'increase_brightness', 'decrease_brightness'] else None,
                'speed': speed_value if action in ['set_speed', 'fan_speed'] else None,
                'adafruit_command': cmd_payload
            }, ensure_ascii=False)
        )
        db.session.add(new_history)

        # Đánh dấu lệnh Voice đã được xử lý xong
        command.command_json = json.dumps({
            **data,
            'rgb': {
                'r': color_rgb[0],
                'g': color_rgb[1],
                'b': color_rgb[2]
            } if color_rgb else None,
            'brightness': brightness_value if action in ['set_color', 'light_rgb', 'set_brightness', 'increase_brightness', 'decrease_brightness'] else None,
            'adafruit_command': cmd_payload,
            'adafruit_success': adafruit_response.get('success', False)
        }, ensure_ascii=False)
        command.action = action
        command.speed = str(speed_value) if action in ['set_speed', 'fan_speed'] else command.speed
        command.status = 'processed'
        command.processed_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Đã xử lý lệnh giọng nói thành công',
            'id': command.id,
            'data': {
                'thiet_bi_id': device.id,
                'action': action,
                'trang_thai': state.to_dict(),
                'adafruit_command': cmd_payload,
                'adafruit_response': adafruit_response
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/voice-commands/pending', methods=['GET'])
def get_pending_commands():
    from models import VoiceCommand
    try:
        commands = VoiceCommand.query.filter_by(status='pending').all()
        return jsonify({
            "data": [cmd.to_dict() for cmd in commands],
            "count": len(commands)
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/voice-commands/<int:command_id>/processed', methods=['POST'])
def mark_command_processed(command_id):
    from models import VoiceCommand
    try:
        command = VoiceCommand.query.get(command_id)
        if not command:
            return jsonify({"error": "Không tìm thấy lệnh"}), 404
        
        command.status = 'processed'
        command.processed_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({"success": True, "message": "Đã đánh dấu xử lý xong"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ==========================================
# Background Task: Auto-sync từ Adafruit mỗi 30s để cập nhật trạng thái cảm biến (nhiệt độ, độ ẩm)
# ==========================================

def sync_sensor_from_adafruit_background():
    """
    Background task: Poll Adafruit feeds mỗi 30s để cập nhật trạng thái cảm biến (nhiệt độ, độ ẩm)
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

EXECUTED_SCHEDULE_KEYS = set()


def parse_schedule_action_config(raw_action):
    if not raw_action:
        return {'action': 'on'}
    try:
        parsed = json.loads(raw_action)
        return parsed if isinstance(parsed, dict) else {'action': str(raw_action)}
    except (TypeError, ValueError, json.JSONDecodeError):
        return {'action': str(raw_action)}


def check_and_execute_schedules_background():
    with app.app_context():
        from models import db, LichTrinh, ThietBi, TrangThaiThietBi, LichSuHoatDong
        from routes.devices import send_command_to_adafruit
        from datetime import datetime

        now = datetime.now()
        current_time = now.time()
        current_weekday = now.weekday()
        today_str = now.strftime('%Y-%m-%d')
        tasks = LichTrinh.query.filter_by(trang_thai_kich_hoat=True).all()

        for task in tasks:
            if task.thoi_gian_hen.hour != current_time.hour or task.thoi_gian_hen.minute != current_time.minute:
                continue

            repeat = task.ngay_trong_tuan or 'Daily'
            is_today_valid = False
            is_one_time = False

            if repeat == 'Daily':
                is_today_valid = True
            elif repeat == 'Weekdays' and current_weekday < 5:
                is_today_valid = True
            elif repeat == 'Weekends' and current_weekday >= 5:
                is_today_valid = True
            elif repeat == today_str:
                is_today_valid = True
                is_one_time = True

            if not is_today_valid:
                continue

            action_config = parse_schedule_action_config(task.trang_thai_thiet_bi_muon_dat)
            target_at = action_config.get('target_at')
            if action_config.get('schedule_mode') == 'countdown' and target_at:
                try:
                    if now < datetime.fromisoformat(target_at):
                        continue
                except ValueError:
                    pass

            run_key = f"{task.id}:{today_str}:{task.thoi_gian_hen.strftime('%H:%M')}"
            if run_key in EXECUTED_SCHEDULE_KEYS:
                continue

            device = ThietBi.query.get(task.thiet_bi_id)
            if not device:
                EXECUTED_SCHEDULE_KEYS.add(run_key)
                continue

            action = action_config.get('action', 'on')
            state = TrangThaiThietBi.query.filter_by(thiet_bi_id=device.id).first()
            if not state:
                state = TrangThaiThietBi(thiet_bi_id=device.id)
                db.session.add(state)
            is_on = bool(state.trang_thai_bat_tat)

            should_send = True
            command = {'action': action, 'source': 'schedule'}

            if action == 'off':
                should_send = is_on
                command['action'] = 'light_off' if device.loai_thiet_bi == 'den' else 'fan_off'
            elif action == 'on':
                if device.loai_thiet_bi == 'den' and any(key in action_config for key in ['r', 'g', 'b', 'brightness']):
                    command.update({
                        'action': 'light_rgb',
                        'r': int(action_config.get('r', 255)),
                        'g': int(action_config.get('g', 255)),
                        'b': int(action_config.get('b', 255)),
                        'brightness': int(action_config.get('brightness', 96))
                    })
                elif device.loai_thiet_bi == 'quat' and action_config.get('speed') is not None:
                    command.update({
                        'action': 'fan_speed',
                        'speed': int(action_config.get('speed', 50))
                    })
                else:
                    should_send = not is_on
                    command['action'] = 'light_on' if device.loai_thiet_bi == 'den' else 'fan_on'
            elif action == 'set_color' and device.loai_thiet_bi == 'den':
                command.update({
                    'action': 'light_rgb',
                    'r': int(action_config.get('r', 255)),
                    'g': int(action_config.get('g', 255)),
                    'b': int(action_config.get('b', 255)),
                    'brightness': int(action_config.get('brightness', 96))
                })
            elif action == 'set_speed' and device.loai_thiet_bi == 'quat':
                command.update({
                    'action': 'fan_speed',
                    'speed': int(action_config.get('speed', 50))
                })
            else:
                should_send = False

            if should_send:
                print(f"[Schedule] Execute {command['action']} for {device.ten_thiet_bi}")
                send_command_to_adafruit(command, device.loai_thiet_bi)

                if command['action'] in ['light_off', 'fan_off']:
                    state.trang_thai_bat_tat = False
                    if device.loai_thiet_bi == 'quat':
                        state.toc_do = 0
                elif command['action'] == 'light_rgb':
                    state.trang_thai_bat_tat = True
                    state.mau_sac = json.dumps({
                        'r': command.get('r', 255),
                        'g': command.get('g', 255),
                        'b': command.get('b', 255),
                        'brightness': command.get('brightness', 96)
                    }, ensure_ascii=False, separators=(',', ':'))
                elif command['action'] == 'fan_speed':
                    state.trang_thai_bat_tat = True
                    state.toc_do = command.get('speed', 50)
                else:
                    state.trang_thai_bat_tat = command['action'] in ['light_on', 'fan_on']

                new_history = LichSuHoatDong(
                    nha_id=task.nha_id,
                    thiet_bi_id=device.id,
                    user_id=None,
                    hanh_dong=f"Auto Schedule: {command['action'].upper()}",
                    thong_so_thay_doi=json.dumps(action_config, ensure_ascii=False),
                    thoi_gian=now
                )
                db.session.add(new_history)

            EXECUTED_SCHEDULE_KEYS.add(run_key)
            if len(EXECUTED_SCHEDULE_KEYS) > 2000:
                EXECUTED_SCHEDULE_KEYS.clear()

            if is_one_time:
                task.trang_thai_kich_hoat = False
                print(f"[Schedule] Disabled one-time schedule '{task.ten_lich_trinh}'.")

        db.session.commit()

# Initialize APScheduler
scheduler = BackgroundScheduler()
# Chạy Hẹn giờ (Mỗi 3 giây)
scheduler.add_job(
    func=check_and_execute_schedules_background,
    trigger="interval",
    seconds=1,
    id="execute_schedules",
    name="Check schedules every 1s",
    coalesce=True,
    max_instances=1,
    replace_existing=True
)

# Đồng bộ cảm biến từ Adafruit (Mỗi 30 giây)
scheduler.add_job(
    func=sync_sensor_from_adafruit_background,
    trigger="interval",
    seconds=30,
    id="sync_adafruit_sensors",
    name="Sync sensors from Adafruit every 30s",
    replace_existing=True
)

scheduler.start()
print("[Scheduler] Background jobs started (Schedules: 1s, Sensors: 30s)")

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
