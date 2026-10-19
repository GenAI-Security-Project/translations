<!-- status: reviewed -->
# ASI01: Przejęcie celu agenta

## Opis

Agenci AI wykazują autonomiczną zdolność do wykonywania szeregu zadań w celu osiągnięcia określonego celu. Z powodu nieodłącznych słabości w sposobie przetwarzania instrukcji w języku naturalnym i powiązanych treści, agenci oraz leżący u ich podstaw model nie są w stanie niezawodnie odróżnić instrukcji od towarzyszącej im treści.

W rezultacie atakujący mogą manipulować celami agenta, wyborem zadań lub ścieżkami decyzyjnymi za pomocą różnych technik — w tym, między innymi, manipulacji opartej na promptach, zwodniczych wyników narzędzi, złośliwych artefaktów, sfałszowanych wiadomości między agentami lub zatrutych danych zewnętrznych. Ponieważ agenci polegają na nietypowanych danych wejściowych w języku naturalnym oraz luźno regulowanej logice orkiestracji, nie są w stanie niezawodnie odróżnić uzasadnionych instrukcji od treści kontrolowanej przez atakującego. W przeciwieństwie do **LLM01:2025**, która koncentruje się na zmianie pojedynczej odpowiedzi modelu, **ASI01** obejmuje szerszy wpływ agentowy, w którym zmanipulowane dane wejściowe przekierowują cele, planowanie (jeśli jest stosowane) oraz zachowanie wieloetapowe.

Przejęcie celu agenta różni się od **ASI06** (Zatrucie pamięci i kontekstu) oraz **ASI10** (Nieuczciwe agenty) tym, że atakujący bezpośrednio zmienia cele, instrukcje lub ścieżki decyzyjne agenta — niezależnie od tego, czy manipulacja następuje interaktywnie, czy poprzez wcześniej umieszczone dane wejściowe, takie jak dokumenty, szablony lub zewnętrzne źródła danych. **ASI06** koncentruje się na trwałym zniekształceniu przechowywanego kontekstu lub pamięci długoterminowej, podczas gdy **ASI10** obejmuje autonomiczne odchylenie od celu, które pojawia się bez aktywnej kontroli atakującego. W przewodniku OWASP Agentic AI Threats & Mitigations, **ASI01** odpowiada **T06** Manipulacja celem (zmiana celów agenta) oraz **T07** Niedostosowane i zwodnicze zachowania (omijanie zabezpieczeń lub wprowadzanie ludzi w błąd). Razem ilustrują one, w jaki sposób atakujący mogą podważyć cele agenta oraz logikę wyboru działań, przekierowując jego autonomię na niezamierzone lub szkodliwe wyniki.

## Typowe przykłady podatności

1. Pośrednie wstrzyknięcie promptu poprzez ukryte ładunki instrukcji osadzone na stronach internetowych lub w dokumentach w scenariuszu RAG, które po cichu przekierowują agenta do eksfiltracji wrażliwych danych lub nadużycia podłączonych narzędzi.

2. Pośrednie wstrzyknięcie promptu poprzez zewnętrzne kanały komunikacji (np. e-mail, kalendarz, Teams) wysłane spoza firmy przejmuje wewnętrzną zdolność komunikacyjną agenta, wysyłając nieautoryzowane wiadomości pod zaufaną tożsamością.

3. Złośliwe nadpisanie promptu manipuluje agentem finansowym, nakłaniając go do przelania środków na konto atakującego.

4. Pośrednie wstrzyknięcie promptu nadpisuje instrukcje agenta, powodując generowanie fałszywych informacji wpływających na decyzje biznesowe.

## Przykładowe scenariusze ataków

1. EchoLeak: Zero-Click Indirect Prompt Injection — atakujący wysyła spreparowaną wiadomość e-mail, która po cichu wyzwala wykonanie ukrytych instrukcji przez Microsoft 365 Copilot, powodując eksfiltrację poufnych e-maili, plików i dzienników czatów przez AI bez jakiejkolwiek interakcji użytkownika.

2. Wstrzyknięcie promptu Operator przez treść internetową: atakujący umieszcza złośliwą treść na stronie internetowej przetwarzanej przez agenta Operator, np. w scenariuszach wyszukiwania lub RAG, oszukując go, by postępował zgodnie z nieautoryzowanymi instrukcjami. Agent Operator uzyskuje następnie dostęp do uwierzytelnionych stron wewnętrznych i ujawnia prywatne dane użytkowników, demonstrując, w jaki sposób słabo zabezpieczeni autonomiczni agenci mogą wyciekać wrażliwe informacje poprzez wstrzyknięcie promptu.

