#!/usr/bin/env python3
import argparse
from pathlib import Path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True)
    ap.add_argument('--output', required=True)
    ap.add_argument('--array-name', default='dht_anomaly_model_tflite')
    args = ap.parse_args()

    data = Path(args.input).read_bytes()
    with open(args.output, 'w', encoding='utf-8') as f:
        f.write('#pragma once\n\n')
        f.write(f'const unsigned char {args.array_name}[] = {{\n')
        for i in range(0, len(data), 12):
            chunk = data[i:i+12]
            f.write('  ' + ', '.join(f'0x{b:02x}' for b in chunk))
            if i + 12 < len(data):
                f.write(',')
            f.write('\n')
        f.write('};\n')
        f.write(f'const unsigned int {args.array_name}_len = {len(data)};\n')

if __name__ == '__main__':
    main()
