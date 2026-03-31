#ifndef HW_PINS_H
#define HW_PINS_H

#include <Arduino.h>

// Fallback digital aliases in case the board package does not expose D7..D10.
#ifndef D10
#define D10 21
#endif
#ifndef D9
#define D9 18
#endif
#ifndef D8
#define D8 17
#endif
#ifndef D7
#define D7 10
#endif

// ==== On-board resources on Yolo_Uno ====
#define PIN_ONBOARD_LED        48
#define PIN_ONBOARD_RGB        45
#define PIN_BOOT_BUTTON         0

// ==== I2C bus shared by DHT20 + LCD ====
#define PIN_I2C_SDA            11
#define PIN_I2C_SCL            12

// ==== External peripherals on Yolo UNO ports ====
#define PIN_EXT_RGB_SIGNAL     D9
#define PIN_EXT_RGB_AUX        D10
#define PIN_MINI_FAN_SIGNAL    D7
#define PIN_MINI_FAN_AUX       D8

// Backward-compatible aliases used elsewhere in the project.
#define PIN_EXT_RGB            PIN_EXT_RGB_SIGNAL
#define PIN_MINI_FAN           PIN_MINI_FAN_SIGNAL

#define ONBOARD_RGB_LED_COUNT   1
#define EXTERNAL_RGB_LED_COUNT  4

#endif
