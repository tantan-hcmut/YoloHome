from flask import Blueprint, request, jsonify
from models import db, LichTrinh, ThietBi, Nha
from utils.security import require_auth
from datetime import datetime, timedelta, timezone
import json

schedules_bp = Blueprint('schedules', __name__, url_prefix='/api/schedules')


def parse_schedule_action(raw_action):
    if not raw_action:
        return {'action': 'on'}
    if isinstance(raw_action, dict):
        return raw_action
    try:
        parsed = json.loads(raw_action)
        return parsed if isinstance(parsed, dict) else {'action': str(raw_action)}
    except (TypeError, ValueError, json.JSONDecodeError):
        return {'action': str(raw_action)}


def schedule_remaining_seconds(target_at):
    if not target_at:
        return 0
    try:
        target = datetime.fromisoformat(str(target_at))
        if target.tzinfo is None:
            target = target.replace(tzinfo=timezone.utc)
        return max(0, int((target - datetime.now(timezone.utc)).total_seconds()))
    except (TypeError, ValueError):
        return 0


def resolve_schedule_active(schedule, action_config):
    if not schedule.trang_thai_kich_hoat:
        return False
    if action_config.get('schedule_mode') != 'countdown':
        return True
    return schedule_remaining_seconds(action_config.get('target_at')) > 0


@schedules_bp.route('', methods=['GET'])
@require_auth
def get_schedules():
    try:
        schedules = LichTrinh.query.order_by(LichTrinh.thoi_gian_hen.asc()).all()
        result = []
        for schedule in schedules:
            device = ThietBi.query.get(schedule.thiet_bi_id)
            action_config = parse_schedule_action(schedule.trang_thai_thiet_bi_muon_dat)
            remaining_seconds = schedule_remaining_seconds(action_config.get('target_at'))
            is_active = resolve_schedule_active(schedule, action_config)
            result.append({
                'id': schedule.id,
                'ten_lich_trinh': schedule.ten_lich_trinh,
                'thiet_bi_id': schedule.thiet_bi_id,
                'thiet_bi_ten': device.ten_thiet_bi if device else 'Thiết bị đã xóa',
                'loai_thiet_bi': device.loai_thiet_bi if device else 'unknown',
                'action': action_config.get('action', 'on'),
                'action_config': action_config,
                'time': schedule.thoi_gian_hen.strftime('%H:%M') if schedule.thoi_gian_hen else '00:00',
                'repeat': schedule.ngay_trong_tuan or 'Daily',
                'schedule_mode': action_config.get('schedule_mode', 'time'),
                'target_at': action_config.get('target_at'),
                'remaining_seconds': remaining_seconds,
                'active': is_active
            })
        return jsonify({'status': 'success', 'data': result}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@schedules_bp.route('', methods=['POST'])
@require_auth
def create_schedule():
    payload = request.get_json() or {}
    try:
        schedule_mode = payload.get('schedule_mode', 'time')
        repeat_value = payload.get('repeat', 'Daily')
        time_str = payload.get('time')
        target_at = None

        if schedule_mode == 'countdown':
            delay_minutes = max(1, int(payload.get('delay_minutes', 1)))
            target_at = datetime.now(timezone.utc) + timedelta(minutes=delay_minutes)
            time_str = target_at.strftime('%H:%M')
            repeat_value = target_at.strftime('%Y-%m-%d')
        elif not time_str:
            return jsonify({'status': 'error', 'message': 'Thiếu giờ hẹn'}), 400

        time_obj = datetime.strptime(time_str, '%H:%M').time()
        nha = Nha.query.first()
        action_config = {
            'action': payload.get('action', 'on'),
            'schedule_mode': schedule_mode
        }

        if target_at:
            action_config['target_at'] = target_at.isoformat()
            action_config['delay_minutes'] = delay_minutes

        for key in ['r', 'g', 'b', 'brightness', 'speed']:
            if payload.get(key) is not None:
                action_config[key] = payload.get(key)

        new_schedule = LichTrinh(
            nha_id=nha.id if nha else 'HOME_001',
            thiet_bi_id=payload.get('thiet_bi_id'),
            ten_lich_trinh=payload.get('ten_lich_trinh'),
            thoi_gian_hen=time_obj,
            ngay_trong_tuan=repeat_value,
            trang_thai_thiet_bi_muon_dat=json.dumps(action_config, ensure_ascii=False, separators=(',', ':')),
            trang_thai_kich_hoat=True
        )
        db.session.add(new_schedule)
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Tạo lịch hẹn thành công'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500


@schedules_bp.route('/<int:schedule_id>', methods=['PUT'])
@require_auth
def toggle_schedule(schedule_id):
    try:
        schedule = LichTrinh.query.get(schedule_id)
        if not schedule:
            return jsonify({'status': 'error', 'message': 'Không tìm thấy lịch'}), 404

        schedule.trang_thai_kich_hoat = False if schedule.trang_thai_kich_hoat else True
        db.session.commit()

        return jsonify({
            'status': 'success',
            'message': 'Cập nhật thành công',
            'active': schedule.trang_thai_kich_hoat
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500


@schedules_bp.route('/<int:schedule_id>', methods=['DELETE'])
@require_auth
def delete_schedule(schedule_id):
    try:
        schedule = LichTrinh.query.get(schedule_id)
        if schedule:
            db.session.delete(schedule)
            db.session.commit()
        return jsonify({'status': 'success', 'message': 'Xóa thành công'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500
