#!/usr/bin/env python
"""
Start Ngrok tunnel for exposing Flask backend to public internet
Usage: python start_ngrok.py
"""

from pyngrok import ngrok
import time

# Set auth token if you have one (optional, only needed for custom domains)
# ngrok.set_auth_token("your_auth_token")

# Start tunnel
try:
    public_url = ngrok.connect(5000, "http")
    print("\n" + "="*60)
    print("✅ NGROK TUNNEL ACTIVE")
    print("="*60)
    print(f"Public URL: {public_url}")
    print(f"\nWebhook endpoint: {public_url}/api/webhook/adafruit/sensor")
    print("="*60)
    print("\nPress Ctrl+C to stop tunnel...\n")
    
    # Keep tunnel running
    ngrok_process = ngrok.get_ngrok_process()
    ngrok_process.proc.wait()
except KeyboardInterrupt:
    print("\n\n✋ Stopping Ngrok...")
    ngrok.kill()
except Exception as e:
    print(f"❌ Error: {e}")
    ngrok.kill()
