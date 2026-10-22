# Мини-апп DGhostMarket

## Проверки перед PR

CI запускает то же самое — красная галочка, не мержить:

```bash
node tools/version-check.js origin/main   # изменённым app-*.js / app.css поднят ?v= в index.html (и embed.html)
node tools/i18n-check.js                  # ключи переводов RU/UZ/EN совпадают
node tools/lint-check.js                  # вызовы несуществующих функций, повторные ключи, недостижимый код
```

Функции из лениво грузящихся файлов (app-3d.js, app-admin.js) вызывать
под проверкой `typeof X === 'function'` в той же строке.
