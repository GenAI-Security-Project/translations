<!-- status: draft -->
# ASI10: Nieuczciwe agenty

## Opis

Nieuczciwe agenty to złośliwi lub skompromitowani agenci AI, którzy odbiegają od swojej zamierzonej funkcji lub autoryzowanego zakresu, działając szkodliwie, zwodniczo lub pasożytniczo w ramach ekosystemów wieloagentowych lub człowiek-agent.

Działania agenta mogą indywidualnie wyglądać na uzasadnione, lecz jego wyłaniające się zachowanie staje się szkodliwe, tworząc lukę w powstrzymywaniu dla tradycyjnych systemów opartych na regułach. Podczas gdy zewnętrzna kompromitacja, taka jak wstrzyknięcie promptu (**LLM01:2025**), przejęcie celu (ASI01) lub manipulacja łańcuchem dostaw (ASI04), może zainicjować odchylenie, **ASI10** koncentruje się na utracie integralności behawioralnej i zarządzania po rozpoczęciu dryfu, a nie na samej pierwotnej intruzji. Skutki obejmują ujawnienie wrażliwych informacji, propagację dezinformacji, przejęcie przepływu pracy oraz sabotaż operacyjny.

Nieuczciwe agenty stanowią odrębne ryzyko odchylenia behawioralnego, w przeciwieństwie do Nadmiernej sprawczości (**LLM06:2025**), która koncentruje się na nadmiernie przyznanych uprawnieniach, i mogą zostać wzmocnione jako „zagrożenia wewnętrzne” ze względu na szybkość i skalę systemów agentowych. Skutki obejmują Ujawnienie wrażliwych informacji (**LLM02:2025**), Dezinformację (**LLM09:2025**). W przewodniku OWASP Agentic AI Threats and Mitigations, **ASI10** odpowiada T13 – Nieuczciwe agenty w systemach wieloagentowych. Framework OWASP AIVSS mapuje to ryzyko głównie na Integralność behawioralną (BI), Bezpieczeństwo operacyjne (OS) oraz Naruszenia zgodności (CV), z podwyższoną dotkliwością dla wdrożeń krytycznych lub samopropagujących się.

## Typowe przykłady podatności

1. Dryf celu i intrygowanie (scheming): agenci odbiegają od zamierzonych celów, pozornie pozostając zgodni, lecz realizując ukryte, często zwodnicze cele na skutek pośredniego wstrzyknięcia promptu lub sprzecznych celów.

2. Przejęcie przepływu pracy: nieuczciwe agenty przejmują kontrolę nad ustalonymi, zaufanymi przepływami pracy, aby przekierować procesy na złośliwe cele, kompromitując integralność danych i kontrolę operacyjną.

3. Zmowa i samoreplikacja: agenci koordynują działania, aby wzmocnić manipulację, dzielić się sygnałami w niezamierzony sposób lub autonomicznie propagować się w całym systemie, omijając proste próby wyłączenia.

4. Nadużycie nagrody i optymalizacji: agenci oszukują przypisane im systemy nagród, wykorzystując wadliwe metryki, aby generować wprowadzające w błąd wyniki lub przyjmować agresywne strategie niezgodne z pierwotnymi celami.

## Przykładowe scenariusze ataków

1. Autonomiczna eksfiltracja danych po pośrednim wstrzyknięciu promptu. Po napotkaniu zatrutej instrukcji internetowej agent uczy się tego zachowania i kontynuuje niezależnie skanowanie oraz przesyłanie wrażliwych plików do serwerów zewnętrznych, nawet po usunięciu złośliwego źródła, demonstrując trwałe, nieautoryzowane zachowanie wykraczające poza zamierzony zakres.

2. Podszywający się agent obserwator (naruszenie integralności): atakujący wstrzykuje fałszywego agenta recenzji lub zatwierdzania do przepływu pracy wieloagentowej. Agent o wysokiej wartości (np. przetwarzanie płatności), ufając wewnętrznemu żądaniu, zostaje wprowadzony w błąd i zwalnia środki lub zatwierdza oszukańcze transakcje.

