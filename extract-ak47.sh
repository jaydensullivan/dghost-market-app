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

ALL_HITS=$(grep -ci "$WEAPON" "$WORK/vpk_dir.txt" || true)
echo "Всего файлов со словом '$WEAPON': $ALL_HITS"

# Под общий фильтр попадают ВСЕ раскраски скинов (weapons/paints/...),
# а они разбросаны по десяткам кусков — качать их значит вытянуть
# половину игры. Для рендера нужна только сама модель и её базовые
# текстуры, поэтому раскраски отсекаем.
# Строгий фильтр: только папка самого ствола. Иначе в выборку
# лезут гильзы (shared/shells), модель из рук (v_models), магазин и
# файлы кастомизации — из-за них кусков становится втрое больше.
PATH_FILTER="${PATH_FILTER:-weapons/models/${WEAPON}/}"

grep -i "$PATH_FILTER" "$WORK/vpk_dir.txt" \
    | grep -iv '/paints/' > "$WORK/hits.txt" || true

# Если по строгому пути пусто (у другого оружия папка может
# называться иначе) — откатываемся на широкий фильтр.
if [ ! -s "$WORK/hits.txt" ]; then
    echo "По пути '$PATH_FILTER' пусто, беру широкий фильтр."
    grep -i "$WEAPON" "$WORK/vpk_dir.txt" \
        | grep -iv '/paints/' \
        | grep -iE 'model' > "$WORK/hits.txt" || true
fi

if [ ! -s "$WORK/hits.txt" ]; then
    echo "⚠️ Файлы модели не нашлись. Вот все .vmdl_c со словом $WEAPON:"
    grep -i "$WEAPON" "$WORK/vpk_dir.txt" | grep -i 'vmdl_c' | head -10
    echo "Скинь эти строки в чат."
    exit 1
fi

echo "Из них относятся к модели: $(wc -l < "$WORK/hits.txt")"
head -8 "$WORK/hits.txt"
echo "   ..."

# Source2Viewer пишет номер куска как fnumber=124; в старых версиях
# поле называлось "archive index" — принимаем оба варианта.
INDICES=$(grep -oiE 'fnumber=[0-9]+|archive *index[:= ]*[0-9]+' "$WORK/hits.txt" \
    | grep -oE '[0-9]+$' | sort -un | tr '\n' ' ')

if [ -z "$INDICES" ]; then
    echo
    echo "⚠️ Номера кусков не распознались. Вот как выглядят строки:"
    head -3 "$WORK/hits.txt"
    echo
    echo "Скинь эти строки в чат — поправим разбор."
    exit 1
fi

COUNT=$(echo "$INDICES" | wc -w)
echo "Нужные куски ($COUNT шт.): $INDICES"

# Каждый кусок — сотни мегабайт. Если их набралось много, значит
# фильтр всё ещё широкий: лучше остановиться, чем забить диск.
if [ "$COUNT" -gt "${CHUNK_LIMIT:-20}" ]; then
    echo
    echo "⚠️ Кусков многовато. Каждый — примерно 200-400 МБ."
    echo "Свободно сейчас: $(df -h /tmp | awk 'NR==2{print $4}')"
    echo "Если места хватает, запусти так: CHUNK_LIMIT=40 ./extract-ak47.sh"
    exit 1
fi

# Скачивает перечисленные куски архива (номера через пробел).
download_chunks() {
    : > "$WORK/filelist-chunks.txt"
    for i in $1; do
        printf 'regex:^game/csgo/pak01_%03d\\.vpk$\n' "$i" >> "$WORK/filelist-chunks.txt"
    done
    cat "$WORK/filelist-chunks.txt"

    dd_run -filelist "$WORK/filelist-chunks.txt" -dir "$GAME"
}

echo "==> 5/6 Качаю только эти куски"

# Можно добавить куски руками: EXTRA_CHUNKS="409 410" ./extract-ak47.sh
if [ -n "${EXTRA_CHUNKS:-}" ]; then
    echo "Добавлены вручную: $EXTRA_CHUNKS"
    INDICES="$INDICES $EXTRA_CHUNKS"
fi

download_chunks "$INDICES"

echo "Скачано:"
du -sh "$GAME"
df -h /tmp | tail -1

echo "==> 6/6 Экспортирую в glTF"
MODEL_PATH=$(grep -io "[^ ]*${WEAPON}[^ ]*\.vmdl_c" "$WORK/hits.txt" | head -1 | tr -d '\r')

