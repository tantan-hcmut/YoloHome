#include "global.h"
#include <string.h>

RuntimeConfig gConfig = {};
SystemState gState = {};

SemaphoreHandle_t xStateMutex = nullptr;
SemaphoreHandle_t xConfigMutex = nullptr;
QueueHandle_t qSensorFrames = nullptr;
QueueHandle_t qInferenceResults = nullptr;
QueueHandle_t qUserCommands = nullptr;
QueueHandle_t qActuatorCommands = nullptr;
EventGroupHandle_t gSystemEvents = nullptr;

static TempLedConfig kDefaultLedConfig[3] = {
    {1000, 1000},
    {300, 1000},
    {120, 150},
};

static NeoColorConfig kDefaultNeoColors[3] = {
    {0, 0, 255},
    {0, 255, 0},
    {255, 64, 0},
};

void copyStringSafe(char *dest, size_t destSize, const String &src)
{
  if (dest == nullptr || destSize == 0)
  {
    return;
  }
  strncpy(dest, src.c_str(), destSize - 1);
  dest[destSize - 1] = '\0';
}

void copyStringSafe(char *dest, size_t destSize, const char *src)
{
  if (dest == nullptr || destSize == 0)
  {
    return;
  }
  if (src == nullptr)
  {
    dest[0] = '\0';
    return;
  }
  strncpy(dest, src, destSize - 1);
  dest[destSize - 1] = '\0';
}

void resetRuntimeConfigToDefaults()
{
  memset(&gConfig, 0, sizeof(gConfig));
  gConfig.tempColdThreshold = TEMP_COLD_THRESHOLD_DEFAULT;
  gConfig.tempHotThreshold = TEMP_HOT_THRESHOLD_DEFAULT;
  gConfig.humiDryThreshold = HUMI_DRY_THRESHOLD_DEFAULT;
  gConfig.humiHumidThreshold = HUMI_HUMID_THRESHOLD_DEFAULT;
  gConfig.aiOnThreshold = AI_ON_THRESHOLD_DEFAULT;
  gConfig.aiOffThreshold = AI_OFF_THRESHOLD_DEFAULT;
  gConfig.autoFanEnabled = true;
  gConfig.sensorPeriodMs = SENSOR_PERIOD_MS_DEFAULT;
  gConfig.inferencePeriodMs = INFERENCE_PERIOD_MS_DEFAULT;
  gConfig.telemetryPeriodMs = TELEMETRY_PERIOD_MS_DEFAULT;
  gConfig.manualOverrideMs = MANUAL_OVERRIDE_MS_DEFAULT;
  gConfig.voiceIndicatorHoldMs = VOICE_INDICATOR_HOLD_MS_DEFAULT;
  gConfig.onboardLedEnabled = true;
  gConfig.onboardRgbEnabled = true;
  gConfig.fanDefaultSpeedPercent = 70;
  gConfig.fanAutoSpeedPercent = 100;
  gConfig.fanRampStartPercent = 50;
  gConfig.fanRampMidPercent = 70;
  gConfig.fanRampEndPercent = 100;
  gConfig.fanRampMidpointMs = FAN_RAMP_MIDPOINT_MS_DEFAULT;
  gConfig.fanRampFullMs = FAN_RAMP_FULL_MS_DEFAULT;
  gConfig.lightDefaultR = 255;
  gConfig.lightDefaultG = 255;
  gConfig.lightDefaultB = 255;
  gConfig.lightDefaultBrightness = 96;

  for (size_t i = 0; i < 3; ++i)
  {
    gConfig.tempLedConfig[i] = kDefaultLedConfig[i];
    gConfig.neoColorConfig[i] = kDefaultNeoColors[i];
  }

  copyStringSafe(gConfig.wifiSsid, sizeof(gConfig.wifiSsid), "");
  copyStringSafe(gConfig.wifiPass, sizeof(gConfig.wifiPass), "");
  copyStringSafe(gConfig.adafruitUsername, sizeof(gConfig.adafruitUsername), "");
  copyStringSafe(gConfig.adafruitKey, sizeof(gConfig.adafruitKey), "");
  copyStringSafe(gConfig.adafruitFeedPrefix, sizeof(gConfig.adafruitFeedPrefix), "yolohome");

  copyStringSafe(gConfig.themePrimaryHex, sizeof(gConfig.themePrimaryHex), "#2563eb");
  copyStringSafe(gConfig.themeAccentHex, sizeof(gConfig.themeAccentHex), "#14b8a6");
  copyStringSafe(gConfig.themeBackgroundHex, sizeof(gConfig.themeBackgroundHex), "#0f172a");
}

void resetSystemStateToDefaults()
{
  memset(&gState, 0, sizeof(gState));
  gState.tempLevel = TEMP_LEVEL_NORMAL;
  gState.humiLevel = HUMI_LEVEL_OK;
  gState.displayState = DISPLAY_STATE_NORMAL;
  gState.overrideMode = OVERRIDE_MODE_AUTO;
  gState.indicatorMode = SYS_MODE_BOOT;
  gState.fanSpeedPercent = 70;
  gState.lightR = 255;
  gState.lightG = 255;
  gState.lightB = 255;
  gState.lightBrightness = 96;
}

