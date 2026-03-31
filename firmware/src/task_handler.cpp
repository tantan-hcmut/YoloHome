#include "task_handler.h"

#include <ArduinoJson.h>
#include <WiFi.h>
#include "global.h"
#include "hw_pins.h"
#include "task_check_info.h"
#include "task_webserver.h"

namespace
{
uint32_t clampMs(uint32_t value, uint32_t minValue, uint32_t maxValue)
{
  if (value < minValue)
    return minValue;
  if (value > maxValue)
    return maxValue;
  return value;
}

uint8_t clampByteValue(int value)
{
  if (value < 0)
    return 0;
  if (value > 255)
    return 255;
  return static_cast<uint8_t>(value);
}

uint8_t clampPercentValue(int value)
{
  if (value < 0)
    return 0;
  if (value > 100)
    return 100;
  return static_cast<uint8_t>(value);
}

bool isValidHexColor(const String &value)
{
  if (value.length() != 7 || value[0] != '#')
  {
    return false;
  }
  for (size_t i = 1; i < value.length(); ++i)
  {
    if (!isHexadecimalDigit(value[i]))
    {
      return false;
    }
  }
  return true;
}

bool enqueueCommand(const CommandMessage &cmd)
{
  if (qUserCommands == nullptr)
  {
    return false;
  }
  return xQueueSend(qUserCommands, &cmd, pdMS_TO_TICKS(20)) == pdTRUE;
}

String overrideModeToString(OverrideMode mode)
{
  switch (mode)
  {
  case OVERRIDE_MODE_FORCE_ON:
    return "FORCED_ON";
  case OVERRIDE_MODE_FORCE_OFF:
    return "FORCED_OFF";
  case OVERRIDE_MODE_AUTO:
  default:
    return "AUTO";
  }
}

String indicatorModeToString(SystemIndicatorMode mode)
{
  switch (mode)
  {
  case SYS_MODE_BOOT:
    return "BOOT";
  case SYS_MODE_NORMAL:
    return "NORMAL";
  case SYS_MODE_WIFI_ONLY:
    return "WIFI_ONLY";
  case SYS_MODE_AP_CONFIG:
    return "AP_CONFIG";
  case SYS_MODE_AI_COOLING:
    return "AI_COOLING";
  case SYS_MODE_MANUAL_LOCKDOWN:
    return "MANUAL_LOCKDOWN";
  case SYS_MODE_VOICE_ACTIVE:
    return "VOICE_ACTIVE";
  case SYS_MODE_FAULT:
  default:
    return "FAULT";
  }
}

void sendSimplePage(const char *page)
{
  StaticJsonDocument<128> doc;
  doc["page"] = page;
  String out;
  serializeJson(doc, out);
  Webserver_sendata(out);
}

void sendAck(const char *page, const char *message)
{
  StaticJsonDocument<256> doc;
  doc["page"] = page;
  doc["message"] = message;
  String out;
  serializeJson(doc, out);
  Webserver_sendata(out);
}

String buildFeedName(const char *prefix, const char *suffix)
{
  const String resolvedPrefix = (prefix == nullptr || strlen(prefix) == 0) ? String("yolohome") : String(prefix);
  return resolvedPrefix + "-" + suffix;
}

void sendConfigToWeb()
{
  RuntimeConfig cfg;
  SystemState st;
  getRuntimeConfig(cfg);
  getSystemState(st);

  DynamicJsonDocument resp(4096);
  resp["page"] = "config";
  JsonObject value = resp.createNestedObject("value");

  JsonObject hardware = value.createNestedObject("hardware");
  hardware["board"] = "Yolo_Uno ESP32-S3";
  hardware["sensor"] = "DHT20 I2C";
  hardware["lcd"] = "LCD 16x2 I2C";
  hardware["fanDriver"] = "Mini fan PWM via port D7-D8 (signal D7)";
  hardware["externalLight"] = "4 LED RGB WS2812 via port D9-D10 (signal D9)";

  JsonObject pins = hardware.createNestedObject("pins");
  pins["i2cSda"] = PIN_I2C_SDA;
  pins["i2cScl"] = PIN_I2C_SCL;
  pins["fanSignal"] = PIN_MINI_FAN;
  pins["fanPortMate"] = PIN_MINI_FAN_AUX;
  pins["externalRgbSignal"] = PIN_EXT_RGB;
  pins["externalRgbPortMate"] = PIN_EXT_RGB_AUX;
  pins["onboardLed"] = PIN_ONBOARD_LED;
  pins["onboardRgb"] = PIN_ONBOARD_RGB;
  pins["bootButton"] = PIN_BOOT_BUTTON;

  JsonObject cloud = value.createNestedObject("cloud");
  cloud["platform"] = "Adafruit IO";
  cloud["broker"] = "io.adafruit.com:1883";
  cloud["feedPrefix"] = cfg.adafruitFeedPrefix;
  cloud["username"] = cfg.adafruitUsername;
  JsonObject feeds = cloud.createNestedObject("feeds");
  feeds["command"] = buildFeedName(cfg.adafruitFeedPrefix, "command");
  feeds["config"] = buildFeedName(cfg.adafruitFeedPrefix, "config");
  feeds["telemetry"] = buildFeedName(cfg.adafruitFeedPrefix, "telemetry");
  feeds["temp"] = buildFeedName(cfg.adafruitFeedPrefix, "temp");
  feeds["humi"] = buildFeedName(cfg.adafruitFeedPrefix, "humi");
  feeds["fan"] = buildFeedName(cfg.adafruitFeedPrefix, "fan");
  feeds["light"] = buildFeedName(cfg.adafruitFeedPrefix, "light");
  feeds["tinyml"] = buildFeedName(cfg.adafruitFeedPrefix, "tinyml");
  feeds["status"] = buildFeedName(cfg.adafruitFeedPrefix, "status");

  JsonObject thr = value.createNestedObject("thresholds");
  thr["tempCold"] = cfg.tempColdThreshold;
  thr["tempHot"] = cfg.tempHotThreshold;
  thr["humiDry"] = cfg.humiDryThreshold;
  thr["humiHumid"] = cfg.humiHumidThreshold;
  thr["aiOn"] = cfg.aiOnThreshold;
  thr["aiOff"] = cfg.aiOffThreshold;

  JsonObject timing = value.createNestedObject("timing");
  timing["sensorPeriodMs"] = cfg.sensorPeriodMs;
  timing["inferencePeriodMs"] = cfg.inferencePeriodMs;
  timing["telemetryPeriodMs"] = cfg.telemetryPeriodMs;
  timing["overrideMinutes"] = cfg.manualOverrideMs / 60000UL;
  timing["voiceHoldMs"] = cfg.voiceIndicatorHoldMs;

  JsonObject fanRamp = value.createNestedObject("fanRamp");
  fanRamp["startPercent"] = cfg.fanRampStartPercent;
  fanRamp["midPercent"] = cfg.fanRampMidPercent;
  fanRamp["endPercent"] = cfg.fanRampEndPercent;
  fanRamp["midMinutes"] = cfg.fanRampMidpointMs / 60000UL;
  fanRamp["fullMinutes"] = cfg.fanRampFullMs / 60000UL;

  JsonObject flags = value.createNestedObject("flags");
  flags["autoFanEnabled"] = cfg.autoFanEnabled;
  flags["onboardLedEnabled"] = cfg.onboardLedEnabled;
  flags["onboardRgbEnabled"] = cfg.onboardRgbEnabled;

  JsonObject settings = value.createNestedObject("settings");
  settings["ssid"] = cfg.wifiSsid;
  settings["password"] = "";
  settings["hasPassword"] = strlen(cfg.wifiPass) > 0;
  settings["aioUsername"] = cfg.adafruitUsername;
  settings["aioKey"] = "";
  settings["hasAioKey"] = strlen(cfg.adafruitKey) > 0;
  settings["feedPrefix"] = cfg.adafruitFeedPrefix;

  JsonObject theme = value.createNestedObject("theme");
  theme["primary"] = cfg.themePrimaryHex;
  theme["accent"] = cfg.themeAccentHex;
  theme["background"] = cfg.themeBackgroundHex;

  JsonObject fanDefaults = value.createNestedObject("fanDefaults");
  fanDefaults["manualSpeedPercent"] = cfg.fanDefaultSpeedPercent;
  fanDefaults["autoSpeedPercent"] = cfg.fanAutoSpeedPercent;

  JsonObject lightDefaults = value.createNestedObject("lightDefaults");
  lightDefaults["r"] = cfg.lightDefaultR;
  lightDefaults["g"] = cfg.lightDefaultG;
  lightDefaults["b"] = cfg.lightDefaultB;
  lightDefaults["brightness"] = cfg.lightDefaultBrightness;

  JsonArray devices = value.createNestedArray("devices");
  JsonObject fan = devices.createNestedObject();
  fan["name"] = "FAN";
  fan["label"] = "Mini Fan";
  fan["type"] = "fan";
  fan["gpio"] = PIN_MINI_FAN;
  fan["port"] = "D7-D8";
  fan["status"] = st.fanOn ? "ON" : "OFF";
  fan["speedPercent"] = st.fanSpeedPercent;

  JsonObject light = devices.createNestedObject();
  light["name"] = "LIGHT";
  light["label"] = "External RGB";
  light["type"] = "rgb";
  light["gpio"] = PIN_EXT_RGB;
  light["port"] = "D9-D10";
  light["status"] = st.lightOn ? "ON" : "OFF";
  light["r"] = st.lightR;
  light["g"] = st.lightG;
  light["b"] = st.lightB;
  light["brightness"] = st.lightBrightness;
  light["pixels"] = EXTERNAL_RGB_LED_COUNT;

  JsonObject led1 = devices.createNestedObject();
  led1["name"] = "LED1";
  led1["label"] = "Onboard LED";
  led1["type"] = "indicator";
  led1["gpio"] = PIN_ONBOARD_LED;
  led1["status"] = cfg.onboardLedEnabled ? "ON" : "OFF";

  JsonObject led2 = devices.createNestedObject();
  led2["name"] = "LED2";
  led2["label"] = "Onboard RGB";
  led2["type"] = "indicator";
  led2["gpio"] = PIN_ONBOARD_RGB;
  led2["status"] = cfg.onboardRgbEnabled ? "ON" : "OFF";

  JsonObject runtime = value.createNestedObject("runtime");
  const wifi_mode_t wifiMode = WiFi.getMode();
  const bool apModeActive = (wifiMode == WIFI_AP || wifiMode == WIFI_AP_STA);
  const String apIp = apModeActive ? WiFi.softAPIP().toString() : String("0.0.0.0");
  const String stationIp = WiFi.isConnected() ? WiFi.localIP().toString() : String("0.0.0.0");
  runtime["wifiConnected"] = st.wifiConnected;
  runtime["cloudConnected"] = st.cloudConnected;
  runtime["sensorValid"] = st.sensorValid;
  runtime["overrideMode"] = overrideModeToString(st.overrideMode);
  runtime["overrideRemainingMs"] = (st.overrideUntilMs > millis()) ? (st.overrideUntilMs - millis()) : 0;
  runtime["indicatorMode"] = indicatorModeToString(st.indicatorMode);
  runtime["fanOn"] = st.fanOn;
  runtime["fanSpeedPercent"] = st.fanSpeedPercent;
  runtime["lightOn"] = st.lightOn;
  runtime["voiceActive"] = st.voiceActive;
  runtime["temperature"] = st.temperature;
  runtime["humidity"] = st.humidity;
  runtime["tinymlScore"] = st.tinymlScore;
  runtime["tinymlSmooth"] = st.tinymlSmoothedScore;
  runtime["tinymlHot"] = st.tinymlPredictedHot;
  runtime["apModeActive"] = apModeActive;
  runtime["apIp"] = apIp;
  runtime["stationIp"] = stationIp;
  runtime["ip"] = WiFi.isConnected() ? stationIp : apIp;
  runtime["aiCoolingElapsedMs"] = st.aiCoolingElapsedMs;
  runtime["aiTargetFanSpeedPercent"] = st.aiTargetFanSpeedPercent;

  JsonArray voiceExamples = value.createNestedArray("voiceExamples");
  voiceExamples.add("fan_on");
  voiceExamples.add("fan_off");
  voiceExamples.add("fan_auto");
  voiceExamples.add("fan_speed");
  voiceExamples.add("light_on");
  voiceExamples.add("light_off");
  voiceExamples.add("light_rgb");

  String out;
  serializeJson(resp, out);
  Webserver_sendata(out);
}

void updateStringFieldIfPresent(JsonObjectConst value, const char *key, char *dest, size_t destSize)
{
  if (value[key].isNull())
  {
    return;
  }
  copyStringSafe(dest, destSize, String(value[key].as<const char *>()));
}

void updateSecretFieldIfPresent(JsonObjectConst value, const char *key, char *dest, size_t destSize, const char *clearFlagKey)
{
  if (clearFlagKey != nullptr && (value[clearFlagKey] | false))
  {
    copyStringSafe(dest, destSize, "");
    return;
  }

  if (value[key].isNull())
  {
    return;
  }

  String incoming = value[key].as<String>();
  incoming.trim();
  if (incoming.length() == 0 || incoming == "********" || incoming == "******")
  {
    return;
  }

  copyStringSafe(dest, destSize, incoming);
}

void updateHexColorIfPresent(JsonObjectConst value, const char *key, char *dest, size_t destSize)
{
  if (value[key].isNull())
  {
    return;
  }
  const String color = value[key].as<String>();
  if (isValidHexColor(color))
  {
    copyStringSafe(dest, destSize, color);
  }
}

void handleSetting(const JsonObject &value)
{
  const bool reboot = value["reboot"] | false;

  if (xConfigMutex != nullptr && xSemaphoreTake(xConfigMutex, pdMS_TO_TICKS(200)) == pdTRUE)
  {
    updateStringFieldIfPresent(value, "ssid", gConfig.wifiSsid, sizeof(gConfig.wifiSsid));
    updateSecretFieldIfPresent(value, "password", gConfig.wifiPass, sizeof(gConfig.wifiPass), "clearPassword");
    updateStringFieldIfPresent(value, "aioUsername", gConfig.adafruitUsername, sizeof(gConfig.adafruitUsername));
    updateSecretFieldIfPresent(value, "aioKey", gConfig.adafruitKey, sizeof(gConfig.adafruitKey), "clearAioKey");
    updateStringFieldIfPresent(value, "feedPrefix", gConfig.adafruitFeedPrefix, sizeof(gConfig.adafruitFeedPrefix));

    updateHexColorIfPresent(value, "themePrimary", gConfig.themePrimaryHex, sizeof(gConfig.themePrimaryHex));
    updateHexColorIfPresent(value, "themeAccent", gConfig.themeAccentHex, sizeof(gConfig.themeAccentHex));
    updateHexColorIfPresent(value, "themeBackground", gConfig.themeBackgroundHex, sizeof(gConfig.themeBackgroundHex));

    if (!value["fanDefaultSpeedPercent"].isNull())
      gConfig.fanDefaultSpeedPercent = clampPercentValue(value["fanDefaultSpeedPercent"] | gConfig.fanDefaultSpeedPercent);
    if (!value["fanAutoSpeedPercent"].isNull())
      gConfig.fanAutoSpeedPercent = clampPercentValue(value["fanAutoSpeedPercent"] | gConfig.fanAutoSpeedPercent);

    if (!value["lightR"].isNull())
      gConfig.lightDefaultR = clampByteValue(value["lightR"] | gConfig.lightDefaultR);
    if (!value["lightG"].isNull())
      gConfig.lightDefaultG = clampByteValue(value["lightG"] | gConfig.lightDefaultG);
    if (!value["lightB"].isNull())
      gConfig.lightDefaultB = clampByteValue(value["lightB"] | gConfig.lightDefaultB);
    if (!value["lightBrightness"].isNull())
      gConfig.lightDefaultBrightness = clampByteValue(value["lightBrightness"] | gConfig.lightDefaultBrightness);

    xSemaphoreGive(xConfigMutex);
  }

  if (Persist_info_File(reboot))
  {
    sendAck("setting_saved", "Da luu cau hinh he thong.");
    if (!reboot)
    {
      sendConfigToWeb();
    }
  }
  else
  {
    sendAck("setting_error", "Khong the luu cau hinh.");
  }
}

void handleThreshold(const JsonObject &value)
{
  if (xConfigMutex == nullptr || xSemaphoreTake(xConfigMutex, pdMS_TO_TICKS(200)) != pdTRUE)
  {
    sendAck("threshold_error", "Khong the cap nhat runtime config.");
    return;
  }

  gConfig.tempColdThreshold = value["tempCold"] | gConfig.tempColdThreshold;
  gConfig.tempHotThreshold = value["tempHot"] | gConfig.tempHotThreshold;
  gConfig.humiDryThreshold = value["humiDry"] | gConfig.humiDryThreshold;
  gConfig.humiHumidThreshold = value["humiHumid"] | gConfig.humiHumidThreshold;
  gConfig.aiOnThreshold = constrain((float)(value["aiOn"] | gConfig.aiOnThreshold), 0.0f, 1.0f);
  gConfig.aiOffThreshold = constrain((float)(value["aiOff"] | gConfig.aiOffThreshold), 0.0f, 1.0f);

  gConfig.sensorPeriodMs = clampMs(value["sensorPeriodMs"] | gConfig.sensorPeriodMs, 500, 60000);
  gConfig.inferencePeriodMs = clampMs(value["inferencePeriodMs"] | gConfig.inferencePeriodMs, 500, 60000);
  gConfig.telemetryPeriodMs = clampMs(value["telemetryPeriodMs"] | gConfig.telemetryPeriodMs, 5000, 120000);
  const uint32_t overrideMinutes = value["overrideMinutes"] | (gConfig.manualOverrideMs / 60000UL);
  gConfig.manualOverrideMs = clampMs(overrideMinutes * 60000UL, 10000, 24UL * 60UL * 60000UL);
  gConfig.voiceIndicatorHoldMs = clampMs(value["voiceHoldMs"] | gConfig.voiceIndicatorHoldMs, 1000, 60000);

  gConfig.autoFanEnabled = value["autoFanEnabled"] | gConfig.autoFanEnabled;
  gConfig.onboardLedEnabled = value["onboardLedEnabled"] | gConfig.onboardLedEnabled;
  gConfig.onboardRgbEnabled = value["onboardRgbEnabled"] | gConfig.onboardRgbEnabled;

  if (!value["fanDefaultSpeedPercent"].isNull())
    gConfig.fanDefaultSpeedPercent = clampPercentValue(value["fanDefaultSpeedPercent"] | gConfig.fanDefaultSpeedPercent);
  if (!value["fanAutoSpeedPercent"].isNull())
    gConfig.fanAutoSpeedPercent = clampPercentValue(value["fanAutoSpeedPercent"] | gConfig.fanAutoSpeedPercent);

  if (!value["fanRampStartPercent"].isNull())
    gConfig.fanRampStartPercent = clampPercentValue(value["fanRampStartPercent"] | gConfig.fanRampStartPercent);
  if (!value["fanRampMidPercent"].isNull())
    gConfig.fanRampMidPercent = clampPercentValue(value["fanRampMidPercent"] | gConfig.fanRampMidPercent);
  if (!value["fanRampEndPercent"].isNull())
    gConfig.fanRampEndPercent = clampPercentValue(value["fanRampEndPercent"] | gConfig.fanRampEndPercent);

  if (!value["fanRampMidMinutes"].isNull())
  {
    const uint32_t minutes = value["fanRampMidMinutes"] | (gConfig.fanRampMidpointMs / 60000UL);
    gConfig.fanRampMidpointMs = clampMs(minutes * 60000UL, 60UL * 1000UL, 30UL * 60UL * 1000UL);
  }
  if (!value["fanRampFullMinutes"].isNull())
  {
    const uint32_t minutes = value["fanRampFullMinutes"] | (gConfig.fanRampFullMs / 60000UL);
    gConfig.fanRampFullMs = clampMs(minutes * 60000UL, 2UL * 60UL * 1000UL, 60UL * 60UL * 1000UL);
  }

  if (!value["lightR"].isNull())
    gConfig.lightDefaultR = clampByteValue(value["lightR"] | gConfig.lightDefaultR);
  if (!value["lightG"].isNull())
    gConfig.lightDefaultG = clampByteValue(value["lightG"] | gConfig.lightDefaultG);
  if (!value["lightB"].isNull())
    gConfig.lightDefaultB = clampByteValue(value["lightB"] | gConfig.lightDefaultB);
  if (!value["lightBrightness"].isNull())
    gConfig.lightDefaultBrightness = clampByteValue(value["lightBrightness"] | gConfig.lightDefaultBrightness);

  if (gConfig.tempColdThreshold > gConfig.tempHotThreshold)
  {
    const float mid = (gConfig.tempColdThreshold + gConfig.tempHotThreshold) * 0.5f;
    gConfig.tempColdThreshold = mid - 0.5f;
    gConfig.tempHotThreshold = mid + 0.5f;
  }
  if (gConfig.humiDryThreshold > gConfig.humiHumidThreshold)
  {
    const float mid = (gConfig.humiDryThreshold + gConfig.humiHumidThreshold) * 0.5f;
    gConfig.humiDryThreshold = mid - 1.0f;
    gConfig.humiHumidThreshold = mid + 1.0f;
  }
  if (gConfig.aiOffThreshold > gConfig.aiOnThreshold)
  {
    const float mid = (gConfig.aiOffThreshold + gConfig.aiOnThreshold) * 0.5f;
    gConfig.aiOffThreshold = constrain(mid - 0.05f, 0.0f, 1.0f);
    gConfig.aiOnThreshold = constrain(mid + 0.05f, 0.0f, 1.0f);
  }

  const float minGap = 0.05f;
  const float maxGap = 0.12f;
  float gap = gConfig.aiOnThreshold - gConfig.aiOffThreshold;

  if (gap < minGap)
  {
    gConfig.aiOffThreshold = constrain(gConfig.aiOnThreshold - minGap, 0.0f, 1.0f);
  }
  else if (gap > maxGap)
  {
    gConfig.aiOffThreshold = constrain(gConfig.aiOnThreshold - maxGap, 0.0f, 1.0f);
  }

  if (gConfig.fanRampMidPercent < gConfig.fanRampStartPercent)
  {
    gConfig.fanRampMidPercent = gConfig.fanRampStartPercent;
  }
  if (gConfig.fanRampEndPercent < gConfig.fanRampMidPercent)
  {
    gConfig.fanRampEndPercent = gConfig.fanRampMidPercent;
  }
  if (gConfig.fanRampFullMs <= gConfig.fanRampMidpointMs)
  {
    gConfig.fanRampFullMs = gConfig.fanRampMidpointMs + 60UL * 1000UL;
  }

  xSemaphoreGive(xConfigMutex);

  if (Persist_info_File(false))
  {
    sendAck("threshold_saved", "Đã lưu runtime config.");
    sendConfigToWeb();
  }
  else
  {
    sendAck("threshold_error", "Không thể persist runtime config.");
  }
}

void handleDevice(const JsonObject &value)
{
  const String name = value["name"] | "";
  const String action = value["action"] | "";
  const String status = value["status"] | "OFF";
  const bool isOn = status.equalsIgnoreCase("ON");

  if (name == "LED1" || name == "LED2")
  {
    if (xConfigMutex != nullptr && xSemaphoreTake(xConfigMutex, pdMS_TO_TICKS(50)) == pdTRUE)
    {
      if (name == "LED1")
      {
        gConfig.onboardLedEnabled = isOn;
      }
      else
      {
        gConfig.onboardRgbEnabled = isOn;
      }
      xSemaphoreGive(xConfigMutex);
      Persist_info_File(false);
    }
    sendConfigToWeb();
    return;
  }

  CommandMessage cmd = {};
  cmd.source = CMD_SOURCE_LOCAL_WEB;

  if (name == "FAN")
  {
    const uint8_t speed = clampPercentValue(value["speed"] | value["speedPercent"] | 0);

    if (action.equalsIgnoreCase("AUTO"))
    {
      cmd.type = CMD_FAN_RETURN_AUTO;
      enqueueCommand(cmd);
      sendAck("fan_command_queued", "Da tra quat ve AUTO.");
      return;
    }

    if (action.equalsIgnoreCase("SET_SPEED"))
    {
      cmd.type = CMD_FAN_SET_SPEED;
      cmd.hasFanSpeed = true;
      cmd.fanSpeedPercent = speed;
      enqueueCommand(cmd);
      sendAck("fan_command_queued", "Dang cap nhat toc do quat.");
      return;
    }

    cmd.type = isOn ? CMD_FAN_FORCE_ON : CMD_FAN_FORCE_OFF;
    cmd.hasFanSpeed = speed > 0;
    cmd.fanSpeedPercent = speed;
    enqueueCommand(cmd);
    sendAck("fan_command_queued", isOn ? "Dang bat quat." : "Dang tat quat.");
    return;
  }

  if (name == "LIGHT")
  {
    cmd.type = isOn ? CMD_LIGHT_FORCE_ON : CMD_LIGHT_FORCE_OFF;
    cmd.hasLightColor = true;
    cmd.rgbR = clampByteValue(value["r"] | 255);
    cmd.rgbG = clampByteValue(value["g"] | 255);
    cmd.rgbB = clampByteValue(value["b"] | 255);
    cmd.hasLightBrightness = true;
    cmd.brightness = clampByteValue(value["brightness"] | 96);
    enqueueCommand(cmd);
    sendAck("light_command_queued", isOn ? "Dang bat den ngoai." : "Dang tat den ngoai.");
    return;
  }
}

void handleVoice(const JsonObject &value)
{
  CommandMessage cmd = {};
  cmd.source = CMD_SOURCE_VOICE;

  const String action = value["action"] | "";

  if (action.equalsIgnoreCase("fan_on"))
  {
    cmd.type = CMD_FAN_FORCE_ON;
    if (!value["speed"].isNull())
    {
      cmd.hasFanSpeed = true;
      cmd.fanSpeedPercent = clampPercentValue(value["speed"] | 0);
    }
  }
  else if (action.equalsIgnoreCase("fan_off"))
  {
    cmd.type = CMD_FAN_FORCE_OFF;
  }
  else if (action.equalsIgnoreCase("fan_auto"))
  {
    cmd.type = CMD_FAN_RETURN_AUTO;
  }
  else if (action.equalsIgnoreCase("fan_speed"))
  {
    cmd.type = CMD_FAN_SET_SPEED;
    cmd.hasFanSpeed = true;
    cmd.fanSpeedPercent = clampPercentValue(value["speed"] | 0);
  }
  else if (action.equalsIgnoreCase("light_on"))
  {
    cmd.type = CMD_LIGHT_FORCE_ON;
    cmd.hasLightColor = true;
    cmd.rgbR = clampByteValue(value["r"] | 255);
    cmd.rgbG = clampByteValue(value["g"] | 255);
    cmd.rgbB = clampByteValue(value["b"] | 255);
    cmd.hasLightBrightness = true;
    cmd.brightness = clampByteValue(value["brightness"] | 96);
  }
  else if (action.equalsIgnoreCase("light_off"))
  {
    cmd.type = CMD_LIGHT_FORCE_OFF;
  }
  else if (action.equalsIgnoreCase("light_rgb"))
  {
    cmd.type = CMD_LIGHT_SET_RGB;
    cmd.hasLightColor = true;
    cmd.rgbR = clampByteValue(value["r"] | 255);
    cmd.rgbG = clampByteValue(value["g"] | 255);
    cmd.rgbB = clampByteValue(value["b"] | 255);
    cmd.hasLightBrightness = true;
    cmd.brightness = clampByteValue(value["brightness"] | 96);
  }
  else if (action.equalsIgnoreCase("voice_active"))
  {
    cmd.type = CMD_SET_VOICE_ACTIVE;
  }
  else if (action.equalsIgnoreCase("voice_idle"))
  {
    cmd.type = CMD_SET_VOICE_IDLE;
  }
  else
  {
    sendAck("voice_error", "Lenh giong noi khong hop le.");
    return;
  }

  enqueueCommand(cmd);
  sendAck("voice_ack", "Da nhan lenh giong noi.");
}
} // namespace

