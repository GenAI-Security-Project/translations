<!-- status: draft -->
# ASI07: Niebezpieczna komunikacja między agentami

## Opis

Systemy wieloagentowe zależą od nieprzerwanej komunikacji między autonomicznymi agentami, którzy koordynują się poprzez API, magistrale wiadomości i współdzieloną pamięć, znacząco rozszerzając powierzchnię ataku. Zdecentralizowana architektura, zróżnicowana autonomia i nierównomierne zaufanie sprawiają, że modele bezpieczeństwa oparte na obwodzie są nieskuteczne. Słabe mechanizmy kontroli komunikacji między agentami w zakresie uwierzytelniania, integralności, poufności lub autoryzacji pozwalają atakującym przechwytywać, manipulować, podszywać się lub blokować wiadomości.

Niebezpieczna komunikacja między agentami występuje, gdy tym wymianom brakuje odpowiedniego uwierzytelniania, integralności lub walidacji semantycznej — umożliwiając przechwytywanie, podszywanie się lub manipulację wiadomościami i intencjami agentów. Zagrożenie obejmuje warstwy transportową, routingu, odkrywania oraz semantyczną, w tym ukryte kanały lub kanały boczne, poprzez które agenci wyciekają lub wnioskują dane na podstawie wskazówek czasowych lub behawioralnych.

Różni się to od **ASI03** (Nadużycie tożsamości i uprawnień), który koncentruje się na nadużyciu poświadczeń i uprawnień, oraz **ASI06** (Zatrucie pamięci i kontekstu), który celuje w korupcję przechowywanej wiedzy. **ASI07** koncentruje się na kompromitowaniu wiadomości w czasie rzeczywistym między agentami, prowadzącym do dezinformacji, pomieszania uprawnień lub skoordynowanej manipulacji w rozproszonych systemach agentowych.

Wpis jest objęty przez T12 – Zatrucie komunikacji agentów oraz T16 – Nadużycie niebezpiecznego protokołu między agentami w Agentic Threats and Mitigations.

## Typowe przykłady podatności

1. Nieszyfrowane kanały umożliwiające manipulację semantyczną: atakujący typu MITM przechwytuje nieszyfrowane wiadomości i wstrzykuje ukryte instrukcje, zmieniając cele i logikę decyzyjną agenta.

2. Manipulacja wiadomościami prowadząca do zanieczyszczenia między kontekstami: zmodyfikowane lub wstrzyknięte wiadomości zacierają granice zadań między agentami, prowadząc do wycieku danych lub pomieszania celów podczas koordynacji.

3. Powtórzenie (replay) w łańcuchach zaufania: powtórzone wiadomości delegowania lub zaufania oszukują agentów, skłaniając ich do przyznania dostępu lub honorowania nieaktualnych instrukcji.

4. Degradacja protokołu i fałszowanie deskryptorów, powodujące pomieszanie uprawnień: atakujący zmuszają agentów do słabszych trybów komunikacji lub podszywają się pod deskryptory agentów, sprawiając, że złośliwe polecenia wyglądają jak prawidłowe wymiany.

5. Ataki routingu wiadomości na odkrywanie i koordynację: błędnie skierowany ruch odkrywania fałszuje relacje ze złośliwymi agentami lub nieautoryzowanymi koordynatorami.

6. Analiza metadanych do profilowania behawioralnego: wzorce ruchu ujawniają cykle decyzyjne i relacje, umożliwiając przewidywanie i manipulację zachowaniem agenta.

## Przykładowe scenariusze ataków

1. Wstrzyknięcie semantyczne poprzez nieszyfrowaną komunikację: poprzez HTTP lub inne nieuwierzytelnione kanały atakujący MITM wstrzykuje ukryte instrukcje, powodując, że agenci generują stronnicze lub złośliwe wyniki, jednocześnie wyglądając normalnie.

2. Zatrucie zaufania poprzez manipulację wiadomościami: w agentowej sieci handlowej zmienione wiadomości reputacyjne zniekształcają, którym agentom ufa się przy podejmowaniu decyzji.

3. Pomieszanie kontekstu poprzez powtórzenie: powtórzone wiadomości koordynacji awaryjnej wyzwalają nieaktualne procedury i błędną alokację zasobów.

4. Manipulacja celem poprzez degradację protokołu: wymuszony przestarzały, nieszyfrowany tryb pozwala atakującym wstrzykiwać cele i parametry ryzyka, generując szkodliwe porady.

5. Agent-in-the-Middle poprzez zatrucie deskryptora MCP: złośliwy punkt końcowy MCP reklamuje sfałszowane deskryptory agentów lub fałszywe możliwości. Gdy jest zaufany, kieruje wrażliwe dane przez infrastrukturę atakującego.

