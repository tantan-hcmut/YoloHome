from flask import Blueprint, jsonify
from models import db, LichSuHoatDong, ThietBi, NguoiDung
from utils.security import require_auth

history_bp = Blueprint('history', __name__, url_prefix='/api/lich-su')

@history_bp.route('', methods=['GET'])
@require_auth
def get_history():
    try:
        # Lấy lịch sử, join với bảng ThietBi và NguoiDung để lấy tên
        histories = db.session.query(
            LichSuHoatDong, ThietBi, NguoiDung
        ).outerjoin(
            ThietBi, LichSuHoatDong.thiet_bi_id == ThietBi.id
        ).outerjoin(
            NguoiDung, LichSuHoatDong.user_id == NguoiDung.id
        ).order_by(LichSuHoatDong.thoi_gian.desc()).limit(200).all() # Lấy 200 dòng mới nhất

        result = []
        for h, tb, nd in histories:
            result.append({
                'id': h.id,
                'thiet_bi_id': h.thiet_bi_id,
                'ten_thiet_bi': tb.ten_thiet_bi if tb else 'Thiết bị đã xóa',
                'loai_thiet_bi': tb.loai_thiet_bi if tb else 'unknown',
                'hanh_dong': h.hanh_dong,
                'thong_so_thay_doi': h.thong_so_thay_doi,
                'thoi_gian': h.thoi_gian.isoformat() + 'Z' if h.thoi_gian else None,
                'nguoi_dung': nd.ho_va_ten if nd else 'Hệ thống tự động'
            })

        return jsonify({'status': 'success', 'data': result}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500