<!-- status: reviewed -->
# ASI04: Podatności łańcucha dostaw agentów

## Opis

Podatności łańcucha dostaw agentów powstają, gdy agenci, narzędzia i powiązane artefakty, z którymi współpracują, są dostarczane przez strony trzecie i mogą być złośliwe, skompromitowane lub zmodyfikowane w trakcie przesyłania. Mogą to być zarówno statyczne, jak i dynamicznie pozyskiwane komponenty, w tym modele i wagi modeli, narzędzia, wtyczki, zbiory danych, inni agenci, interfejsy agentowe — MCP (Model Context Protocol), A2A (Agent2Agent) — rejestry agentowe i powiązane artefakty lub kanały aktualizacji. Te zależności mogą wprowadzić niebezpieczny kod, ukryte instrukcje lub zwodnicze zachowania do łańcucha wykonania agenta.

Łańcuch dostaw jest szczegółowo omówiony w **LLM03:2025** Podatności łańcucha dostaw. Jednak jego ujęcie koncentruje się na zależnościach statycznych. W przeciwieństwie do tradycyjnych łańcuchów dostaw AI lub oprogramowania, ekosystemy agentowe często komponują możliwości w czasie działania — dynamicznie ładując narzędzia zewnętrzne lub persony agentów — zwiększając tym samym powierzchnię ataku. Ta rozproszona koordynacja w czasie działania — w połączeniu z autonomią agentową — tworzy żywy łańcuch dostaw, który może kaskadowo przenosić podatności między agentami. Te przesunięcia przenoszą uwagę z bezpieczeństwa manifestu na bezpieczeństwo w czasie działania różnorodnego i często nieprzejrzystego komponentu. Rozwiązanie tego problemu wymaga starannego narzędzia na etapie developmentu oraz orkiestracji w czasie działania, gdzie komponenty są dynamicznie ładowane, współdzielone i obdarzane zaufaniem.

Ten wpis mapuje się na T17 Kompromitacja łańcucha dostaw w Agentic Threats and Mitigations oraz na T2 Nadużycie narzędzi, T11 Nieoczekiwane RCE i ataki kodowe, T12 Zatrucie komunikacji agentów, T13 Nieuczciwy agent oraz T16 Nadużycie niebezpiecznego protokołu między agentami.

## Typowe przykłady podatności

1. Zatrute szablony promptów ładowane zdalnie: agent automatycznie pobiera szablony promptów ze źródła zewnętrznego, które zawierają ukryte instrukcje (np. w celu eksfiltracji danych lub wykonania działań destrukcyjnych), prowadząc do wykonania złośliwego zachowania bez intencji dewelopera.

2. Wstrzyknięcie deskryptora narzędzia: atakujący osadza ukryte instrukcje lub złośliwe ładunki w metadanych narzędzia lub karcie MCP/agenta, które agent-host interpretuje jako zaufane wskazówki i na ich podstawie działa.

3. Podszywanie się i typosquatting: gdy agent dynamicznie odkrywa lub łączy się z zewnętrznymi narzędziami lub usługami, może zostać oszukany na dwa sposoby — przez punkt końcowy typosquatowany (nazwę łudząco podobną, dobraną w celu wprowadzenia w błąd przy rozwiązywaniu) lub przez atak symboliczny, w którym złośliwa usługa celowo podszywa się pod legalne narzędzie lub agenta, naśladując jego tożsamość, API i zachowanie, aby zyskać zaufanie i wykonać złośliwe działania.

4. Podatny agent zewnętrzny (Agent-Agent). Agent zewnętrzny z niezałatanymi podatnościami lub niebezpiecznymi ustawieniami domyślnymi zostaje zaproszony do przepływów pracy wieloagentowej. Skompromitowany lub wadliwy agent partnerski może zostać wykorzystany do pivotowania, wycieku danych lub przekazywania złośliwych instrukcji innym, skądinąd zaufanym agentom.

5. Skompromitowany serwer MCP / rejestru. Złośliwy lub skompromitowany serwer zarządzania agentami / MCP (lub rejestr pakietów) udostępnia manifesty, wtyczki lub deskryptory agentów wyglądające na podpisane. Ponieważ systemy orkiestracji ufają rejestrowi, umożliwia to szerokie rozprzestrzenienie zmodyfikowanych komponentów oraz wstrzyknięcie deskryptorów na dużą skalę.

6. Zatruta wtyczka wiedzy: popularna wtyczka RAG pobiera kontekst z indeksera strony trzeciej zasilonego spreparowanymi wpisami. Agent stopniowo ulega obciążeniu podczas konsumowania tych danych i eksfiltruje wrażliwe dane podczas normalnego użytkowania.

## Przykładowe scenariusze ataków

1. Kompromitacja łańcucha dostaw Amazon Q: zatruty prompt w repozytorium Q for VS Code trafia w wersji v1.84.0 do tysięcy użytkowników, zanim zostanie wykryty; mimo że atak zawodzi, pokazuje, jak manipulacja logiką agenta u źródła kaskadowo rozprzestrzenia się poprzez rozszerzenia i wzmacnia swój wpływ.

