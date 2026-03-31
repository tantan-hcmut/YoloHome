#include "tinyml.h"

#include <ArduinoJson.h>
#include "TensorFlowLite_ESP32.h"
#include "dht_anomaly_model.h"
#include "global.h"
#include "task_webserver.h"
#include "tensorflow/lite/micro/all_ops_resolver.h"
#include "tensorflow/lite/micro/micro_error_reporter.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/schema/schema_generated.h"

namespace
{
constexpr size_t kWindowSize = 6;
constexpr int kTensorArenaSize = 40 * 1024;
alignas(16) uint8_t tensorArena[kTensorArenaSize];
SensorFrame history[kWindowSize] = {};
size_t historyCount = 0;
size_t historyIndex = 0;

bool hotLatched = false;
float previousSmoothedScore = 0.0f;

const tflite::Model *model = nullptr;
tflite::ErrorReporter *errorReporter = nullptr;
tflite::MicroInterpreter *interpreter = nullptr;
TfLiteTensor *inputTensor = nullptr;
TfLiteTensor *outputTensor = nullptr;

void pushFrame(const SensorFrame &frame)
{
  history[historyIndex] = frame;
  historyIndex = (historyIndex + 1) % kWindowSize;
  if (historyCount < kWindowSize)
  {
    historyCount++;
  }
}

bool computeWindowStats(float &avgTemp, float &avgHumi)
{
  if (historyCount == 0)
  {
    return false;
  }

  float sumTemp = 0.0f;
  float sumHumi = 0.0f;
  size_t validCount = 0;

  for (size_t i = 0; i < historyCount; ++i)
  {
    if (!history[i].valid)
    {
      continue;
    }
    sumTemp += history[i].temperature;
    sumHumi += history[i].humidity;
    validCount++;
  }

  if (validCount == 0)
  {
    return false;
  }

  avgTemp = sumTemp / static_cast<float>(validCount);
  avgHumi = sumHumi / static_cast<float>(validCount);
  return true;
}

bool computeGroundTruth(const float avgTemp, const float avgHumi)
{
  RuntimeConfig cfg;
  getRuntimeConfig(cfg);
  const bool tempBad = avgTemp > cfg.tempHotThreshold;
  const bool humiBad = avgHumi > cfg.humiHumidThreshold;
  return tempBad || humiBad;
}

void sendTinyMlToWeb(const InferenceResult &result)
{
  StaticJsonDocument<256> doc;
  doc["page"] = "tinyml";
  doc["score"] = result.modelScore;
  doc["smooth"] = result.smoothedScore;
  doc["avgTemp"] = result.averageTemperature;
  doc["avgHumi"] = result.averageHumidity;
  doc["pred"] = result.predictedHot;
  doc["gt"] = result.groundTruthHot;
  doc["acc"] = result.onlineAccuracy;
  doc["ts"] = result.timestampMs;

  String out;
  serializeJson(doc, out);
  Webserver_sendata(out);
}
} // namespace

void setupTinyML()
{
  static tflite::MicroErrorReporter microErrorReporter;
  errorReporter = &microErrorReporter;

  model = tflite::GetModel(dht_anomaly_model_tflite);
  if (model->version() != TFLITE_SCHEMA_VERSION)
  {
    errorReporter->Report("Model schema mismatch");
    return;
  }

  static tflite::AllOpsResolver resolver;
  static tflite::MicroInterpreter staticInterpreter(
      model,
      resolver,
      tensorArena,
      kTensorArenaSize,
      errorReporter);

  interpreter = &staticInterpreter;

  if (interpreter->AllocateTensors() != kTfLiteOk)
  {
    errorReporter->Report("AllocateTensors failed");
    interpreter = nullptr;
    return;
  }

  inputTensor = interpreter->input(0);
  outputTensor = interpreter->output(0);
  Serial.println("[TinyML] TensorFlow Lite Micro initialized");
}

