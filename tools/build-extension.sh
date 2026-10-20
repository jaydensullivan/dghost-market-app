#!/bin/sh
# Собрать архив расширения DGhost Trade для страницы extension/index.html.
# Запускать после любой правки файлов в extension/.
set -e
cd "$(dirname "$0")/../extension"
rm -f dghost-trade.zip
zip -q -X dghost-trade.zip manifest.json content.js content.css icon-16.png icon-48.png icon-128.png
echo "extension/dghost-trade.zip готов"
