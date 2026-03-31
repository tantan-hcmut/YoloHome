#include "task_control_logic.h"

#include <ArduinoJson.h>
#include "global.h"
#include "task_webserver.h"

namespace
{
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

uint8_t lerpPercent(const uint8_t startValue, const uint8_t endValue, const float t)
{
  const float clampedT = constrain(t, 0.0f, 1.0f);
  const float value = static_cast<float>(startValue) + (static_cast<float>(endValue) - static_cast<float>(startValue)) * clampedT;
  return clampPercentValue(static_cast<int>(value + 0.5f));
}

uint8_t computeAutoRampPercent(const RuntimeConfig &cfg, const uint32_t elapsedMs)
{
  const uint32_t midMs = max<uint32_t>(cfg.fanRampMidpointMs, 60UL * 1000UL);
  const uint32_t fullMs = max<uint32_t>(cfg.fanRampFullMs, midMs + 60UL * 1000UL);

  if (elapsedMs >= fullMs)
  {
    return clampPercentValue(cfg.fanRampEndPercent);
  }

  if (elapsedMs >= midMs)
  {
    const float stageT = static_cast<float>(elapsedMs - midMs) / static_cast<float>(fullMs - midMs);
    return lerpPercent(cfg.fanRampMidPercent, cfg.fanRampEndPercent, stageT);
  }

  const float stageT = static_cast<float>(elapsedMs) / static_cast<float>(midMs);
  return lerpPercent(cfg.fanRampStartPercent, cfg.fanRampMidPercent, stageT);
}

void pushActuatorCommand(const bool fanOn,
                         const uint8_t fanSpeedPercent,
                         const bool lightOn,
                         const uint8_t lightR,
                         const uint8_t lightG,
                         const uint8_t lightB,
                         const uint8_t lightBrightness)
{
  if (qActuatorCommands == nullptr)
  {
    return;
  }

  ActuatorCommand cmd = {};
  cmd.fanOn = fanOn;
  cmd.fanSpeedPercent = fanSpeedPercent;
  cmd.lightOn = lightOn;
  cmd.lightR = lightR;
  cmd.lightG = lightG;
  cmd.lightB = lightB;
  cmd.lightBrightness = lightBrightness;
  xQueueOverwrite(qActuatorCommands, &cmd);
}

void broadcastControlState()
{
  SystemState st;
  if (!getSystemState(st))
  {
    return;
  }

  StaticJsonDocument<448> doc;
  doc["page"] = "control";
  doc["fanOn"] = st.fanOn;
  doc["fanSpeedPercent"] = st.fanSpeedPercent;
  doc["autoFanRequest"] = st.autoFanRequest;
  doc["overrideMode"] = static_cast<uint8_t>(st.overrideMode);
  doc["overrideUntilMs"] = st.overrideUntilMs;
  doc["voiceActive"] = st.voiceActive;
  doc["wifiConnected"] = st.wifiConnected;
  doc["cloudConnected"] = st.cloudConnected;
  doc["lightOn"] = st.lightOn;
  doc["aiCoolingElapsedMs"] = st.aiCoolingElapsedMs;
  doc["aiTargetFanSpeedPercent"] = st.aiTargetFanSpeedPercent;

  JsonObject light = doc.createNestedObject("lightState");
  light["r"] = st.lightR;
  light["g"] = st.lightG;
  light["b"] = st.lightB;
  light["brightness"] = st.lightBrightness;

  String out;
  serializeJson(doc, out);
  Webserver_sendata(out);
}
} // namespace

