#!/usr/bin/env python3
"""
Train TinyML model that matches the CURRENT YoloHome firmware architecture.
Model input shape: [avg_temp, avg_humi]
Model output shape: [score_hot]
Default behavior intentionally DOES NOT normalize features so the resulting
TFLite model can be dropped into the current firmware without changing tinyml.cpp.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, f1_score, accuracy_score

import tensorflow as tf
from tensorflow import keras


def build_model(input_dim: int) -> keras.Model:
    model = keras.Sequential([
        keras.layers.Input(shape=(input_dim,), name='sensor_input'),
        keras.layers.Dense(8, activation='relu'),
        keras.layers.Dense(4, activation='relu'),
        keras.layers.Dense(1, activation='sigmoid', name='score_hot'),
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='binary_crossentropy',
        metrics=[keras.metrics.BinaryAccuracy(name='acc'), keras.metrics.AUC(name='auc')],
    )
    return model


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True, help='CSV with avg_temp, avg_humi, label_hot')
    ap.add_argument('--outdir', default='build_artifacts')
    ap.add_argument('--model-name', default='dht_anomaly_model')
    args = ap.parse_args()

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(args.input)
    required = {'avg_temp', 'avg_humi', 'label_hot'}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f'Missing columns: {sorted(missing)}')

    X = df[['avg_temp', 'avg_humi']].astype(np.float32).values
    y = df['label_hot'].astype(np.float32).values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = build_model(X_train.shape[1])
    callbacks = [keras.callbacks.EarlyStopping(monitor='val_loss', patience=20, restore_best_weights=True)]
    model.fit(
        X_train,
        y_train,
        validation_split=0.2,
        epochs=300,
        batch_size=32,
        verbose=1,
        callbacks=callbacks,
    )

    probs = model.predict(X_test, verbose=0).reshape(-1)
    preds = (probs >= 0.5).astype(np.int32)

    metrics = {
        'accuracy': float(accuracy_score(y_test, preds)),
        'f1': float(f1_score(y_test, preds)),
        'auc': float(roc_auc_score(y_test, probs)),
        'confusion_matrix': confusion_matrix(y_test, preds).tolist(),
        'classification_report': classification_report(y_test, preds, output_dict=True),
        'feature_order': ['avg_temp', 'avg_humi'],
        'threshold_default': 0.5,
        'normalized': False,
    }

    with open(outdir / f'{args.model_name}_metrics.json', 'w', encoding='utf-8') as f:
        json.dump(metrics, f, indent=2)

    model.save(outdir / f'{args.model_name}.keras')

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()
    tflite_path = outdir / f'{args.model_name}.tflite'
    tflite_path.write_bytes(tflite_model)

    print('\n=== TRAIN DONE ===')
    print(f'TFLite: {tflite_path}')
    print(f'Metrics: {outdir / (args.model_name + "_metrics.json")}')
    print('Model này KHÔNG normalize input -> cắm thẳng vào firmware hiện tại.')

if __name__ == '__main__':
    main()
