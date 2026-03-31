#ifndef TASK_CHECK_INFO_H
#define TASK_CHECK_INFO_H

#include <ArduinoJson.h>
#include "LittleFS.h"
#include "global.h"

bool check_info_File(bool checkOnly);
void Load_info_File();
void Delete_info_File();
bool Factory_reset_and_restart(uint32_t restartDelayMs = 150);
bool Persist_info_File(bool restartAfter = false);
void Save_info_File(String wifiSsid,
                    String wifiPass,
                    String adafruitUsername,
                    String adafruitKey,
                    String reserved);

#endif
