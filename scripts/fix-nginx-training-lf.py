#!/usr/bin/env python3
path = '/etc/nginx/sites-available/hotel'
with open(path) as f:
    c = f.read()
old = '    location = /training { return 301 /training/; }'
new = '''    location = /training {
        proxy_pass http://127.0.0.1:3012/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }'''
if old in c:
    c = c.replace(old, new)
    with open(path, 'w') as f:
        f.write(c)
    print('Fixed')
else:
    print('Old block not found')
