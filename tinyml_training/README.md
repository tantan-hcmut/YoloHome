## Các file
- `train_tinyml_project_model.py`: script train model 
- `generate_project_seed_dataset.py`: tạo seed dataset ban đầu 
- `project_seed_dataset.csv`: seed dataset đã tạo 
- `real_log_template.csv`: mẫu log 
- `export_tflite_to_header.py`: đổi file `.tflite` sang `dht_anomaly_model.h`

## Cài thư viện Python
```bash
pip install tensorflow pandas numpy scikit-learn
```

## Bước 1: train từ seed dataset
```bash
python train_tinyml_project_model.py --input project_seed_dataset.csv --outdir build_artifacts --model-name dht_anomaly_model
```

## Bước 2: đổi sang header C
```bash
python export_tflite_to_header.py --input build_artifacts/dht_anomaly_model.tflite --output dht_anomaly_model.h --array-name dht_anomaly_model_tflite
```

## Bước 3: thay vào firmware
- chép đè `dht_anomaly_model.h`
- build lại PlatformIO