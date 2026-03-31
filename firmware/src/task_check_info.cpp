#include "task_check_info.h"

#include <WiFi.h>
#include "task_webserver.h"
#include "task_wifi.h"

namespace
{
constexpr const char *kInfoPath = "/info.dat";

uint8_t clampPercentValue(int value)
{
  if (value < 0)
  {
    return 0;
  }
  if (value > 100)
  {
    return 100;
  }
  return static_cast<uint8_t>(value);
}

bool isHexColorString(const char *value)
{
  if (value == nullptr || strlen(value) != 7 || value[0] != '#')
  {
    return false;
  }

  for (size_t i = 1; i < 7; ++i)
  {
    if (!isHexadecimalDigit(value[i]))
    {
      return false;
    }
  }
  return true;
}

void ensureHexColor(char *dest, size_t destSize, const char *fallback)
{
  if (!isHexColorString(dest))
  {
    copyStringSafe(dest, destSize, fallback);
  }
}
} // namespace

static void clampLoadedConfig(RuntimeConfig &cfg)
{
  if (cfg.tempColdThreshold > cfg.tempHotThreshold)
  {
    const float mid = (cfg.tempColdThreshold + cfg.tempHotThreshold) * 0.5f;
    cfg.tempColdThreshold = mid - 0.5f;
    cfg.tempHotThreshold = mid + 0.5f;
  }

  if (cfg.humiDryThreshold > cfg.humiHumidThreshold)
  {
    const float mid = (cfg.humiDryThreshold + cfg.humiHumidThreshold) * 0.5f;
    cfg.humiDryThreshold = mid - 1.0f;
    cfg.humiHumidThreshold = mid + 1.0f;
  }

  cfg.humiDryThreshold = constrain(cfg.humiDryThreshold, 0.0f, 100.0f);
  cfg.humiHumidThreshold = constrain(cfg.humiHumidThreshold, 0.0f, 100.0f);
  cfg.aiOffThreshold = constrain(cfg.aiOffThreshold, 0.0f, 1.0f);
  cfg.aiOnThreshold = constrain(cfg.aiOnThreshold, 0.0f, 1.0f);
  if (cfg.aiOffThreshold > cfg.aiOnThreshold)
  {
    const float mid = (cfg.aiOffThreshold + cfg.aiOnThreshold) * 0.5f;
    cfg.aiOffThreshold = constrain(mid - 0.05f, 0.0f, 1.0f);
    cfg.aiOnThreshold = constrain(mid + 0.05f, 0.0f, 1.0f);
  }

  const float minGap = 0.08f;
  const float maxGap = 0.22f;
  float gap = cfg.aiOnThreshold - cfg.aiOffThreshold;

  if (gap < minGap)
  {
    cfg.aiOffThreshold = constrain(cfg.aiOnThreshold - minGap, 0.0f, 1.0f);
  }
  else if (gap > maxGap)
  {
    cfg.aiOffThreshold = constrain(cfg.aiOnThreshold - maxGap, 0.0f, 1.0f);
  }

  cfg.sensorPeriodMs = max<uint32_t>(cfg.sensorPeriodMs, 500);
  cfg.inferencePeriodMs = max<uint32_t>(cfg.inferencePeriodMs, 500);
  cfg.telemetryPeriodMs = max<uint32_t>(cfg.telemetryPeriodMs, 5000);
  cfg.manualOverrideMs = max<uint32_t>(cfg.manualOverrideMs, 10000);
  cfg.voiceIndicatorHoldMs = max<uint32_t>(cfg.voiceIndicatorHoldMs, 1000);

  cfg.fanDefaultSpeedPercent = clampPercentValue(cfg.fanDefaultSpeedPercent);
  cfg.fanAutoSpeedPercent = clampPercentValue(cfg.fanAutoSpeedPercent);
  cfg.fanRampStartPercent = clampPercentValue(cfg.fanRampStartPercent);
  cfg.fanRampMidPercent = clampPercentValue(cfg.fanRampMidPercent);
  cfg.fanRampEndPercent = clampPercentValue(cfg.fanRampEndPercent);

  if (cfg.fanDefaultSpeedPercent == 0)
  {
    cfg.fanDefaultSpeedPercent = 70;
  }
  if (cfg.fanAutoSpeedPercent == 0)
  {
    cfg.fanAutoSpeedPercent = 100;
  }

  if (cfg.fanRampStartPercent == 0)
  {
    cfg.fanRampStartPercent = 50;
  }
  if (cfg.fanRampMidPercent < cfg.fanRampStartPercent)
  {
    cfg.fanRampMidPercent = cfg.fanRampStartPercent;
  }
  if (cfg.fanRampEndPercent < cfg.fanRampMidPercent)
  {
    cfg.fanRampEndPercent = cfg.fanRampMidPercent;
  }

  cfg.fanRampMidpointMs = max<uint32_t>(cfg.fanRampMidpointMs, 60UL * 1000UL);
  cfg.fanRampFullMs = max<uint32_t>(cfg.fanRampFullMs, cfg.fanRampMidpointMs + 60UL * 1000UL);

  if (strlen(cfg.adafruitFeedPrefix) == 0)
  {
    copyStringSafe(cfg.adafruitFeedPrefix, sizeof(cfg.adafruitFeedPrefix), "yolohome");
  }

  ensureHexColor(cfg.themePrimaryHex, sizeof(cfg.themePrimaryHex), "#2563eb");
  ensureHexColor(cfg.themeAccentHex, sizeof(cfg.themeAccentHex), "#14b8a6");
  ensureHexColor(cfg.themeBackgroundHex, sizeof(cfg.themeBackgroundHex), "#0f172a");
}

