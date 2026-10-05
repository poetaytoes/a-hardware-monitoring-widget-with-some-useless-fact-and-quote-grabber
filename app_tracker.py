import time
import json
import psutil
import sys
from pathlib import Path

OUTPUT_FILE = Path("app_usage.json")

# System and background processes to ignore so we focus only on user applications
IGNORED_PROCESSES = {
    "system", "registry", "smss.exe", "csrss.exe", "wininit.exe",
    "services.exe", "lsass.exe", "svchost.exe", "dwm.exe", "conhost.exe",
    "runtimebroker.exe", "taskhostw.exe", "explorer.exe", "python.exe",
    "node.exe", "telemetry_worker.exe", "cmd.exe", "powershell.exe"
}

# Dictionary to accumulate time for all discovered user apps during this session
session_usage ={}

def track_application():
    print("[Python tracker] Started dynamic top-5 application monitoring...")
    poll_interval = 5

    while True:
        # Sleep first so the initial data packet outputs right away
        time.sleep(poll_interval)

        try:
            # Use a set to track unique apps found in THIS tick only
            active_this_tick = set()

            for proc in psutil.process_iter(['name']):
                try:
                    p_name = proc.info['name']
                    if p_name:
                        p_lower = p_name.lower()

                        # Skip background system daemons
                        if p_lower in IGNORED_PROCESSES:
                            continue

                        active_this_tick.add(p_lower)

                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    pass

            # Increment usage ONCE per unique app per tick (prevents multi-process multiplier inflation)
            for p_lower in active_this_tick:
                if p_lower not in session_usage:
                    session_usage[p_lower] = 0
                session_usage[p_lower] += poll_interval

            # Sort apps by active session time (descending) and take the top 5
            sorted_apps = sorted(session_usage.items(), key=lambda x: x[1], reverse=True)
            top_5_apps = dict(sorted_apps[:5])

            # Print directly to stdout for Node.js pipe capture
            print(json.dumps(top_5_apps))
            sys.stdout.flush()

        except Exception as e:
            print(f"[Error in tracker]: {e}")

        #Poll every 5 seconds
        time.sleep(poll_interval)

if __name__ == "__main__":
    track_application()