void handleWebSocketMessage(String message)
{
  StaticJsonDocument<1024> doc;
  const DeserializationError error = deserializeJson(doc, message);
  if (error)
  {
    Serial.print("[WS] Invalid JSON: ");
    Serial.println(error.c_str());
    return;
  }

  const String page = doc["page"] | "";
  const JsonObject value = doc["value"].is<JsonObject>() ? doc["value"].as<JsonObject>() : JsonObject();

  if (page == "setting" || page == "theme")
  {
    handleSetting(value);
    return;
  }

  if (page == "threshold" || page == "runtime_config" || page == "automation")
  {
    handleThreshold(value);
    return;
  }

  if (page == "device")
  {
    handleDevice(value);
    return;
  }

  if (page == "voice" || page == "voice_command")
  {
    handleVoice(value);
    return;
  }

  if (page == "get_config" || page == "sync")
  {
    sendConfigToWeb();
    return;
  }

  if (page == "reset_factory")
  {
    sendSimplePage("reset_done");
    delay(120);
    Factory_reset_and_restart(150);
    return;
  }

  if (page == "fan_auto")
  {
    CommandMessage cmd = {};
    cmd.source = CMD_SOURCE_LOCAL_WEB;
    cmd.type = CMD_FAN_RETURN_AUTO;
    enqueueCommand(cmd);
    sendAck("fan_command_queued", "Da tra quat ve AUTO.");
    return;
  }

  sendAck("ws_unknown", "Page command khong duoc ho tro.");
}
