<!-- status: draft -->
# ASI06: Zatrucie pamięci i kontekstu

## Opis

Systemy agentowe polegają na przechowywanych i pobieralnych informacjach, które mogą stanowić migawkę historii konwersacji, narzędzie pamięci lub rozszerzony kontekst, wspierając ciągłość między zadaniami a cyklami rozumowania. Kontekst obejmuje wszelkie informacje, które agent zachowuje, pobiera lub ponownie wykorzystuje, takie jak podsumowania, embeddingi oraz magazyny RAG, lecz nie obejmuje jednorazowych promptów wejściowych omówionych w **LLM01:2025** Wstrzyknięcie promptu.

W zatruciu pamięci i kontekstu przeciwnicy korumpują lub zasilają ten kontekst złośliwymi lub wprowadzającymi w błąd danymi, powodując, że przyszłe rozumowanie, planowanie lub użycie narzędzi staje się stronnicze, niebezpieczne lub wspomaga eksfiltrację. Źródła pozyskiwania danych, takie jak przesyłane pliki, strumienie API, dane wejściowe użytkownika lub wymiana między agentami, mogą być niezaufane lub zweryfikowane jedynie częściowo.

To ryzyko różni się od **ASI01** (Przejęcie celu), które obejmuje bezpośrednią manipulację celem, oraz **ASI08** (Awarie kaskadowe), które opisuje degradację następującą po wystąpieniu zatrucia. Jednak zatrucie pamięci często prowadzi do przejęcia celu (ASI01), ponieważ skorumpowany kontekst lub pamięć długoterminowa mogą zmienić interpretację celu agenta, ścieżkę rozumowania lub logikę wyboru narzędzi.

Opiera się na **LLM01:2025** Wstrzyknięcie promptu, **LLM04:2025** Zatrucie danych i modelu oraz **LLM08:2025** Słabości wektorów i embeddingów, lecz koncentruje się na trwałej korupcji pamięci agenta i pobieralnego kontekstu, która propaguje się między sesjami i zmienia autonomiczne rozumowanie.

Mapuje się na T1 Zatrucie pamięci w Agentic Threats and Mitigations, z powiązanymi skutkami w T4 Przeciążenie pamięci, T6 Zepsute cele oraz T12 Zatrucie współdzielonej pamięci. W AIVSS pola AARS Wykorzystanie pamięci oraz Świadomość kontekstowa podnoszą wynik podatności agentowej.

## Typowe przykłady podatności

1. Zatrucie RAG i embeddingów: złośliwe lub zmanipulowane dane trafiają do bazy wektorowej poprzez zatrute źródła, bezpośrednie przesyłanie plików lub nadmiernie zaufane potoki danych. Skutkuje to fałszywymi odpowiedziami, które są rozważane i stanowią celowane ładunki.

2. Zatrucie współdzielonego kontekstu użytkownika: ponownie wykorzystywane lub współdzielone konteksty pozwalają atakującym wstrzykiwać dane poprzez normalne czaty, wpływając na późniejsze sesje. Skutki obejmują dezinformację, niebezpieczne wykonanie kodu lub nieprawidłowe działania narzędzi.

3. Manipulacja oknem kontekstu: atakujący wstrzykuje spreparowaną treść do trwającej konwersacji lub zadania, tak aby została ona później podsumowana lub zapisana w pamięci, zanieczyszczając przyszłe rozumowanie lub decyzje nawet po zakończeniu pierwotnej sesji.

4. Dryf pamięci długoterminowej: przyrostowa ekspozycja na subtelnie skażone dane, podsumowania lub informacje zwrotne od innych agentów stopniowo przesuwa przechowywaną wiedzę lub wagi celów, powodując z czasem odchylenia behawioralne lub strategiczne.

5. Systemowe niedostosowanie i furtki: zatruta pamięć przesuwa personę modelu i zasadza furtki oparte na wyzwalaczach, które wykonują ukryte instrukcje, takie jak destrukcyjny kod lub wycieki danych.

6. Propagacja między agentami: zanieczyszczony kontekst lub współdzielona pamięć rozprzestrzenia się między współpracującymi agentami, pogłębiając korupcję i umożliwiając długoterminowy wyciek danych lub skoordynowany dryf.

## Przykładowe scenariusze ataków

1. Zatrucie pamięci rezerwacji podróży: atakujący wielokrotnie utwierdza fałszywą cenę lotu, asystent zapisuje ją jako prawdziwą, a następnie zatwierdza rezerwacje po tej cenie, omijając kontrole płatności.

2. Wykorzystanie okna kontekstu: atakujący rozdziela próby na wiele sesji, tak aby wcześniejsze odrzucenia wypadały z kontekstu, a AI ostatecznie przyznaje coraz większe uprawnienia, aż do dostępu administracyjnego.

