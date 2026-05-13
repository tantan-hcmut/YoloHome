from flask import Blueprint, request, jsonify
from models import NguoiDung, Nha, NguoiDungNha, db
from utils.security import generate_token, verify_token, normalize_email, normalize_password, verify_password

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/register', methods=['POST'])
def register():
    """API tạo người dùng mới"""
    try:
        data = request.get_json()
        if not data or not data.get('email') or not data.get('password') or not data.get('ho_va_ten'):
            return jsonify({'status': 'error', 'message': 'email, password, ho_va_ten là bắt buộc'}), 400

        email = normalize_email(data['email'])
        password = normalize_password(data['password'])
        ho_va_ten = data['ho_va_ten'].strip()
        vai_tro = data.get('vai_tro', 'user')

        if NguoiDung.query.filter_by(email=email).first():
            return jsonify({'status': 'error', 'message': 'Email đã tồn tại'}), 400

        user = NguoiDung(email=email, mat_khau=password, ho_va_ten=ho_va_ten, vai_tro=vai_tro)
        from models import db
        db.session.add(user)
        db.session.commit()

        return jsonify({'status': 'success', 'message': 'Đăng ký thành công', 'data': user.to_dict()}), 201

    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Lỗi server: {str(e)}'}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """API Login"""
    try:
        data = request.get_json()

        if not data or not data.get('email') or not data.get('password'):
            return jsonify({'status': 'error', 'message': 'Email và mật khẩu không được để trống'}), 400

        email = normalize_email(data['email'])
        password = normalize_password(data['password'])

        user = NguoiDung.query.filter_by(email=email).first()
        if not user or not verify_password(password, user.mat_khau):
            return jsonify({'status': 'error', 'message': 'Email hoặc mật khẩu không chính xác'}), 401

        if not user.trang_thai_cap_quyen:
            return jsonify({'status': 'error', 'message': 'Tài khoản của bạn chưa được cấp quyền'}), 403

        adafruit_username = (data.get('adafruit_username') or '').strip()
        adafruit_key = (data.get('adafruit_key') or '').strip()

        if adafruit_username or adafruit_key:
            if not adafruit_username or not adafruit_key:
                return jsonify({'status': 'error', 'message': 'Adafruit username và API key phải nhập cùng nhau'}), 400

            user_home_link = NguoiDungNha.query.filter_by(nguoi_dung_id=user.id).first()
            if not user_home_link:
                return jsonify({'status': 'error', 'message': 'Không tìm thấy nhà để lưu Adafruit credentials'}), 404

            home = Nha.query.filter_by(id=user_home_link.nha_id).first()
            if not home:
                return jsonify({'status': 'error', 'message': 'Không tìm thấy nhà để lưu Adafruit credentials'}), 404

            home.adafruit_username = adafruit_username
            home.adafruit_key = adafruit_key
            db.session.add(home)

        token = generate_token(user.id)

        db.session.commit()

        return jsonify({
            'status': 'success',
            'message': 'Đăng nhập thành công',
            'data': {
                'token': token,
                'user': user.to_dict()
            }
        }), 200

    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Lỗi server: {str(e)}'}), 500


@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    """API lấy thông tin user hiện tại (dùng token)"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'status': 'error', 'message': 'Missing authorization header'}), 401

        parts = auth_header.split(' ')
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return jsonify({'status': 'error', 'message': 'Invalid token format'}), 401

        token = parts[1]
        payload = verify_token(token)
        if not payload:
            return jsonify({'status': 'error', 'message': 'Token invalid hoặc hết hạn'}), 401

        user = NguoiDung.query.get(payload['user_id'])
        if not user:
            return jsonify({'status': 'error', 'message': 'User not found'}), 404

        return jsonify({'status': 'success', 'data': user.to_dict()}), 200

    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Lỗi server: {str(e)}'}), 500

