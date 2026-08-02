# Do zero ao APK no tablet

Guia completo: rodar no aparelho, abrir no Android Studio e gerar o APK do totem.
Escrito para ser reaproveitado em qualquer projeto Expo (SDK 57).

---

## Panorama: três formas de ver o app rodando

| Forma | Precisa de quê | Quando usar |
| ----- | -------------- | ----------- |
| **Expo Go** | Só o celular/tablet e o Wi-Fi | Desenvolvimento diário. É o caminho mais rápido — 2 minutos. |
| **EAS Build (nuvem)** | Conta Expo grátis | Gerar o APK final. Não precisa instalar nada de Android no PC. |
| **Build local** | Android Studio + JDK 17 (~10 GB) | Quando você quer o projeto nativo aberto no Android Studio, ou buildar sem internet. |

Para o totem, o caminho recomendado é **Expo Go para testar → EAS Build para o APK**.

---

## 1. Expo Go (2 minutos, sem instalar nada)

```powershell
# No PC, na pasta do projeto:
npx expo start
```

1. Instale o app **Expo Go** no tablet (Play Store).
2. O terminal mostra um QR code — escaneie com o Expo Go.
3. O tablet e o PC precisam estar **na mesma rede Wi-Fi**.

Para o app enxergar o servidor da loja, exporte a variável **antes** do `expo start`:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://192.168.0.10:3001"   # IP do PC, não "localhost"
npx expo start
```

> Descubra o IP do PC com `ipconfig` (procure "Endereço IPv4" do adaptador Wi-Fi).

**Limitações do Expo Go:** não tem o ícone/splash do app, não roda em modo quiosque de verdade e precisa do Expo Go instalado. Serve para validar telas e fluxo, não para entregar.

---

## 2. EAS Build — o APK do totem (caminho recomendado)

Builda na nuvem da Expo. **Não precisa de Android Studio, JDK nem SDK no seu PC.**

### 2.1 Uma vez só: conta e login

```powershell
npm install -g eas-cli
eas login          # conta Expo grátis — crie em https://expo.dev/signup
```

### 2.2 Conferir o perfil de build

O `eas.json` já tem o perfil `totem` configurado para gerar **APK** (e não AAB, que só serve para a Play Store):

```jsonc
{
  "cli": { "appVersionSource": "remote" },
  "build": {
    "totem": {
      "distribution": "internal",     // link de download direto, sem loja
      "android": { "buildType": "apk" },
      "channel": "totem"
    }
  }
}
```

### 2.3 Antes de buildar: atualizar o conteúdo empacotado

O APK carrega o catálogo e as fotos dentro dele. Gere a versão mais recente:

```powershell
npm run atualizar     # sync + images + bundle
```

### 2.4 Buildar

```powershell
# A URL do servidor da loja fica embutida no APK — defina antes:
$env:EXPO_PUBLIC_API_URL = "http://192.168.0.10:3001"
eas build -p android --profile totem
```

O primeiro build pergunta se pode gerar um **keystore** (assinatura do app) — responda **sim**; a Expo guarda e reutiliza. Ao final sai um link `https://expo.dev/artifacts/...` com o APK.

> **Importante:** guarde esse keystore (`eas credentials`). Um APK assinado com keystore diferente **não** atualiza por cima do anterior — o Android obriga a desinstalar antes.

### 2.5 Instalar no tablet

- **Pelo link:** abra o link do build no navegador do tablet e baixe. Permita "instalar apps de fontes desconhecidas".
- **Por cabo** (se tiver `adb`): `adb install -r caminho\do\app.apk`

---

## 3. Build local + Android Studio

Use se quiser mexer no projeto nativo (permissões, launcher de quiosque, ícones adaptativos avançados).

### 3.1 Instalar o ambiente (uma vez, ~10 GB)

1. **JDK 17**
   ```powershell
   choco install -y microsoft-openjdk17
   ```
   (ou baixe o Azul Zulu 17 / Microsoft OpenJDK 17 manualmente)

2. **Android Studio** — https://developer.android.com/studio
   No instalador, marque **Android SDK**, **Android SDK Platform** e **Android Virtual Device**.

3. No Android Studio: **Settings → Languages & Frameworks → Android SDK → SDK Platforms**, marque *Show Package Details* e instale:
   - **Android SDK Platform 36**
   - **Sources for Android 36**

   Na aba **SDK Tools**: **Android SDK Build-Tools** e **Android Emulator**.

