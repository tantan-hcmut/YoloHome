#include "temp_humi_monitor.h"

#include <Wire.h>
#include <ArduinoJson.h>
#include "DHT20.h"
#include "LiquidCrystal_I2C.h"
#include "global.h"
#include "hw_pins.h"
#include "task_webserver.h"

namespace
{
DHT20 dht20;
LiquidCrystal_I2C lcd(0x21, 16, 2);

DisplayState computeDisplayState(const TempLevel tempLevel, const HumiLevel humiLevel)
{
  if (tempLevel == TEMP_LEVEL_HOT || humiLevel == HUMI_LEVEL_HUMID)
  {
    return DISPLAY_STATE_CRITICAL;
  }
  if (tempLevel == TEMP_LEVEL_COLD || humiLevel == HUMI_LEVEL_DRY)
  {
    return DISPLAY_STATE_WARNING;
  }
  return DISPLAY_STATE_NORMAL;
}

void updateLcd(const SensorFrame &frame)
{
  lcd.clear();
  lcd.setCursor(0, 0);
  switch (frame.displayState)
  {
  case DISPLAY_STATE_CRITICAL:
    lcd.print("State: HOT/HUM ");
    break;
  case DISPLAY_STATE_WARNING:
    lcd.print("State: WARN    ");
    break;
  case DISPLAY_STATE_NORMAL:
  default:
    lcd.print("State: NORMAL  ");
    break;
  }

  lcd.setCursor(0, 1);
  lcd.printf("T:%2.1fC H:%2.0f%%", frame.temperature, frame.humidity);
}

void sendSensorToWeb(const SensorFrame &frame)
{
  StaticJsonDocument<256> doc;
  doc["page"] = "sensor";
  doc["temp"] = frame.temperature;
  doc["humi"] = frame.humidity;
  doc["tempLevel"] = static_cast<uint8_t>(frame.tempLevel);
  doc["humiLevel"] = static_cast<uint8_t>(frame.humiLevel);
  doc["displayState"] = static_cast<uint8_t>(frame.displayState);
  doc["valid"] = frame.valid;
  doc["ts"] = frame.timestampMs;

  String out;
  serializeJson(doc, out);
  Webserver_sendata(out);
}
} // namespace

void temp_humi_monitor(void *pvParameters)
{
  (void)pvParameters;
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  dht20.begin();

  lcd.begin();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("YoloHome boot...");
  lcd.setCursor(0, 1);
  lcd.print("Init sensors");
  vTaskDelay(pdMS_TO_TICKS(1200));

  for (;;)
  {
    RuntimeConfig cfg;
    getRuntimeConfig(cfg);

    SensorFrame frame = {};
    frame.timestampMs = millis();

    dht20.read();
    frame.temperature = dht20.getTemperature();
    frame.humidity = dht20.getHumidity();
    frame.valid = !isnan(frame.temperature) && !isnan(frame.humidity);

    if (!frame.valid)
    {
      frame.temperature = 0.0f;
      frame.humidity = 0.0f;
      frame.tempLevel = TEMP_LEVEL_NORMAL;
      frame.humiLevel = HUMI_LEVEL_OK;
      frame.displayState = DISPLAY_STATE_CRITICAL;
      Serial.println("[SENSOR] Failed to read DHT20");
    }
    else
    {
      if (frame.temperature < cfg.tempColdThreshold)
        frame.tempLevel = TEMP_LEVEL_COLD;
      else if (frame.temperature > cfg.tempHotThreshold)
        frame.tempLevel = TEMP_LEVEL_HOT;
      else
        frame.tempLevel = TEMP_LEVEL_NORMAL;

      if (frame.humidity < cfg.humiDryThreshold)
        frame.humiLevel = HUMI_LEVEL_DRY;
      else if (frame.humidity > cfg.humiHumidThreshold)
        frame.humiLevel = HUMI_LEVEL_HUMID;
      else
        frame.humiLevel = HUMI_LEVEL_OK;

      frame.displayState = computeDisplayState(frame.tempLevel, frame.humiLevel);
    }

    if (xStateMutex != nullptr && xSemaphoreTake(xStateMutex, pdMS_TO_TICKS(50)) == pdTRUE)
    {
      gState.temperature = frame.temperature;
      gState.humidity = frame.humidity;
      gState.tempLevel = frame.tempLevel;
      gState.humiLevel = frame.humiLevel;
      gState.displayState = frame.displayState;
      gState.sensorValid = frame.valid;
      gState.sensorTimestampMs = frame.timestampMs;
      xSemaphoreGive(xStateMutex);
    }

    if (gSystemEvents != nullptr)
    {
      frame.valid ? xEventGroupSetBits(gSystemEvents, EVT_SENSOR_VALID)
                  : xEventGroupClearBits(gSystemEvents, EVT_SENSOR_VALID);
    }

    updateLcd(frame);
    sendSensorToWeb(frame);

    if (qSensorFrames != nullptr)
    {
      xQueueOverwrite(qSensorFrames, &frame);
    }

    refreshIndicatorMode();

    Serial.printf("[SENSOR] T=%.2f H=%.2f valid=%s\n",
                  frame.temperature,
                  frame.humidity,
                  frame.valid ? "true" : "false");

    vTaskDelay(pdMS_TO_TICKS(cfg.sensorPeriodMs));
  }
}
