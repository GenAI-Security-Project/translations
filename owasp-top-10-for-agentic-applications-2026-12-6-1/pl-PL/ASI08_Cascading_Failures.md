<!-- status: draft -->
# ASI08: Awarie kaskadowe

## Opis

Agentowe awarie kaskadowe występują, gdy pojedyncza usterka (halucynacja, złośliwe dane wejściowe, skorumpowane narzędzie lub zatruta pamięć) propaguje się między autonomicznymi agentami, kumulując się w szkodę systemową. Ponieważ agenci planują, zachowują trwałość i delegują autonomicznie, pojedynczy błąd może ominąć etapowe kontrole człowieka i utrwalić się w zapisanym stanie. W miarę jak agenci tworzą wyłaniające się powiązania z nowymi narzędziami lub partnerami, te ukryte usterki łączą się w operacje uprzywilejowane, które kompromitują poufność, integralność i dostępność, prowadząc do rozległych awarii usług w sieciach agentów, systemach i przepływach pracy.

Awarie kaskadowe opisują propagację i wzmocnienie pierwotnej usterki — nie samą pierwotną podatność — między agentami, narzędziami i przepływami pracy, zamieniając pojedynczy błąd w wpływ obejmujący cały system.

**ASI08** koncentruje się na propagacji i wzmocnieniu usterek, a nie na ich pochodzeniu. Pierwotny defekt należy klasyfikować w ramach ASI04, ASI06 lub ASI07, gdy stanowi on bezpośrednią kompromitację — taką jak skażona zależność, zatruta pamięć lub sfałszowana wiadomość — i stosować ASI08 wyłącznie wtedy, gdy ten defekt rozprzestrzenia się między agentami, sesjami lub przepływami pracy, powodując mierzalne rozgałęzienie lub wpływ systemowy wykraczający poza pierwotne naruszenie.

Obserwowalne objawy obejmują szybkie rozgałęzienie, w którym jedna błędna decyzja wyzwala wielu agentów lub zadań podrzędnych w krótkim czasie, rozprzestrzenianie się między domenami lub najemcami poza pierwotny kontekst, oscylujące ponowienia lub pętle sprzężenia zwrotnego między agentami oraz burze kolejek podrzędnych lub powtarzające się identyczne intencje — z których każdy dostarcza jasnych punktów wykrywania, czyniąc ASI08 operacyjnie możliwym do działania.

Awarie kaskadowe wzmacniają się między połączonymi agentami, łącząc w łańcuch ryzyka z OWASP LLM Top 10. **LLM01:2025** Wstrzyknięcie promptu oraz **LLM06:2025** Nadmierna sprawczość mogą wyzwalać autonomiczne uruchomienia narzędzi, które rozprzestrzeniają błędy bez kontroli człowieka, podczas gdy **LLM04:2025** Zatrucie danych i modelu w pamięci trwałej może zniekształcać decyzje w różnych sesjach i przepływach pracy. Agentic AI - Threats and Mitigations 1.1 obejmuje to zagrożenie w T5 – Ataki kaskadowej halucynacji, podczas gdy T8 – Niezaprzeczalność i możliwość śledzenia podkreśla fundamentalną obronę: zdolność do śledzenia, przypisywania i audytowania zachowań kaskadowych poprzez odporne logowanie i mechanizmy niezaprzeczalności, które zapobiegają cichej propagacji. Niemniej jednak te kumulujące się zagrożenia ilustrują potencjalną rozbieżność między szybkością i skalą propagacji usterek w systemie wieloagentowym a zdolnością ludzi do nadążania za nimi, aby zapewnić bezpieczne i skuteczne działanie systemu. Pozostawia to pewne niezłagodzone ryzyka, które przedsiębiorstwo musi dokładnie ocenić, aby upewnić się, że mieszczą się one w ogólnym budżecie ryzyka organizacji.

## Typowe przykłady podatności

1. Sprzężenie planisty i wykonawcy: halucynujący lub skompromitowany planista emituje niebezpieczne kroki, które wykonawca automatycznie realizuje bez walidacji, mnożąc wpływ między agentami.

2. Skorumpowana pamięć trwała: zatrute cele długoterminowe lub wpisy stanu nadal wpływają na nowe plany i delegacje, propagując ten sam błąd nawet po zniknięciu pierwotnego źródła.

3. Kaskady między agentami z zatrutych wiadomości: pojedyncza skorumpowana aktualizacja powoduje, że agenci partnerscy działają na podstawie fałszywych alertów lub instrukcji restartu, rozprzestrzeniając zakłócenia w różnych regionach.

4. Kaskadowe nadużycie narzędzi i eskalacja uprawnień. Nadużycie integracji lub podwyższonych poświadczeń przez jednego agenta prowadzi do tego, że agenci podrzędni powtarzają niebezpieczne działania lub wyciekają odziedziczone dane.

5. Kaskada automatycznego wdrożenia ze skażonej aktualizacji: zatrute lub wadliwe wydanie wypchnięte przez orkiestrator propaguje się automatycznie do wszystkich połączonych agentów, wzmacniając naruszenie poza jego pochodzeniem.

6. Kaskada dryfu nadzoru: nadzór człowieka słabnie po wielokrotnych sukcesach; masowe zatwierdzenia lub rozluźnienia polityk propagują niekontrolowany dryf konfiguracji między agentami.

7. Wzmocnienie pętli sprzężenia zwrotnego. Dwaj lub więcej agentów polega na wzajemnych wynikach, tworząc samowzmacniającą się pętlę, która powiększa pierwotne błędy lub fałszywe alarmy.

## Przykładowe scenariusze ataków

