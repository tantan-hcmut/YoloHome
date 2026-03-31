#include "task_adafruit_io.h"

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "global.h"
#include "task_check_info.h"
#include "task_webserver.h"
#include "task_wifi.h"

namespace
{
constexpr uint16_t MQTT_BUFFER_SIZE_BYTES = 1024;
constexpr uint32_t TELEMETRY_PERIOD_MIN_MS = 30000;
constexpr uint32_t MIRROR_FEED_INTERVAL_MS = 3000;
constexpr uint8_t MIRROR_FEED_SLOT_COUNT = 4;

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

char topicCommand[128];
char topicConfig[128];
char topicTelemetry[128];
char topicTemp[128];
char topicHumi[128];
char topicFan[128];
char topicLight[128];
char topicTinyml[128];
char topicStatus[128];

char activeCloudUsername[64] = {};
char activeCloudKey[128] = {};
char activeCloudPrefix[32] = {};

bool enqueueCommand(const CommandMessage &cmd);
bool enqueueSimple(CommandType type, CommandSource source);

uint8_t clampByteValue(int value)
{
  if (value < 0)
  {
    return 0;
  }
  if (value > 255)
  {
    return 255;
  }
  return static_cast<uint8_t>(value);
}

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

const char *resolvePrefix(const RuntimeConfig &cfg)
{
  return strlen(cfg.adafruitFeedPrefix) == 0 ? "yolohome" : cfg.adafruitFeedPrefix;
}

void resolveGroupedFeedKeys(const char *prefix, const char *feedSuffix, String &groupKey, String &feedKey)
{
  const String rawPrefix = (prefix == nullptr || strlen(prefix) == 0) ? String("yolohome") : String(prefix);
  const int dotPos = rawPrefix.lastIndexOf('.');

  if (dotPos >= 0)
  {
    groupKey = rawPrefix.substring(0, dotPos);
    String feedBase = rawPrefix.substring(dotPos + 1);
    if (groupKey.length() == 0)
    {
      groupKey = "yolohome";
    }
    if (feedBase.length() == 0)
    {
      feedBase = groupKey;
    }
    feedKey = feedBase + "-" + feedSuffix;
    return;
  }

  groupKey = rawPrefix;
  feedKey = rawPrefix + "-" + feedSuffix;
}

void buildTopic(char *dest, size_t destSize, const char *username, const char *prefix, const char *feedSuffix)
{
  String groupKey;
  String feedKey;
  resolveGroupedFeedKeys(prefix, feedSuffix, groupKey, feedKey);

  const String groupedKey = groupKey + "." + feedKey;
  snprintf(dest, destSize, "%s/f/%s", username, groupedKey.c_str());
}

const char *overrideModeToText(const OverrideMode mode)
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

String normalizedPayloadText(const String &rawMessage)
{
  String message = rawMessage;
  message.trim();
  if (message.length() >= 2 && message[0] == '"' && message[message.length() - 1] == '"')
  {
    message = message.substring(1, message.length() - 1);
    message.trim();
  }
  return message;
}

bool enqueueFanFeedCommand(const String &rawMessage)
{
  const String message = normalizedPayloadText(rawMessage);
  if (message.equalsIgnoreCase("ON") || message.equalsIgnoreCase("1") || message.equalsIgnoreCase("true") || message.equalsIgnoreCase("fan_on"))
  {
    return enqueueSimple(CMD_FAN_FORCE_ON, CMD_SOURCE_CLOUD);
  }
  if (message.equalsIgnoreCase("OFF") || message.equalsIgnoreCase("0") || message.equalsIgnoreCase("false") || message.equalsIgnoreCase("fan_off"))
  {
    return enqueueSimple(CMD_FAN_FORCE_OFF, CMD_SOURCE_CLOUD);
  }
  if (message.equalsIgnoreCase("AUTO") || message.equalsIgnoreCase("fan_auto"))
  {
    return enqueueSimple(CMD_FAN_RETURN_AUTO, CMD_SOURCE_CLOUD);
  }
  return false;
}

bool enqueueLightFeedCommand(const String &rawMessage)
{
  const String message = normalizedPayloadText(rawMessage);
  if (message.equalsIgnoreCase("ON") || message.equalsIgnoreCase("1") || message.equalsIgnoreCase("true") || message.equalsIgnoreCase("light_on"))
  {
    return enqueueSimple(CMD_LIGHT_FORCE_ON, CMD_SOURCE_CLOUD);
  }
  if (message.equalsIgnoreCase("OFF") || message.equalsIgnoreCase("0") || message.equalsIgnoreCase("false") || message.equalsIgnoreCase("light_off"))
  {
    return enqueueSimple(CMD_LIGHT_FORCE_OFF, CMD_SOURCE_CLOUD);
  }
  return false;
}

void sendWebCloudState(const bool cloudConnected)
{
  StaticJsonDocument<128> doc;
  doc["page"] = "cloud";
  doc["connected"] = cloudConnected;
  String out;
  serializeJson(doc, out);
  Webserver_sendata(out);
}

bool enqueueCommand(const CommandMessage &cmd)
{
  if (qUserCommands == nullptr)
  {
    return false;
  }
  return xQueueSend(qUserCommands, &cmd, pdMS_TO_TICKS(20)) == pdTRUE;
}

bool enqueueSimple(CommandType type, CommandSource source)
{
  CommandMessage cmd = {};
  cmd.type = type;
  cmd.source = source;
  return enqueueCommand(cmd);
}

void mqttCallback(char *topic, byte *payload, unsigned int length)
{
  String message;
  message.reserve(length + 1);
  for (unsigned int i = 0; i < length; ++i)
  {
    message += static_cast<char>(payload[i]);
  }

  Serial.printf("[AIO] %s <= %s\n", topic, message.c_str());

  const bool isCommandTopic = String(topic) == String(topicCommand);
  const bool isConfigTopic = String(topic) == String(topicConfig);
  const bool isFanTopic = String(topic) == String(topicFan);
  const bool isLightTopic = String(topic) == String(topicLight);

  if (isCommandTopic)
  {
    StaticJsonDocument<768> doc;
    if (deserializeJson(doc, message) == DeserializationError::Ok)
    {
      const String action = doc["action"] | "";
      const String sourceStr = doc["source"] | "cloud";
      const CommandSource source = sourceStr.equalsIgnoreCase("voice") ? CMD_SOURCE_VOICE : CMD_SOURCE_CLOUD;

      if (action.equalsIgnoreCase("fan_on"))
      {
        CommandMessage cmd = {};
        cmd.type = CMD_FAN_FORCE_ON;
        cmd.source = source;
        if (!doc["speed"].isNull())
        {
          cmd.hasFanSpeed = true;
          cmd.fanSpeedPercent = clampPercentValue(doc["speed"] | 0);
        }
        enqueueCommand(cmd);
      }
      else if (action.equalsIgnoreCase("fan_off"))
      {
        enqueueSimple(CMD_FAN_FORCE_OFF, source);
      }
      else if (action.equalsIgnoreCase("fan_auto"))
      {
        enqueueSimple(CMD_FAN_RETURN_AUTO, source);
      }
      else if (action.equalsIgnoreCase("fan_speed"))
      {
        CommandMessage cmd = {};
        cmd.type = CMD_FAN_SET_SPEED;
        cmd.source = source;
        cmd.hasFanSpeed = true;
        cmd.fanSpeedPercent = clampPercentValue(doc["speed"] | 0);
        enqueueCommand(cmd);
      }
      else if (action.equalsIgnoreCase("voice_active"))
      {
        enqueueSimple(CMD_SET_VOICE_ACTIVE, source);
      }
      else if (action.equalsIgnoreCase("voice_idle"))
      {
        enqueueSimple(CMD_SET_VOICE_IDLE, source);
      }
      else if (action.equalsIgnoreCase("light_on"))
      {
        CommandMessage cmd = {};
        cmd.type = CMD_LIGHT_FORCE_ON;
        cmd.source = source;
        cmd.hasLightColor = true;
        cmd.rgbR = clampByteValue(doc["r"] | 255);
        cmd.rgbG = clampByteValue(doc["g"] | 255);
        cmd.rgbB = clampByteValue(doc["b"] | 255);
        cmd.hasLightBrightness = true;
        cmd.brightness = clampByteValue(doc["brightness"] | 96);
        enqueueCommand(cmd);
      }
      else if (action.equalsIgnoreCase("light_off"))
      {
        enqueueSimple(CMD_LIGHT_FORCE_OFF, source);
      }
      else if (action.equalsIgnoreCase("light_rgb"))
      {
        CommandMessage cmd = {};
        cmd.type = CMD_LIGHT_SET_RGB;
        cmd.source = source;
        cmd.hasLightColor = true;
        cmd.rgbR = clampByteValue(doc["r"] | 255);
        cmd.rgbG = clampByteValue(doc["g"] | 255);
        cmd.rgbB = clampByteValue(doc["b"] | 255);
        cmd.hasLightBrightness = true;
        cmd.brightness = clampByteValue(doc["brightness"] | 96);
        enqueueCommand(cmd);
      }
      return;
    }

    if (message.equalsIgnoreCase("fan_on"))
    {
      enqueueSimple(CMD_FAN_FORCE_ON, CMD_SOURCE_CLOUD);
    }
    else if (message.equalsIgnoreCase("fan_off"))
    {
      enqueueSimple(CMD_FAN_FORCE_OFF, CMD_SOURCE_CLOUD);
    }
    else if (message.equalsIgnoreCase("fan_auto"))
    {
      enqueueSimple(CMD_FAN_RETURN_AUTO, CMD_SOURCE_CLOUD);
    }
    else if (message.equalsIgnoreCase("light_on"))
    {
      enqueueSimple(CMD_LIGHT_FORCE_ON, CMD_SOURCE_CLOUD);
    }
    else if (message.equalsIgnoreCase("light_off"))
    {
      enqueueSimple(CMD_LIGHT_FORCE_OFF, CMD_SOURCE_CLOUD);
    }
    return;
  }


  if (isFanTopic)
  {
    enqueueFanFeedCommand(message);
    return;
  }

  if (isLightTopic)
  {
    enqueueLightFeedCommand(message);
    return;
  }

  if (isConfigTopic)
  {
    StaticJsonDocument<1024> doc;
    if (deserializeJson(doc, message) != DeserializationError::Ok)
    {
      return;
    }

    if (xConfigMutex != nullptr && xSemaphoreTake(xConfigMutex, pdMS_TO_TICKS(200)) == pdTRUE)
    {
      gConfig.tempColdThreshold = doc["tempCold"] | gConfig.tempColdThreshold;
      gConfig.tempHotThreshold = doc["tempHot"] | gConfig.tempHotThreshold;
      gConfig.humiDryThreshold = doc["humiDry"] | gConfig.humiDryThreshold;
      gConfig.humiHumidThreshold = doc["humiHumid"] | gConfig.humiHumidThreshold;
      gConfig.aiOnThreshold = doc["aiOn"] | gConfig.aiOnThreshold;
      gConfig.aiOffThreshold = doc["aiOff"] | gConfig.aiOffThreshold;
      gConfig.autoFanEnabled = doc["autoFanEnabled"] | gConfig.autoFanEnabled;
      gConfig.telemetryPeriodMs = max<uint32_t>(doc["telemetryPeriodMs"] | gConfig.telemetryPeriodMs, 5000UL);
      gConfig.manualOverrideMs = max<uint32_t>((doc["overrideMinutes"] | (gConfig.manualOverrideMs / 60000UL)) * 60000UL, 10000UL);
      gConfig.voiceIndicatorHoldMs = doc["voiceHoldMs"] | gConfig.voiceIndicatorHoldMs;
      gConfig.fanDefaultSpeedPercent = clampPercentValue(doc["fanDefaultSpeedPercent"] | gConfig.fanDefaultSpeedPercent);
      gConfig.fanAutoSpeedPercent = clampPercentValue(doc["fanAutoSpeedPercent"] | gConfig.fanAutoSpeedPercent);
      gConfig.fanRampStartPercent = clampPercentValue(doc["fanRampStartPercent"] | gConfig.fanRampStartPercent);
      gConfig.fanRampMidPercent = clampPercentValue(doc["fanRampMidPercent"] | gConfig.fanRampMidPercent);
      gConfig.fanRampEndPercent = clampPercentValue(doc["fanRampEndPercent"] | gConfig.fanRampEndPercent);
      gConfig.fanRampMidpointMs = max<uint32_t>((doc["fanRampMidMinutes"] | (gConfig.fanRampMidpointMs / 60000UL)) * 60000UL, 60UL * 1000UL);
      gConfig.fanRampFullMs = max<uint32_t>((doc["fanRampFullMinutes"] | (gConfig.fanRampFullMs / 60000UL)) * 60000UL, gConfig.fanRampMidpointMs + 60UL * 1000UL);
      gConfig.lightDefaultR = clampByteValue(doc["lightR"] | gConfig.lightDefaultR);
      gConfig.lightDefaultG = clampByteValue(doc["lightG"] | gConfig.lightDefaultG);
      gConfig.lightDefaultB = clampByteValue(doc["lightB"] | gConfig.lightDefaultB);
      gConfig.lightDefaultBrightness = clampByteValue(doc["lightBrightness"] | gConfig.lightDefaultBrightness);
      xSemaphoreGive(xConfigMutex);
    }

    Persist_info_File(false);
    Webserver_sendata("{\"page\":\"cloud_config_updated\"}");
  }
}

bool cloudConfigChanged(const RuntimeConfig &cfg)
{
  if (strncmp(activeCloudUsername, cfg.adafruitUsername, sizeof(activeCloudUsername)) != 0)
  {
    return true;
  }
  if (strncmp(activeCloudKey, cfg.adafruitKey, sizeof(activeCloudKey)) != 0)
  {
    return true;
  }
  if (strncmp(activeCloudPrefix, resolvePrefix(cfg), sizeof(activeCloudPrefix)) != 0)
  {
    return true;
  }
  return false;
}

bool connectMqtt(RuntimeConfig &cfg)
{
  if (strlen(cfg.adafruitUsername) == 0 || strlen(cfg.adafruitKey) == 0)
  {
    return false;
  }

  mqttClient.setServer("io.adafruit.com", 1883);
  mqttClient.setBufferSize(MQTT_BUFFER_SIZE_BYTES);
  mqttClient.setKeepAlive(30);
  mqttClient.setSocketTimeout(5);
  mqttClient.setCallback(mqttCallback);

  const char *prefix = resolvePrefix(cfg);
  buildTopic(topicCommand, sizeof(topicCommand), cfg.adafruitUsername, prefix, "command");
  buildTopic(topicConfig, sizeof(topicConfig), cfg.adafruitUsername, prefix, "config");
  buildTopic(topicTelemetry, sizeof(topicTelemetry), cfg.adafruitUsername, prefix, "telemetry");
  buildTopic(topicTemp, sizeof(topicTemp), cfg.adafruitUsername, prefix, "temp");
  buildTopic(topicHumi, sizeof(topicHumi), cfg.adafruitUsername, prefix, "humi");
  buildTopic(topicFan, sizeof(topicFan), cfg.adafruitUsername, prefix, "fan");
  buildTopic(topicLight, sizeof(topicLight), cfg.adafruitUsername, prefix, "light");
  buildTopic(topicTinyml, sizeof(topicTinyml), cfg.adafruitUsername, prefix, "tinyml");
  buildTopic(topicStatus, sizeof(topicStatus), cfg.adafruitUsername, prefix, "status");

  const String clientId = String("YoloHome-") + String((uint32_t)ESP.getEfuseMac(), HEX);
  const bool ok = mqttClient.connect(clientId.c_str(), cfg.adafruitUsername, cfg.adafruitKey);
  if (!ok)
  {
    Serial.printf("[AIO] MQTT connect failed rc=%d\n", mqttClient.state());
    return false;
  }

  mqttClient.subscribe(topicCommand);
  mqttClient.subscribe(topicConfig);
  mqttClient.subscribe(topicFan);
  mqttClient.subscribe(topicLight);
  copyStringSafe(activeCloudUsername, sizeof(activeCloudUsername), cfg.adafruitUsername);
  copyStringSafe(activeCloudKey, sizeof(activeCloudKey), cfg.adafruitKey);
  copyStringSafe(activeCloudPrefix, sizeof(activeCloudPrefix), resolvePrefix(cfg));
  Serial.println("[AIO] MQTT connected and subscribed");
  return true;
}

void publishCompactTelemetry(const SystemState &st)
{
  StaticJsonDocument<640> doc;
  doc["temp"] = st.temperature;
  doc["humi"] = st.humidity;
  doc["fanOn"] = st.fanOn;
  doc["fanSpeedPercent"] = st.fanSpeedPercent;
  doc["lightOn"] = st.lightOn;
  doc["lightR"] = st.lightR;
  doc["lightG"] = st.lightG;
  doc["lightB"] = st.lightB;
  doc["lightBrightness"] = st.lightBrightness;
  doc["wifi"] = st.wifiConnected;
  doc["cloud"] = st.cloudConnected;
  doc["voice"] = st.voiceActive;
  doc["overrideMode"] = static_cast<uint8_t>(st.overrideMode);
  doc["tinymlScore"] = st.tinymlScore;
  doc["tinymlSmooth"] = st.tinymlSmoothedScore;
  doc["tinymlHot"] = st.tinymlPredictedHot;
  doc["sensorValid"] = st.sensorValid;
  doc["aiCoolingElapsedMs"] = st.aiCoolingElapsedMs;
  doc["aiTargetFanSpeedPercent"] = st.aiTargetFanSpeedPercent;
  doc["ts"] = millis();

  String payload;
  serializeJson(doc, payload);
  mqttClient.publish(topicTelemetry, payload.c_str());
}

void publishMirrorFeedSlot(const SystemState &st, const uint8_t slot)
{
  switch (slot % MIRROR_FEED_SLOT_COUNT)
  {
  case 0:
  {
    const String tempValue = String(st.temperature, 2);
    mqttClient.publish(topicTemp, tempValue.c_str());
    break;
  }
  case 1:
  {
    const String humiValue = String(st.humidity, 2);
    mqttClient.publish(topicHumi, humiValue.c_str());
    break;
  }
  case 2:
  {
    const String tinymlValue = String(st.tinymlSmoothedScore, 3);
    mqttClient.publish(topicTinyml, tinymlValue.c_str());
    break;
  }
  case 3:
  default:
    mqttClient.publish(topicStatus, overrideModeToText(st.overrideMode));
    break;
  }
}
} // namespace

