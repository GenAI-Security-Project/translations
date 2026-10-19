<!-- status: draft -->
# Załącznik A - Macierz mapowania bezpieczeństwa OWASP Agentic AI

Krzyżowe mapowanie ASI Top 10, LLM Top 10, Agentic AI Threats & Mitigations oraz AIVSS Core Risks

ID / Tytuł ASI OWASP LLM Top 10 Dopasowanie do Agentic AI Threats & AIVSS Core Risk (2025) Mitigations

ASI 01 – Przejęcie celu agenta LLM01:2025 Wstrzyknięcie promptu · LLM06:2025 Nadmierna sprawczość T6 Manipulacja celem · T7 Niedostosowane i zwodnicze zachowania Manipulacja celem i instrukcją agenta

ASI 02 – Nadużycie i wykorzystanie narzędzi LLM06:2025 Nadmierna sprawczość T2 Nadużycie narzędzi · T4 Przeciążenie zasobów · T16 Nadużycie niebezpiecznego protokołu między agentami Nadużycie narzędzi agentowej AI

ASI 03 – Nadużycie tożsamości i uprawnień LLM01:2025 Wstrzyknięcie promptu · LLM06:2025 Nadmierna sprawczość · LLM02:2025 Ujawnienie wrażliwych informacji T3 Kompromitacja uprawnień Naruszenie kontroli dostępu agenta

ASI 04 – Podatności łańcucha dostaw agentów LLM03:2025 Podatności łańcucha dostaw T17 Kompromitacja łańcucha dostaw · T2 Nadużycie narzędzi · T11 Nieoczekiwane RCE · T12 Zatrucie komunikacji agentów · T13 Nieuczciwy agent · T16 Nadużycie niebezpiecznego protokołu między agentami Ataki na łańcuch dostaw i zależności agenta

ASI 05 – Nieoczekiwane wykonanie kodu (RCE) LLM01:2025 Wstrzyknięcie promptu · LLM05 Nieprawidłowa obsługa wyników T11 Nieoczekiwane RCE i ataki kodowe Interakcja z krytycznymi systemami agenta

ASI 06 – Zatrucie pamięci i kontekstu LLM01:2025 Wstrzyknięcie promptu · LLM04:2025 Zatrucie danych i modelu · LLM08:2025 Słabości wektorów i embeddingów T1 Zatrucie pamięci · T4 Przeciążenie pamięci · T6 Zepsute cele · T12 Zatrucie współdzielonej pamięci Wykorzystanie pamięci i świadomość kontekstowa

ASI 07 – Niebezpieczna komunikacja między agentami LLM02:2025 Ujawnienie wrażliwych informacji · LLM06:2025 Nadmierna sprawczość T12 Zatrucie komunikacji agentów · T16 Nadużycie niebezpiecznego protokołu między agentami Manipulacja pamięcią i kontekstem agenta

ASI 08 – Awarie kaskadowe LLM01:2025 Wstrzyknięcie promptu · LLM04 Zatrucie danych i modelu · LLM06:2025 Nadmierna sprawczość T5 Ataki kaskadowej halucynacji · T8 Niezaprzeczalność i możliwość śledzenia Awarie kaskadowe agenta

ASI 09 – Wykorzystanie zaufania człowiek-agent LLM01:2025 Wstrzyknięcie promptu · LLM05:2025 Nieprawidłowa obsługa wyników · LLM06:2025 Nadmierna sprawczość · LLM09 Dezinformacja T7 Niedostosowane i zwodnicze zachowania · T8 Niezaprzeczalność i możliwość śledzenia · T10 Przytłoczenie nadzoru ludzkiego Brak możliwości śledzenia agenta / Manipulacja człowiekiem

ASI 10 – Nieuczciwe agenty LLM02:2025 Ujawnienie wrażliwych informacji · LLM09:2025 Dezinformacja T13 Nieuczciwe agenty w systemach wieloagentowych · T14 Ataki ludzi na systemy wieloagentowe · T15 Manipulacja człowiekiem Integralność behawioralna (BI) · Bezpieczeństwo operacyjne (OS) · Naruszenia zgodności (CV)

Uwagi

Dopasowanie do LLM Top 10: ujmuje pierwotne podatności LLM rozszerzone na systemy agentowe. • Agentic Threats & Mitigations (T1–T17): reprezentują szczegółowe ścieżki ataku, do których odnosi się framework ASI. • AIVSS Core Risks: mapują się na kategorie punktacji ilościowej dla priorytetyzacji i rankingu dotkliwości (np. BI, OS, CV). • Wgląd przekrojowy: wpisy ASI często łączą wiele wpisów LLM — np. ASI01 łączy LLM01:2025 (prompt) z LLM06 (autonomia) — pokazując, jak autonomia agentowa potęguje ryzyka na poziomie modelu.
