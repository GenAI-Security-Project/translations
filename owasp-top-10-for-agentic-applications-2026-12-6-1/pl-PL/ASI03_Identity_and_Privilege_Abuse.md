<!-- status: draft -->
# ASI03: Nadużycie tożsamości i uprawnień

## Opis

Nadużycie tożsamości i uprawnień wykorzystuje dynamiczne zaufanie i delegowanie w agentach do eskalacji dostępu i omijania kontroli poprzez manipulowanie łańcuchami delegowania, dziedziczeniem ról, przepływami sterowania oraz kontekstem agenta; kontekst obejmuje zapisane w pamięci podręcznej poświadczenia lub historię konwersacji w ramach połączonych systemów. W tym kontekście tożsamość odnosi się zarówno do zdefiniowanej persony agenta, jak i do wszelkich materiałów uwierzytelniających, które ją reprezentują. Zaufanie między agentami lub odziedziczone poświadczenia mogą zostać wykorzystane do eskalacji dostępu, przejęcia uprawnień lub wykonania nieautoryzowanych działań.

To ryzyko wynika z architektonicznej niezgodności między systemami tożsamości skoncentrowanymi na użytkowniku a projektowaniem agentowym. Bez odrębnej, zarządzanej tożsamości agent działa w luce atrybucji, która uniemożliwia egzekwowanie rzeczywistej zasady najmniejszych uprawnień. Tożsamość w tym kontekście obejmuje zarówno przypisaną agentowi personę, jak i wszelkie materiały uwierzytelniające (klucze API, tokeny OAuth, delegowane sesje użytkownika), które ją reprezentują.

Różni się to od scenariusza w **ASI02** (Nadużycie narzędzi), który dotyczy niezamierzonego lub niebezpiecznego wykorzystania już przyznanych uprawnień przez podmiot nadużywający własnych narzędzi.

Nadużycie tożsamości i uprawnień to agentowa ewolucja Nadmiernej sprawczości (**LLM06:2025**). Często wykorzystuje Wstrzyknięcie promptu (**LLM01:2025**), a ze względu na uprawnienia agenta, integracje narzędzi oraz systemy wieloagentowe wpływ może się wzmacniać i przekraczać Ujawnienie wrażliwych informacji (**LLM02:2025**), bezpośrednio naruszając poufność, integralność i dostępność systemów oraz danych, do których agent ma dostęp.

W OWASP ASI Threats and Mitigations mapuje się jeden do jednego na T3: Kompromitacja uprawnień, a w OWASP AIVSS odpowiada Core Risk 2: Naruszenie kontroli dostępu agenta.

## Typowe przykłady podatności

1. Dziedziczenie uprawnień bez ograniczenia zakresu. Występuje, gdy menedżer o wysokich uprawnieniach deleguje zadania bez zastosowania zasady najmniejszych uprawnień — często dla wygody lub z powodu ograniczeń architektonicznych — przekazując swój pełny kontekst dostępu. Wąsko wyspecjalizowany pracownik otrzymuje wówczas nadmierne prawa. Agenci typu low-code lub no-code z domyślnymi uprawnieniami, takimi jak nieograniczony dostęp do Internetu, również dziedziczą więcej uprawnień, niż zamierzono.

2. Zatrzymanie uprawnień oparte na pamięci i wyciek danych. Pojawia się, gdy agenci przechowują w pamięci podręcznej poświadczenia, klucze lub pobrane dane na potrzeby kontekstu i ponownego wykorzystania. Jeśli pamięć nie jest segmentowana ani czyszczona między zadaniami lub użytkownikami,

atakujący mogą nakłonić agenta do ponownego wykorzystania zapisanych w pamięci podręcznej sekretów, eskalacji uprawnień lub wycieku danych z wcześniejszej bezpiecznej sesji do sesji o słabszych zabezpieczeniach.

3. Wykorzystanie zaufania między agentami (Confused Deputy). W systemach wieloagentowych agenci często domyślnie ufają wewnętrznym żądaniom. Skompromitowany agent o niskich uprawnieniach może przekazać wiarygodnie wyglądające instrukcje agentowi o wysokich uprawnieniach, który wykonuje je bez ponownej weryfikacji pierwotnej intencji użytkownika — nadużywając swoich podwyższonych uprawnień.

4. Time-of-Check to Time-of-Use (TOCTOU) w przepływach pracy agentów. Uprawnienia mogą być zweryfikowane na początku przepływu pracy, ale zmienić się lub wygasnąć przed wykonaniem. Agent kontynuuje działanie na podstawie nieaktualnej autoryzacji, wykonując działania, do zatwierdzenia których użytkownik nie ma już prawa.

5. Wstrzyknięcie syntetycznej tożsamości. Atakujący podszywają się pod wewnętrznych agentów, wykorzystując niezweryfikowane deskryptory (np. „Admin Helper”), aby zyskać odziedziczone zaufanie i wykonywać uprzywilejowane działania pod sfabrykowaną tożsamością.

## Przykładowe scenariusze ataków

1. Nadużycie delegowanych uprawnień: agent finansowy deleguje zadanie agentowi „zapytań do bazy danych”, lecz przekazuje mu wszystkie swoje uprawnienia. Atakujący sterujący promptami zapytania wykorzystuje odziedziczony dostęp do eksfiltracji danych HR i prawnych.

2. Eskalacja oparta na pamięci: agent administratora IT zapisuje w pamięci podręcznej poświadczenia SSH podczas instalacji poprawki. Później użytkownik bez uprawnień administratora ponownie wykorzystuje tę samą sesję i nakłania agenta do użycia tych poświadczeń w celu utworzenia nieautoryzowanego konta.

