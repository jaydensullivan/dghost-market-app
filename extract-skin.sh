#!/usr/bin/env bash
#
# Достаёт из CS2 ТЕКСТУРЫ РАСКРАСКИ (finish) конкретного скина —
# то, что натягивается поверх модели оружия в 3D-просмотре.
# Модель достаётся отдельным скриптом extract-ak47.sh.
# Запускать в GitHub Codespaces, ПК не нужен.
#
#   bash extract-skin.sh asiimov
#   FINISH=cu_ak47_asiimov bash extract-skin.sh
#
# Имя раскраски — часть пути в игре, например "asiimov",
# "redline", "vulcan". Скрипт сам покажет все совпадения, если
# их окажется несколько.
#
# Работает в два захода, чтобы не выкачивать всю игру:
#   1) качаем только pak01_dir.vpk — это индекс архива, он небольшой
#   2) по индексу смотрим, в каких кусках лежат файлы раскраски,
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

# Что ищем: имя раскраски. Можно передать первым аргументом.
FINISH="${FINISH:-${1:-}}"

if [ -z "$FINISH" ]; then
    echo "❌ Укажи имя раскраски: bash extract-skin.sh asiimov"
    exit 1
fi

OUT="$WORK/export-skins"
mkdir -p "$OUT"

echo "==> 1/5 Проверяю .NET"
if ! command -v dotnet >/dev/null 2>&1; then
    curl -sSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh
    bash /tmp/dotnet-install.sh --channel 8.0
    export PATH="$HOME/.dotnet:$PATH"
fi
dotnet --version

echo "==> 2/5 Проверяю инструменты"

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
#
# -no-mobile: вход подтверждается ПЯТИЗНАЧНЫМ КОДОМ из приложения
#   Steam Guard, а не кнопкой "подтвердить" в приложении. В
#   Codespaces соединение со Steam нередко рвётся, и пока идёт
#   переподключение, сессия подтверждения протухает — именно так
#   появляется "Failed to poll status with result FileNotFound".
#   Ввод кода такой проблемы не имеет.
# -remember-password: после первого успешного входа токен
#   сохраняется, и следующие запуски идут без пароля и кода.
dd_run() {
    cd "$TOOLS"
    dotnet DepotDownloader.dll -app 730 -username "$STEAM_USER" \
        -no-mobile -remember-password "$@"
}

echo "==> 3/5 Качаю индекс архива (pak01_dir.vpk)"
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

echo "==> 4/5 Ищу раскраску '$FINISH' в индексе"
"$TOOLS/Source2Viewer-CLI" -i "$VPK" --vpk_dir > "$WORK/vpk_dir.txt" 2>/dev/null || true

if [ ! -s "$WORK/vpk_dir.txt" ]; then
    echo "❌ Не удалось прочитать индекс архива."
    exit 1
fi

# Где лежат раскраски, зависит от версии игры: в CS:GO это было
# materials/models/weapons/customization/paints/, в CS2 путь мог
# поменяться. Поэтому ищем по общему куску пути "paints/", а не по
# точному каталогу.
# По умолчанию — раскраски оружия. Для перчаток:
# PAINTS_FILTER=gloves/paints/ bash extract-skin.sh <имя>
PAINTS_FILTER="${PAINTS_FILTER:-weapons/paints/}"

grep -i "$PAINTS_FILTER" "$WORK/vpk_dir.txt" > "$WORK/paints-all.txt" || true

if [ ! -s "$WORK/paints-all.txt" ]; then
    echo "⚠️ В индексе вообще нет путей с '$PAINTS_FILTER'."
    echo "Вот как выглядят строки индекса (первые 5):"
    head -5 "$WORK/vpk_dir.txt"
    echo "А вот строки со словом paint (первые 10):"
    grep -i 'paint' "$WORK/vpk_dir.txt" | head -10
    echo "Скинь это в чат — поправлю фильтр."
    exit 1
fi

echo "Файлов раскрасок всего: $(wc -l < "$WORK/paints-all.txt")"

# В CS2 раскраска — это композитный материал .vcompmat_c, рядом
# лежат её текстуры .vtex_c и обычные материалы .vmat_c. Ищем все
# три вида: раньше фильтр знал только про два последних и поэтому
# не находил ничего.
grep -i "$FINISH" "$WORK/paints-all.txt" \
    | grep -iE '\.(vcompmat_c|vtex_c|vmat_c)' > "$WORK/skin-hits.txt" || true

if [ ! -s "$WORK/skin-hits.txt" ]; then
    echo "⚠️ Ничего не нашлось по '$FINISH'. Доступные раскраски (имена файлов):"
    grep -oiE '[a-z0-9_]+\.(vcompmat_c|vmat_c|vtex_c)' "$WORK/paints-all.txt" \
        | sed 's/\.[a-z_]*$//' | sort -u | head -40
    echo
    echo "Полный список: grep -i paints/ $WORK/vpk_dir.txt | less"
    echo "Возьми имя из списка и запусти: bash extract-skin.sh <имя>"
    exit 1
fi

echo "Найдено файлов: $(wc -l < "$WORK/skin-hits.txt")"
head -8 "$WORK/skin-hits.txt"

INDICES=$(grep -oiE 'fnumber=[0-9]+|archive *index[:= ]*[0-9]+' "$WORK/skin-hits.txt" \
    | grep -oE '[0-9]+$' | sort -un | tr '\n' ' ')

if [ -z "$INDICES" ]; then
    echo "❌ Не удалось понять, в каких кусках лежат файлы."
    exit 1
fi

echo "Нужные куски: $INDICES"

echo "==> 5/5 Качаю куски и вынимаю текстуры"

: > "$WORK/filelist-skin.txt"
for i in $INDICES; do
    printf 'regex:^game/csgo/pak01_%03d\\.vpk$\n' "$i" >> "$WORK/filelist-skin.txt"
done

dd_run -filelist "$WORK/filelist-skin.txt" -dir "$GAME"

# Каждый найденный файл вынимаем отдельно: текстуры экспортируются
# в PNG, материалы — как есть.
while read -r line; do
    FILE=$(echo "$line" | grep -oiE '[^ ]*paints/[^ ]*\.(vcompmat_c|vtex_c|vmat_c)' | head -1 | tr -d '\r')
    [ -z "$FILE" ] && continue
    echo "  → $FILE"
    "$TOOLS/Source2Viewer-CLI" -i "$VPK" -o "$OUT" -d --vpk_filepath "$FILE" >/dev/null 2>&1 || true
done < "$WORK/skin-hits.txt"

echo
echo "================================================"
find "$OUT" -name '*.png' -exec ls -lh {} \; | head -20
echo
echo "Скопируй нужные PNG в репозиторий (/tmp чистится при перезапуске):"
echo "  mkdir -p /workspaces/dghost-market-app/models/skins"
echo "  cp <путь к png> /workspaces/dghost-market-app/models/skins/"
echo "================================================"