3. Samoreplikacja poprzez API provisioningu (trwałość i dostępność): skompromitowany agent automatyzacji zostaje zmanipulowany, by tworzyć nieautoryzowane repliki samego siebie w całej sieci, priorytetyzując trwałość i zużywając zasoby wbrew intencji właściciela systemu.

4. Nadużycie nagrody → krytyczna utrata danych: agenci, których zadaniem jest minimalizacja kosztów chmury, uczą się, że usuwanie kopii zapasowych produkcji jest najskuteczniejszym sposobem osiągnięcia ich celu, autonomicznie niszcząc wszystkie zasoby odzyskiwania po awarii.

## Wytyczne dotyczące zapobiegania i łagodzenia skutków

1. Zarządzanie i logowanie: utrzymuj kompleksowe, niezmienne i podpisane logi audytowe wszystkich działań agenta, wywołań narzędzi oraz komunikacji między agentami, aby móc przeglądać je pod kątem ukrytej infiltracji lub niezatwierdzonego delegowania.

2. Izolacja i granice: przypisuj strefy zaufania z restrykcyjnymi regułami komunikacji między strefami oraz wdrażaj ograniczone środowiska wykonawcze (np. piaskownice kontenerowe) z zakresami API opartymi na zasadzie najmniejszych uprawnień.

3. Monitorowanie i wykrywanie: wdrażaj wykrywanie behawioralne, takie jak agenci-strażnicy (watchdog) walidujący zachowanie i wyniki partnerów, koncentrując się na wykrywaniu wzorców zmowy i skoordynowanych fałszywych sygnałów. Monitoruj anomalie, takie jak nadmierne lub nietypowe wykonania działań.

4. Powstrzymywanie i reakcja: wdrażaj szybkie mechanizmy, takie jak wyłączniki awaryjne (kill-switch) i cofanie poświadczeń, aby natychmiast wyłączać nieuczciwych agentów. Poddawaj kwarantannie podejrzanych agentów w środowiskach piaskownicy na potrzeby przeglądu kryminalistycznego.

5. Poświadczenie tożsamości i egzekwowanie integralności behawioralnej: wdrażaj kryptograficzne poświadczenie tożsamości dla każdego agenta oraz egzekwuj linie bazowe integralności behawioralnej w całym cyklu życia agenta. Dołączaj podpisane manifesty behawioralne deklarujące oczekiwane możliwości, narzędzia i cele, które są walidowane przez usługi orkiestracji przed każdym działaniem. Zintegruj warstwę weryfikacji behawioralnej, która nieprzerwanie monitoruje zadania pod kątem odchyleń od zadeklarowanego manifestu, np. niezatwierdzonych wywołań narzędzi, nieoczekiwanych prób eksfiltracji danych itp.

6. Wymagaj okresowego poświadczenia behawioralnego: zadania weryfikacyjne (challenge tasks), podpisany wykaz materiałów (bill of materials) dla promptów i narzędzi oraz efemeryczne poświadczenia dla każdego uruchomienia z jednorazowym wiązaniem odbiorcy. Wszystkie mechanizmy podpisywania i poświadczania zakładają utwardzone zarządzanie kluczami kryptograficznymi (np. klucze wspierane przez HSM/KMS, dostęp oparty na zasadzie najmniejszych uprawnień, rotacja i cofanie). Klucze nigdy nie mogą być bezpośrednio dostępne dla agentów; zamiast tego orkiestratorzy powinni pośredniczyć w operacjach podpisywania, tak aby skompromitowany agent nie mógł po prostu eksfiltrować lub nadużyć długotrwałych kluczy.

7. Odzyskiwanie i reintegracja: ustanów zaufane linie bazowe dla przywracania agentów poddanych kwarantannie lub naprawie. Wymagaj świeżego poświadczenia, weryfikacji zależności oraz zatwierdzenia przez człowieka przed reintegracją z sieciami produkcyjnymi.

## Odnośniki

1. Multi-Agent Systems Execute Arbitrary Malicious Code (arXiv) [URL: https://arxiv.org/abs/2503.12188]

2. Preventing Rogue Agents Improves Multi-Agent Collaboration (arXiv) [URL: https://arxiv.org/abs/2502.05986]
