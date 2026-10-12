# Sobe tudo que o totem precisa para rodar em desenvolvimento.
#
# Uso:  .\dev.ps1                 -> emulador Medium_Tablet
#       .\dev.ps1 -Avd Pixel_8    -> outro emulador
#       .\dev.ps1 -Parar          -> derruba o que ESTE projeto subiu
#
# O script é idempotente: o que já estiver rodando é reaproveitado, então pode
# rodar de novo sem medo se algo cair no meio do caminho.
#
# CONVIVENDO COM OUTROS PROJETOS
# As portas 3001 e 8081 são as mesmas que qualquer outro projeto Expo/Node usa.
# Há dois caminhos:
#   1. Alternar: rode `.\dev.ps1 -Parar` antes de ir para o outro projeto.
#   2. Coexistir: dê portas próprias a este aqui, ex.
#      `.\dev.ps1 -ApiUrl http://10.0.2.2:3002 -PortaMetro 8082`
#   No caso 2, o script mira o emulador deste AVD pelo serial (`adb -s`), então
#   dois emuladores podem rodar lado a lado sem um roubar os túneis do outro.

param(
  [string]$Avd = 'Medium_Tablet',
  # Endereço do servidor da loja visto de DENTRO do aparelho. 10.0.2.2 é como o
  # emulador enxerga este PC; num tablet de verdade, troque pelo IP da rede.
  # A porta daqui é a que o servidor vai realmente abrir no PC.
  [string]$ApiUrl = 'http://10.0.2.2:3001',
  # Porta do Metro NO PC. Dentro do aparelho ele continua sendo o 8081 (é o que
  # o dev client procura); o túnel faz a tradução.
  [int]$PortaMetro = 8081,
  # Encerra o servidor da loja e o Metro deste projeto e sai. O emulador fica
  # de pé de propósito: ele é compartilhado e demora demais para subir.
  [switch]$Parar
)

$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot
$sdk  = "$env:LOCALAPPDATA\Android\Sdk"
$adb  = "$sdk\platform-tools\adb.exe"

$env:ANDROID_HOME = $sdk
$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot'
$env:EXPO_PUBLIC_API_URL = $ApiUrl

$portaApi   = ([uri]$ApiUrl).Port
$portaMetro = $PortaMetro

# --- Qual aparelho? ------------------------------------------------------------
# Com dois emuladores ligados, um `adb` sem `-s` falha com "more than one
# device" - ou, pior, acerta o aparelho do outro projeto. Por isso todo comando
# de dispositivo daqui para baixo leva o serial deste AVD.

function SerialDoAvd($nome) {
  foreach ($linha in (& $adb devices)) {
    if ($linha -match '^(emulator-\d+)\s+device') {
      $serial = $matches[1]
      $atual = (& $adb -s $serial emu avd name 2>$null | Select-Object -First 1)
      if ($atual -and $atual.Trim() -eq $nome) { return $serial }
    }
  }
  return $null
}

# --- Quem esta na porta? -------------------------------------------------------
# Saber que "tem alguem escutando" nao basta: outro projeto na mesma porta faz o
# app apontar para o servidor errado e falhar de um jeito mudo. Entao subimos a
# arvore de processos ate a raiz, porque o caminho do projeto quase nunca
# aparece no processo folha - ele aparece no `npm run` ou na janela que o abriu.

function Arvore($porta) {
  $con = Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $con) { return @() }
  $atual = $con.OwningProcess
  $lista = @()
  for ($i = 0; $i -lt 8 -and $atual -and $atual -ne 0; $i++) {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$atual" -ErrorAction SilentlyContinue
    if (-not $p) { break }
    $lista += $p
    $atual = $p.ParentProcessId
  }
  return $lista
}

function DesteProjeto($arvore) {
  foreach ($p in $arvore) {
    if ($p.CommandLine -and $p.CommandLine.ToLower().Contains($raiz.ToLower())) { return $true }
  }
  return $false
}

# O servidor da loja se identifica sozinho, o que cobre o caso de ele ter sido
# iniciado na mao (aí o caminho do projeto nao aparece em linha de comando
# nenhuma da arvore).
function ServidorEhNosso {
  try {
    $r = Invoke-RestMethod -Uri "http://localhost:$portaApi/health" -TimeoutSec 3
    return ($null -ne $r.produtosNoTotem)
  } catch { return $false }
}

