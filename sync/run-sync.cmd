@echo off
rem Sincroniza o catálogo com o Bling. Usado pela tarefa agendada do Windows
rem ("Le Parfum - Sync Bling", a cada 6h). O log guarda somente a última execução.
cd /d "%~dp0"
echo [%date% %time%] Iniciando sync agendado > last-sync.log
node src\sync.js >> last-sync.log 2>&1
echo [%date% %time%] Fim (exit %errorlevel%) >> last-sync.log