1. Kaskada handlu finansowego: wstrzyknięcie promptu (**LLM01:2025**) zatruwa agenta analizy rynku, zawyżając limity ryzyka; agenci pozycji i wykonania automatycznie zawierają większe transakcje, podczas gdy compliance pozostaje ślepe na aktywność „w ramach parametrów”.

2. Propagacja protokołu w ochronie zdrowia: manipulacja łańcuchem dostaw (ASI04) korumpuje dane o lekach; agent leczenia automatycznie dostosowuje protokoły, a koordynacja opieki rozprzestrzenia je w całej sieci bez przeglądu przez człowieka.

3. Załamanie orkiestracji chmurowej: zatrucie (**LLM04:2025**) w planowaniu zasobów dodaje nieautoryzowane uprawnienia i rozdęcie; agent bezpieczeństwa je stosuje, a agent wdrożenia udostępnia infrastrukturę z furtką, kosztowną, bez zatwierdzenia dla każdej zmiany.

4. Kompromitacja operacji bezpieczeństwa: skradzione poświadczenia usługi — poprzez **LLM06:2025** i **LLM03:2025** — sprawiają, że mechanizmy wykrywania oznaczają rzeczywiste alerty jako fałszywe, zespół reagowania na incydenty wyłącza kontrole i czyści logi, a compliance raportuje czyste metryki.

5. Awaria kontroli jakości w produkcji (QC): wstrzyknięcie pamięci (ASI06) wraz z zatrutą wiedzą (**LLM08:2025**) sprawia, że QC zatwierdza wadliwe elementy i odrzuca dobre; zarządzanie zapasami i harmonogramowanie optymalizują na podstawie złych danych, powodując wadliwe wysyłki i straty.

6. Pętla sprzężenia zwrotnego automatycznej naprawy: agent naprawczy tłumi alerty, aby spełnić SLA dotyczące opóźnień; agent planujący interpretuje mniejszą liczbę alertów jako sukces i rozszerza automatyzację, potencjalnie pogłębiając martwe punkty w różnych regionach.

7. Regionalna awaria DNS w chmurze hiperskalowej może jednocześnie przerwać działanie wielu usług AI, które od niej zależą, powodując kaskadę awarii agentów w wielu organizacjach.

8. Agentowe systemy obrony cybernetycznej i zapory sieciowe: propagacja halucynacji o nadchodzącym ataku lub wstrzykniętego fałszywego alertu rozprzestrzenia się w leżących u podstaw systemach wieloagentowych, powodując niepotrzebne, lecz katastrofalne działania obronne, takie jak wyłączenia, odmowy i odłączenia sieciowe.

## Wytyczne dotyczące zapobiegania i łagodzenia skutków

1. Model zero-trust w projektowaniu aplikacji: projektuj system z tolerancją na błędy, zakładając awarię dostępności komponentów LLM:2025, funkcji agentowych oraz źródeł zewnętrznych.

2. Izolacja i granice zaufania: stosuj piaskownice dla agentów, zasadę najmniejszych uprawnień, segmentację sieci, API o ograniczonym zakresie oraz wzajemne uwierzytelnianie, aby powstrzymać propagację awarii.

3. Dostęp JIT i jednorazowy do narzędzi z kontrolami w czasie działania: wydawaj krótkotrwałe poświadczenia ograniczone do zadania dla każdego uruchomienia agenta i waliduj każde wywołanie narzędzia o wysokim wpływie względem reguły polityki jako kodu przed jego wykonaniem. Zapewnia to, że skompromitowany lub dryfujący agent nie może wyzwolić reakcji łańcuchowych w innych agentach lub systemach.

4. Niezależne egzekwowanie polityk: oddziel planowanie od wykonania za pomocą zewnętrznego silnika polityk, aby zapobiec wyzwalaniu szkodliwych działań przez skorumpowane planowanie.

5. Walidacja wyników i bramy ludzkie: punkty kontrolne, agenci zarządzający lub przegląd przez człowieka dla wysokiego ryzyka, zanim wyniki agenta zostaną propagowane dalej.

6. Ograniczanie częstotliwości i monitorowanie: wykrywaj szybko rozprzestrzeniające się polecenia oraz ograniczaj lub wstrzymuj przy anomaliach.

7. Wdrażaj zabezpieczenia promienia rażenia, takie jak limity, pułapy postępu, wyłączniki bezpieczeństwa (circuit breakers) między planistą a wykonawcą.

8. Wykrywanie dryfu behawioralnego i nadzorczego: śledź decyzje względem linii bazowych i dostosowania; flaguj stopniową degradację.

9. Odtwarzanie cyfrowego bliźniaka i bramkowanie polityk: ponownie uruchom zarejestrowane działania agenta z ostatniego tygodnia w izolowanym klonie środowiska produkcyjnego, aby sprawdzić, czy ta sama sekwencja wyzwoliłaby awarie kaskadowe. Uzależnij każde rozszerzenie polityki od przejścia tych testów odtwarzania w ramach wcześniej zdefiniowanych limitów promienia rażenia przed wdrożeniem.

10. Logowanie i niezaprzeczalność. Rejestruj wszystkie wiadomości między agentami, decyzje polityczne oraz wyniki wykonania w odpornych na manipulację, znakowanych czasowo logach powiązanych z kryptograficznymi tożsamościami agentów. Utrzymuj metadane pochodzenia dla każdego propagowanego działania, aby wspierać śledzenie kryminalistyczne, walidację wycofywania zmian oraz rozliczalność podczas kaskad.

## Odnośniki

1. https://sre.google/sre-book/addressing-cascading-failures/
2. https://cwe.mitre.org/data/definitions/400.html
