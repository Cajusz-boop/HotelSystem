#!/bin/bash
# Naprawa pętli przekierowań /training: zamiast 301 proxy do aplikacji
CONF="/etc/nginx/sites-available/hotel"

# Blok proxy zamiast redirect
PROXY_BLOCK='    location = /training {
        proxy_pass http://127.0.0.1:3012/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection '"'"'upgrade'"'"';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }'

OLD='    location = /training { return 301 /training/; }'

# Użyj python do replace
python3 - "$CONF" "$OLD" "$PROXY_BLOCK" << 'PY'
import sys
path = sys.argv[1]
old = sys.argv[2]
new = sys.argv[3]
with open(path, 'r') as f:
    content = f.read()
if old not in content:
    print("Old block not found - config may already be fixed")
    sys.exit(0)
content = content.replace(old, new)
with open(path, 'w') as f:
    f.write(content)
print("Fixed: replaced 301 redirect with proxy")
PY