void task_control_logic(void *pvParameters)
{
  (void)pvParameters;

  RuntimeConfig bootCfg;
  getRuntimeConfig(bootCfg);

  bool fanOn = false;
  uint8_t fanSpeedPercent = bootCfg.fanDefaultSpeedPercent;
  bool autoFanRequest = false;
  bool voiceActive = false;
  bool latestAutoPrediction = false;
  OverrideMode overrideMode = OVERRIDE_MODE_AUTO;
  uint32_t overrideUntilMs = 0;
  uint32_t aiCoolingStartMs = 0;

  bool lightOn = false;
  uint8_t lightR = bootCfg.lightDefaultR;
  uint8_t lightG = bootCfg.lightDefaultG;
  uint8_t lightB = bootCfg.lightDefaultB;
  uint8_t lightBrightness = bootCfg.lightDefaultBrightness;

  pushActuatorCommand(false, 0, false, lightR, lightG, lightB, lightBrightness);

  bool firstSync = true;

  for (;;)
  {
    RuntimeConfig cfg;
    getRuntimeConfig(cfg);

    const uint32_t nowMs = millis();
    bool stateChanged = firstSync;

    if (voiceActive && xStateMutex != nullptr && xSemaphoreTake(xStateMutex, pdMS_TO_TICKS(10)) == pdTRUE)
    {
      if (gState.voiceActiveUntilMs != 0 && nowMs >= gState.voiceActiveUntilMs)
      {
        voiceActive = false;
        gState.voiceActive = false;
        gState.voiceActiveUntilMs = 0;
        xSemaphoreGive(xStateMutex);
        stateChanged = true;
      }
      else
      {
        xSemaphoreGive(xStateMutex);
      }
    }

    if (overrideMode != OVERRIDE_MODE_AUTO && nowMs >= overrideUntilMs)
    {
      overrideMode = OVERRIDE_MODE_AUTO;
      overrideUntilMs = 0;
      stateChanged = true;
    }

    CommandMessage cmd = {};
    if (qUserCommands != nullptr && xQueueReceive(qUserCommands, &cmd, pdMS_TO_TICKS(100)) == pdTRUE)
    {
      switch (cmd.type)
      {
      case CMD_FAN_FORCE_ON:
      {
        const uint8_t requestedSpeed = cmd.hasFanSpeed
                                           ? clampPercentValue(cmd.fanSpeedPercent)
                                           : clampPercentValue(cfg.fanDefaultSpeedPercent);
        fanSpeedPercent = (requestedSpeed == 0) ? clampPercentValue(cfg.fanDefaultSpeedPercent) : requestedSpeed;
        fanOn = true;
        autoFanRequest = false;
        overrideMode = OVERRIDE_MODE_FORCE_ON;
        overrideUntilMs = nowMs + cfg.manualOverrideMs;
        voiceActive = (cmd.source == CMD_SOURCE_VOICE);
        stateChanged = true;
        break;
      }

      case CMD_FAN_FORCE_OFF:
        fanOn = false;
        fanSpeedPercent = 0;
        autoFanRequest = false;
        overrideMode = OVERRIDE_MODE_FORCE_OFF;
        overrideUntilMs = nowMs + cfg.manualOverrideMs;
        voiceActive = (cmd.source == CMD_SOURCE_VOICE);
        stateChanged = true;
        break;

      case CMD_FAN_RETURN_AUTO:
        overrideMode = OVERRIDE_MODE_AUTO;
        overrideUntilMs = 0;
        voiceActive = (cmd.source == CMD_SOURCE_VOICE);
        stateChanged = true;
        break;

      case CMD_FAN_SET_SPEED:
      {
        const uint8_t requestedSpeed = clampPercentValue(cmd.fanSpeedPercent);
        fanSpeedPercent = requestedSpeed;
        fanOn = requestedSpeed > 0;
        autoFanRequest = false;
        overrideMode = fanOn ? OVERRIDE_MODE_FORCE_ON : OVERRIDE_MODE_FORCE_OFF;
        overrideUntilMs = nowMs + cfg.manualOverrideMs;
        voiceActive = (cmd.source == CMD_SOURCE_VOICE);
        stateChanged = true;
        break;
      }

      case CMD_LIGHT_FORCE_ON:
        lightOn = true;
        if (cmd.hasLightBrightness)
        {
          lightBrightness = cmd.brightness;
        }
        if (cmd.hasLightColor)
        {
          lightR = clampByteValue(cmd.rgbR);
          lightG = clampByteValue(cmd.rgbG);
          lightB = clampByteValue(cmd.rgbB);
        }
        voiceActive = (cmd.source == CMD_SOURCE_VOICE);
        stateChanged = true;
        break;

      case CMD_LIGHT_FORCE_OFF:
        lightOn = false;
        voiceActive = (cmd.source == CMD_SOURCE_VOICE);
        stateChanged = true;
        break;

      case CMD_LIGHT_SET_RGB:
        if (cmd.hasLightColor)
        {
          lightR = clampByteValue(cmd.rgbR);
          lightG = clampByteValue(cmd.rgbG);
          lightB = clampByteValue(cmd.rgbB);
        }
        if (cmd.hasLightBrightness)
        {
          lightBrightness = clampByteValue(cmd.brightness);
        }
        lightOn = true;
        voiceActive = (cmd.source == CMD_SOURCE_VOICE);
        stateChanged = true;
        break;

      case CMD_SET_VOICE_ACTIVE:
        voiceActive = true;
        stateChanged = true;
        break;

      case CMD_SET_VOICE_IDLE:
        voiceActive = false;
        stateChanged = true;
        break;

      case CMD_SET_AUTO_FAN_ENABLED:
        if (xConfigMutex != nullptr && xSemaphoreTake(xConfigMutex, pdMS_TO_TICKS(50)) == pdTRUE)
        {
          gConfig.autoFanEnabled = cmd.boolValue;
          xSemaphoreGive(xConfigMutex);
        }
        if (!cmd.boolValue)
        {
          aiCoolingStartMs = 0;
          latestAutoPrediction = false;
        }
        stateChanged = true;
        break;

      case CMD_PUSH_STATUS:
      case CMD_NONE:
      default:
        break;
      }

      if (voiceActive)
      {
        updateVoiceState(true, cfg.voiceIndicatorHoldMs);
      }
    }

    InferenceResult inference = {};
    if (qInferenceResults != nullptr && xQueueReceive(qInferenceResults, &inference, 0) == pdTRUE)
    {
      latestAutoPrediction = inference.predictedHot;
      if (latestAutoPrediction)
      {
        if (aiCoolingStartMs == 0)
        {
          aiCoolingStartMs = nowMs;
        }
      }
      else
      {
        aiCoolingStartMs = 0;
      }
      stateChanged = true;
    }

    if (!cfg.autoFanEnabled)
    {
      latestAutoPrediction = false;
      aiCoolingStartMs = 0;

      if (overrideMode == OVERRIDE_MODE_AUTO)
      {
        if (fanOn || fanSpeedPercent != 0 || autoFanRequest)
        {
          fanOn = false;
          fanSpeedPercent = 0;
          autoFanRequest = false;
          stateChanged = true;
        }
      }
    }
    else if (overrideMode == OVERRIDE_MODE_AUTO)
    {
      if (latestAutoPrediction)
      {
        if (aiCoolingStartMs == 0)
        {
          aiCoolingStartMs = nowMs;
        }

        const uint32_t elapsedMs = nowMs - aiCoolingStartMs;
        const uint8_t targetSpeed = computeAutoRampPercent(cfg, elapsedMs);

        if (!fanOn || !autoFanRequest || fanSpeedPercent != targetSpeed)
        {
          fanOn = true;
          autoFanRequest = true;
          fanSpeedPercent = targetSpeed;
          stateChanged = true;
        }
      }
      else
      {
        if (fanOn || fanSpeedPercent != 0 || autoFanRequest)
        {
          fanOn = false;
          fanSpeedPercent = 0;
          autoFanRequest = false;
          stateChanged = true;
        }
      }
    }

    if (stateChanged)
    {
      const uint32_t aiElapsedMs = (latestAutoPrediction && aiCoolingStartMs != 0) ? (nowMs - aiCoolingStartMs) : 0;
      const uint8_t aiTargetPercent = (latestAutoPrediction && cfg.autoFanEnabled)
                                          ? computeAutoRampPercent(cfg, aiElapsedMs)
                                          : 0;

      if (xStateMutex != nullptr && xSemaphoreTake(xStateMutex, pdMS_TO_TICKS(50)) == pdTRUE)
      {
        gState.fanOn = fanOn;
        gState.fanSpeedPercent = fanSpeedPercent;
        gState.autoFanRequest = autoFanRequest;
        gState.overrideMode = overrideMode;
        gState.overrideUntilMs = overrideUntilMs;
        gState.voiceActive = voiceActive;
        gState.voiceActiveUntilMs = voiceActive ? (nowMs + cfg.voiceIndicatorHoldMs) : 0;
        gState.aiCoolingActiveSinceMs = aiCoolingStartMs;
        gState.aiCoolingElapsedMs = aiElapsedMs;
        gState.aiTargetFanSpeedPercent = aiTargetPercent;
        gState.lightOn = lightOn;
        gState.lightR = lightR;
        gState.lightG = lightG;
        gState.lightB = lightB;
        gState.lightBrightness = lightBrightness;
        xSemaphoreGive(xStateMutex);
      }

      if (gSystemEvents != nullptr)
      {
        (overrideMode != OVERRIDE_MODE_AUTO) ? xEventGroupSetBits(gSystemEvents, EVT_MANUAL_LOCKDOWN)
                                             : xEventGroupClearBits(gSystemEvents, EVT_MANUAL_LOCKDOWN);
        (fanOn && autoFanRequest) ? xEventGroupSetBits(gSystemEvents, EVT_AI_COOLING)
                                  : xEventGroupClearBits(gSystemEvents, EVT_AI_COOLING);
        voiceActive ? xEventGroupSetBits(gSystemEvents, EVT_VOICE_ACTIVE)
                    : xEventGroupClearBits(gSystemEvents, EVT_VOICE_ACTIVE);
      }

      pushActuatorCommand(fanOn, fanSpeedPercent, lightOn, lightR, lightG, lightB, lightBrightness);
      refreshIndicatorMode();
      broadcastControlState();
      firstSync = false;
    }
  }
}
