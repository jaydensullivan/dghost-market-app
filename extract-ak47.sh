#!/usr/bin/env bash
#
# Этап 0 — достать модель AK-47 из CS2 и экспортнуть в glTF.
# Запускать в GitHub Codespaces, ПК не нужен.
#
#   chmod +x extract-ak47.sh && ./extract-ak47.sh
#
# Работает в два захода, чтобы не выкачивать всю игру:
#   1) качаем только pak01_dir.vpk — это индекс архива, он небольшой
#   2) по индексу смотрим, в каких кусках лежат файлы AK-47,
#      и докачиваем только их
#
set -euo pipefail

# Качаем в /tmp: там 38 ГБ свободно против 16 ГБ в /workspaces.
# ВНИМАНИЕ: /tmp чистится при перезапуске Codespace — готовый .glb
# сразу копируй в репозиторий.
WORK="${WORK:-/tmp/cs2-assets}"
TOOLS="$WORK/tools"
GAME="$WORK/game"
OUT="$WORK/export"

mkdir -p "$TOOLS" "$GAME" "$OUT"

# Что ищем. Поменяй, если нужен другой ствол.
WEAPON="${WEAPON:-ak47}"

echo "==> 1/6 Проверяю .NET"
if ! command -v dotnet >/dev/null 2>&1; then
    curl -sSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh
    bash /tmp/dotnet-install.sh --channel 8.0
    export PATH="$HOME/.dotnet:$PATH"
fi
dotnet --version

echo "==> 2/6 Проверяю инструменты"

