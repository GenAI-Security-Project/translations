<!-- status: draft -->
# Załącznik C - Mapowanie między OWASP Non-Human Identities Top 10 (2025) a OWASP Agentic AI Top 10

Poniższa tabela mapuje ryzyka OWASP Non-Human Identities (NHI) Top 10 (2025) na OWASP Agentic AI Top 10 (ASI), Agentic-AI Threats & Mitigations (kody T) oraz kategorie AIVSS Core Risk, aby pokazać dopasowanie między ryzykami skoncentrowanymi na tożsamości a ryzykami skoncentrowanymi na zachowaniu agentowym.

ID ryzyka NHI / Tytuł Krótki opis Dopasowane wpisy ASI Top 10 Dopasowane kody T / Threats & Mitigations Dopasowanie do AIVSS Core Risk

NHI1: Nieprawidłowe wycofywanie z użycia Brak dezaktywacji lub usunięcia nieużywanych tożsamości nie-ludzkich prowadzi do trwałej powierzchni ataku. ASI04 – Podatności łańcucha dostaw agentów T17 Kompromitacja łańcucha dostaw · T2 Nadużycie narzędzi Ataki na łańcuch dostaw i zależności agenta

NHI2: Wyciek sekretów Ujawnienie kluczy API, tokenów lub certyfikatów używanych przez tożsamości nie-ludzkie. ASI02 – Nadużycie i wykorzystanie narzędzi · ASI06 – Zatrucie pamięci i kontekstu T6 Manipulacja celem · T1 Zatrucie pamięci Wykorzystanie pamięci i świadomość kontekstowa

NHI3: Podatna tożsamość zewnętrzna Zintegrowane tożsamości stron trzecich zostają skompromitowane i wykorzystane. ASI04 – Podatności łańcucha dostaw · ASI03 – Nadużycie tożsamości i uprawnień T12 Zatrucie komunikacji agentów · T13 Nieuczciwe agenty Ataki na łańcuch dostaw i zależności agenta NHI

NHI4: Niebezpieczne uwierzytelnianie Słabe lub przestarzałe mechanizmy uwierzytelniania dla NHI. ASI03 – Nadużycie tożsamości i uprawnień · ASI07 – Niebezpieczna komunikacja między agentami T16 Nadużycie niebezpiecznego protokołu między agentami Naruszenie kontroli dostępu agenta

NHI5: Tożsamość nie-ludzka z nadmiernymi uprawnieniami Tożsamościom nie-ludzkim przyznano nadmierne uprawnienia. ASI02 – Nadużycie i wykorzystanie narzędzi · ASI03 – Nadużycie tożsamości i uprawnień T2 Nadużycie narzędzi · T3 Kompromitacja uprawnień Naruszenie kontroli dostępu agenta / Kompromitacja NHI

NHI6: Niebezpieczne konfiguracje wdrożenia w chmurze Błędnie skonfigurowane konfiguracje CI/CD i chmury ze statycznymi poświadczeniami. ASI04 – Podatności łańcucha dostaw · ASI05 – Nieoczekiwane wykonanie kodu (RCE) T11 Nieoczekiwane RCE i ataki kodowe Interakcja z krytycznymi systemami agenta

NHI7: Długotrwałe sekrety Poświadczenia lub klucze o długim okresie ważności zwiększają czas obecności atakującego w systemie. ASI06 – Zatrucie pamięci i kontekstu · ASI08 – Awarie kaskadowe T4 Przeciążenie pamięci · T12 Zatrucie współdzielonej pamięci Wykorzystanie pamięci i świadomość kontekstowa

NHI8: Ponowne wykorzystanie NHI w różnych środowiskach Ponowne wykorzystanie NHI między środowiskami dev/test/prod umożliwia ruch boczny. ASI08 – Awarie kaskadowe · ASI07 – Niebezpieczna komunikacja między agentami T8 Niezaprzeczalność i możliwość śledzenia · T12 Zatrucie komunikacji agentów Awarie kaskadowe agenta

NHI9: Ponowne wykorzystanie NHI Ponowne wykorzystanie tej samej NHI w różnych usługach wzmacnia wpływ kompromitacji. ASI08 – Awarie kaskadowe · ASI04 – Podatności łańcucha dostaw T5 Ataki kaskadowej halucynacji · T13 Nieuczciwe agenty Awarie kaskadowe agenta

NHI10: Wykorzystanie NHI przez człowieka Ludzie wykorzystujący poświadczenia nie-ludzkie powodują utratę rozliczalności i nadużycie uprawnień. ASI09 – Wykorzystanie zaufania człowiek-agent · ASI01 – Przejęcie celu agenta T10 Przytłoczenie nadzoru ludzkiego · T7 Niedostosowane i zwodnicze zachowania Brak możliwości śledzenia agenta / Manipulacja człowiekiem
