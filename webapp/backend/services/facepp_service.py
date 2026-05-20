import base64
import hashlib
import os
from dataclasses import dataclass

import requests


class FaceServiceError(Exception):
    def __init__(self, code, message, status_code=400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass
class FaceMatch:
    profile: object
    confidence: float


def _config():
    api_key = os.getenv('FACEPP_API_KEY')
    api_secret = os.getenv('FACEPP_API_SECRET')
    api_base = os.getenv('FACEPP_API_BASE', 'https://api-us.faceplusplus.com/facepp/v3').rstrip('/')
    if not api_key or not api_secret:
        raise FaceServiceError('FACEPP_NOT_CONFIGURED', 'Chưa cấu hình Face++ API key/secret.', 500)
    return api_key, api_secret, api_base


def _image_bytes_from_data_url(image_data):
    if not image_data:
        raise FaceServiceError('IMAGE_REQUIRED', 'Vui lòng cung cấp ảnh khuôn mặt.')

    if isinstance(image_data, bytes):
        return image_data

    value = str(image_data)
    if ',' in value and value.startswith('data:image'):
        value = value.split(',', 1)[1]

    try:
        return base64.b64decode(value, validate=True)
    except Exception as exc:
        raise FaceServiceError('INVALID_IMAGE', 'Ảnh khuôn mặt không hợp lệ.') from exc


def _post_facepp(endpoint, data=None, files=None):
    api_key, api_secret, api_base = _config()
    payload = {'api_key': api_key, 'api_secret': api_secret}
    if data:
        payload.update(data)

    try:
        response = requests.post(f'{api_base}/{endpoint}', data=payload, files=files, timeout=15)
    except requests.RequestException as exc:
        raise FaceServiceError('FACEPP_NETWORK_ERROR', 'Không thể kết nối Face++. Vui lòng thử lại.') from exc

    try:
        body = response.json()
    except ValueError as exc:
        raise FaceServiceError('FACEPP_BAD_RESPONSE', 'Face++ trả về phản hồi không hợp lệ.', 502) from exc

    if response.status_code >= 400 or body.get('error_message'):
        message = body.get('error_message') or 'Face++ xử lý thất bại.'
        raise FaceServiceError('FACEPP_ERROR', message, 502)

    return body


def detect_face(image_data):
    image_bytes = _image_bytes_from_data_url(image_data)
    if len(image_bytes) > 5 * 1024 * 1024:
        raise FaceServiceError('IMAGE_TOO_LARGE', 'Ảnh quá lớn. Vui lòng dùng ảnh dưới 5MB.')

    body = _post_facepp(
        'detect',
        data={'return_attributes': 'headpose'},
        files={'image_file': ('face.jpg', image_bytes, 'image/jpeg')}
    )
    faces = body.get('faces') or []

    if len(faces) == 0:
        raise FaceServiceError('NO_FACE_DETECTED', 'Không tìm thấy khuôn mặt. Vui lòng thử lại.')
    if len(faces) > 1:
        raise FaceServiceError('MULTIPLE_FACES_DETECTED', 'Phát hiện nhiều khuôn mặt. Vui lòng chỉ để một người trong khung hình.')

    return faces[0], hashlib.sha256(image_bytes).hexdigest()


def compare_faces(face_token_1, face_token_2):
    body = _post_facepp('compare', data={'face_token1': face_token_1, 'face_token2': face_token_2})
    return float(body.get('confidence') or 0)


def match_registered_face(face_token, profiles):
    limit = int(os.getenv('FACE_MAX_COMPARE_PROFILES', '20'))
    threshold = float(os.getenv('FACE_MATCH_THRESHOLD', '75'))
    best = None

    for profile in profiles[:limit]:
        confidence = compare_faces(face_token, profile.face_token)
        if best is None or confidence > best.confidence:
            best = FaceMatch(profile=profile, confidence=confidence)

    if not best or best.confidence < threshold:
        raise FaceServiceError('FACE_NOT_MATCHED', 'Không khớp với khuôn mặt đã đăng ký.', 401)

    return best


def create_or_get_faceset():
    outer_id = os.getenv('FACEPP_FACESET_OUTER_ID', 'yolohome_faces')

    try:
        body = _post_facepp('faceset/create', data={
            'outer_id': outer_id,
            'display_name': 'YoloHome Faces',
            'force_merge': 1
        })
        return body.get('faceset_token'), outer_id
    except FaceServiceError as exc:
        # Nếu FaceSet đã tồn tại thì dùng outer_id luôn
        if 'EXIST' in str(exc.message).upper() or 'exists' in str(exc.message).lower():
            return None, outer_id
        raise


def add_face_to_faceset(face_token):
    _, outer_id = create_or_get_faceset()
    body = _post_facepp('faceset/addface', data={
        'outer_id': outer_id,
        'face_tokens': face_token
    })
    return body


def remove_face_from_faceset(face_token):
    outer_id = os.getenv('FACEPP_FACESET_OUTER_ID', 'yolohome_faces')
    return _post_facepp('faceset/removeface', data={
        'outer_id': outer_id,
        'face_tokens': face_token
    })


def search_face(face_token):
    outer_id = os.getenv('FACEPP_FACESET_OUTER_ID', 'yolohome_faces')
    body = _post_facepp('search', data={
        'outer_id': outer_id,
        'face_token': face_token,
        'return_result_count': 1
    })
    return body
