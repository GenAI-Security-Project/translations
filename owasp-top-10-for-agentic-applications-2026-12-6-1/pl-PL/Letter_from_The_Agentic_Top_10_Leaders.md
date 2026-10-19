<!-- status: draft -->
# List od Liderów Agentic Top 10

Systemy AI oparte na agentach szybko przechodzą od pilotaży do produkcji w finansach, ochronie zdrowia, obronności, infrastrukturze krytycznej i sektorze publicznym. W przeciwieństwie do automatyzacji zadaniowych, agenci planują, podejmują decyzje i działają w wielu krokach i systemach, często w imieniu użytkowników i zespołów. Agentic Security Initiative rozpoczęła już definiowanie zabezpieczeń dla aplikacji agentowych, publikując zestaw wytycznych obejmujący cały cykl życia.

Nasza podstawowa taksonomia (Agentic AI - Threats and Mitigations) dostarcza bazowej definicji agentów, ich relacji do aplikacji LLM, roli autonomii oraz szczegółowego omówienia zagrożeń i środków zaradczych. Dodatkowe dokumenty obejmują modelowanie zagrożeń (Agentic Threat Modelling Guide), zabezpieczanie architektury, projektowania, rozwoju i wdrażania aplikacji agentowych (Securing Agentic Applications), a także ład organizacyjny (State of Agentic AI Security and Governance)

Te publikacje stanowią kompleksowy zbiór wytycznych, mających służyć jako materiał referencyjny i pogłębione omówienie tematu. Niemniej jednak ich zakres może utrudniać przełożenie ich na codzienną praktykę dla twórców, obrońców i decydentów.

Nasz OWASP Top 10 for Agentic Applications (lub OWASP Agentic Top 10) służy jako kompas i podstawowy punkt odniesienia dla liderów bezpieczeństwa i praktyków, pomagając zrozumieć i zaadresować 10 zagrożeń o najwyższym wpływie oraz rozpocząć swoją podróż.

Wykorzystuje standardowy i popularny format OWASP Top 10, aby dostarczyć zwięzłe, praktyczne i możliwe do wdrożenia wytyczne. Każdy wpis zawiera krótki opis, typowe podatności, przykładowe scenariusze oraz, co najważniejsze, konkretne działania łagodzące, które zespoły mogą zacząć wdrażać już dziś.

Naszym celem jest uproszczenie i powiązanie istniejących wytycznych, a nie przyczynianie się do nadmiaru nakładających się wskazówek. Odnosimy się do naszego dokumentu Agentic AI Threats and Mitigations, który pozostaje naszą fundamentalną i szczegółową taksonomią, na której opiera się niniejszy Top 10.

Naszym głównym obszarem zainteresowania są aplikacje agentowe, jednak nie będą one istnieć w izolacji i będą stanowić część rozwijającej się aplikacji LLM. W rezultacie nasze wpisy odwołują się do OWASP Top 10 for LLM Applications i innych istotnych standardów. Obejmują one różne inne listy OWASP Top 10, standard CycloneDX, Top 10 for Non-Human Identities (NHI) oraz OWASP AI Vulnerability Scoring System (AIVSS) do oceny i priorytetyzacji.

Agenci wzmacniają istniejące podatności. Rozszerzamy koncepcje Least-Privilege i Excessive Agency, przywołując zasadę Least-Agency. Ujmuje ona naszą rekomendację dla organizacji, aby unikać zbędnej autonomii; wdrażanie zachowań agentowych tam, gdzie nie są one potrzebne, poszerza powierzchnię ataku bez dodawania wartości. Podobnie, silna obserwowalność staje się niezbędna: bez jasnej widoczności tego, co robią agenci, dlaczego to robią i jakich narzędzi używają, zbędna autonomia może niepostrzeżenie poszerzać powierzchnię ataku i zamieniać drobne problemy w awarie obejmujące cały system.

Niniejszy dokument jest dziełem globalnej społeczności OWASP. Dziesiątki ekspertów ds. bezpieczeństwa z przemysłu, środowisk akademickich i administracji publicznej wniosło badania nad zagrożeniami, wyniki działań red-team oraz sprawdzone w praktyce środki zaradcze, przy wsparciu organizacji budujących platformy agentowe, instytucji publicznych oraz dostawców produktów.

Sekcja Podziękowania zawiera listę liderów poszczególnych wpisów, współautorów, naszej znamienitej rady recenzentów eksperckich oraz organizacji, które wzięły udział w naszym procesie recenzji, umożliwiając nam uwzględnienie różnorodnych, rzeczywistych spostrzeżeń.

Jesteśmy im zobowiązani i będziemy nadal rozwijać nasze podejście, oparte na kierowanej przez ekspertów społeczności OWASP, poprzez otwartą współpracę, recenzję wzajemną oraz wnioski z badań, exploitów, incydentów i wyzwań napotykanych we wdrożeniach w świecie rzeczywistym.

Z wyrazami szacunku,

John Sotiropoulos, członek zarządu OWASP GenAI Security Project i współlider ASI, przewodniczący Agentic Top 10

Keren Katz, liderka Agentic Top 10, OWASP GenAI Security Project — główny zespół ASI

Ron F. Del Rosario, członek głównego zespołu OWASP GenAI Security Project i współlider ASI
