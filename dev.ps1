# Sobe tudo que o totem precisa para rodar em desenvolvimento.
#
# Uso:  .\dev.ps1                 -> emulador Medium_Tablet
#       .\dev.ps1 -Avd Pixel_8    -> outro emulador
#
# O script é idempotente: o que já estiver rodando é reaproveitado, então pode
# rodar de novo sem medo se algo cair no meio do caminho.

param(
  [string]$Avd = 'Medium_Tablet',
  # Endereço do servidor da loja visto de DENTRO do aparelho. 10.0.2.2 é como o
  # emulador enxerga este PC; num tablet de verdade, troque pelo IP da rede.
  [string]$ApiUrl = 'http://10.0.2.2:3001'
)

$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot
$sdk  = "$env:LOCALAPPDATA\Android\Sdk"
$adb  = "$sdk\platform-tools\adb.exe"

$env:ANDROID_HOME = $sdk
$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot'
$env:EXPO_PUBLIC_API_URL = $ApiUrl

function Ouvindo($porta) {
  [bool](Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue)
}

# 1. Emulador ------------------------------------------------------------------
$dispositivos = (& $adb devices) -join "`n"
if ($dispositivos -match 'emulator-\d+\s+device') {
  Write-Host '[1/4] Emulador ja esta rodando.' -ForegroundColor DarkGray
} else {
  Write-Host "[1/4] Ligando o emulador $Avd..." -ForegroundColor Cyan
  Start-Process -FilePath "$sdk\emulator\emulator.exe" -ArgumentList '-avd', $Avd -WorkingDirectory "$sdk\emulator"
  # O primeiro boot de um AVD novo passa dos 5 min que o Android Studio espera;
  # aqui damos tempo de verdade em vez de desistir no meio.
  & $adb wait-for-device
  & $adb shell 'while [ -z "$(getprop sys.boot_completed)" ]; do sleep 2; done' | Out-Null
  Write-Host '      Boot completo.' -ForegroundColor DarkGray
}

# 2. Tuneis --------------------------------------------------------------------
# Sao POR APARELHO e se perdem quando o emulador desliga. Sem o 8081 o app abre
# na tela vermelha "Unable to load script".
& $adb reverse tcp:8081 tcp:8081 | Out-Null
& $adb reverse tcp:3001 tcp:3001 | Out-Null
Write-Host '[2/4] Tuneis 8081 (Metro) e 3001 (servidor) criados.' -ForegroundColor Cyan

# 3. Servidor da loja ----------------------------------------------------------
if (Ouvindo 3001) {
  Write-Host '[3/4] Servidor da loja ja esta rodando.' -ForegroundColor DarkGray
} else {
  Write-Host '[3/4] Subindo o servidor da loja (janela separada)...' -ForegroundColor Cyan
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$raiz'; npm run server"
}

# 4. Metro ---------------------------------------------------------------------
if (Ouvindo 8081) {
  Write-Host '[4/4] Metro ja esta rodando.' -ForegroundColor DarkGray
  Write-Host '      ATENCAO: se ele nao foi iniciado por este script, pode estar' -ForegroundColor Yellow
  Write-Host '      sem EXPO_PUBLIC_API_URL e o cadastro dira "Servidor nao' -ForegroundColor Yellow
  Write-Host '      configurado". Nesse caso feche aquele Metro e rode de novo.' -ForegroundColor Yellow
} else {
  Write-Host '[4/4] Subindo o Metro (janela separada)...' -ForegroundColor Cyan
  # A variavel entra no bundle no momento em que o Metro sobe; por isso ela e
  # passada aqui, e nao depois.
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$raiz'; `$env:EXPO_PUBLIC_API_URL='$ApiUrl'; npx expo start"
}

Write-Host ''
Write-Host 'Pronto. Abra o Le Parfum no emulador.' -ForegroundColor Green
Write-Host 'Se o app ainda nao estiver instalado nesse aparelho: npx expo run:android' -ForegroundColor DarkGray
