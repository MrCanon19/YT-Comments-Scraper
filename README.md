# YT Comments Scraper

Skrypt Tampermonkey do pobierania **WSZYSTKICH** komentarzy i subkomentarzy z YouTube. Eksport do pliku Excel (.xlsx) lub TXT.

**Wersja:** 2.1.0

## Funkcje

- **Wszystkie komentarze** — scrolluje stronę aż do załadowania każdego wątku (detekcja spinnera YT, 20 prób bez nowych = stop)
- **Wszystkie subkomentarze** — dwufazowe rozwijanie odpowiedzi:
  - Faza 1: klika "Wyświetl X odpowiedzi" na każdym wątku
  - Faza 2: klika "Więcej odpowiedzi" dla wątków z >10 odpowiedziami
- **Eksport Excel (.xlsx)** — prawdziwy plik Excel z kolumnami: Nr, Typ, Autor, Data, Lajki, Treść
- **Eksport TXT** — czytelny plik tekstowy z wcięciami dla odpowiedzi
- **Anonimizacja** — automatyczne maskowanie nazw autorów (np. `@M****i`)
- **Deduplikacja** — eliminacja powtórzonych komentarzy
- **Limit lub wszystkie** — pobierz wszystkie albo ustaw konkretną liczbę (50 / 100 / 250 / 500 / 1000)

## Wymagania

Rozszerzenie **Tampermonkey** dla przeglądarki:

- [Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox Add-ons](https://addons.mozilla.org/pl/firefox/addon/tampermonkey/)

## Instalacja

### 1. Zainstaluj Tampermonkey

1. Otwórz przeglądarkę (Chrome, Firefox, Edge lub Safari).
2. Wejdź na stronę rozszerzenia Tampermonkey (link powyżej).
3. Kliknij **Dodaj do Chrome** (lub odpowiednik w Twojej przeglądarce).
4. Potwierdź instalację — ikona Tampermonkey pojawi się obok paska adresu.

### 2. Dodaj skrypt

1. Kliknij ikonę **Tampermonkey** w pasku narzędzi przeglądarki.
2. Wybierz **Utwórz nowy skrypt...** (lub "Create a new script...").
3. Usuń całą domyślną zawartość edytora (`Ctrl+A` → `Delete`).
4. Otwórz plik [`yt-comments-scraper.user.js`](yt-comments-scraper.user.js) z tego repozytorium.
5. Skopiuj całą jego zawartość (`Ctrl+A` → `Ctrl+C`).
6. Wklej do edytora Tampermonkey (`Ctrl+V`).
7. Zapisz skrypt: **Ctrl+S** lub kliknij ikonę dyskietki.

> **Uwaga:** Skrypt używa biblioteki SheetJS do generowania plików Excel. Jest ładowana automatycznie przez `@require` w nagłówku — nie musisz nic instalować ręcznie.

### 3. Gotowe

1. Wejdź na dowolny film na **YouTube**.
2. W prawym dolnym rogu pojawi się przycisk **💬**.
3. Kliknij go — otworzy się panel z opcjami.

## Użycie

1. Kliknij przycisk **💬** w prawym dolnym rogu strony YouTube.
2. Wybierz tryb pobierania:
   - **Wszystkie** — pobiera wszystkie dostępne komentarze
   - **Liczba** — ustaw limit (szybkie przyciski: 50, 100, 250, 500, 1000)
3. Opcjonalnie zaznacz **Pobierz odpowiedzi na komentarze**.
4. Wybierz format: **Excel** lub **TXT**.
5. Kliknij **Pobierz komentarze**.
6. Skrypt automatycznie scrolluje stronę, zbiera komentarze i pobiera plik.

## Format pliku Excel

Plik `.xlsx` zawiera:

| Nr | Typ | Autor | Data | Lajki | Treść komentarza |
|----|-----|-------|------|-------|-----------------|
| 1 | Komentarz | M*****i | 2 tygodnie temu | 42 | Treść... |
| 2 | Odpowiedź | @J***n | 1 tydzień temu | 5 | Treść... |

Pierwsze wiersze arkusza zawierają metadane: tytuł filmu, URL, datę pobrania i łączną liczbę elementów.

## Jak to działa

1. **Scroll** — skrypt scrolluje stronę do końca, czekając na załadowanie kolejnych wątków. Jeśli YT pokazuje spinner ładowania, nie liczy tego jako nieudanej próby.
2. **Rozwijanie odpowiedzi** — dwufazowe klikanie przycisków "Wyświetl odpowiedzi" i "Więcej odpowiedzi".
3. **Zbieranie danych** — wyciąga tekst, autora, datę i lajki z DOM YouTube.
4. **Eksport** — generuje plik Excel (SheetJS) lub TXT i automatycznie pobiera.

## Changelog

### v2.1.0
- Więcej fallback selektorów CSS — odporność na drobne zmiany DOM YouTube
- Lepsze wykrywanie spinnera ładowania (więcej wariantów)
- Diagnostyka selektorów — gdy pobieranie zwróci 0 wyników, komunikat informuje które selektory się zepsuły i linkuje do zgłoszenia błędu na GitHub

### v2.0.0
- Eksport do prawdziwego pliku Excel (.xlsx) przez SheetJS
- Naprawione pobieranie WSZYSTKICH komentarzy (maxScrollRetries: 6 → 20, scrollPause: 1800 → 2500ms)
- Detekcja spinnera YT — nie kończy scrollowania gdy strona jeszcze ładuje
- Naprawione pobieranie WSZYSTKICH subkomentarzy (dwufazowe rozwijanie, obsługa wątków z >10 odpowiedziami)
- Dynamiczny czas oczekiwania po rozwinięciu odpowiedzi

### v1.8.2
- Eksport do TXT
- Anonimizacja autorów
- Opcjonalne pobieranie odpowiedzi

## Licencja

Projekt prywatny. Autor: Michał Marini — [LinkedIn](https://www.linkedin.com/in/michal-marini/)
