from pydantic import BaseModel, EmailStr, Field
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr
    ho_va_ten: str = Field(..., min_length=1)
    vai_tro: str = 'user'


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserOut(UserBase):
    id: int
    trang_thai_cap_quyen: bool

    class Config:
        orm_mode = True


class HouseBase(BaseModel):
    id: str
    ten_nha: str
    adafruit_username: str | None = None
    adafruit_key: str | None = None


class DeviceBase(BaseModel):
    id: str
    nha_id: str
    ten_thiet_bi: str
    loai_thiet_bi: str
    nha_san_xuat: str | None = None
    vi_tri_lap_dat: str | None = None
    ngay_kich_hoat: datetime | None = None


class ScheduleBase(BaseModel):
    id: int | None = None
    nha_id: str
    thiet_bi_id: str | None = None
    ten_lich_trinh: str
    mo_ta: str | None = None
    thoi_gian_bat_dau: datetime
    thoi_gian_ket_thuc: datetime | None = None
    trang_thai: str = 'inactive'


class ScheduleOut(ScheduleBase):
    ngay_tao: datetime

    class Config:
        orm_mode = True