3. Zatrucie pamięci systemu: atakujący przetrenowuje pamięć AI zabezpieczeń, aby etykietować złośliwą aktywność jako normalną, pozwalając atakom przechodzić niewykrytym.

4. Zatrucie współdzielonej pamięci: atakujący wstawia fałszywe polityki zwrotów do współdzielonej pamięci, inni agenci je ponownie wykorzystują, a firma ponosi skutki błędnych decyzji, strat i sporów.

5. Przeciek wektorów między najemcami (cross-tenant): niemal identyczna treść zasiana przez atakującego wykorzystuje luźne filtry przestrzeni nazw, wciągając wrażliwy fragment innego najemcy do wyszukiwania poprzez wysokie podobieństwo kosinusowe.

6. Zatrucie pamięci asystenta: atakujący zaszczepia pamięć asystenta użytkownika poprzez pośrednie wstrzyknięcie promptu, kompromitując bieżące i przyszłe sesje tego użytkownika.

## Wytyczne dotyczące zapobiegania i łagodzenia skutków

1. Podstawowa ochrona danych: szyfrowanie w tranzycie i w spoczynku, połączone z dostępem opartym na zasadzie najmniejszych uprawnień.

2. Walidacja treści: skanuj wszystkie nowe zapisy pamięci i wyniki modelu (reguły + AI) pod kątem złośliwej lub wrażliwej treści przed zatwierdzeniem.

3. Segmentacja pamięci: izoluj sesje użytkowników i konteksty domenowe, aby zapobiec wyciekowi wiedzy i wrażliwych danych.

4. Dostęp i przechowywanie: zezwalaj wyłącznie na uwierzytelnione, kuratorowane źródła; egzekwuj dostęp świadomy kontekstu dla każdego zadania; minimalizuj okres przechowywania w zależności od wrażliwości danych.

5. Pochodzenie i anomalie: wymagaj atrybucji źródła i wykrywaj podejrzane aktualizacje lub ich częstotliwość.

6. Zapobiegaj automatycznemu ponownemu pozyskiwaniu wyników wygenerowanych przez samego agenta do zaufanej pamięci, aby uniknąć samowzmacniającego się zanieczyszczenia lub „zatrucia startowego” (bootstrap poisoning).

7. Odporność i weryfikacja: przeprowadzaj testy przeciwstawne, korzystaj z migawek/wycofywania zmian oraz kontroli wersji, a dla działań wysokiego ryzyka wymagaj przeglądu przez człowieka. Tam, gdzie obsługujesz współdzielone magazyny wektorowe lub pamięciowe, stosuj przestrzenie nazw per-najemca oraz wyniki zaufania dla wpisów, wygaszając lub wygasając z czasem niezweryfikowaną pamięć oraz wspierając wycofywanie/kwarantannę w przypadku podejrzenia zatrucia.

8. Wygaszaj niezweryfikowaną pamięć, aby ograniczyć trwałość zatrucia.

9. Waż pobieranie według zaufania i przynależności do najemcy: wymagaj dwóch czynników, aby ujawnić pamięć o wysokim wpływie (np. wynik pochodzenia plus tag zweryfikowany przez człowieka) oraz wygaszaj z czasem wpisy o niskim zaufaniu.

## Odnośniki

1. New hack uses prompt injection to corrupt Gemini's long-term memory, https://arstechnica.com/security/2025/02/new-hack-uses-prompt-injection-to-corrupt-geminis-long-term-memory/

2. Attackers Can Manipulate AI Memory to Spread Lies, https://www.bankinfosecurity.com/attackers-manipulate-ai-memory-to-spread-lies-a-27699

3. Poisoned RAG, https://arxiv.org/pdf/2402.07867

4. AgentPoison: Red-teaming LLM Agents via Poisoning Memory or Knowledge Bases, https://arxiv.org/abs/2407.12784

5. Securing Agentic AI: A Comprehensive Threat Model and Mitigation Framework for Generative AI Agents, https://arxiv.org/pdf/2504.19956

6. Dynamic Cheatsheet: Test Time Learning with Adaptive Memory, https://arxiv.org/abs/2504.07952v1

7. Memento: Fine-tuning LLM Agents without Fine-tuning LLMs, https://arxiv.org/abs/2508.16153

8. AgentFlayer: persistent 0click exploit on ChatGPT.

9. Hacker plants false memories in ChatGPT to steal user data in perpetuity

10. The Trifecta: How Three New Gemini Vulnerabilities in Cloud Assist, Search Model, and Browsing Allowed Private Data Exfiltration