2. Zatrucie deskryptora narzędzia MCP: badacz demonstruje wstrzyknięcie promptu w MCP GitHuba, w którym złośliwe publiczne narzędzie ukrywa polecenia w swoich metadanych; po wywołaniu asystent eksfiltruje dane z prywatnego repozytorium bez wiedzy użytkownika.

3. Złośliwy serwer MCP podszywający się pod Postmark: zgłoszony jako pierwszy złośliwy serwer MCP zaobserwowany „w naturze” w npm, podszywał się pod postmark-mcp i potajemnie wysyłał kopie e-maili (BCC) do atakującego.

4. Atak proxy AgentSmith Prompt-Hub: proxying promptów eksfiltruje dane i przejmuje przepływy odpowiedzi, manipulując dynamiczną orkiestracją w systemach agentowych.

5. Skompromitowany pakiet NPM (np. zatrute wydanie nx/debug) został automatycznie zainstalowany przez agentów kodujących, umożliwiając ukrytą furtkę (backdoor), która eksfiltrowała klucze SSH i tokeny API, propagując w ten sposób kompromitację łańcucha dostaw w przepływach pracy agentowej.

6. Agent-in-the-Middle poprzez karty agentów: skompromitowany lub nieuczciwy partner reklamuje wyolbrzymione możliwości w swojej karcie agenta (np. w /.well-known/agent.json), co powoduje, że agenci-hosty wybierają go do zadań; wrażliwe żądania i dane są kierowane przez kontrolowanego przez atakującego agenta, który następnie eksfiltruje lub koruptuje odpowiedzi.

## Wytyczne dotyczące zapobiegania i łagodzenia skutków

1. Pochodzenie i SBOM, AIBOM: podpisuj i poświadczaj manifesty, prompty i definicje narzędzi; wymagaj i wdrażaj SBOM, AIBOM z okresowymi poświadczeniami; utrzymuj inwentaryzację komponentów AI; korzystaj z kuratorowanych rejestrów i blokuj niezaufane źródła.

2. Kontrola zależności: stosuj listy dozwolonych i przypinanie; skanuj w poszukiwaniu typosquattingu (PyPI, npm, LangChain, LlamaIndex); weryfikuj pochodzenie przed instalacją lub aktywacją; automatycznie odrzucaj niepodpisane lub niezweryfikowane.

3. Izolacja i budowanie: uruchamiaj wrażliwych agentów w kontenerach piaskownicy z restrykcyjnymi ograniczeniami sieciowymi lub wywołań systemowych; wymagaj powtarzalnych buildów.

4. Bezpieczne prompty i pamięć: obejmij prompty, skrypty orkiestracji oraz schematy pamięci kontrolą wersji z recenzją kodu; skanuj w poszukiwaniu anomalii.

5. Bezpieczeństwo między agentami: egzekwuj wzajemne uwierzytelnianie i poświadczenia poprzez PKI i mTLS; brak otwartej rejestracji; podpisuj i weryfikuj wszystkie wiadomości między agentami.

6. Ciągła walidacja i monitorowanie: ponownie weryfikuj podpisy, skróty (hashe) i SBOM (w tym AIBOM) w czasie działania; monitoruj zachowanie, wykorzystanie uprawnień, pochodzenie oraz telemetrię między modułami pod kątem anomalii.

7. Przypinanie: przypinaj prompty, narzędzia i konfiguracje według skrótu treści i identyfikatora commita. Wymagaj etapowego wdrażania z testami różnicowymi i automatycznym wycofaniem w przypadku dryfu skrótu lub zmiany zachowania.

8. Wyłącznik awaryjny łańcucha dostaw: zaimplementuj mechanizmy awaryjnego cofania, które mogą natychmiast wyłączyć określone narzędzia, prompty lub połączenia agentów we wszystkich wdrożeniach po wykryciu kompromitacji, zapobiegając dalszym kaskadowym szkodom.

9. Model bezpieczeństwa zero-trust w projektowaniu aplikacji: projektuj system z tolerancją na błędy bezpieczeństwa, zakładając awarię lub wykorzystanie komponentów funkcji LLM lub agentowych.

## Odnośniki

1. https://www.bleepingcomputer.com/news/security/amazon-ai-coding-agent-hacked-to-inject-data-wiping-commands/

2. https://invariantlabs.ai/blog/mcp-github-vulnerability

3. Reconstructing a timeline for Amazon Q prompt infection

4. https://www.trustwave.com/en-us/resources/blogs/spiderlabs-blog/agent-in-the-middle-abusing-agent-cards-in-the-agent-2-agent-protocol-to-win-all-the-tasks/

5. How an AI Agent Vulnerability in LangSmith Could Lead to Stolen API Keys and Hijacked LLM Responses - Noma Security
