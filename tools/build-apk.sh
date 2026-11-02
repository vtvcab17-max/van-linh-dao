#!/usr/bin/env bash
# Đóng gói file APK Android cho Vạn Linh Đảo — chỉ cần Java 17+, KHÔNG cần Android SDK.
# Dùng: bash tools/build-apk.sh                      (chơi trên máy, có đảo máy)
# APK là bản thử nghiệm chơi trên máy. Bản chính thức (đăng nhập Google) chỉ chạy trên web.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .apk-tools build
APKTOOL=.apk-tools/apktool_2.9.3.jar
SIGNER=.apk-tools/uber-apk-signer-1.3.0.jar
[ -f "$APKTOOL" ] || curl -sSL -o "$APKTOOL" https://github.com/iBotPeaches/Apktool/releases/download/v2.9.3/apktool_2.9.3.jar
[ -f "$SIGNER" ] || curl -sSL -o "$SIGNER" https://github.com/patrickfav/uber-apk-signer/releases/download/v1.3.0/uber-apk-signer-1.3.0.jar

npx vite build
rm -rf build/app && cp -r android-shell build/app
mkdir -p build/app/assets && cp dist/index.html build/app/assets/index.html
java -jar "$APKTOOL" b build/app -o build/van-linh-dao-unsigned.apk
# Có KEYSTORE (bản phát hành) thì ký bằng khoá thật, không thì ký khoá debug để cài thử
if [ -n "${KEYSTORE:-}" ]; then
  java -jar "$SIGNER" -a build/van-linh-dao-unsigned.apk -o build/signed --ks "$KEYSTORE" --ksAlias "${KEY_ALIAS:-betaholding}" --ksPass "${KEYSTORE_PASS}" --ksKeyPass "${KEY_PASS:-$KEYSTORE_PASS}"
else
  java -jar "$SIGNER" -a build/van-linh-dao-unsigned.apk -o build/signed
fi
cp build/signed/*.apk build/van-linh-dao.apk
echo "Xong: build/van-linh-dao.apk"
