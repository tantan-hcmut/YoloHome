from flask import Blueprint, request, jsonify

from models import FaceAuthAudit, FaceProfile, NguoiDung, db
from services.face_challenge_service import consume_challenge, validate_head_pose
from services.facepp_service import FaceServiceError, detect_face, match_registered_face
from utils.security import generate_token, verify_token, normalize_email, normalize_password, verify_password


auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def auth_payload_for_user(user, message='Đăng nhập thành công'):
    token = generate_token(user.id)
    return {
        'status': 'success',
        'message': message,
        'data': {
            'token': token,
            'user': user.to_dict()
        }
    }


def json_error(code, message, status=400):
    return jsonify({'status': 'error', 'code': code, 'message': message}), status


@auth_bp.route('/register', methods=['POST'])
def register():
    """API tạo người dùng mới."""
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
        db.session.add(user)
        db.session.commit()

        return jsonify({'status': 'success', 'message': 'Đăng ký thành công', 'data': user.to_dict()}), 201
    except Exception as exc:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': f'Lỗi server: {str(exc)}'}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """API login bằng mật khẩu."""
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

        return jsonify(auth_payload_for_user(user, 'Đăng nhập thành công')), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': f'Lỗi server: {str(exc)}'}), 500


@auth_bp.route('/face-login', methods=['POST'])
def face_login():
    """API đăng nhập bằng khuôn mặt với liveness challenge."""
    try:
        profiles = FaceProfile.query.order_by(FaceProfile.created_at.desc()).all()
        if not profiles:
            return json_error(
                'NO_FACE_REGISTERED',
                'Chưa có khuôn mặt nào được đăng ký. Vui lòng đăng nhập bằng mật khẩu và thêm khuôn mặt trước.',
                400
            )

        data = request.get_json(silent=True) or {}
        challenge = consume_challenge(data.get('challengeId'))
        if not challenge:
            return json_error('INVALID_CHALLENGE', 'Phiên xác thực đã hết hạn. Vui lòng thử lại.', 400)

        frames = data.get('frames') or data.get('images') or []
        if not isinstance(frames, list):
            frames = []

        detected = []
        for step in challenge['steps']:
            frame = next((item for item in frames if item.get('step') == step), None)
            if not frame or not frame.get('image'):
                return json_error('MISSING_CHALLENGE_FRAME', 'Thiếu ảnh xác thực khuôn mặt.', 400)

            face, _ = detect_face(frame['image'])
            try:
                validate_head_pose(step, (face.get('attributes') or {}).get('headpose'))
            except ValueError as exc:
                return json_error('INVALID_HEAD_POSE', str(exc), 400)

            detected.append({'step': step, 'face': face})

        center = next((item for item in detected if item['step'] == 'CENTER'), detected[0])
        match = match_registered_face(center['face']['face_token'], profiles)
        user = NguoiDung.query.get(match.profile.user_id)
        if not user or not user.trang_thai_cap_quyen:
            return json_error('USER_NOT_ALLOWED', 'Tài khoản gắn với khuôn mặt chưa được cấp quyền.', 403)

        db.session.add(FaceAuthAudit(
            user_id=user.id,
            face_profile_id=match.profile.id,
            action='FACE_LOGIN',
            confidence=match.confidence,
            success=True
        ))
        db.session.commit()

        return jsonify(auth_payload_for_user(user, 'Nhận diện thành công')), 200
    except FaceServiceError as exc:
        db.session.rollback()
        return json_error(exc.code, exc.message, exc.status_code)
    except Exception:
        db.session.rollback()
        return json_error('FACE_LOGIN_FAILED', 'Không thể xác thực khuôn mặt. Vui lòng thử lại.', 500)


@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    """API lấy thông tin user hiện tại (dùng token)."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'status': 'error', 'message': 'Missing authorization header'}), 401

        parts = auth_header.split(' ')
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return jsonify({'status': 'error', 'message': 'Invalid token format'}), 401

        payload = verify_token(parts[1])
        if not payload:
            return jsonify({'status': 'error', 'message': 'Token invalid hoặc hết hạn'}), 401

        user = NguoiDung.query.get(payload['user_id'])
        if not user:
            return jsonify({'status': 'error', 'message': 'User not found'}), 404

        return jsonify({'status': 'success', 'data': user.to_dict()}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': f'Lỗi server: {str(exc)}'}), 500