if [ -z "$MODEL_PATH" ]; then
    echo "❌ Путь к модели не найден. Посмотри $WORK/vpk_dir.txt"
    exit 1
fi
echo "Модель: $MODEL_PATH"

# Модель ссылается на текстуры и материалы, которые лежат в других
# кусках архива — по индексу их не видно, они всплывают только при
# экспорте ("pak01_409.vpk not found"). Номер куска зависит от
# версии игры, поэтому не зашиваем его в скрипт: ловим из ошибки,
# докачиваем и повторяем экспорт. До 5 попыток.
# $1 — дополнительные флаги экспорта (материалы/текстуры).
run_export() {
    "$TOOLS/Source2Viewer-CLI" \
        -i "$VPK" \
        -o "$OUT" \
        -d \
        --gltf_export_format glb \
        $1 \
        --vpk_filepath "$MODEL_PATH" 2>&1 | tee "$WORK/export.log"

    # Код возврата берём у самого экспортёра, а не у tee.
    # Source2Viewer иногда завершается с кодом 0, напечатав
    # исключение, поэтому дополнительно проверяем сам файл.
    rc="${PIPESTATUS[0]}"

    if [ "$rc" -ne 0 ]; then
        return "$rc"
    fi

    if [ -z "$(find "$OUT" -name '*.glb' 2>/dev/null | head -1)" ]; then
        echo "(файл .glb не появился)"
        return 1
    fi

    return 0
}

# Полный набор — с материалами и текстурами. Если он падает,
# пробуем голую геометрию: модель без текстур всё равно откроется
# в просмотрщике, а текстуру скина мы всё равно будем подставлять
# своим рендером.
EXPORT_FLAGS="--gltf_export_materials --gltf_textures_adapt"

GOT_CHUNKS=" $INDICES "

# FORCE_TEXTURES=1 — не откатываться на экспорт без текстур, а
# показать настоящую ошибку. Нужен, когда текстуры обязательны:
# без них в 3D нет ни маски покраски, ни собственного цвета ствола.
FORCE_TEXTURES="${FORCE_TEXTURES:-0}"

for attempt in 1 2 3 4 5 6 7 8; do
    echo "--- Экспорт, попытка $attempt ---"

    if run_export "$EXPORT_FLAGS"; then
        break
    fi

    # Ищем в логе номера недостающих кусков.
    # || true — иначе пустой grep при set -e уронит скрипт.
    MISSING=$(grep -oE 'pak01_[0-9]{3}(\.vpk)?' "$WORK/export.log" \
        | grep -oE '[0-9]{3}' | sort -un | tr '\n' ' ' || true)

    NEW=""
    for i in $MISSING; do
        case "$GOT_CHUNKS" in
            *" $i "*) ;;
            *) NEW="$NEW $i" ;;
        esac
    done

    if [ -z "$NEW" ]; then

        # Куски все на месте — значит падает сам экспорт. Один раз
        # пробуем без материалов и текстур.
        if [ -n "$EXPORT_FLAGS" ] && [ "$FORCE_TEXTURES" != "1" ]; then
            echo
            echo "⚠️ Экспорт с текстурами не удался — пробую без них."
            echo "   (запусти с FORCE_TEXTURES=1, чтобы увидеть причину)"
            EXPORT_FLAGS=""
            continue
        fi

        echo "❌ Экспорт не удался и без текстур."
        echo "--- начало ошибки (по ней понятно, что сломалось) ---"
        grep -m1 -A6 -iE 'exception|error' "$WORK/export.log" || head -25 "$WORK/export.log"
        echo "--- конец ---"
        echo "Полный лог: $WORK/export.log"
        exit 1
    fi

    echo "Не хватает кусков:$NEW — докачиваю."
    download_chunks "$NEW"
    GOT_CHUNKS="$GOT_CHUNKS$NEW "
done

GLB=$(find "$OUT" -name '*.glb' 2>/dev/null | head -1)

if [ -z "$GLB" ]; then
    echo "❌ .glb так и не появился. Полный лог: $WORK/export.log"
    exit 1
fi

if [ -z "$EXPORT_FLAGS" ]; then
    echo "⚠️ Модель без материалов и текстур — геометрия есть, вид серый."
fi

echo
echo "================================================"
ls -lh "$GLB"
echo
echo "Скопируй .glb в репозиторий (/tmp чистится при перезапуске):"
echo "  mkdir -p /workspaces/dghost-market-app/models"
echo "  cp \$(find $OUT -name '*.glb' | head -1) /workspaces/dghost-market-app/models/ak47.glb"
echo "================================================"
