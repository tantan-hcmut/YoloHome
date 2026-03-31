import jwt
from datetime import datetime, timedelta
import os
from functools import wraps
from flask import request, jsonify


def generate_token(user_id, expires_in=86400):
    """Tạo JWT token"""
    secret_key = os.getenv('SECRET_KEY', 'your-secret-key-change-this')

    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(seconds=expires_in)
    }

    return jwt.encode(payload, secret_key, algorithm='HS256')


def verify_token(token):
    """Xác thực token"""
    try:
        secret_key = os.getenv('SECRET_KEY', 'your-secret-key-change-this')
        payload = jwt.decode(token, secret_key, algorithms=['HS256'])
        return payload
    except Exception:
        return None


def require_auth(f):
    """Decorator để bảo vệ API routes - kiểm tra JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Lấy token từ Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]
            except IndexError:
                return jsonify({'status': 'error', 'message': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'status': 'error', 'message': 'Token required'}), 401
        
        # Verify token
        payload = verify_token(token)
        if not payload:
            return jsonify({'status': 'error', 'message': 'Invalid or expired token'}), 401
        
        # Lưu user_id vào request context
        request.user_id = payload.get('user_id')
        
        return f(*args, **kwargs)
    
    return decorated


def normalize_email(email: str) -> str:
    return email.strip().lower() if isinstance(email, str) else ''


def normalize_password(password: str) -> str:
    """Giữ password dạng chữ thường (no hash)"""
    return password.strip().lower() if isinstance(password, str) else ''


def verify_password(raw_password: str, stored_password: str) -> bool:
    raw = normalize_password(raw_password)
    stored = normalize_password(stored_password)
    return raw == stored