static bool writeConfigToFile(const RuntimeConfig &cfg)
{
  DynamicJsonDocument doc(6144);
  doc["wifi_ssid"] = cfg.wifiSsid;
  doc["wifi_pass"] = cfg.wifiPass;
  doc["aio_username"] = cfg.adafruitUsername;
  doc["aio_key"] = cfg.adafruitKey;
  doc["aio_feed_prefix"] = cfg.adafruitFeedPrefix;
  doc["temp_cold"] = cfg.tempColdThreshold;
  doc["temp_hot"] = cfg.tempHotThreshold;
  doc["humi_dry"] = cfg.humiDryThreshold;
  doc["humi_humid"] = cfg.humiHumidThreshold;
  doc["ai_on"] = cfg.aiOnThreshold;
  doc["ai_off"] = cfg.aiOffThreshold;
  doc["auto_fan_enabled"] = cfg.autoFanEnabled;
  doc["sensor_period_ms"] = cfg.sensorPeriodMs;
  doc["inference_period_ms"] = cfg.inferencePeriodMs;
  doc["telemetry_period_ms"] = cfg.telemetryPeriodMs;
  doc["manual_override_ms"] = cfg.manualOverrideMs;
  doc["voice_hold_ms"] = cfg.voiceIndicatorHoldMs;
  doc["onboard_led_enabled"] = cfg.onboardLedEnabled;
  doc["onboard_rgb_enabled"] = cfg.onboardRgbEnabled;
  doc["fan_default_speed_percent"] = cfg.fanDefaultSpeedPercent;
  doc["fan_auto_speed_percent"] = cfg.fanAutoSpeedPercent;
  doc["fan_ramp_start_percent"] = cfg.fanRampStartPercent;
  doc["fan_ramp_mid_percent"] = cfg.fanRampMidPercent;
  doc["fan_ramp_end_percent"] = cfg.fanRampEndPercent;
  doc["fan_ramp_mid_ms"] = cfg.fanRampMidpointMs;
  doc["fan_ramp_full_ms"] = cfg.fanRampFullMs;
  doc["light_default_r"] = cfg.lightDefaultR;
  doc["light_default_g"] = cfg.lightDefaultG;
  doc["light_default_b"] = cfg.lightDefaultB;
  doc["light_default_brightness"] = cfg.lightDefaultBrightness;
  doc["theme_primary"] = cfg.themePrimaryHex;
  doc["theme_accent"] = cfg.themeAccentHex;
  doc["theme_background"] = cfg.themeBackgroundHex;

  File configFile = LittleFS.open(kInfoPath, "w");
  if (!configFile)
  {
    Serial.println("[CFG] Unable to open /info.dat for writing");
    return false;
  }

  serializeJson(doc, configFile);
  configFile.close();
  Serial.println("[CFG] Configuration persisted to LittleFS");
  return true;
}