# Matar a folha nao resolve: o `ts-node-dev` e o `npm` respawnam o filho. O node
# mais alto da arvore e o npm/npx que comanda tudo - e onde a machadada pega.
function Comandante($arvore) {
  return ($arvore | Where-Object { $_.Name -eq 'node.exe' } | Select-Object -Last 1)
}

function Conflito($porta, $arvore, $oQue) {
  Write-Host ''
  Write-Host "ERRO: a porta $porta ($oQue) esta ocupada por OUTRO projeto." -ForegroundColor Red
  # So os primeiros degraus interessam: mais acima so tem VS Code e explorer,
  # que nao dizem nada sobre qual projeto e esse.
  foreach ($p in ($arvore | Select-Object -First 3)) {
    $cmd = $p.CommandLine
    if (-not $cmd) { $cmd = $p.Name }
    if ($cmd.Length -gt 140) { $cmd = $cmd.Substring(0, 140) + '...' }
    Write-Host ("      PID {0,-6} {1}" -f $p.ProcessId, $cmd) -ForegroundColor DarkGray
  }
  Write-Host ''
  Write-Host '      Va no projeto dono e pare por la (o -Parar dele, se tiver).' -ForegroundColor Yellow
  $chefe = Comandante $arvore
  if ($chefe) {
    Write-Host '      Ou derrube a arvore inteira daqui:' -ForegroundColor Yellow
    Write-Host ("      taskkill /F /T /PID {0}" -f $chefe.ProcessId) -ForegroundColor Yellow
  }
  Write-Host ''
  exit 1
}

# --- -Parar --------------------------------------------------------------------
if ($Parar) {
  $algo = $false
  foreach ($alvo in @(
    @{ Porta = $portaApi;   Nome = 'servidor da loja' },
    @{ Porta = $portaMetro; Nome = 'Metro' }
  )) {
    $arvore = Arvore $alvo.Porta
    if (-not $arvore) {
      Write-Host ("$($alvo.Nome) (porta $($alvo.Porta)): ja estava parado.") -ForegroundColor DarkGray
      continue
    }
    $nosso = DesteProjeto $arvore
    if (-not $nosso -and $alvo.Porta -eq $portaApi) { $nosso = ServidorEhNosso }
    if (-not $nosso) {
      Write-Host ("$($alvo.Nome) (porta $($alvo.Porta)): e de OUTRO projeto, nao vou mexer.") -ForegroundColor Yellow
      Write-Host ("      PID {0}  {1}" -f $arvore[0].ProcessId, $arvore[0].CommandLine) -ForegroundColor DarkGray
      continue
    }
    $chefe = Comandante $arvore
    if (-not $chefe) { $chefe = $arvore[0] }
    & taskkill /F /T /PID $chefe.ProcessId | Out-Null
    Write-Host ("$($alvo.Nome) (porta $($alvo.Porta)): encerrado (PID $($chefe.ProcessId)).") -ForegroundColor Cyan
    $algo = $true
  }

  # Os tuneis sao por aparelho e sobrevivem ao Metro morto; deixa-los para tras
  # faz o proximo projeto herdar redirecionamentos que ninguem pediu.
  if (Test-Path $adb) {
    $serial = SerialDoAvd $Avd
    if ($serial) {
      & $adb -s $serial reverse --remove 'tcp:8081'       2>$null | Out-Null
      & $adb -s $serial reverse --remove "tcp:$portaApi"   2>$null | Out-Null
    }
  }

  Write-Host ''
  if ($algo) {
    Write-Host 'Portas liberadas. Pode abrir o outro projeto.' -ForegroundColor Green
  } else {
    Write-Host 'Nada deste projeto estava rodando.' -ForegroundColor Green
  }
  Write-Host 'O emulador continua ligado de proposito (da para reaproveitar).' -ForegroundColor DarkGray
  Write-Host 'Para desligar tambem:  adb emu kill' -ForegroundColor DarkGray
  exit 0
}