# Инструменты могли остаться от прошлого запуска в домашней папке —
# переносим, чтобы не качать заново.
OLD_TOOLS="$HOME/cs2-assets/tools"
if [ -d "$OLD_TOOLS" ]; then
    cp -n "$OLD_TOOLS"/* "$TOOLS/" 2>/dev/null || true
    [ -f "$TOOLS/Source2Viewer-CLI" ] && chmod +x "$TOOLS/Source2Viewer-CLI"
fi

# Ссылку берём из GitHub API, но он ограничивает число запросов без
# ключа. Раньше скрипт в этом случае выходил молча — теперь честно
# говорит и откатывается на проверенную ссылку.
fetch_tool() {
    local name="$1" api="$2" pattern="$3" fallback="$4" zipname="$5"

    cd "$TOOLS"
    echo "  $name: качаю..."

    local url
    url=$(curl -s "$api" | grep -o "$pattern" | head -1 || true)

    if [ -z "$url" ]; then
        echo "  $name: GitHub API не ответил ссылкой (лимит запросов?), беру запасную."
        url="$fallback"
    fi

    echo "  $name: $url"

    if ! curl -fsSL "$url" -o "$zipname"; then
        echo "❌ $name не скачался. Проверь: curl -I $url"
        exit 1
    fi

    unzip -oq "$zipname" && rm "$zipname"
}

if [ ! -f "$TOOLS/DepotDownloader.dll" ]; then
    fetch_tool "DepotDownloader" \
        "https://api.github.com/repos/SteamRE/DepotDownloader/releases/latest" \
        'https://[^"]*DepotDownloader-framework.zip' \
        "https://github.com/SteamRE/DepotDownloader/releases/download/DepotDownloader_3.4.0/DepotDownloader-framework.zip" \
        "dd.zip"
fi

if [ ! -f "$TOOLS/Source2Viewer-CLI" ]; then
    fetch_tool "Source2Viewer" \
        "https://api.github.com/repos/ValveResourceFormat/ValveResourceFormat/releases/latest" \
        'https://[^"]*cli-linux-x64.zip' \
        "https://github.com/ValveResourceFormat/ValveResourceFormat/releases/download/20.0/cli-linux-x64.zip" \
        "s2v.zip"
    chmod +x "$TOOLS/Source2Viewer-CLI"
fi

if [ ! -f "$TOOLS/DepotDownloader.dll" ] || [ ! -f "$TOOLS/Source2Viewer-CLI" ]; then
    echo "❌ Инструменты на месте не оказались. Содержимое $TOOLS:"
    ls -la "$TOOLS"
    exit 1
fi
echo "Инструменты на месте."

# --- логин ---------------------------------------------------------
# Прошлая версия молча подставляла пустой логин, и Steam отвечал
# "requires a username and password" — теперь спрашиваем явно.
STEAM_USER="${STEAM_USERNAME:-}"
if [ -z "$STEAM_USER" ]; then
    read -rp "Логин Steam: " STEAM_USER
fi
if [ -z "$STEAM_USER" ]; then
    echo "❌ Без логина скачать нельзя."
    exit 1
fi

# Пароль спрашивает сам DepotDownloader — он не показывает его при
# вводе и не оставляет в истории терминала.
dd_run() {
    cd "$TOOLS"
    dotnet DepotDownloader.dll -app 730 -username "$STEAM_USER" "$@"
}

echo "==> 3/6 Качаю индекс архива (pak01_dir.vpk)"
if [ -z "$(find "$GAME" -name 'pak01_dir.vpk' 2>/dev/null | head -1)" ]; then
    printf 'regex:^game/csgo/pak01_dir\\.vpk$\n' > "$WORK/filelist-dir.txt"
    dd_run -filelist "$WORK/filelist-dir.txt" -dir "$GAME"
fi

VPK=$(find "$GAME" -name 'pak01_dir.vpk' 2>/dev/null | head -1)
if [ -z "$VPK" ]; then
    echo "❌ pak01_dir.vpk не скачался."
    exit 1
fi
echo "Индекс: $VPK ($(du -h "$VPK" | cut -f1))"

echo "==> 4/6 Смотрю, в каких кусках лежит $WEAPON"
"$TOOLS/Source2Viewer-CLI" -i "$VPK" --vpk_dir > "$WORK/vpk_dir.txt" 2>/dev/null || true

if [ ! -s "$WORK/vpk_dir.txt" ]; then
    echo "❌ Не удалось прочитать индекс. Покажи вывод команды:"
    echo "   $TOOLS/Source2Viewer-CLI -i $VPK --vpk_dir | head -20"
    exit 1
fi

grep -i "$WEAPON" "$WORK/vpk_dir.txt" | head -20
echo "   ..."

# Номера кусков из строк индекса. Формат вывода между версиями
# отличается — если ничего не распозналось, покажем сырые строки.
INDICES=$(grep -i "$WEAPON" "$WORK/vpk_dir.txt" \
    | grep -oi 'archive *index[:= ]*[0-9]*' \
    | grep -o '[0-9]*$' | sort -un | tr '\n' ' ')

if [ -z "$INDICES" ]; then
    echo
    echo "⚠️ Номера кусков не распознались. Вот как выглядят строки:"
    grep -i "$WEAPON" "$WORK/vpk_dir.txt" | head -3
    echo
    echo "Скинь эти строки в чат — поправим разбор."
    exit 1
fi

echo "Нужные куски: $INDICES"

echo "==> 5/6 Качаю только эти куски"
: > "$WORK/filelist-chunks.txt"
for i in $INDICES; do
    printf 'regex:^game/csgo/pak01_%03d\\.vpk$\n' "$i" >> "$WORK/filelist-chunks.txt"
done
cat "$WORK/filelist-chunks.txt"

dd_run -filelist "$WORK/filelist-chunks.txt" -dir "$GAME"

echo "Скачано:"
du -sh "$GAME"
df -h /tmp | tail -1

echo "==> 6/6 Экспортирую в glTF"
MODEL_PATH=$(grep -io "[^ ]*${WEAPON}[^ ]*\.vmdl_c" "$WORK/vpk_dir.txt" | head -1 | tr -d '\r')

if [ -z "$MODEL_PATH" ]; then
    echo "❌ Путь к модели не найден. Посмотри $WORK/vpk_dir.txt"
    exit 1
fi
echo "Модель: $MODEL_PATH"

"$TOOLS/Source2Viewer-CLI" \
    -i "$VPK" \
    -o "$OUT" \
    -d \
    --gltf_export_format glb \
    --gltf_export_materials \
    --gltf_textures_adapt \
    --vpk_filepath "$MODEL_PATH"

echo
echo "================================================"
find "$OUT" -name '*.glb' -exec ls -lh {} \;
echo
echo "Скопируй .glb в репозиторий (/tmp чистится при перезапуске):"
echo "  cp \$(find $OUT -name '*.glb' | head -1) /workspaces/dghost-market-app/ak47.glb"
echo "================================================"
