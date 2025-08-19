@echo off
setlocal
cd /d "%~dp0"

REM Entrar na pasta do servidor
pushd server

REM Instalar dependências se necessário
IF NOT EXIST node_modules (
  echo Instalando dependencias NPM...
  call npm install
)

REM Iniciar o servidor em um novo terminal (janela separada)
echo Iniciando servidor...
start "Souls Help Server" cmd /k "npm start"

popd

REM Aguardar alguns segundos e abrir o navegador
timeout /t 2 >nul
start "" http://localhost:3000

endlocal
