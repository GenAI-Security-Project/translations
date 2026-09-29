<!-- status: draft -->
# پیوست A - ماتریس نگاشت امنیت هوش مصنوعی عامل‌محور OWASP

نگاشت متقابل ASI Top 10، LLM Top 10، Agentic AI Threats & Mitigations و ریسک‌های اصلی AIVSS

شناسه/عنوان ASI؛ OWASP LLM Top 10؛ Agentic AI Threats & Mitigations؛ ریسک اصلی AIVSS (۲۰۲۵)؛ هم‌راستایی تدابیر کاهش ریسک

ASI 01 – ربودن هدف عامل: LLM01:2025 Prompt Injection · LLM06:2025 Excessive Agency؛ T6 Goal Manipulation · T7 Misaligned & Deceptive Behaviors؛ دستکاری دستورالعمل

ASI 02 – سوءاستفاده و بهره‌برداری از ابزارها: LLM06:2025 Excessive Agency؛ T2 Tool Misuse · T4 Resource Overload · T16 Insecure Inter-Agent Protocol Abuse؛ سوءاستفاده از ابزار هوش مصنوعی عامل‌محور

ASI 03 – سوءاستفاده از هویت و امتیازات: LLM01:2025 Prompt Injection · LLM06:2025 Excessive Agency · LLM02:2025 Sensitive Info Disclosure؛ T3 Privilege Compromise؛ نقض کنترل دسترسی عامل

ASI 04 – آسیب‌پذیری‌های زنجیره تأمین عامل‌محور: LLM03:2025 Supply Chain Vulnerabilities؛ T17 Supply Chain Compromise · T2 Tool Misuse · T11 Unexpected RCE · T12 Agent Comm Poisoning · T13 Rogue Agent · T16 Insecure Inter-Agent Protocol Abuse؛ حملات زنجیره تأمین و وابستگی عامل

ASI 05 – اجرای غیرمنتظره کد (RCE): LLM01:2025 Prompt Injection · LLM05 Improper Output Handling؛ T11 Unexpected RCE & Code Attacks؛ تعامل ناامن با سامانه‌های حیاتی عامل

ASI 06 – آلوده‌سازی حافظه و زمینه: LLM01:2025 Prompt Injection · LLM04:2025 Data & Model Poisoning · LLM08:2025 Vector & Embedding Weaknesses؛ T1 Memory Poisoning · T4 Memory Overload · T6 Broken Goals · T12 Shared Memory Poisoning؛ استفاده از حافظه و آگاهی زمینه‌ای

ASI 07 – ارتباط ناامن بین عامل‌ها: LLM02:2025 Sensitive Information Disclosure · LLM06:2025 Excessive Agency؛ T12 Agent Communication Poisoning · T16 Insecure Inter-Agent Protocol Abuse؛ دستکاری حافظه و زمینه عامل

ASI 08 – خرابی‌های زنجیره‌ای: LLM01:2025 Prompt Injection · LLM04 Data & Model Poisoning · LLM06:2025 Excessive Agency؛ T5 Cascading Hallucination Attacks · T8 Repudiation & Untraceability؛ خرابی‌های زنجیره‌ای عامل

ASI 09 – سوءاستفاده از اعتماد بین انسان و عامل: LLM01:2025 Prompt Injection · LLM05:2025 Improper Output Handling · LLM06:2025 Excessive Agency · LLM09 Misinformation؛ T7 Misaligned & Deceptive Behaviors · T8 Repudiation & Untraceability · T10 Overwhelming Human in the Loop؛ عدم‌قابلیت‌ردیابی عامل / دستکاری انسان

ASI 10 – عامل‌های سرکش: LLM02:2025 Sensitive Information Disclosure · LLM09:2025 Misinformation؛ T13 Rogue Agents in Multi-Agent Systems · T14 Human Attacks on Multi-Agent Systems · T15 Human Manipulation؛ یکپارچگی رفتاری (BI) · امنیت عملیاتی (OS) · نقض‌های انطباق (CV)

## یادداشت‌ها

هم‌راستایی با LLM Top 10: آسیب‌پذیری‌های ریشه‌ای LLM را که در سامانه‌های عامل‌محور گسترش یافته‌اند ثبت می‌کند. • Agentic Threats & Mitigations (T1–T17): مسیرهای حمله دانه‌ریز مرجع در چارچوب ASI را نمایندگی می‌کنند. • ریسک‌های اصلی AIVSS: به دسته‌بندی‌های امتیازدهی کمّی برای اولویت‌بندی و رتبه‌بندی شدت نگاشت می‌شوند (مانند BI، OS، CV). • بینش همپوشانی: ورودی‌های ASI اغلب چندین ورودی LLM را ترکیب می‌کنند — برای مثال، ASI01 ترکیبی از LLM01:2025 (پرامپت) با LLM06 (خودمختاری) است — که نشان‌دهنده چگونگی تشدید ریسک‌های سطح مدل توسط خودمختاری عامل‌محور است.
