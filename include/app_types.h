#ifndef APP_TYPES_H
#define APP_TYPES_H

#include <Arduino.h>

enum TempLevel : uint8_t
{
  TEMP_LEVEL_COLD = 0,
  TEMP_LEVEL_NORMAL,
  TEMP_LEVEL_HOT
};

enum HumiLevel : uint8_t
{
  HUMI_LEVEL_DRY = 0,
  HUMI_LEVEL_OK,
  HUMI_LEVEL_HUMID
};

enum DisplayState : uint8_t
{
  DISPLAY_STATE_NORMAL = 0,
  DISPLAY_STATE_WARNING,
  DISPLAY_STATE_CRITICAL
};

enum SystemIndicatorMode : uint8_t
{
  SYS_MODE_BOOT = 0,
  SYS_MODE_NORMAL,
  SYS_MODE_WIFI_ONLY,
  SYS_MODE_AP_CONFIG,
  SYS_MODE_AI_COOLING,
  SYS_MODE_MANUAL_LOCKDOWN,
  SYS_MODE_VOICE_ACTIVE,
  SYS_MODE_FAULT
};

enum CommandSource : uint8_t
{
  CMD_SOURCE_LOCAL_WEB = 0,
  CMD_SOURCE_CLOUD,
  CMD_SOURCE_VOICE,
  CMD_SOURCE_SYSTEM
};

enum CommandType : uint8_t
{
  CMD_NONE = 0,
  CMD_FAN_FORCE_ON,
  CMD_FAN_FORCE_OFF,
  CMD_FAN_RETURN_AUTO,
  CMD_FAN_SET_SPEED,
  CMD_LIGHT_FORCE_ON,
  CMD_LIGHT_FORCE_OFF,
  CMD_LIGHT_SET_RGB,
  CMD_SET_VOICE_ACTIVE,
  CMD_SET_VOICE_IDLE,
  CMD_SET_AUTO_FAN_ENABLED,
  CMD_PUSH_STATUS
};

enum OverrideMode : uint8_t
{
  OVERRIDE_MODE_AUTO = 0,
  OVERRIDE_MODE_FORCE_ON,
  OVERRIDE_MODE_FORCE_OFF
};

struct TempLedConfig
{
  uint16_t on_ms;
  uint16_t off_ms;
};

struct NeoColorConfig
{
  uint8_t r;
  uint8_t g;
  uint8_t b;
};

struct SensorFrame
{
  float temperature;
  float humidity;
  TempLevel tempLevel;
  HumiLevel humiLevel;
  DisplayState displayState;
  bool valid;
  uint32_t timestampMs;
};

struct InferenceResult
{
  float modelScore;
  float smoothedScore;
  float averageTemperature;
  float averageHumidity;
  bool predictedHot;
  bool groundTruthHot;
  float onlineAccuracy;
  bool valid;
  uint32_t timestampMs;
};

struct CommandMessage
{
  CommandType type;
  CommandSource source;
  bool boolValue;
  float floatValue;
  uint32_t uintValue;
  uint8_t fanSpeedPercent;
  bool hasFanSpeed;
  uint8_t rgbR;
  uint8_t rgbG;
  uint8_t rgbB;
  bool hasLightColor;
  uint8_t brightness;
  bool hasLightBrightness;
  char text[64];
};

struct ActuatorCommand
{
  bool fanOn;
  uint8_t fanSpeedPercent;
  bool lightOn;
  uint8_t lightR;
  uint8_t lightG;
  uint8_t lightB;
  uint8_t lightBrightness;
};

struct RuntimeConfig
{
  float tempColdThreshold;
  float tempHotThreshold;
  float humiDryThreshold;
  float humiHumidThreshold;

  float aiOnThreshold;
  float aiOffThreshold;
  bool autoFanEnabled;

  uint32_t sensorPeriodMs;
  uint32_t inferencePeriodMs;
  uint32_t telemetryPeriodMs;
  uint32_t manualOverrideMs;
  uint32_t voiceIndicatorHoldMs;

  bool onboardLedEnabled;
  bool onboardRgbEnabled;

  TempLedConfig tempLedConfig[3];
  NeoColorConfig neoColorConfig[3];

  uint8_t fanDefaultSpeedPercent;
  uint8_t fanAutoSpeedPercent;

  // Fan ramp profile used when TinyML predicts the room is hot.
  uint8_t fanRampStartPercent;
  uint8_t fanRampMidPercent;
  uint8_t fanRampEndPercent;
  uint32_t fanRampMidpointMs;
  uint32_t fanRampFullMs;

  uint8_t lightDefaultR;
  uint8_t lightDefaultG;
  uint8_t lightDefaultB;
  uint8_t lightDefaultBrightness;

  char wifiSsid[64];
  char wifiPass[64];
  char adafruitUsername[64];
  char adafruitKey[128];
  char adafruitFeedPrefix[32];

  // Persist theme customization so the local dashboard keeps the same appearance.
  char themePrimaryHex[8];
  char themeAccentHex[8];
  char themeBackgroundHex[8];
};

struct SystemState
{
  float temperature;
  float humidity;
  TempLevel tempLevel;
  HumiLevel humiLevel;
  DisplayState displayState;
  bool sensorValid;

  float tinymlScore;
  float tinymlSmoothedScore;
  float tinymlAccuracy;
  bool tinymlPredictedHot;
  bool tinymlGroundTruthHot;

  bool fanOn;
  uint8_t fanSpeedPercent;
  bool autoFanRequest;
  OverrideMode overrideMode;
  uint32_t overrideUntilMs;

  // Runtime visibility for the AI cooling ramp.
  uint32_t aiCoolingActiveSinceMs;
  uint32_t aiCoolingElapsedMs;
  uint8_t aiTargetFanSpeedPercent;

  bool lightOn;
  uint8_t lightR;
  uint8_t lightG;
  uint8_t lightB;
  uint8_t lightBrightness;

  bool wifiConnected;
  bool cloudConnected;
  bool apModeActive;
  bool voiceActive;
  uint32_t voiceActiveUntilMs;

  SystemIndicatorMode indicatorMode;
  uint32_t sensorTimestampMs;
  uint32_t telemetryTimestampMs;
};

#endif