void tiny_ml_task(void *pvParameters)
{
  (void)pvParameters;
  setupTinyML();

  uint32_t totalSamples = 0;
  uint32_t correctSamples = 0;
  uint32_t lastInferenceMs = 0;

  for (;;)
  {
    SensorFrame frame = {};
    if (qSensorFrames == nullptr || xQueueReceive(qSensorFrames, &frame, portMAX_DELAY) != pdTRUE)
    {
      continue;
    }

    if (!frame.valid)
    {
      continue;
    }

    pushFrame(frame);

    RuntimeConfig cfg;
    getRuntimeConfig(cfg);
    if (lastInferenceMs != 0 && (frame.timestampMs - lastInferenceMs) < cfg.inferencePeriodMs)
    {
      continue;
    }
    lastInferenceMs = frame.timestampMs;

    float avgTemp = 0.0f;
    float avgHumi = 0.0f;
    if (!computeWindowStats(avgTemp, avgHumi))
    {
      continue;
    }

    if (interpreter == nullptr || inputTensor == nullptr || outputTensor == nullptr)
    {
      vTaskDelay(pdMS_TO_TICKS(1000));
      continue;
    }

    inputTensor->data.f[0] = avgTemp;
    inputTensor->data.f[1] = avgHumi;

    if (interpreter->Invoke() != kTfLiteOk)
    {
      if (errorReporter != nullptr)
      {
        errorReporter->Report("Invoke failed");
      }
      vTaskDelay(pdMS_TO_TICKS(1000));
      continue;
    }

    const float modelScore = outputTensor->data.f[0];
    float smoothedScore = modelScore;
    if (historyCount > 1)
    {
      if (modelScore < previousSmoothedScore)
      {
        // đang hạ -> cho rơi nhanh hơn
        smoothedScore = 0.35f * previousSmoothedScore + 0.65f * modelScore;
      }
      else
      {
        // đang tăng -> vẫn giữ chút ổn định
        smoothedScore = 0.65f * previousSmoothedScore + 0.35f * modelScore;
      }
    }
    previousSmoothedScore = smoothedScore;

    static uint8_t recoveryStableCount = 0;

    const bool clearlyRecovered =
        (avgTemp < (cfg.tempHotThreshold - 0.7f)) &&
        (avgHumi < (cfg.humiHumidThreshold - 3.0f));

    if (clearlyRecovered)
    {
      if (recoveryStableCount < 255)
      {
        recoveryStableCount++;
      }
    }
    else
    {
      recoveryStableCount = 0;
    }

    static uint8_t coolConfirmCount = 0;

    const bool sensorHotNow =
        (frame.temperature > cfg.tempHotThreshold) ||
        (frame.humidity > cfg.humiHumidThreshold);

    const bool avgHotNow =
        (avgTemp > cfg.tempHotThreshold) ||
        (avgHumi > cfg.humiHumidThreshold);

    // Warmup: mới vào mà đã nóng thì phải bật ngay, không chờ model đủ "tin"
    if (!hotLatched)
    {
      if (historyCount < 3)
      {
        if (sensorHotNow || avgHotNow || smoothedScore >= cfg.aiOnThreshold)
        {
          hotLatched = true;
          coolConfirmCount = 0;
        }
      }
      else
      {
        if (smoothedScore >= cfg.aiOnThreshold || avgHotNow)
        {
          hotLatched = true;
          coolConfirmCount = 0;
        }
      }
    }
    else
    {
      // Đang HOT thì chỉ được tắt khi score thấp đủ lâu
      // và môi trường trung bình không còn nóng nữa
      if (smoothedScore <= cfg.aiOffThreshold && !avgHotNow)
      {
        if (coolConfirmCount < 255)
        {
          coolConfirmCount++;
        }
      }
      else
      {
        coolConfirmCount = 0;
      }

      if (coolConfirmCount >= 3)
      {
        hotLatched = false;
        coolConfirmCount = 0;
      }
    }

    const bool groundTruth = computeGroundTruth(avgTemp, avgHumi);
    totalSamples++;
    if (hotLatched == groundTruth)
    {
      correctSamples++;
    }

    InferenceResult result = {};
    result.modelScore = modelScore;
    result.smoothedScore = smoothedScore;
    result.averageTemperature = avgTemp;
    result.averageHumidity = avgHumi;
    result.predictedHot = hotLatched;
    result.groundTruthHot = groundTruth;
    result.onlineAccuracy = (totalSamples == 0) ? 0.0f : (100.0f * correctSamples / totalSamples);
    result.valid = true;
    result.timestampMs = millis();

    if (xStateMutex != nullptr && xSemaphoreTake(xStateMutex, pdMS_TO_TICKS(50)) == pdTRUE)
    {
      gState.tinymlScore = result.modelScore;
      gState.tinymlSmoothedScore = result.smoothedScore;
      gState.tinymlAccuracy = result.onlineAccuracy;
      gState.tinymlPredictedHot = result.predictedHot;
      gState.tinymlGroundTruthHot = result.groundTruthHot;
      xSemaphoreGive(xStateMutex);
    }

    if (qInferenceResults != nullptr)
    {
      xQueueSend(qInferenceResults, &result, pdMS_TO_TICKS(20));
    }

    sendTinyMlToWeb(result);
    refreshIndicatorMode();

    Serial.printf("[TinyML] score=%.3f smooth=%.3f pred=%s acc=%.1f%%\n",
                  result.modelScore,
                  result.smoothedScore,
                  result.predictedHot ? "HOT" : "OK",
                  result.onlineAccuracy);
  }
}
