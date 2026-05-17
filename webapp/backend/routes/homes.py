from flask import Blueprint, request, jsonify
from models import db, Nha, NguoiDungNha, ThietBi
from utils.security import require_auth

homes_bp = Blueprint('homes', __name__, url_prefix='/api/homes')

@homes_bp.route('', methods=['GET'])
@require_auth
def get_user_homes():
    """Lấy danh sách các nhà mà user hiện tại có quyền truy cập"""
    user_id = request.user_id
    # Query các bản ghi liên kết của user
    links = NguoiDungNha.query.filter_by(user_id=user_id).all()
    
    result = []
    for link in links:
        home = Nha.query.get(link.nha_id)
        if home:
            # Đếm số thiết bị trong nhà đó
            device_count = ThietBi.query.filter_by(nha_id=home.id).count()
            result.append({
                'id': home.id,
                'ten_nha': home.ten_nha,
                'role': link.vai_tro_trong_nha,
                'devices': device_count,
                'members': NguoiDungNha.query.filter_by(nha_id=home.id).count()
            })
            
    return jsonify({'status': 'success', 'data': result}), 200

@homes_bp.route('', methods=['POST'])
@require_auth
def create_home():
    """Tạo căn nhà mới và gắn user làm chủ nhà"""
    data = request.get_json() or {}
    home_id = data.get('id')
    ten_nha = data.get('ten_nha')
    adafruit_username = data.get('adafruit_username')
    adafruit_key = data.get('adafruit_key')

    if not home_id or not ten_nha:
        return jsonify({'status': 'error', 'message': 'Thiếu mã ID nhà hoặc tên nhà'}), 400

    # Kiểm tra ID nhà
    exist_home = Nha.query.get(home_id)
    if exist_home:
        return jsonify({'status': 'error', 'message': 'Mã ID nhà này đã tồn tại trên hệ thống'}), 400

    try:
        # Tạo Nhà
        new_home = Nha(
            id=home_id,
            ten_nha=ten_nha,
            adafruit_username=adafruit_username,
            adafruit_key=adafruit_key
        )
        db.session.add(new_home)
        
        # Tạo liên kết Người dùng - Nhà (Mặc định là chu_nha)
        new_link = NguoiDungNha(
            user_id=request.user_id,
            nha_id=home_id,
            vai_tro_trong_nha='chu_nha'
        )
        db.session.add(new_link)
        
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Đăng ký mới nhà thông minh thành công!'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500