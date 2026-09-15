#!/usr/bin/env bash
#
# Этап 0 — достать одну модель оружия из CS2 и экспортнуть в glTF.
# Запускать в GitHub Codespaces (Linux), ПК не нужен.
#
# Цепочка:
#   DepotDownloader  — скачивает файлы игры напрямую из Steam
#   Source2Viewer-CLI — распаковывает VPK и декомпилирует .vmdl_c в glTF
#
# Оба инструмента на .NET и работают под Linux.
#
#   chmod +x extract-ak47.sh && ./extract-ak47.sh
#
set -euo pipefail

WORK="$HOME/cs2-assets"
TOOLS="$WORK/tools"
GAME="$WORK/game"
OUT="$WORK/export"

mkdir -p "$TOOLS" "$GAME" "$OUT"

echo "==> 1/5 Проверяю .NET"
if ! command -v dotnet >/dev/null 2>&1; then
    echo "Ставлю .NET 8 SDK..."
    curl -sSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh
    bash /tmp/dotnet-install.sh --channel 8.0
    export PATH="$HOME/.dotnet:$PATH"
    echo 'export PATH="$HOME/.dotnet:$PATH"' >> ~/.bashrc
fi
dotnet --version

echo "==> 2/5 Ставлю DepotDownloader"
# Скачивает файлы игры из Steam по аккаунту. CS2 бесплатная,
# поэтому подойдёт любой аккаунт — можно тот же, что у инспект-бота.
if [ ! -f "$TOOLS/DepotDownloader.dll" ]; then
    cd "$TOOLS"
    DD_URL=$(curl -s https://api.github.com/repos/SteamRE/DepotDownloader/releases/latest \
        | grep -o 'https://[^"]*DepotDownloader-framework.zip' | head -1)
    echo "Беру: $DD_URL"
    curl -sSL "$DD_URL" -o dd.zip
    unzip -oq dd.zip && rm dd.zip
fi

echo "==> 3/5 Ставлю Source2Viewer-CLI"
# Кроссплатформенный декомпилятор Source 2. Умеет читать VPK и
# экспортировать модели сразу в glTF вместе с материалами.
if [ ! -f "$TOOLS/Source2Viewer-CLI" ]; then
    cd "$TOOLS"
    S2V_URL=$(curl -s https://api.github.com/repos/ValveResourceFormat/ValveResourceFormat/releases/latest \
        | grep -o 'https://[^"]*cli-linux-x64.zip' | head -1)
    echo "Беру: $S2V_URL"
    curl -sSL "$S2V_URL" -o s2v.zip
    unzip -oq s2v.zip && rm s2v.zip
    chmod +x Source2Viewer-CLI
fi

echo "==> 4/5 Качаю файлы CS2"
# ВАЖНО: целиком игра — это десятки гигабайт, в Codespaces она не
# влезет и не нужна. Берём только архив с моделями оружия.
# Список файлов задаётся регулярками.
cat > "$WORK/filelist.txt" <<'EOF'
regex:^game/csgo/pak01_dir\.vpk$
regex:^game/csgo/pak01_[0-9]+\.vpk$
EOF

cd "$TOOLS"
if [ ! -f "$GAME/game/csgo/pak01_dir.vpk" ]; then
    echo
    echo "Сейчас спросит логин Steam и код Guard."
    echo "Аккаунт нужен только для скачивания — ничего не изменится."
    echo
    dotnet DepotDownloader.dll \
        -app 730 \
        -filelist "$WORK/filelist.txt" \
        -dir "$GAME" \
        -username "${STEAM_USERNAME:-}" \
        ${STEAM_PASSWORD:+-password "$STEAM_PASSWORD"}
fi

VPK=$(find "$GAME" -name 'pak01_dir.vpk' | head -1)
if [ -z "$VPK" ]; then
    echo "❌ pak01_dir.vpk не найден. Проверь, что скачивание прошло."
    exit 1
fi
echo "Архив: $VPK ($(du -h "$VPK" | cut -f1))"

echo "==> 5/5 Экспортирую AK-47 в glTF"
# Сначала смотрим, как путь называется в этой версии игры —
# Valve их периодически двигает, хардкодить нельзя.
echo "Ищу модель в архиве..."
"$TOOLS/Source2Viewer-CLI" -i "$VPK" --vpk_list \
    | grep -i 'weapons/models.*ak47.*vmdl' | head -5 || true

AK_PATH=$("$TOOLS/Source2Viewer-CLI" -i "$VPK" --vpk_list \
    | grep -i 'weapons/models.*ak47.*\.vmdl_c$' | head -1 | tr -d '\r')

if [ -z "$AK_PATH" ]; then
    echo "❌ Модель AK-47 не нашлась. Посмотри список выше и укажи путь руками."
    exit 1
fi

echo "Нашёл: $AK_PATH"

"$TOOLS/Source2Viewer-CLI" \
    -i "$VPK" \
    -o "$OUT" \
    -d \
    --gltf_export_format glb \
    --gltf_export_materials \
    --gltf_textures_adapt \
    --vpk_filepath "$AK_PATH"

echo
echo "================================================"
echo "Готово. Результат:"
find "$OUT" -name '*.glb' -exec ls -lh {} \;
echo
echo "Дальше: залей .glb в репозиторий мини-аппа и открой стенд"
echo "  https://app.dghostmarket.com/viewer-test.html?model=<ссылка на glb>"
echo "================================================"
