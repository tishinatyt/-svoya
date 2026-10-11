# СВОЯ — одобренный логотип, 11 октября 2026

Бордовый знак из четырёх переплетённых лепестков, надпись «СВОЯ» и подпись
«ЖІНОЧИЙ КЛУБ» заменяют прежнюю монограмму. Пользователь одобрил исходное
изображение и отдельно поручил установить его на сайт.

- `svoya-logo-approved-source.png` — одобренный исходник на светлом фоне.
- `svoya-logo-transparent-source.png` — версия с прозрачностью, подготовленная встроенным ImageGen (не CLI).
- `svoya-logo-20261011.png` — полный логотип с исходной типографикой для сайта.
- `svoya-symbol-20261011.png` — знак для иконок.
- Главная, подвал, мобильная шапка и панель клуба используют один компонент Brand.
- На тёмной панели CSS делает тот же логотип белым; фон PNG остаётся прозрачным.
- Favicon, iOS и PWA-иконки, включая `/icons/`, обновлены. Версия ссылок — `svoya-20261011`.
- Доступное название ссылки остаётся текстом в `aria-label`.

Производные размеры воспроизводятся командой `node scripts/build-brand-assets.mjs`
(ImageMagick нужен только для подготовки изображений, не для обычной сборки).

Запрос встроенному ImageGen: убрать только бумажный фон и его фактуру; сохранить
одобренный знак, его ориентацию, пропорции, бордовый цвет, надписи «СВОЯ» и
«ЖІНОЧИЙ КЛУБ», шрифт и расположение; получить настоящий прозрачный PNG без
теней, нового фона и дополнительных элементов.

## Архив v2

7 октября 2026 по просьбе владельца простой знак заменён переплетённой монограммой С/В с декоративными терракотовыми деталями. Создан встроенным image_gen, прозрачный фон.

Текущие файлы: `svoya-emblem-source.png` — исходник, `svoya-emblem.png` — знак 256 px. Brand использует живую подпись «СВОЯ / жіночий клуб». Обновлены все favicon, iOS и PWA размеры, включая старые алиасы `/icons/`.

## Архив v1

# СВОЯ — фирменный знак

Создан 6 октября 2026 встроенным инструментом image_gen (не CLI).
Знак использует открытый круг «С» и отдельную терракотовую точку.
Название «СВОЯ» и подпись «жіночий клуб» набраны живым текстом в компоненте src/site/brand.tsx.

- svoya-mark-source.png — исходный прозрачный PNG, 1280×1280.
- svoya-mark.png — прозрачный PNG для интерфейса, 256×256.
- favicon-32.png — вкладка браузера.
- apple-touch-icon.png — ярлык iOS, 180×180.
- ../svoya-icon-192.png и ../svoya-icon-512.png — иконки приложения.

Исходный знак не изменялся; производные размеры подготовлены для веб-интерфейса.

## Запрос генерации

```text
Use case: logo-brand.
Asset type: production brand symbol for the Ukrainian women's friendship club "СВОЯ", website header and app icon.
Primary request: create ONE distinctive minimalist, professionally drawn brand symbol, not a presentation sheet.
Subject: a bold sculptural open-circle Cyrillic С monogram, a humanist editorial shape with subtle thick-to-thin calligraphic balance, cradling a single small warm terracotta circle in its opening. The idea is a welcoming social circle and an individual finding her place. Strong simple silhouette recognizable at 24 pixels. Adult, warm, confident, independent women's social club; not a beauty salon.
Composition: the single symbol centered, fills around 78 percent of a square canvas, generous uniform transparent margin.
Style: flat crisp vector-like graphic, clean antialiased edges, custom editorial identity, careful optical balance.
Color palette: deep burgundy #67243D main symbol, terracotta #D56E58 small circle, genuinely transparent background.
Text: NO words, NO lettering beyond the symbolic С curve.
Avoid: flowers, hearts, female faces, Venus signs, butterflies, leaves, crowns, sparkles, ornate thin lines, gradients, shadows, mockups, textures, fake paper, checkerboard drawn into the image, multiple variants, borders.
Make the С a single smooth weighty form and the dot visually separated from it.
```