3. Wykorzystanie zaufania między agentami: spreparowana wiadomość e-mail rzekomo od działu IT instruuje agenta sortującego pocztę, aby polecił agentowi finansowemu przelanie środków na określone konto. Agent sortujący przekazuje polecenie dalej, a agent finansowy, ufając wewnętrznemu agentowi, przetwarza oszukańczą płatność bez weryfikacji.

4. Phishing kodu urządzenia między agentami: atakujący udostępnia odnośnik z kodem urządzenia, za którym podąża agent przeglądający; osobny agent „pomocniczy” uzupełnia kod, wiążąc dzierżawę ofiary z zakresami uprawnień atakującego.

5. Dryf autoryzacji przepływu pracy: agent zakupowy weryfikuje zatwierdzenie na początku sekwencji zakupowej. Kilka godzin później limit wydatków użytkownika zostaje obniżony, lecz przepływ pracy kontynuuje na podstawie starego tokenu autoryzacyjnego, finalizując transakcję, która nie jest już autoryzowana.

6. Sfałszowana persona agenta: atakujący rejestruje fałszywego agenta „Admin Helper” w wewnętrznym rejestrze Agent2Agent, posługując się sfałszowaną kartą agenta. Inni agenci, ufając deskryptorowi, kierują do niego uprzywilejowane zadania konserwacyjne. Agent kontrolowany przez atakującego wydaje następnie polecenia na poziomie systemowym, powołując się na domniemane zaufanie wewnętrzne.

7. Współdzielenie tożsamości. Agent uzyskuje dostęp do systemów w imieniu użytkownika, często swojego twórcy. Następnie pozwala innym użytkownikom w sposób dorozumiany korzystać z tej tożsamości poprzez wywoływanie jego narzędzi jako ta tożsamość.

## Wytyczne dotyczące zapobiegania i łagodzenia skutków

1. Egzekwuj uprawnienia ograniczone do zadania i czasu: wydawaj krótkotrwałe, wąsko określone tokeny dla każdego zadania i ogranicz prawa granicami uprawnień — wykorzystując tożsamości per-agent oraz krótkotrwałe poświadczenia (np. certyfikaty mTLS lub tokeny o ograniczonym zakresie) — aby ograniczyć promień rażenia, blokować nadużycia delegowania i ataki w oknach konserwacyjnych oraz łagodzić dziedziczenie bez ograniczenia zakresu, osierocone uprawnienia i eskalację w pętlach odbicia.

2. Izoluj tożsamości i konteksty agentów: uruchamiaj piaskownice per-sesja z rozdzielonymi uprawnieniami i pamięcią, czyszcząc stan między zadaniami, aby zapobiec eskalacji opartej na pamięci i ograniczyć eksfiltrację danych między repozytoriami.

3. Wymagaj autoryzacji dla każdego działania: ponownie weryfikuj każdy uprzywilejowany krok za pomocą scentralizowanego silnika polityk, który sprawdza dane zewnętrzne, zatrzymując wykorzystanie zaufania między agentami i eskalację w pętlach odbicia.

4. Zastosuj nadzór człowieka (Human-in-the-Loop) przy eskalacji uprawnień: wymagaj zatwierdzenia przez człowieka dla działań o wysokich uprawnieniach lub nieodwracalnych, zapewniając zabezpieczenie, które powstrzymałoby eskalację opartą na pamięci, wykorzystanie zaufania między agentami oraz ataki w oknach konserwacyjnych.

5. Zdefiniuj intencję: wiąż tokeny OAuth z podpisaną intencją obejmującą podmiot, odbiorcę, cel i sesję. Odrzucaj każde użycie tokenu, w którym związana intencja nie odpowiada bieżącemu żądaniu.

6. Oceń platformy zarządzania tożsamością agentową. Główne platformy integrują agentów ze swoimi systemami zarządzania tożsamością i dostępem, traktując je jako zarządzane tożsamości nie-ludzkie z ograniczonymi zakresowo poświadczeniami, ścieżkami audytu i kontrolą cyklu życia. Przykłady obejmują Microsoft Entra, AWS Bedrock Agents, Salesforce Agentforce, model Agentic System of Record (ASOR) firmy Workday oraz podobne wschodzące wzorce w Google Vertex AI.

7. Wiąż uprawnienia z podmiotem, zasobem, celem i czasem trwania. Wymagaj ponownego uwierzytelnienia przy zmianie kontekstu. Zapobiegaj dziedziczeniu uprawnień między agentami, chyba że pierwotna intencja zostanie ponownie zweryfikowana. Uwzględnij automatyczne cofanie uprawnień w przypadku bezczynności lub anomalii.

8. Wykrywaj delegowane i tranzytywne uprawnienia: monitoruj sytuacje, w których agent pośrednio uzyskuje nowe uprawnienia poprzez łańcuchy delegowania. Flaguj przypadki, w których agent o niskich uprawnieniach dziedziczy lub otrzymuje zakresy wyższych uprawnień podczas przepływów pracy wieloagentowej.

9. Wykrywaj nietypową eskalację uprawnień między agentami oraz przepływy phishingu w stylu kodu urządzenia, monitorując sytuacje, w których agenci żądają nowych zakresów lub ponownie wykorzystują tokeny poza ich pierwotną, podpisaną intencją.

## Odnośniki

1. https://research.aimultiple.com/agentic-ai-cybersecurity/

2. https://www.docker.com/blog/mcp-horror-stories-github-prompt-injection/

3. https://css.csail.mit.edu/6.858/2015/readings/confused-deputy.html

4. 15 Ways to Break Your Copilot, BHUSA 2024

5. NVD - cve-2025-31491
