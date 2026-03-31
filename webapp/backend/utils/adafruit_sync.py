"""
Adafruit IO synchronization utilities
Handles pulling sensor data from Adafruit feeds and updating database
"""

import requests
import os
from datetime import datetime, timezone
from models import db, TrangThaiCamBien, LichSuCamBien


def sync_sensor_data_from_adafruit():
    """
    Poll Adafruit feeds (yolohome.yolohome-temp, yolohome.yolohome-humi)
    and update database with latest sensor readings
    
    Returns:
        tuple: (success: bool, temp_value: float, humi_value: float, message: str)
    """
    try:
        adafruit_user = os.getenv('ADAFRUIT_IO_USER')
        adafruit_key = os.getenv('ADAFRUIT_IO_KEY')
        group_key = os.getenv('ADAFRUIT_GROUP_KEY', 'yolohome')
        
        if not adafruit_user or not adafruit_key:
            return False, None, None, "Adafruit credentials not configured"
        
        headers = {
            'X-AIO-Key': adafruit_key,
            'Content-Type': 'application/json'
        }
        
        # Fetch temperature data
        temp_url = f'https://io.adafruit.com/api/v2/{adafruit_user}/feeds/{group_key}.yolohome-temp/data/last'
        temp_response = requests.get(temp_url, headers=headers, timeout=5)
        
        # Fetch humidity data
        humi_url = f'https://io.adafruit.com/api/v2/{adafruit_user}/feeds/{group_key}.yolohome-humi/data/last'
        humi_response = requests.get(humi_url, headers=headers, timeout=5)
        
        print(f"[DEBUG] Temp status: {temp_response.status_code}, Humi status: {humi_response.status_code}")
        
        # Check if feeds exist (404 = not created yet)
        if temp_response.status_code == 404 and humi_response.status_code == 404:
            return False, None, None, "Feeds not found on Adafruit"
        
        # Parse temperature
        temp_data = temp_response.json() if temp_response.status_code == 200 else None
        temp_value = float(temp_data.get('value', 0)) if temp_data and temp_data.get('value') else None
        
        # Parse humidity
        humi_data = humi_response.json() if humi_response.status_code == 200 else None
        humi_value = float(humi_data.get('value', 0)) if humi_data and humi_data.get('value') else None
        
        # Find or create sensor record
        sensor = TrangThaiCamBien.query.filter_by(thiet_bi_id='SENSOR_001').first()
        if not sensor:
            sensor = TrangThaiCamBien(thiet_bi_id='SENSOR_001')
            db.session.add(sensor)
        
        # Update current state
        if temp_value is not None:
            sensor.nhiet_do = temp_value
        
        if humi_value is not None:
            sensor.do_am = humi_value
        
        sensor.thoi_gian_cap_nhat = datetime.now(timezone.utc)
        
        # Save history only if BOTH values are valid
        if temp_value is not None and humi_value is not None:
            history = LichSuCamBien(
                thiet_bi_id='SENSOR_001',
                nhiet_do=temp_value,
                do_am=humi_value,
                thoi_gian_ghi_nhan=datetime.now(timezone.utc)
            )
            db.session.add(history)
            message = f"Synced successfully - Temp: {temp_value}°C, Humi: {humi_value}%"
        else:
            message = f"Incomplete data - Temp: {temp_value}, Humi: {humi_value}"
        
        db.session.commit()
        
        # Return True only if both values are valid
        success = temp_value is not None and humi_value is not None
        return success, temp_value, humi_value, message
        
    except Exception as e:
        error_msg = f"Sync error: {str(e)}"
        print(f"[Sync Error] {error_msg}")
        return False, None, None, error_msg