3. Dryf blokady celu poprzez zaplanowane prompty. Złośliwe zaproszenie kalendarzowe wstrzykuje cykliczną instrukcję „trybu cichego”, która subtelnie zmienia wagę celów każdego poranka, kierując planistę w stronę zatwierdzeń o niskim tarciu, przy jednoczesnym zachowaniu działań w ramach zadeklarowanych zasad.

4. Atak Inception na użytkownikach ChatGPT. Złośliwy dokument Google Doc wstrzykuje instrukcje nakazujące ChatGPT eksfiltrację danych użytkownika i przekonuje użytkownika do podjęcia nierozważnej decyzji biznesowej.

## Wytyczne dotyczące zapobiegania i łagodzenia skutków

1. Traktuj wszystkie dane wejściowe w języku naturalnym (np. tekst dostarczony przez użytkownika, przesłane dokumenty, pobrane treści) jako niezaufane. Przepuszczaj je przez te same mechanizmy walidacji danych wejściowych i zabezpieczenia przed wstrzyknięciem promptu, zdefiniowane w **LLM01:2025**, zanim będą mogły wpłynąć na wybór celu, planowanie lub wywołania narzędzi.

2. Minimalizuj wpływ przejęcia celu poprzez egzekwowanie zasady najmniejszych uprawnień dla narzędzi agenta oraz wymaganie zatwierdzenia przez człowieka dla działań o wysokim wpływie lub zmieniających cel.

3. Zdefiniuj i zablokuj prompty systemowe agenta tak, aby priorytety celów i dozwolone działania były jawne i podlegały audytowi. Zmiany celów lub definicji nagród muszą przechodzić przez zarządzanie konfiguracją i zatwierdzenie przez człowieka.

4. W czasie działania waliduj zarówno intencję użytkownika, jak i intencję agenta przed wykonaniem działań zmieniających cel lub o wysokim wpływie. Wymagaj potwierdzenia — poprzez zatwierdzenie przez człowieka, silnik polityk lub mechanizmy ochronne platformy — zawsze, gdy agent proponuje działania odbiegające od pierwotnego zadania lub zakresu. Wstrzymaj lub zablokuj wykonanie przy każdej nieoczekiwanej zmianie celu, zgłoś odchylenie do przeglądu i zarejestruj je do celów audytu.

5. Przy budowaniu agentów rozważ zastosowanie „kapsuły intencji” (intent capsule), wschodzącego wzorca wiążącego zadeklarowany cel, ograniczenia i kontekst z każdym cyklem wykonania w podpisanej kopercie, ograniczającej wykorzystanie w czasie działania.

6. Oczyszczaj i waliduj każde podłączone źródło danych — w tym dane wejściowe RAG, e-maile, zaproszenia kalendarzowe, przesłane pliki, zewnętrzne API, wyniki przeglądania oraz wiadomości między agentami — wykorzystując CDR, wykrywanie nośników promptów oraz filtrowanie treści, zanim dane te będą mogły wpłynąć na cele lub działania agenta.

7. Utrzymuj kompleksowe logowanie i ciągłe monitorowanie aktywności agenta, ustanawiając behawioralną linię bazową obejmującą stan celu, wzorce wykorzystania narzędzi oraz właściwości niezmienne (np. schemat, wzorce dostępu). Śledź stabilny identyfikator aktywnego celu tam, gdzie to wykonalne, i alarmuj o

wszelkich odchyleniach — takich jak nieoczekiwane zmiany celu, anomalne sekwencje narzędzi lub odejścia od ustalonej linii bazowej — aby nieautoryzowany dryf celu był natychmiast widoczny w operacjach.

8. Przeprowadzaj okresowe testy red-team symulujące nadpisanie celu i weryfikuj skuteczność wycofywania zmian (rollback).

9. Włącz agentów AI do istniejącego programu zagrożeń wewnętrznych (Insider Threat Program), aby monitorować wszelkie prompty wewnętrzne mające na celu uzyskanie dostępu do wrażliwych danych lub zmianę zachowania agenta, umożliwiając dochodzenie w przypadku nietypowej aktywności.

## Odnośniki

1. Security Advisory - ChatGPT Crawler Reflective DDOS Vulnerability: biuletyn bezpieczeństwa szczegółowo opisujący podatność

2. AIM Echoleak Blog Post: wpis na blogu opisujący podatność

3. ChatGPT Plugin Exploit Explained: From Prompt Injection to Accessing Private Data.

4. AgentFlayer: atak 0click inception na użytkownikach ChatGPT.
