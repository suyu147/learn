@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: =============================================================================
:: SmartLearn — 一键部署脚本 (Windows)
:: =============================================================================
:: 用法：双击运行 deploy.bat，或在命令行执行 deploy.bat
:: 前提：已安装 Docker Desktop 并启动
:: =============================================================================

title SmartLearn 一键部署

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║        SmartLearn 智能学习平台 — 一键部署          ║
echo  ╚══════════════════════════════════════════════════╝
echo.

:: ---------------------------------------------------------------------------
:: Step 1: 检查 Docker 是否安装
:: ---------------------------------------------------------------------------
echo [1/5] 检查 Docker 环境...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Docker，请先安装 Docker Desktop。
    echo        下载地址：https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

:: 确保 Docker 正在运行
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Docker 未启动，请先启动 Docker Desktop 后重试。
    pause
    exit /b 1
)

docker compose version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 需要 Docker Compose V2（docker compose），请升级 Docker Desktop。
    pause
    exit /b 1
)

echo        Docker 环境正常 ✓
echo.

:: ---------------------------------------------------------------------------
:: Step 2: 检查并配置 .env 文件
:: ---------------------------------------------------------------------------
echo [2/5] 检查环境配置文件...

if not exist ".env" (
    echo        .env 文件不存在，正在从 .env.example 创建...
    copy .env.example .env >nul
    echo.
    echo ╔══════════════════════════════════════════════════╗
    echo ║  [重要] .env 文件已创建，请先编辑以下必填项：       ║
    echo ║                                                    ║
    echo ║  1. AI_API_KEY         — 大模型 API Key           ║
    echo ║  2. JWT_SECRET         — JWT 签名密钥（随机字符串）║
    echo ║  3. DT_ENCRYPTION_SECRET — 加密密钥（随机字符串）  ║
    echo ║                                                    ║
    echo ║  配置完成后按任意键继续部署...                      ║
    echo ╚══════════════════════════════════════════════════╝
    echo.
    pause
)

:: 检查必填项是否已填写
set NEED_CONFIG=0
for /f "tokens=1,2 delims==" %%a in (.env) do (
    set "key=%%a"
    set "val=%%b"
    if "!key!"=="JWT_SECRET" if "!val!"=="" set NEED_CONFIG=1
    if "!key!"=="DT_ENCRYPTION_SECRET" if "!val!"=="" set NEED_CONFIG=1
)

if %NEED_CONFIG% equ 1 (
    echo ╔══════════════════════════════════════════════════╗
    echo ║  [警告] .env 中存在未配置的必填项：                 ║
    echo ║  - JWT_SECRET                                    ║
    echo ║  - DT_ENCRYPTION_SECRET                          ║
    echo ║                                                    ║
    echo ║  请编辑 .env 文件填写后重新运行本脚本。             ║
    echo ╚══════════════════════════════════════════════════╝
    pause
    exit /b 1
)

echo        .env 配置就绪 ✓
echo.

:: ---------------------------------------------------------------------------
:: Step 3: 构建 Docker 镜像
:: ---------------------------------------------------------------------------
echo [3/5] 构建 Docker 镜像（首次构建约需 5-10 分钟）...
docker compose build --pull
if %errorlevel% neq 0 (
    echo [错误] 镜像构建失败，请检查上方错误信息。
    pause
    exit /b 1
)
echo        镜像构建完成 ✓
echo.

:: ---------------------------------------------------------------------------
:: Step 4: 启动服务
:: ---------------------------------------------------------------------------
echo [4/5] 启动 SmartLearn 服务...
docker compose up -d
if %errorlevel% neq 0 (
    echo [错误] 服务启动失败，请检查上方错误信息。
    pause
    exit /b 1
)
echo        服务已启动 ✓
echo.

:: ---------------------------------------------------------------------------
:: Step 5: 等待服务就绪并验证
:: ---------------------------------------------------------------------------
echo [5/5] 等待服务就绪（约需 30-60 秒）...

set RETRY=0
:health_loop
timeout /t 5 /nobreak >nul
set /a RETRY+=1

curl -sf http://localhost:3000/api/v1/health >nul 2>&1
if %errorlevel% equ 0 (
    echo        服务健康检查通过 ✓
    goto success
)

if %RETRY% lss 12 (
    echo        等待中... (%RETRY%/12)
    goto health_loop
)

echo        服务启动超时，但容器可能仍在初始化中。
echo        请稍后访问 http://localhost:3000 检查状态。
goto done

:: ---------------------------------------------------------------------------
:: 部署成功
:: ---------------------------------------------------------------------------
:success
echo.
echo ╔══════════════════════════════════════════════════╗
echo ║                                                  ║
echo ║      SmartLearn 部署成功！                        ║
echo ║                                                  ║
echo ║      访问地址：http://localhost:3000              ║
echo ║                                                  ║
echo ║      常用命令：                                    ║
echo ║        查看日志：docker compose logs -f app       ║
echo ║        停止服务：docker compose stop              ║
echo ║        重启服务：docker compose restart           ║
echo ║        完全卸载：docker compose down -v           ║
echo ║                                                  ║
echo ╚══════════════════════════════════════════════════╝
echo.

:done
echo 按任意键退出...
pause >nul
endlocal