void Load_info_File()
{
  File file = LittleFS.open(kInfoPath, "r");
  if (!file)
  {
    Serial.println("[CFG] /info.dat not found, using defaults");
    return;
  }

  DynamicJsonDocument doc(6144);
  const DeserializationError error = deserializeJson(doc, file);
  file.close();

  if (error)
  {
    Serial.print(F("[CFG] deserializeJson failed: "));
    Serial.println(error.c_str());
    return;
  }

  if (xConfigMutex != nullptr && xSemaphoreTake(xConfigMutex, pdMS_TO_TICKS(200)) == pdTRUE)
  {
    const char *legacyServer = doc["CORE_IOT_SERVER"] | "";
    const char *legacyToken = doc["CORE_IOT_TOKEN"] | "";
    const char *aioUser = doc["aio_username"] | legacyServer;
    const char *aioKey = doc["aio_key"] | legacyToken;

    copyStringSafe(gConfig.wifiSsid, sizeof(gConfig.wifiSsid), doc["wifi_ssid"] | "");
    copyStringSafe(gConfig.wifiPass, sizeof(gConfig.wifiPass), doc["wifi_pass"] | "");
    copyStringSafe(gConfig.adafruitUsername, sizeof(gConfig.adafruitUsername), aioUser);
    copyStringSafe(gConfig.adafruitKey, sizeof(gConfig.adafruitKey), aioKey);
    copyStringSafe(gConfig.adafruitFeedPrefix, sizeof(gConfig.adafruitFeedPrefix), doc["aio_feed_prefix"] | "yolohome");

    copyStringSafe(gConfig.themePrimaryHex, sizeof(gConfig.themePrimaryHex), doc["theme_primary"] | gConfig.themePrimaryHex);
    copyStringSafe(gConfig.themeAccentHex, sizeof(gConfig.themeAccentHex), doc["theme_accent"] | gConfig.themeAccentHex);
    copyStringSafe(gConfig.themeBackgroundHex, sizeof(gConfig.themeBackgroundHex), doc["theme_background"] | gConfig.themeBackgroundHex);

    gConfig.tempColdThreshold = doc["temp_cold"] | gConfig.tempColdThreshold;
    gConfig.tempHotThreshold = doc["temp_hot"] | gConfig.tempHotThreshold;
    gConfig.humiDryThreshold = doc["humi_dry"] | gConfig.humiDryThreshold;
    gConfig.humiHumidThreshold = doc["humi_humid"] | gConfig.humiHumidThreshold;
    gConfig.aiOnThreshold = doc["ai_on"] | gConfig.aiOnThreshold;
    gConfig.aiOffThreshold = doc["ai_off"] | gConfig.aiOffThreshold;
    gConfig.autoFanEnabled = doc["auto_fan_enabled"] | gConfig.autoFanEnabled;
    gConfig.sensorPeriodMs = doc["sensor_period_ms"] | gConfig.sensorPeriodMs;
    gConfig.inferencePeriodMs = doc["inference_period_ms"] | gConfig.inferencePeriodMs;
    gConfig.telemetryPeriodMs = doc["telemetry_period_ms"] | gConfig.telemetryPeriodMs;
    gConfig.manualOverrideMs = doc["manual_override_ms"] | gConfig.manualOverrideMs;
    gConfig.voiceIndicatorHoldMs = doc["voice_hold_ms"] | gConfig.voiceIndicatorHoldMs;
    gConfig.onboardLedEnabled = doc["onboard_led_enabled"] | gConfig.onboardLedEnabled;
    gConfig.onboardRgbEnabled = doc["onboard_rgb_enabled"] | gConfig.onboardRgbEnabled;
    gConfig.fanDefaultSpeedPercent = doc["fan_default_speed_percent"] | gConfig.fanDefaultSpeedPercent;
    gConfig.fanAutoSpeedPercent = doc["fan_auto_speed_percent"] | gConfig.fanAutoSpeedPercent;
    gConfig.fanRampStartPercent = doc["fan_ramp_start_percent"] | gConfig.fanRampStartPercent;
    gConfig.fanRampMidPercent = doc["fan_ramp_mid_percent"] | gConfig.fanRampMidPercent;
    gConfig.fanRampEndPercent = doc["fan_ramp_end_percent"] | gConfig.fanRampEndPercent;
    gConfig.fanRampMidpointMs = doc["fan_ramp_mid_ms"] | gConfig.fanRampMidpointMs;
    gConfig.fanRampFullMs = doc["fan_ramp_full_ms"] | gConfig.fanRampFullMs;
    gConfig.lightDefaultR = doc["light_default_r"] | gConfig.lightDefaultR;
    gConfig.lightDefaultG = doc["light_default_g"] | gConfig.lightDefaultG;
    gConfig.lightDefaultB = doc["light_default_b"] | gConfig.lightDefaultB;
    gConfig.lightDefaultBrightness = doc["light_default_brightness"] | gConfig.lightDefaultBrightness;

    clampLoadedConfig(gConfig);
    xSemaphoreGive(xConfigMutex);
  }

  Serial.println("[CFG] Configuration loaded from LittleFS");
}

