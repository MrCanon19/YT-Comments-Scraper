# YT Comments Scraper

Skrypt Tampermonkey do eksportu zanonimizowanych komentarzy z YouTube do pliku tekstowego.

**Wersja:** 1.8.2

## Funkcje

- **Eksport komentarzy** — pobieranie komentarzy z dowolnego filmu na YouTube
- **Anonimizacja** — automatyczne maskowanie nazw autorow (np. `@M****i`)
- **Odpowiedzi (replies)** — opcjonalne pobieranie odpowiedzi z watkow
- **Daty i polubienia** — kazdy komentarz zawiera date publikacji i liczbe lajkow
- **Deduplikacja** — eliminacja powtorzonych komentarzy
- **Eksport do .txt** — gotowy plik tekstowy z czytelnym formatowaniem
- **Szybki wybor ilosci** — pobierz wszystkie lub ustaw limit (50, 100, 250, 500, 1000)

## Wymagania

Rozszerzenie **Tampermonkey** dla przegladarki:

- [Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox Add-ons](https://addons.mozilla.org/pl/firefox/addon/tampermonkey/)

## Instalacja krok po kroku

### 1. Zainstaluj Tampermonkey

1. Otworz przegladarke (Chrome, Firefox, Edge lub Safari).
2. Wejdz na strone rozszerzenia Tampermonkey (link powyzej).
3. Kliknij **Dodaj do Chrome** (lub odpowiednik w Twojej przegladarce).
4. Potwierdz instalacje — ikona Tampermonkey pojawi sie obok paska adresu.

### 2. Dodaj skrypt

1. Kliknij ikone **Tampermonkey** w pasku narzedzi przegladarki.
2. Wybierz **Utworz nowy skrypt...** (lub "Create a new script...").
3. Usun cala domyslna zawartosc edytora (zaznacz wszystko `Ctrl+A` i usun).
4. Otworz plik `yt-comments-scraper.user.js` z tego repozytorium.
5. Skopiuj cala jego zawartosc (`Ctrl+A` → `Ctrl+C`).
6. Wklej do edytora Tampermonkey (`Ctrl+V`).
7. Zapisz skrypt: **Ctrl+S** lub kliknij ikone dyskietki.

### 3. Gotowe — uzyj skryptu

1. Wejdz na dowolny film na **YouTube**.
2. W prawym dolnym rogu pojawi sie przycisk **📥**.
3. Kliknij go — otworzy sie panel z opcjami.

## Uzycie

1. Kliknij przycisk **📥** w prawym dolnym rogu strony YouTube.
2. Wybierz tryb pobierania:
   - **Wszystkie** — pobiera wszystkie dostepne komentarze
   - **Liczba** — ustaw limit (szybkie przyciski: 50, 100, 250, 500, 1000)
3. Opcjonalnie zaznacz **Pobierz odpowiedzi na komentarze**.
4. Kliknij **Pobierz komentarze**.
5. Skrypt automatycznie scrolluje strone, zbiera komentarze i pobiera plik `.txt`.

## Format pliku wynikowego

Plik `.txt` zawiera:

- Naglowek z tytulem filmu, URL i data pobrania
- Komentarze z zanonimizowanym autorem, data i liczba lajkow
- Odpowiedzi wciete i oznaczone strzalka `↪`
- Stopke z danymi autora

## Jak to dziala

Skrypt automatycznie scrolluje strone YouTube, laduje komentarze, rozwija watki z odpowiedziami, anonimizuje nazwy autorow i eksportuje dane do pliku tekstowego z czytelnym formatowaniem.

## Licencja

Projekt prywatny. Autor: Michal Marini.
