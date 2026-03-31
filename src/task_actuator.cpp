#include "task_actuator.h"

#include <Adafruit_NeoPixel.h>
#include "global.h"
#include "hw_pins.h"

namespace
{
constexpr uint8_t FAN_PWM_CHANNEL = 0;
constexpr uint32_t FAN_PWM_FREQUENCY_HZ = 25000;
constexpr uint8_t FAN_PWM_RESOLUTION_BITS = 8;

Adafruit_NeoPixel extStrip(EXTERNAL_RGB_LED_COUNT, PIN_EXT_RGB, NEO_GRB + NEO_KHZ800);

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

uint8_t fanPercentToPwm(const uint8_t percent)
{
  return static_cast<uint8_t>((static_cast<uint16_t>(clampPercentValue(percent)) * 255U) / 100U);
}

void applyFanPwm(const uint8_t pwmValue)
{
  ledcWrite(FAN_PWM_CHANNEL, pwmValue);
}

void applyExternalLight(const ActuatorCommand &cmd)
{
  if (!cmd.lightOn || cmd.lightBrightness == 0)
  {
    extStrip.clear();
    extStrip.show();
    return;
  }

  extStrip.setBrightness(cmd.lightBrightness);
  for (uint16_t pixel = 0; pixel < EXTERNAL_RGB_LED_COUNT; ++pixel)
  {
    extStrip.setPixelColor(pixel, extStrip.Color(cmd.lightR, cmd.lightG, cmd.lightB));
  }
  extStrip.show();
}
} // namespace

void task_actuator(void *pvParameters)
{
  (void)pvParameters;

  pinMode(PIN_MINI_FAN, OUTPUT);
  ledcSetup(FAN_PWM_CHANNEL, FAN_PWM_FREQUENCY_HZ, FAN_PWM_RESOLUTION_BITS);
  ledcAttachPin(PIN_MINI_FAN, FAN_PWM_CHANNEL);
  applyFanPwm(0);

  extStrip.begin();
  extStrip.clear();
  extStrip.show();

  for (;;)
  {
    ActuatorCommand cmd = {};
    if (qActuatorCommands == nullptr || xQueueReceive(qActuatorCommands, &cmd, portMAX_DELAY) != pdTRUE)
    {
      continue;
    }

    const uint8_t pwmValue = (cmd.fanOn && cmd.fanSpeedPercent > 0)
                                 ? fanPercentToPwm(cmd.fanSpeedPercent)
                                 : 0;
    applyFanPwm(pwmValue);
    applyExternalLight(cmd);

    Serial.printf("[ACTUATOR] fan=%s speed=%u%% pwm=%u light=%s rgb=(%u,%u,%u) bri=%u\n",
                  cmd.fanOn ? "ON" : "OFF",
                  cmd.fanSpeedPercent,
                  pwmValue,
                  cmd.lightOn ? "ON" : "OFF",
                  cmd.lightR,
                  cmd.lightG,
                  cmd.lightB,
                  cmd.lightBrightness);
  }
}
