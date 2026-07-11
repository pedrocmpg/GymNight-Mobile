@echo off
REM setup-device.cmd — Configurar app para rodar no device físico via USB (Windows)
REM 
REM Uso:
REM   setup-device.cmd <YOUR_PC_IP> [SUPABASE_URL] [SUPABASE_ANON_KEY]
REM
REM Exemplo:
REM   setup-device.cmd 192.168.1.100

setlocal enabledelayedexpansion

if "%~1"=="" (
    echo Erro: Missing arguments
    echo.
    echo Uso:
    echo   %0 ^<YOUR_PC_IP^> [SUPABASE_URL] [SUPABASE_ANON_KEY]
    echo.
    echo Exemplo:
    echo   %0 192.168.1.100
    echo   %0 192.168.1.100 https://abc123.supabase.co eyJ0eXAi...
    echo.
    echo Para descobrir seu IP local:
    echo   ipconfig
    echo.
    exit /b 1
)

set "PC_IP=%~1"
set "SUPABASE_URL=%~2"
set "SUPABASE_ANON_KEY=%~3"

REM ========================================================================
REM CRIAR/ATUALIZAR .env
REM ========================================================================

echo Criando/atualizando .env...

(
    echo # Configuracao para device via USB ^(Physical Device^)
    echo # Gerado em: %date% %time%
    echo.
    echo # Backend URL — ajuste para o IP do seu PC
    echo # EXPO_PUBLIC_* prefixo é obrigatorio ^(Expo exigencia^)
    echo EXPO_PUBLIC_BACKEND_BASE_URL=http://%PC_IP%:8000
    echo.
    echo # Supabase
    echo EXPO_PUBLIC_SUPABASE_URL=%SUPABASE_URL%
    echo EXPO_PUBLIC_SUPABASE_ANON_KEY=%SUPABASE_ANON_KEY%
    echo.
    echo # Debug ^(desabilitar em producao^)
    echo EXPO_PUBLIC_DEBUG_SYNC=false
    echo EXPO_PUBLIC_DEBUG_AUTH=false
    echo EXPO_PUBLIC_DEBUG_DB=false
) > .env

echo. & echo [OK] .env criado/atualizado & echo.

REM ========================================================================
REM VERIFICAR DEPENDÊNCIAS
REM ========================================================================

echo Verificando dependencias...

where node >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Node.js nao instalado
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo [OK] Node.js: %NODE_VER%

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERRO] npm nao instalado
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do set NPM_VER=%%i
echo [OK] npm: %NPM_VER%

where adb >nul 2>nul
if errorlevel 1 (
    echo [AVISO] ADB (Android Debug Bridge) nao encontrado
    echo         (necessario para device Android via USB^)
) else (
    echo [OK] ADB encontrado
)

REM ========================================================================
REM PRÓXIMOS PASSOS
REM ========================================================================

echo.
echo [OK] Setup concluido!
echo.
echo Proximos passos:
echo.
echo 1. Conectar o device via USB
echo    - Ativar Modo de Desenvolvedor (7 toques em 'Numero da build'^)
echo    - Ativar 'Depuracao USB' em Configuracoes ^> Desenvolvedor
echo    - Escolher 'Transferencia de arquivos' ao conectar
echo.
echo 2. Verificar conexao:
echo    - adb devices
echo.
echo 3. Em um terminal, rodar o backend:
echo    - cd gymnight\backend
echo    - uvicorn app.main:app --host 0.0.0.0 --port 8000
echo.
echo 4. Em outro terminal, fazer deploy direto no device USB:
echo    - npx expo run:android
echo    (Expo detecta device conectado e faz build ~1-2 min^)
echo.
echo 5. Editar os arquivos em src\ — as mudancas aparecem em tempo real!
echo.
echo Alternativa: usar LAN mode se preferir
echo    - npm start -- --lan
echo    (em outro terminal^) npx expo run:android
echo.
echo Duvidas? Veja: docs\PHYSICAL_DEVICE_CHECKLIST.md
