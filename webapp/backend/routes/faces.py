from flask import Blueprint, jsonify, request

from models import FaceProfile, db
from services.face_challenge_service import create_challenge
from services.facepp_service import FaceServiceError, detect_face
from utils.security import require_auth


faces_bp = Blueprint('faces', __name__, url_prefix='/api/faces')


def _error(code, message, status=400):
    return jsonify({'status': 'error', 'code': code, 'message': message}), status


def _image_from_request():
    if 'image' in request.files:
        return request.files['image'].read()
    data = request.get_json(silent=True) or request.form
    return data.get('image') if data else None


@faces_bp.route('/status', methods=['GET'])
def status():
    count = FaceProfile.query.count()
    return jsonify({'hasFaces': count > 0, 'count': count}), 200


@faces_bp.route('/challenge', methods=['POST'])
def challenge():
    return jsonify(create_challenge()), 201


@faces_bp.route('', methods=['GET'])
@require_auth
def list_faces():
    faces = FaceProfile.query.filter_by(user_id=request.user_id).order_by(FaceProfile.created_at.desc()).all()
    return jsonify({'faces': [face.to_public_dict() for face in faces]}), 200


@faces_bp.route('', methods=['POST'])
@require_auth
def create_face():
    name = (request.form.get('name') or (request.get_json(silent=True) or {}).get('name') or '').strip()
    if not name:
        return _error('NAME_REQUIRED', 'Vui lòng nhập tên khuôn mặt.')

    image_data = _image_from_request()
    if not image_data:
        return _error('IMAGE_REQUIRED', 'Vui lòng chụp ảnh khuôn mặt.')

    try:
        face, image_hash = detect_face(image_data)
        profile = FaceProfile(
            user_id=request.user_id,
            name=name,
            face_token=face['face_token'],
            image_hash=image_hash
        )
        db.session.add(profile)
        db.session.commit()
        return jsonify({
            'status': 'success',
            'message': 'Đã thêm khuôn mặt thành công',
            'face': profile.to_public_dict()
        }), 201
    except FaceServiceError as exc:
        db.session.rollback()
        return _error(exc.code, exc.message, exc.status_code)
    except Exception:
        db.session.rollback()
        return _error('FACE_CREATE_FAILED', 'Không thể thêm khuôn mặt. Vui lòng thử lại.', 500)


@faces_bp.route('/<int:face_id>', methods=['DELETE'])
@require_auth
def delete_face(face_id):
    profile = FaceProfile.query.filter_by(id=face_id, user_id=request.user_id).first()
    if not profile:
        return _error('FACE_NOT_FOUND', 'Không tìm thấy khuôn mặt.', 404)

    db.session.delete(profile)
    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Đã xóa khuôn mặt thành công'}), 200
