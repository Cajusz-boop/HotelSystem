#!/bin/bash
# Add /training location to nginx hotel config
CONF="/etc/nginx/sites-available/hotel"
# Insert before "location / {"
# We add: location = /training { return 301 /training/; }
#         location /training/ { ... proxy to 3012 ... }

TRAINING_BLOCK='    location = /training { return 301 /training/; }
    location /training/ {
        proxy_pass http://127.0.0.1:3012/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection '"'"'upgrade'"'"';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
'

# Use python to insert (more reliable than sed for multiline)
python3 - "$CONF" "$TRAINING_BLOCK" << 'PY'
import sys
path = sys.argv[1]
block = sys.argv[2]
with open(path, 'r') as f:
    content = f.read()
marker = "    location / {"
if block in content:
    print("Already has /training block")
    sys.exit(0)
if marker not in content:
    print("Marker not found")
    sys.exit(1)
content = content.replace(marker, block + "\n" + marker)
with open(path, 'w') as f:
    f.write(content)
print("Added /training block")
PY