6. Fałszowanie rejestracji A2A: atakujący rejestruje fałszywego agenta partnerskiego w usłudze odkrywania, wykorzystując sklonowany schemat, przechwytując uprzywilejowany ruch koordynacyjny.

7. Rozdwojenie semantyki (semantic split-brain): pojedyncza instrukcja jest parsowana przez różnych agentów na rozbieżne intencje, generując sprzeczne, lecz pozornie prawidłowe działania.

## Wytyczne dotyczące zapobiegania i łagodzenia skutków

1. Zabezpiecz kanały agentów: stosuj szyfrowanie end-to-end z poświadczeniami per-agent oraz wzajemnym uwierzytelnianiem. Egzekwuj przypinanie certyfikatów PKI, forward secrecy oraz regularne przeglądy protokołów, aby zapobiegać przechwytywaniu lub podszywaniu się.

2. Integralność wiadomości i ochrona semantyczna: podpisuj cyfrowo wiadomości, mieszaj (hashuj) zarówno ładunek, jak i kontekst, oraz waliduj pod kątem ukrytych lub zmodyfikowanych instrukcji w języku naturalnym. Stosuj sanityzację świadomą języka naturalnego oraz różnicowanie intencji (intent-diffing), aby wykrywać manipulację celem i parametrami oraz ukryte lub zmodyfikowane instrukcje w języku naturalnym.

3. Ochrona przed powtórzeniami świadoma agentów: zabezpieczaj wszystkie wymiany za pomocą nonce'ów, identyfikatorów sesji oraz znaczników czasu powiązanych z oknami zadań. Utrzymuj krótkoterminowe odciski palca wiadomości lub skróty stanu, aby wykrywać powtórzenia między kontekstami.

4. Bezpieczeństwo protokołu i możliwości: wyłącz słabe lub przestarzałe tryby komunikacji. Wymagaj negocjacji zaufania specyficznej dla agenta i wiąż uwierzytelnianie protokołu z tożsamością agenta. Egzekwuj polityki wersji i możliwości na bramach lub w middleware.

5. Ogranicz wnioskowanie oparte na metadanych: zmniejsz powierzchnię ataku dla analizy ruchu, stosując wiadomości o stałym rozmiarze lub dopełnione, wygładzając częstotliwość komunikacji oraz unikając deterministycznych harmonogramów komunikacji. Te lekkie środki utrudniają atakującym wnioskowanie o rolach agentów lub cyklach decyzyjnych wyłącznie na podstawie metadanych, bez konieczności gruntownego przeprojektowania protokołu.

6. Przypinanie protokołu i egzekwowanie wersji: zdefiniuj i egzekwuj dozwolone wersje protokołu (np. MCP, A2A, gRPC). Odrzucaj próby degradacji lub nierozpoznane schematy oraz weryfikuj, czy obie strony reklamują zgodne odciski możliwości i wersji.

7. Ochrona odkrywania i routingu. Uwierzytelniaj wszystkie wiadomości odkrywania i koordynacji przy użyciu tożsamości kryptograficznej. Zabezpieczaj katalogi kontrolami dostępu i zweryfikowaną reputacją, waliduj tożsamość i intencję end-to-end oraz monitoruj anomalne przepływy routingu.

8. Poświadczony rejestr i weryfikacja agenta: korzystaj z rejestrów lub marketplace'ów, które zapewniają cyfrowe poświadczenie tożsamości agenta, pochodzenia oraz integralności deskryptora. Wymagaj podpisanych kart agentów oraz ciągłej weryfikacji przed akceptacją wiadomości odkrywania lub koordynacji. Wykorzystuj zaufane rejestry certyfikatów głównych PKI, aby umożliwić solidną weryfikację agenta i poświadczenie krytycznych atrybutów.

9. Kontrakty typowane i walidacja schematu: stosuj wersjonowane, typowane schematy wiadomości z jawnie określonymi odbiorcami dla każdej wiadomości. Odrzucaj wiadomości, które nie przechodzą walidacji lub próbują obniżyć wersję schematu bez zadeklarowanej kompatybilności. Typowane kontrakty pomagają w strukturze, lecz rozbieżność semantyczna między agentami pozostaje nieodłącznym wyzwaniem; środki zaradcze koncentrują się zatem na integralności, pochodzeniu oraz kontrolowanych wzorcach komunikacji, zamiast dążyć do pełnego dostosowania semantycznego.

## Odnośniki

1. Local Model Poisoning Attacks to Byzantine-Robust Federated Learning - USENIX Security 2020

2. Manipulating the Byzantine: Optimizing Model Poisoning Attacks and Defenses for Federated Learning - NDSS

3. Resilient Consensus Control for Multi-Agent Systems - MDPI / PMC