# 1. Emulador ------------------------------------------------------------------
$serial = SerialDoAvd $Avd
if ($serial) {
  Write-Host "[1/4] Emulador $Avd ja esta rodando ($serial)." -ForegroundColor DarkGray
} else {
  Write-Host "[1/4] Ligando o emulador $Avd..." -ForegroundColor Cyan
  Start-Process -FilePath "$sdk\emulator\emulator.exe" -ArgumentList '-avd', $Avd -WorkingDirectory "$sdk\emulator"
  # O primeiro boot de um AVD novo passa dos 5 min que o Android Studio espera;
  # aqui damos tempo de verdade em vez de desistir no meio.
  # Nao da para usar `wait-for-device` sem serial: se houver outro emulador
  # ligado, ele volta na hora apontando para o aparelho errado.
  $limite = (Get-Date).AddMinutes(10)
  while (-not $serial -and (Get-Date) -lt $limite) {
    Start-Sleep -Seconds 3
    $serial = SerialDoAvd $Avd
  }
  if (-not $serial) {
    Write-Host "ERRO: o emulador $Avd nao apareceu em 10 min." -ForegroundColor Red
    exit 1
  }
  & $adb -s $serial shell 'while [ -z "$(getprop sys.boot_completed)" ]; do sleep 2; done' | Out-Null
  Write-Host "      Boot completo ($serial)." -ForegroundColor DarkGray
}

# 2. Tuneis --------------------------------------------------------------------
# Sao POR APARELHO e se perdem quando o emulador desliga. Sem o 8081 o app abre
# na tela vermelha "Unable to load script".
#
# O lado do APARELHO e sempre 8081, porque e onde o dev client procura o bundle;
# so o lado do PC muda quando este projeto cede a porta para outro. Por isso o
# mapeamento pode ser cruzado (8081 -> 8082).
& $adb -s $serial reverse 'tcp:8081'     "tcp:$portaMetro" | Out-Null
& $adb -s $serial reverse "tcp:$portaApi" "tcp:$portaApi"  | Out-Null
if ($portaMetro -eq 8081) {
  Write-Host "[2/4] Tuneis 8081 (Metro) e $portaApi (servidor) criados." -ForegroundColor Cyan
} else {
  Write-Host "[2/4] Tuneis 8081 do aparelho -> $portaMetro do PC (Metro) e $portaApi (servidor)." -ForegroundColor Cyan
}

# --- Conflito antes de qualquer coisa ------------------------------------------
# As duas portas sao conferidas ANTES de subir nada. Se o Metro estivesse
# ocupado e a checagem viesse depois, o script ja teria deixado um servidor
# solto para tras ao abortar.
$arvoreApi   = Arvore $portaApi
$arvoreMetro = Arvore $portaMetro
$apiEhNossa   = $arvoreApi   -and ((DesteProjeto $arvoreApi) -or (ServidorEhNosso))
$metroEhNosso = $arvoreMetro -and (DesteProjeto $arvoreMetro)
if ($arvoreApi   -and -not $apiEhNossa)   { Conflito $portaApi   $arvoreApi   'servidor da loja' }
if ($arvoreMetro -and -not $metroEhNosso) { Conflito $portaMetro $arvoreMetro 'Metro' }

# 3. Servidor da loja ----------------------------------------------------------
if ($apiEhNossa) {
  Write-Host "[3/4] Servidor da loja ja esta rodando (porta $portaApi)." -ForegroundColor DarkGray
} else {
  Write-Host "[3/4] Subindo o servidor da loja na porta $portaApi (janela separada)..." -ForegroundColor Cyan
  # PORT precisa ir por variavel de ambiente: o `dotenv` do servidor nao
  # sobrescreve o que ja existe no processo, entao isto vence o sync/.env.
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$raiz'; `$env:PORT='$portaApi'; npm run server"
}

# 4. Metro ---------------------------------------------------------------------
if ($metroEhNosso) {
  Write-Host "[4/4] Metro ja esta rodando (porta $portaMetro)." -ForegroundColor DarkGray
  Write-Host '      ATENCAO: se ele nao foi iniciado por este script, pode estar' -ForegroundColor Yellow
  Write-Host '      sem EXPO_PUBLIC_API_URL e o cadastro dira "Servidor nao' -ForegroundColor Yellow
  Write-Host '      configurado". Nesse caso feche aquele Metro e rode de novo.' -ForegroundColor Yellow
} else {
  Write-Host "[4/4] Subindo o Metro na porta $portaMetro (janela separada)..." -ForegroundColor Cyan
  # A variavel entra no bundle no momento em que o Metro sobe; por isso ela e
  # passada aqui, e nao depois.
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$raiz'; `$env:EXPO_PUBLIC_API_URL='$ApiUrl'; npx expo start --port $portaMetro"
}

Write-Host ''
Write-Host "Pronto. Abra o Le Parfum no emulador $Avd." -ForegroundColor Green
Write-Host "Se o app ainda nao estiver instalado nesse aparelho: npx expo run:android" -ForegroundColor DarkGray
Write-Host 'Para liberar as portas depois:  .\dev.ps1 -Parar' -ForegroundColor DarkGray