bool Factory_reset_and_restart(uint32_t restartDelayMs)
{
  Serial.println("[CFG] Factory reset requested");

  Webserver_stop();
  WiFi.disconnect(true, true);
  WiFi.mode(WIFI_OFF);
  delay(50);

  if (!LittleFS.begin(true))
  {
    Serial.println("[CFG] LittleFS mount failed during factory reset");
  }
  else
  {
    if (LittleFS.exists(kInfoPath))
    {
      if (LittleFS.remove(kInfoPath))
      {
        Serial.println("[CFG] Deleted /info.dat (Configs reset)");
      }
      else
      {
        Serial.println("[CFG] Failed to delete /info.dat");
      }
    }
    LittleFS.end();
  }

  if (xConfigMutex != nullptr && xSemaphoreTake(xConfigMutex, pdMS_TO_TICKS(200)) == pdTRUE)
  {
    resetRuntimeConfigToDefaults();
    xSemaphoreGive(xConfigMutex);
  }

  if (xStateMutex != nullptr && xSemaphoreTake(xStateMutex, pdMS_TO_TICKS(200)) == pdTRUE)
  {
    resetSystemStateToDefaults();
    xSemaphoreGive(xStateMutex);
  }

  delay(restartDelayMs);
  Serial.println("[CFG] Restarting after factory reset...");
  Serial.flush();
  ESP.restart();
  return true;
}

void Delete_info_File()
{
  Factory_reset_and_restart(150);
}

bool Persist_info_File(bool restartAfter)
{
  RuntimeConfig cfg;
  if (!getRuntimeConfig(cfg))
  {
    Serial.println("[CFG] Unable to snapshot runtime config");
    return false;
  }

  clampLoadedConfig(cfg);
  const bool ok = writeConfigToFile(cfg);
  if (ok && restartAfter)
  {
    Serial.println("[CFG] Restarting to apply configuration...");
    delay(120);
    ESP.restart();
  }
  return ok;
}

void Save_info_File(String wifiSsid,
                    String wifiPass,
                    String adafruitUsername,
                    String adafruitKey,
                    String reserved)
{
  (void)reserved;

  if (xConfigMutex != nullptr && xSemaphoreTake(xConfigMutex, pdMS_TO_TICKS(200)) == pdTRUE)
  {
    copyStringSafe(gConfig.wifiSsid, sizeof(gConfig.wifiSsid), wifiSsid);
    copyStringSafe(gConfig.wifiPass, sizeof(gConfig.wifiPass), wifiPass);
    copyStringSafe(gConfig.adafruitUsername, sizeof(gConfig.adafruitUsername), adafruitUsername);
    copyStringSafe(gConfig.adafruitKey, sizeof(gConfig.adafruitKey), adafruitKey);
    xSemaphoreGive(xConfigMutex);
  }

  Persist_info_File(true);
}

bool check_info_File(bool checkOnly)
{
  if (!checkOnly)
  {
    if (!LittleFS.begin(true))
    {
      Serial.println("[CFG] LittleFS mount failed");
      return false;
    }
    Load_info_File();
  }

  RuntimeConfig cfg;
  if (!getRuntimeConfig(cfg))
  {
    return false;
  }

  if (strlen(cfg.wifiSsid) == 0)
  {
    if (!checkOnly)
    {
      startAP();
    }
    return false;
  }
  return true;
}
