@echo off
cd /d "%~dp0"

if exist "bridge.env" (
    for /f "usebackq eol=# tokens=1,* delims==" %%a in ("bridge.env") do (
        if not "%%a"=="" if not "%%b"=="" set "%%a=%%b"
    )
)

node server.mjs
pause
