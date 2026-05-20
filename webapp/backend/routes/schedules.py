from flask import Blueprint, request, jsonify
from models import db, LichTrinh, ThietBi, Nha
from utils.security import require_auth
from datetime import datetime

schedules_bp = Blueprint('schedules', __name__, url_prefix='/api/schedules')

@schedules_bp.route('', methods=['GET'])
@require_auth
def get_schedules():
    try:
        schedules = LichTrinh.query.order_by(LichTrinh.thoi_gian_hen.asc()).all()
        result = []
        for s in schedules:
            device = ThietBi.query.get(s.thiet_bi_id)
            result.append({
                'id': s.id,
                'ten_lich_trinh': s.ten_lich_trinh, # Đọc từ DB trả về cho Frontend
                'thiet_bi_id': s.thiet_bi_id,
                'thiet_bi_ten': device.ten_thiet_bi if device else 'Thiết bị đã xóa',
                'action': s.trang_thai_thiet_bi_muon_dat,
                'time': s.thoi_gian_hen.strftime('%H:%M') if s.thoi_gian_hen else '00:00',
                'repeat': s.ngay_trong_tuan or 'Daily',
                'active': s.trang_thai_kich_hoat
            })
        return jsonify({'status': 'success', 'data': result}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@schedules_bp.route('', methods=['POST'])
@require_auth
def create_schedule():
    payload = request.get_json() or {}
    try:
        time_str = payload.get('time')
        time_obj = datetime.strptime(time_str, '%H:%M').time()
        nha = Nha.query.first()
        
        new_schedule = LichTrinh(
            nha_id=nha.id if nha else 'HOME_001',
            thiet_bi_id=payload.get('thiet_bi_id'),
            ten_lich_trinh=payload.get('ten_lich_trinh'), # Lưu tên lịch trình vào DB
            thoi_gian_hen=time_obj,
            ngay_trong_tuan=payload.get('repeat', 'Daily'),
            trang_thai_thiet_bi_muon_dat=payload.get('action', 'on'),
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
    """Bật/Tắt (Enable/Disable) một lịch trình"""
    try:
        schedule = LichTrinh.query.get(schedule_id)
        if not schedule:
            return jsonify({'status': 'error', 'message': 'Không tìm thấy lịch'}), 404
        
        # Đảo ngược cờ kích hoạt một cách tường minh cho PostgreSQL
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
    """Xóa lịch trình"""
    try:
        schedule = LichTrinh.query.get(schedule_id)
        if schedule:
            db.session.delete(schedule)
            db.session.commit()
        return jsonify({'status': 'success', 'message': 'Xóa thành công'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500