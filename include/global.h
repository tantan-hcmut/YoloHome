#ifndef GLOBAL_H
#define GLOBAL_H

#include <Arduino.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "freertos/event_groups.h"

#include "app_types.h"

constexpr float TEMP_COLD_THRESHOLD_DEFAULT = 24.0f;
constexpr float TEMP_HOT_THRESHOLD_DEFAULT = 32.0f;
constexpr float HUMI_DRY_THRESHOLD_DEFAULT = 30.0f;
constexpr float HUMI_HUMID_THRESHOLD_DEFAULT = 80.0f;

constexpr float AI_ON_THRESHOLD_DEFAULT = 0.68f;
constexpr float AI_OFF_THRESHOLD_DEFAULT = 0.48f;

constexpr uint32_t SENSOR_PERIOD_MS_DEFAULT = 2000;
constexpr uint32_t INFERENCE_PERIOD_MS_DEFAULT = 2000;
// 5s is the minimum we persist because Adafruit IO has a publish rate limit.
constexpr uint32_t TELEMETRY_PERIOD_MS_DEFAULT = 10000;
constexpr uint32_t MANUAL_OVERRIDE_MS_DEFAULT = 30UL * 60UL * 1000UL;
constexpr uint32_t VOICE_INDICATOR_HOLD_MS_DEFAULT = 5000;

constexpr uint32_t FAN_RAMP_MIDPOINT_MS_DEFAULT = 5UL * 60UL * 1000UL;
constexpr uint32_t FAN_RAMP_FULL_MS_DEFAULT = 10UL * 60UL * 1000UL;

constexpr size_t SENSOR_QUEUE_LENGTH = 1;
constexpr size_t INFERENCE_QUEUE_LENGTH = 4;
constexpr size_t COMMAND_QUEUE_LENGTH = 12;
constexpr size_t ACTUATOR_QUEUE_LENGTH = 1;

extern RuntimeConfig gConfig;
extern SystemState gState;

extern SemaphoreHandle_t xStateMutex;
extern SemaphoreHandle_t xConfigMutex;
extern QueueHandle_t qSensorFrames;
extern QueueHandle_t qInferenceResults;
extern QueueHandle_t qUserCommands;
extern QueueHandle_t qActuatorCommands;
extern EventGroupHandle_t gSystemEvents;

constexpr EventBits_t EVT_WIFI_CONNECTED = BIT0;
constexpr EventBits_t EVT_CLOUD_CONNECTED = BIT1;
constexpr EventBits_t EVT_AP_MODE = BIT2;
constexpr EventBits_t EVT_SENSOR_VALID = BIT3;
constexpr EventBits_t EVT_VOICE_ACTIVE = BIT4;
constexpr EventBits_t EVT_MANUAL_LOCKDOWN = BIT5;
constexpr EventBits_t EVT_AI_COOLING = BIT6;

void initGlobalResources();
void resetRuntimeConfigToDefaults();
void resetSystemStateToDefaults();
void copyStringSafe(char *dest, size_t destSize, const String &src);
void copyStringSafe(char *dest, size_t destSize, const char *src);

bool getRuntimeConfig(RuntimeConfig &outConfig);
bool getSystemState(SystemState &outState);

void updateConnectivityState(bool wifiConnected, bool cloudConnected, bool apMode);
void updateVoiceState(bool active, uint32_t holdMs);
void refreshIndicatorMode();

#endif