void task_adafruit_io(void *pvParameters)
{
  (void)pvParameters;

  uint32_t lastTelemetryMs = 0;
  uint32_t lastMirrorMs = 0;
  uint8_t mirrorFeedSlot = 0;
  bool cloudConnected = false;

  for (;;)
  {
    RuntimeConfig cfg;
    SystemState st;
    getRuntimeConfig(cfg);
    getSystemState(st);

    const bool wifiConnected = Wifi_reconnect();

    if (!wifiConnected && mqttClient.connected())
    {
      mqttClient.disconnect();
      cloudConnected = false;
    }

    if (wifiConnected && mqttClient.connected() && cloudConfigChanged(cfg))
    {
      Serial.println("[AIO] Cloud config changed, reconnecting MQTT...");
      mqttClient.disconnect();
      cloudConnected = false;
    }

    if (wifiConnected)
    {
      if (!mqttClient.connected())
      {
        cloudConnected = connectMqtt(cfg);
        if (cloudConnected)
        {
          lastTelemetryMs = 0;
          lastMirrorMs = 0;
          mirrorFeedSlot = 0;
        }
        updateConnectivityState(true, cloudConnected, WiFi.getMode() == WIFI_AP_STA || WiFi.getMode() == WIFI_AP);
        sendWebCloudState(cloudConnected);
      }
      else
      {
        cloudConnected = true;
      }

      if (mqttClient.connected())
      {
        mqttClient.loop();
        const uint32_t nowMs = millis();

        const uint32_t effectiveTelemetryPeriodMs = max<uint32_t>(cfg.telemetryPeriodMs, TELEMETRY_PERIOD_MIN_MS);

        if (lastTelemetryMs == 0 || (nowMs - lastTelemetryMs) >= effectiveTelemetryPeriodMs)
        {
          getSystemState(st);
          publishCompactTelemetry(st);
          lastTelemetryMs = nowMs;

          if (xStateMutex != nullptr && xSemaphoreTake(xStateMutex, pdMS_TO_TICKS(20)) == pdTRUE)
          {
            gState.telemetryTimestampMs = lastTelemetryMs;
            xSemaphoreGive(xStateMutex);
          }
        }

        if (lastMirrorMs == 0 || (nowMs - lastMirrorMs) >= MIRROR_FEED_INTERVAL_MS)
        {
          getSystemState(st);
          publishMirrorFeedSlot(st, mirrorFeedSlot);
          mirrorFeedSlot = static_cast<uint8_t>((mirrorFeedSlot + 1U) % MIRROR_FEED_SLOT_COUNT);
          lastMirrorMs = nowMs;
        }
      }
    }
    else
    {
      cloudConnected = false;
      updateConnectivityState(false, false, WiFi.getMode() == WIFI_AP_STA || WiFi.getMode() == WIFI_AP);
      sendWebCloudState(false);
    }

    if (!mqttClient.connected())
    {
      cloudConnected = false;
      updateConnectivityState(wifiConnected, false, WiFi.getMode() == WIFI_AP_STA || WiFi.getMode() == WIFI_AP);
    }

    vTaskDelay(pdMS_TO_TICKS(500));
  }
}
