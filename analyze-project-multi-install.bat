@echo off
setlocal
REM SkillHub Installer Batch - analyze-project
REM Platform: Windows

set "TMP_DIR=%TEMP%\skillhub-analyze-project-%RANDOM%"
if not exist "%TMP_DIR%" mkdir "%TMP_DIR%"

curl -L "https://mentalok.io/api/v1/skills/analyze-project/install?os=windows&agent=claude" -o "%TMP_DIR%\install-analyze-project-claude.bat"
if errorlevel 1 exit /b 1
call "%TMP_DIR%\install-analyze-project-claude.bat"
if errorlevel 1 exit /b 1

curl -L "https://mentalok.io/api/v1/skills/analyze-project/install?os=windows&agent=windsurf" -o "%TMP_DIR%\install-analyze-project-windsurf.bat"
if errorlevel 1 exit /b 1
call "%TMP_DIR%\install-analyze-project-windsurf.bat"
if errorlevel 1 exit /b 1

if exist "%TMP_DIR%" rmdir /s /q "%TMP_DIR%"