void initGlobalResources()
{
  resetRuntimeConfigToDefaults();
  resetSystemStateToDefaults();

  if (xStateMutex == nullptr)
  {
    xStateMutex = xSemaphoreCreateMutex();
  }
  if (xConfigMutex == nullptr)
  {
    xConfigMutex = xSemaphoreCreateMutex();
  }
  if (qSensorFrames == nullptr)
  {
    qSensorFrames = xQueueCreate(SENSOR_QUEUE_LENGTH, sizeof(SensorFrame));
  }
  if (qInferenceResults == nullptr)
  {
    qInferenceResults = xQueueCreate(INFERENCE_QUEUE_LENGTH, sizeof(InferenceResult));
  }
  if (qUserCommands == nullptr)
  {
    qUserCommands = xQueueCreate(COMMAND_QUEUE_LENGTH, sizeof(CommandMessage));
  }
  if (qActuatorCommands == nullptr)
  {
    qActuatorCommands = xQueueCreate(ACTUATOR_QUEUE_LENGTH, sizeof(ActuatorCommand));
  }
  if (gSystemEvents == nullptr)
  {
    gSystemEvents = xEventGroupCreate();
  }
}

bool getRuntimeConfig(RuntimeConfig &outConfig)
{
  if (xConfigMutex == nullptr)
  {
    return false;
  }
  if (xSemaphoreTake(xConfigMutex, pdMS_TO_TICKS(150)) != pdTRUE)
  {
    return false;
  }
  outConfig = gConfig;
  xSemaphoreGive(xConfigMutex);
  return true;
}

bool getSystemState(SystemState &outState)
{
  if (xStateMutex == nullptr)
  {
    return false;
  }
  if (xSemaphoreTake(xStateMutex, pdMS_TO_TICKS(150)) != pdTRUE)
  {
    return false;
  }
  outState = gState;
  xSemaphoreGive(xStateMutex);
  return true;
}

void updateConnectivityState(bool wifiConnected, bool cloudConnected, bool apMode)
{
  if (xStateMutex != nullptr && xSemaphoreTake(xStateMutex, pdMS_TO_TICKS(50)) == pdTRUE)
  {
    gState.wifiConnected = wifiConnected;
    gState.cloudConnected = cloudConnected;
    gState.apModeActive = apMode;
    xSemaphoreGive(xStateMutex);
  }

  if (gSystemEvents != nullptr)
  {
    wifiConnected ? xEventGroupSetBits(gSystemEvents, EVT_WIFI_CONNECTED)
                  : xEventGroupClearBits(gSystemEvents, EVT_WIFI_CONNECTED);
    cloudConnected ? xEventGroupSetBits(gSystemEvents, EVT_CLOUD_CONNECTED)
                   : xEventGroupClearBits(gSystemEvents, EVT_CLOUD_CONNECTED);
    apMode ? xEventGroupSetBits(gSystemEvents, EVT_AP_MODE)
           : xEventGroupClearBits(gSystemEvents, EVT_AP_MODE);
  }

  refreshIndicatorMode();
}

void updateVoiceState(bool active, uint32_t holdMs)
{
  if (xStateMutex != nullptr && xSemaphoreTake(xStateMutex, pdMS_TO_TICKS(50)) == pdTRUE)
  {
    gState.voiceActive = active;
    gState.voiceActiveUntilMs = active ? (millis() + holdMs) : 0;
    xSemaphoreGive(xStateMutex);
  }

  if (gSystemEvents != nullptr)
  {
    active ? xEventGroupSetBits(gSystemEvents, EVT_VOICE_ACTIVE)
           : xEventGroupClearBits(gSystemEvents, EVT_VOICE_ACTIVE);
  }

  refreshIndicatorMode();
}

void refreshIndicatorMode()
{
  if (xStateMutex == nullptr)
  {
    return;
  }

  if (xSemaphoreTake(xStateMutex, pdMS_TO_TICKS(150)) != pdTRUE)
  {
    return;
  }

  SystemIndicatorMode mode = SYS_MODE_BOOT;

  if (gState.sensorTimestampMs != 0 && !gState.sensorValid)
  {
    mode = SYS_MODE_FAULT;
  }
  else if (gState.voiceActive)
  {
    mode = SYS_MODE_VOICE_ACTIVE;
  }
  else if (gState.overrideMode != OVERRIDE_MODE_AUTO)
  {
    mode = SYS_MODE_MANUAL_LOCKDOWN;
  }
  else if (gState.autoFanRequest && gState.fanOn)
  {
    mode = SYS_MODE_AI_COOLING;
  }
  else if (gState.apModeActive && !gState.wifiConnected)
  {
    mode = SYS_MODE_AP_CONFIG;
  }
  else if (gState.wifiConnected && !gState.cloudConnected)
  {
    mode = SYS_MODE_WIFI_ONLY;
  }
  else
  {
    mode = SYS_MODE_NORMAL;
  }

  gState.indicatorMode = mode;
  xSemaphoreGive(xStateMutex);
}