4. **Variáveis de ambiente** (PowerShell, permanente):
   ```powershell
   [Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
   $p = [Environment]::GetEnvironmentVariable("Path", "User")
   [Environment]::SetEnvironmentVariable("Path", "$p;$env:LOCALAPPDATA\Android\Sdk\platform-tools", "User")
   ```
   Feche e reabra o terminal. Teste com `adb devices`.

### 3.2 Gerar o projeto nativo

O projeto não versiona as pastas `android/` e `ios/` — elas são geradas a partir do `app.json`:

```powershell
npx expo prebuild -p android
```

Isso cria a pasta **`android/`**. Agora, no Android Studio: **File → Open** → selecione a pasta **`android`** (não a raiz do projeto). Espere o Gradle sincronizar.

> Rodou `prebuild` e depois mudou o `app.json`? Rode `npx expo prebuild -p android --clean` para regenerar.

### 3.3 Rodar e buildar

```powershell
# Instala e roda no tablet conectado por USB (com depuração USB ligada):
npx expo run:android

# Versão de release (mais rápida, sem o menu de debug):
npx expo run:android --variant release
```

Ou pelo Gradle direto:

```powershell
cd android
.\gradlew assembleRelease
# APK em: android\app\build\outputs\apk\release\app-release.apk
```

> ⚠️ O APK gerado por `expo run:android --variant release` / `assembleRelease` sem configurar assinatura usa uma **chave de debug**. Serve para testar e para uso interno; **não** serve para a Play Store. Para assinar de verdade, o caminho simples é o EAS Build (seção 2).

---

## 4. iPhone / iPad (Expo Go)

```powershell
npx expo start
```

Escaneie o QR com a **câmera do iPhone** (o Expo Go abre sozinho). Para gerar um app iOS instalável é preciso conta paga do Apple Developer (US$ 99/ano) e `eas build -p ios` — desnecessário para este totem, que é Android.

---

## 5. Deixar o tablet em modo quiosque

Depois de instalar o APK:

1. **Fixação de tela (nativo, grátis)**
   Configurações → Segurança → **Fixação de tela** → ative.
   Abra o app → botão de apps recentes → toque no ícone do app → **Fixar**.
   Para sair: segure *Voltar* + *Recentes* (peça o PIN do aparelho).

2. **Launcher dedicado (mais robusto)**
   Para a loja de verdade, um MDM/launcher como **SureLock** ou o modo *dedicated device* do Android Enterprise impede que o cliente saia do app, desligue o Wi-Fi ou acesse as configurações.

3. **Ajustes recomendados no tablet**
   - Brilho no máximo, rotação automática **desligada**
   - "Manter tela ligada ao carregar" ligado (o app já usa `expo-keep-awake`, mas isso ajuda antes de ele abrir)
   - Wi-Fi da loja com IP fixo para o PC do servidor

---

## 6. Manter o catálogo atualizado

Não há nada para agendar no sistema operacional. As rotinas de sincronização
rodam **dentro do servidor** ([sync/src/scheduler.js](../sync/src/scheduler.js)):
sync rápido a cada 5 minutos, sync completo às 05:00.

Basta o servidor ficar de pé:

```bash
cd sync && npm run server
```

Para o servidor subir sozinho com o PC, o caminho mais simples é um atalho em
`shell:startup` apontando para esse comando. Se quiser algo mais robusto (log,
reinício automático em caso de falha), use o **PM2**:

```bash
npm install -g pm2
pm2 start npm --name le-parfum --cwd "C:\Users\victo\OneDrive\Desktop\Le Parfum\App\sync" -- run server
pm2 save
pm2 startup     # segue as instruções que ele imprime
```

Conferir se as rotinas estão rodando: `curl http://localhost:3001/health` — o
campo `agenda` mostra a última execução e o último erro de cada uma.

## 7. Checklist antes de uma apresentação

```powershell
npm run atualizar        # catálogo, fotos e bundle no dia
npm run typecheck        # tipos
npx expo-doctor          # saúde do projeto (deve dar 20/20)
npx expo export --platform android    # o Metro consegue empacotar tudo?
```

- [ ] APK instalado e aberto **com o Wi-Fi desligado** — catálogo e fotos aparecem?
- [ ] Painel da loja (segurar o logo → PIN) mostra a data do catálogo correta?
- [ ] Quiz completo até o resultado, com perfumes reais?
- [ ] Fixação de tela ativada?
- [ ] Tablet carregado e com brilho no máximo?
