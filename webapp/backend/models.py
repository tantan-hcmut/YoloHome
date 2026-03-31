from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class NguoiDung(db.Model):
    """
    Ánh xạ tới bảng 'nguoi_dung' trong database
    """
    __tablename__ = 'nguoi_dung'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    mat_khau = db.Column(db.String(255), nullable=False)
    ho_va_ten = db.Column(db.String(255), nullable=False)
    vai_tro = db.Column(db.String(50), default='user')
    du_lieu_khuon_mat = db.Column(db.Text, nullable=True)
    trang_thai_cap_quyen = db.Column(db.Boolean, default=True)

    nha_lien_ket = db.relationship('NguoiDungNha', back_populates='nguoi_dung', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<NguoiDung {self.email}>'

    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'email': self.email,
            'ho_va_ten': self.ho_va_ten,
            'vai_tro': self.vai_tro,
            'trang_thai_cap_quyen': self.trang_thai_cap_quyen
        }


class Nha(db.Model):
    """Ánh xạ tới bảng 'nha' trong database"""
    __tablename__ = 'nha'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.String(50), primary_key=True)
    ten_nha = db.Column(db.String(255), nullable=False)
    adafruit_username = db.Column(db.String(255), nullable=True)
    adafruit_key = db.Column(db.String(255), nullable=True)

    thiet_bi = db.relationship('ThietBi', backref='nha', lazy=True, cascade='all, delete-orphan')
    nguoi_dung = db.relationship('NguoiDungNha', back_populates='nha', cascade='all, delete-orphan')
    lich_trinh = db.relationship('LichTrinh', backref='nha', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Nha {self.ten_nha}>'


class ThietBi(db.Model):
    """Ánh xạ tới bảng 'thiet_bi' trong database"""
    __tablename__ = 'thiet_bi'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.String(50), primary_key=True)
    nha_id = db.Column(db.String(50), db.ForeignKey('nha.id'), nullable=False)
    ten_thiet_bi = db.Column(db.String(255), nullable=False)
    loai_thiet_bi = db.Column(db.String(50), nullable=False)
    nha_san_xuat = db.Column(db.String(255), nullable=True)
    vi_tri_lap_dat = db.Column(db.String(255), nullable=True)
    ngay_kich_hoat = db.Column(db.DateTime, default=datetime.utcnow)

    trang_thai = db.relationship('TrangThaiThietBi', uselist=False, back_populates='thiet_bi', cascade='all, delete-orphan')
    lich_su = db.relationship('LichSuHoatDong', back_populates='thiet_bi', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<ThietBi {self.ten_thiet_bi}>'


class TrangThaiThietBi(db.Model):
    """Có trạng thái của mỗi thiết bị"""
    __tablename__ = 'trang_thai_thiet_bi'

    thiet_bi_id = db.Column(db.String(50), db.ForeignKey('thiet_bi.id'), primary_key=True, nullable=False)
    trang_thai_bat_tat = db.Column(db.Boolean, default=False)
    toc_do = db.Column(db.Integer, default=0)
    mau_sac = db.Column(db.String(50), nullable=True)

    thiet_bi = db.relationship('ThietBi', back_populates='trang_thai')

    def to_dict(self):
        return {
            'thiet_bi_id': self.thiet_bi_id,
            'trang_thai_bat_tat': self.trang_thai_bat_tat,
            'toc_do': self.toc_do,
            'mau_sac': self.mau_sac
        }


class LichSuHoatDong(db.Model):
    """Lịch sử hoạt động thay đổi thiết bị"""
    __tablename__ = 'lich_su_hoat_dong'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    thiet_bi_id = db.Column(db.String(50), db.ForeignKey('thiet_bi.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('nguoi_dung.id'), nullable=True)
    hanh_dong = db.Column(db.String(255), nullable=False)
    thong_so_thay_doi = db.Column(db.Text, nullable=True)
    thoi_gian = db.Column(db.DateTime, default=datetime.utcnow)

    thiet_bi = db.relationship('ThietBi', back_populates='lich_su')

    def to_dict(self):
        return {
            'id': self.id,
            'thiet_bi_id': self.thiet_bi_id,
            'user_id': self.user_id,
            'hanh_dong': self.hanh_dong,
            'thong_so_thay_doi': self.thong_so_thay_doi,
            'thoi_gian': self.thoi_gian.isoformat() if self.thoi_gian else None
        }


class NguoiDungNha(db.Model):
    """Mapping bảng liên kết nhiều-nhiều giữa người dùng và nhà"""
    __tablename__ = 'nguoi_dung_nha'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    nguoi_dung_id = db.Column(db.Integer, db.ForeignKey('nguoi_dung.id'), nullable=False)
    nha_id = db.Column(db.String(50), db.ForeignKey('nha.id'), nullable=False)
    vai_tro = db.Column(db.String(50), default='member')
    ngay_tao = db.Column(db.DateTime, default=datetime.utcnow)

    nguoi_dung = db.relationship('NguoiDung', back_populates='nha_lien_ket')
    nha = db.relationship('Nha', back_populates='nguoi_dung')

    def to_dict(self):
        return {
            'id': self.id,
            'nguoi_dung_id': self.nguoi_dung_id,
            'nha_id': self.nha_id,
            'vai_tro': self.vai_tro,
            'ngay_tao': self.ngay_tao.isoformat() if self.ngay_tao else None
        }


class LichTrinh(db.Model):
    """Lịch trình điều khiển thiết bị"""
    __tablename__ = 'lich_trinh'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    nha_id = db.Column(db.String(50), db.ForeignKey('nha.id'), nullable=False)
    thiet_bi_id = db.Column(db.String(50), db.ForeignKey('thiet_bi.id'), nullable=True)
    ten_lich_trinh = db.Column(db.String(255), nullable=False)
    mo_ta = db.Column(db.Text, nullable=True)
    thoi_gian_bat_dau = db.Column(db.DateTime, nullable=False)
    thoi_gian_ket_thuc = db.Column(db.DateTime, nullable=True)
    trang_thai = db.Column(db.String(50), default='inactive')
    ngay_tao = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'nha_id': self.nha_id,
            'thiet_bi_id': self.thiet_bi_id,
            'ten_lich_trinh': self.ten_lich_trinh,
            'mo_ta': self.mo_ta,
            'thoi_gian_bat_dau': self.thoi_gian_bat_dau.isoformat() if self.thoi_gian_bat_dau else None,
            'thoi_gian_ket_thuc': self.thoi_gian_ket_thuc.isoformat() if self.thoi_gian_ket_thuc else None,
            'trang_thai': self.trang_thai,
            'ngay_tao': self.ngay_tao.isoformat() if self.ngay_tao else None
        }


class TrangThaiCamBien(db.Model):
    """Trạng thái hiện tại của cảm biến (nhiệt độ, độ ẩm, v.v.)"""
    __tablename__ = 'trang_thai_cam_bien'

    thiet_bi_id = db.Column(db.String(50), db.ForeignKey('thiet_bi.id'), primary_key=True, nullable=False)
    nhiet_do = db.Column(db.Float, nullable=True)
    do_am = db.Column(db.Float, nullable=True)
    thoi_gian_cap_nhat = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'thiet_bi_id': self.thiet_bi_id,
            'nhiet_do': self.nhiet_do,
            'do_am': self.do_am,
            'thoi_gian_cap_nhat': self.thoi_gian_cap_nhat.isoformat() if self.thoi_gian_cap_nhat else None
        }


class LichSuCamBien(db.Model):
    """Lịch sử dữ liệu cảm biến"""
    __tablename__ = 'lich_su_cam_bien'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    thiet_bi_id = db.Column(db.String(50), db.ForeignKey('thiet_bi.id'), nullable=False)
    nhiet_do = db.Column(db.Float, nullable=True)
    do_am = db.Column(db.Float, nullable=True)
    thoi_gian_ghi_nhan = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'thiet_bi_id': self.thiet_bi_id,
            'nhiet_do': self.nhiet_do,
            'do_am': self.do_am,
            'thoi_gian_ghi_nhan': self.thoi_gian_ghi_nhan.isoformat() if self.thoi_gian_ghi_nhan else None
        }


class AdafruitFeedMapping(db.Model):
    """Mapping giữa Adafruit feed_key và thiết bị trong hệ thống"""
    __tablename__ = 'adafruit_feed_mapping'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    feed_key = db.Column(db.String(100), unique=True, nullable=False)  # yolohome-temp, yolohome-light, etc
    thiet_bi_id = db.Column(db.String(50), db.ForeignKey('thiet_bi.id'), nullable=False)
    sensor_type = db.Column(db.String(50), nullable=True)  # 'temperature', 'humidity', 'light', 'fan'
    config = db.Column(db.JSON, default={})  # Additional config like min/max values

    thiet_bi = db.relationship('ThietBi')

    def __repr__(self):
        return f'<AdafruitFeedMapping {self.feed_key} -> {self.thiet_bi_id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'feed_key': self.feed_key,
            'thiet_bi_id': self.thiet_bi_id,
            'sensor_type': self.sensor_type,
            'config': self.config
        }


