// Builds the manager overview deck for the OWASP GenAI translations pipeline.
// Speaker notes are written to be spoken: they're also the narration for the
// explainer video (see video.sh).
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const fs = require("fs");
const path = require("path");
const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");

const OUT = process.argv[2] || "GenAI-Translations-Manager-Overview.pptx";
const LOGO = process.argv[3];

// genai.owasp.org palette: navy 0F172A, slate 233B4F, blue 0798FF, deep blue 003580, pale E7F6FF / F5F8FF.
const THEME = {
  name: "OWASP GenAI Translations",
  headFontFace: "Arial",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "1E2A38", lt1: "FFFFFF", dk2: "0F172A", lt2: "F5F8FF",
    accent1: "0798FF", accent2: "233B4F", accent3: "003580",
    accent4: "E7F6FF", accent5: "1B7A3D", accent6: "B3261E",
    hlink: "0060C7", folHlink: "233B4F",
  },
};
const HEX = THEME.colors;

async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625
  pres.title = "GenAI Translations — Manager overview";
  pres.author = "OWASP GenAI Security Project";
  pres.company = "OWASP GenAI Security Project";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;

  // The deck and video show only "GenAI SECURITY PROJECT": the left 300px
  // of the logo (the OWASP mark, the word OWASP and the divider) are cropped
  // off by default. LOGO_CROP_LEFT=0 shows the full logo. The crop is done
  // in memory; the logo file itself is never edited.
  const cropLeft = parseInt(process.env.LOGO_CROP_LEFT ?? "300", 10);
  let logoBuf = fs.readFileSync(LOGO);
  const meta = await sharp(logoBuf).metadata();
  if (cropLeft > 0) logoBuf = await sharp(logoBuf).extract({ left: cropLeft, top: 0, width: meta.width - cropLeft, height: meta.height }).png().toBuffer();
  const logoData = "image/png;base64," + logoBuf.toString("base64");
  const LOGO_RATIO = meta.height / (meta.width - cropLeft);
  const LOGO_W = 3.6 * (meta.width - cropLeft) / meta.width; // same letter size either way

  // ---- Layouts -------------------------------------------------------
  pres.defineSlideMaster({
    title: "Dark title",
    background: { color: HEX.dk2 },
    objects: [
      { image: { data: logoData, x: 0.6, y: 0.55, w: LOGO_W, h: LOGO_W * LOGO_RATIO, altText: cropLeft > 0 ? "GenAI Security Project" : "OWASP GenAI Security Project" } },
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 1.7, w: 8.8, h: 1.2, fontSize: 40, bold: true, color: C.background1, valign: "bottom", align: "left", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 3.05, w: 8.2, h: 1.1, fontSize: 18, color: C.accent4, valign: "top", margin: 0 }, text: "" } },
    ],
  });
  pres.defineSlideMaster({
    title: "Content",
    background: { color: HEX.lt1 },
    margin: [0.5, 0.5, 0.6, 0.5],
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.3, w: 9.0, h: 0.75, fontSize: 28, bold: true, color: C.text2, valign: "middle", align: "left", margin: 0 }, text: "" } },
      { text: { text: "OWASP GenAI Security Project · Translations", options: { x: 0.5, y: 5.2, w: 6, h: 0.3, fontSize: 10, color: "5F6B7A", margin: 0 } } },
    ],
    slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.3, fontSize: 10, color: "5F6B7A", align: "right" },
  });

  const content = (title, section) => {
    const s = pres.addSlide({ masterName: "Content", sectionTitle: section });
    s.addText(title, { placeholder: "title" });
    return s;
  };

  // Numbered circle (the deck's motif).
  const num = (s, n, x, y, d = 0.42, fill = C.accent1) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill }, objectName: `step-${n}` });
    s.addText(String(n), { x, y, w: d, h: d, fontSize: 14, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true });
  };
  const card = (s, x, y, w, h, name) =>
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: C.background2 }, line: { color: "D1DAE5", width: 0.75 }, objectName: name });
  const iconCircle = async (s, Comp, x, y, d = 0.55) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: C.accent4 }, line: { color: C.accent4 } });
    s.addImage({ data: await icon(Comp, HEX.accent3), x: x + d * 0.24, y: y + d * 0.24, w: d * 0.52, h: d * 0.52 });
  };

  // ---- 1. Title ------------------------------------------------------
  pres.addSection({ title: "Introduction" });
  let s = pres.addSlide({ masterName: "Dark title", sectionTitle: "Introduction" });
  s.addText("GenAI Translations", { placeholder: "title" });
  s.addText("How the translation pipeline works — an overview for translations managers", { placeholder: "body" });
  s.addNotes(
    "Welcome. This is an overview of the OWASP GenAI Security Project's translation pipeline, for translations managers. " +
    "We'll cover how a document gets into the pipeline, how a new language is added, where translations are reviewed and edited, " +
    "how they're marked as reviewed, and how a finished translation goes through layout, final review and sign-off before anything is published."
  );

  // ---- 2. At a glance ------------------------------------------------
  s = content("The pipeline at a glance", "Introduction");
  const steps = [
    ["Request", "New document or new language"],
    ["Machine draft", "Gemini drafts each section"],
    ["Review & edit", "Language reviewers fix the draft"],
    ["Mark reviewed", "Approve and merge"],
    ["Layout handoff", "Watermarked draft for the designer"],
    ["Layout & final review", "Laid out in the template, checked"],
    ["Sign-off & publish", "Three approvals, then publish"],
  ];
  const sw = 9.0 / steps.length;
  steps.forEach(([t, d], i) => {
    const x = 0.5 + i * sw;
    if (i < steps.length - 1) s.addShape(pres.shapes.LINE, { x: x + 0.62, y: 1.71, w: sw - 0.42, h: 0, line: { color: "9DC3CF", width: 1.5 } });
    num(s, i + 1, x + 0.2, 1.5);
    s.addText(t, { x: x, y: 2.05, w: sw - 0.08, h: 0.6, fontSize: 13, bold: true, color: C.text2, valign: "top", margin: 0, isTextBox: true });
    s.addText(d, { x: x, y: 2.65, w: sw - 0.12, h: 0.9, fontSize: 11, color: "4A5563", valign: "top", margin: 0, isTextBox: true });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 3.85, w: 9.0, h: 0.95, rectRadius: 0.08, fill: { color: C.text2 }, line: { color: C.text2 }, objectName: "rule" });
  s.addImage({ data: await icon(fa.FaLock, "FFFFFF"), x: 0.78, y: 4.1, w: 0.45, h: 0.45 });
  s.addText([
    { text: "Nothing is published without sign-off. ", options: { bold: true, color: "FFFFFF" } },
    { text: "Machine drafts and watermarked layout drafts are working copies, never releases.", options: { color: "E7F6FF" } },
  ], { x: 1.45, y: 3.95, w: 7.8, h: 0.75, fontSize: 15, valign: "middle", margin: 0, isTextBox: true });
  s.addNotes(
    "Here's the whole journey in seven steps. A translations manager makes a request: either a new document, or a new language for a document that's already in the pipeline. " +
    "Gemini then machine-drafts every section. Language reviewers review and edit that draft, and mark it as reviewed by approving and merging it. " +
    "Once every section is reviewed, a manager produces a watermarked layout draft for the designer, who lays it out in the template for final review. " +
    "And finally, three people sign off before anything is published. That last point is the rule that matters most: nothing is published without sign-off."
  );

  // ---- 3. Who does what ---------------------------------------------
  s = content("Who does what", "Introduction");
  const roles = [
    [fa.FaUserShield, "Translations managers", "Make requests, run layout handoffs, confirm publishing. The translations-managers team or Maintain on the repo."],
    [fa.FaLanguage, "Language reviewers", "Review and edit drafts for their language. One reviewer team per language, requested automatically."],
    [fa.FaUserTie, "Document owners", "Named on each document; asked to review its drafts."],
    [fa.FaPencilRuler, "Layout designer", "Lays the reviewed, watermarked draft out in the document template."],
    [fa.FaClipboardCheck, "Sign-off approvers", "Localization lead, technical/content reviewer and project/ops executive."],
    [fa.FaCogs, "The pipeline", "GitHub Actions: drafting, status tracking, checks. Every step is gated to managers."],
  ];
  for (let i = 0; i < roles.length; i++) {
    const [Ic, t, d] = roles[i];
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.5 + col * 3.07, y = 1.25 + row * 1.95;
    card(s, x, y, 2.86, 1.75, `role-${i}`);
    await iconCircle(s, Ic, x + 0.2, y + 0.2);
    s.addText(t, { x: x + 0.88, y: y + 0.2, w: 1.85, h: 0.55, fontSize: 14, bold: true, color: C.text2, valign: "middle", margin: 0, isTextBox: true });
    s.addText(d, { x: x + 0.2, y: y + 0.85, w: 2.5, h: 0.82, fontSize: 11, color: "3F4A57", valign: "top", margin: 0, isTextBox: true });
  }
  s.addNotes(
    "Who does what. Translations managers start everything: they make requests, run layout handoffs and confirm publishing. Every pipeline action checks that the person is a manager. " +
    "Language reviewers review and edit the drafts for their language, and they're requested automatically on each draft. Document owners are asked to review too. " +
    "The layout designer lays the reviewed draft out in the template. Three sign-off approvers, the localization lead, the technical or content reviewer, and the project or ops executive, approve publishing. " +
    "And the pipeline itself, running on GitHub Actions, does the drafting and keeps track of each section's status."
  );

  // ---- 4. Add a new document ----------------------------------------
  pres.addSection({ title: "Requests" });
  s = content("Add a new document", "Requests");
  const newDoc = [
    ["Open the form", "Site → Onboard a document → Open the onboarding form."],
    ["Attach the English file", "Drag in the finished .pdf or .docx. Its file name becomes the document id."],
    ["Choose from the lists", "Version, languages (pick several) and layout template."],
    ["Create", "The pipeline checks you're a manager and opens an onboarding pull request."],
    ["Merge the onboarding PR", "Machine drafting of each language starts automatically."],
  ];
  newDoc.forEach(([t, d], i) => {
    const y = 1.2 + i * 0.75;
    num(s, i + 1, 0.5, y + 0.04);
    s.addText(t, { x: 1.1, y, w: 4.6, h: 0.3, fontSize: 14, bold: true, color: C.text2, margin: 0, isTextBox: true });
    s.addText(d, { x: 1.1, y: y + 0.3, w: 4.6, h: 0.4, fontSize: 11.5, color: "3F4A57", valign: "top", margin: 0, isTextBox: true });
  });
  card(s, 6.1, 1.2, 3.4, 3.55, "newdoc-notes");
  await iconCircle(s, fa.FaFileUpload, 6.3, 1.38);
  s.addText("Good to know", { x: 6.98, y: 1.38, w: 2.4, h: 0.55, fontSize: 14, bold: true, color: C.text2, valign: "middle", margin: 0, isTextBox: true });
  s.addText([
    { text: "New documents only — languages for an existing document use the other form.", options: { bullet: true, breakLine: true } },
    { text: "The repository is public: only attach documents meant to be published.", options: { bullet: true, breakLine: true } },
    { text: "Non-managers' requests are declined automatically with a comment.", options: { bullet: true } },
  ], { x: 6.3, y: 2.08, w: 3.05, h: 2.55, fontSize: 11.5, color: "3F4A57", valign: "top", paraSpaceAfter: 6, margin: 0, isTextBox: true });
  s.addNotes(
    "To add a new document, open the translations site and choose Onboard a document, then open the onboarding form on GitHub. " +
    "Drag the finished English PDF or Word file into the form. Its file name becomes the document's id, so name it clearly. " +
    "Then pick the version, the languages and the layout template from the lists, and press Create. " +
    "The pipeline checks that you're a translations manager and opens an onboarding pull request. When that's merged, machine drafting of every language starts automatically. " +
    "Remember that the repository is public, so only attach documents that are meant to be published."
  );

  // ---- 5. Add a language --------------------------------------------
  s = content("Add a language to an existing document", "Requests");
  card(s, 0.5, 1.2, 4.3, 3.55, "lang-how");
  await iconCircle(s, fa.FaGlobeEurope, 0.7, 1.38);
  s.addText("Two ways to ask", { x: 1.38, y: 1.38, w: 3.3, h: 0.55, fontSize: 14, bold: true, color: C.text2, valign: "middle", margin: 0, isTextBox: true });
  s.addText([
    { text: "Status page: ", options: { bold: true } },
    { text: "press + Add languages under the document, tick languages, press Request translation, then Create on GitHub.", options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 6 } },
    { text: "Or the form: ", options: { bold: true } },
    { text: "Add languages to a document — pick the document and languages from drop-down lists. No file needed.", options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 6 } },
    { text: "Free Gemini tier: ", options: { bold: true } },
    { text: "a long document may need a second drafting run; a partial draft still opens its pull request.", options: {} },
  ], { x: 0.7, y: 2.08, w: 3.95, h: 2.55, fontSize: 12, color: "3F4A57", valign: "top", margin: 0, isTextBox: true });
  const after = [
    ["Checked", "Manager only; languages the document already has are skipped."],
    ["Registered", "The language is added to the document automatically."],
    ["Drafted", "Gemini drafts each new language in turn."],
    ["Ready for review", "One pull request per language, linked on your request."],
  ];
  s.addText("What happens next", { x: 5.2, y: 1.2, w: 4.3, h: 0.4, fontSize: 14, bold: true, color: C.text2, margin: 0, isTextBox: true });
  after.forEach(([t, d], i) => {
    const y = 1.72 + i * 0.76;
    num(s, i + 1, 5.2, y + 0.02, 0.38);
    s.addText(t, { x: 5.75, y, w: 3.75, h: 0.28, fontSize: 13, bold: true, color: C.text2, margin: 0, isTextBox: true });
    s.addText(d, { x: 5.75, y: y + 0.28, w: 3.75, h: 0.4, fontSize: 11.5, color: "3F4A57", valign: "top", margin: 0, isTextBox: true });
  });
  s.addNotes(
    "To translate an existing document into another language, the easiest route is the Documents and languages page. Press Add languages under the document, tick the languages you want, and press Request translation. " +
    "GitHub opens the request; press Create. You can also open the Add languages form directly and pick the document and languages from drop-down lists. No file is needed. " +
    "The pipeline checks you're a manager, skips any language the document already has, registers the new ones, and drafts each language in turn. " +
    "Each draft arrives as its own pull request for review, and it's linked on your request. On the free Gemini tier a long document can need a second run; a partial draft still opens its pull request."
  );

  // ---- 6. Review and edit -------------------------------------------
  pres.addSection({ title: "Review" });
  s = content("Where to review and edit translations", "Review");
  const where = [
    [fa.FaCodeBranch, "In the draft pull request", "Each language's draft is a pull request labelled status:draft. Reviewers for that language and the document owners are requested automatically."],
    [fa.FaFileAlt, "One file per section", "Sections live under <document>/<language>/ — one text file per section, plus translated figures."],
    [fa.FaEdit, "Edit on GitHub", "Files changed → ⋯ → Edit file, or press the . key to open the web editor. Commit straight to the pull request's branch."],
  ];
  for (let i = 0; i < where.length; i++) {
    const [Ic, t, d] = where[i];
    const x = 0.5 + i * 3.07;
    card(s, x, 1.25, 2.86, 2.85, `where-${i}`);
    await iconCircle(s, Ic, x + 0.2, 1.45, 0.65);
    s.addText(t, { x: x + 0.2, y: 2.25, w: 2.5, h: 0.6, fontSize: 14, bold: true, color: C.text2, valign: "top", margin: 0, isTextBox: true });
    s.addText(d, { x: x + 0.2, y: 2.85, w: 2.5, h: 1.15, fontSize: 11.5, color: "3F4A57", valign: "top", margin: 0, isTextBox: true });
  }
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 4.3, w: 9.0, h: 0.6, rectRadius: 0.08, fill: { color: C.accent4 }, line: { color: C.accent4 }, objectName: "tip" });
  s.addText([
    { text: "Finding drafts: ", options: { bold: true } },
    { text: "each request links its draft PRs, and Docs → Translations awaiting review lists them all." },
  ], { x: 0.75, y: 4.3, w: 8.6, h: 0.6, fontSize: 12.5, color: C.text2, valign: "middle", margin: 0, isTextBox: true });
  s.addNotes(
    "Where do translations get reviewed and edited? In the draft pull request for that language. You'll find it linked on the request, or under Translations awaiting review on the Docs page. " +
    "Reviewers for the language and the document owners are asked to review automatically. " +
    "Each section is its own file, under the document's folder and then the language's folder. " +
    "To edit, open the pull request's Files changed tab and choose Edit file, or press the full-stop key to open GitHub's web editor, and commit your changes straight to the pull request's branch."
  );

  // ---- 7. Mark as reviewed ------------------------------------------
  s = content("Marking translations as reviewed", "Review");
  const states = [
    ["Draft", "Machine-drafted, not yet checked.", "F1F5F9", C.text2],
    ["In review", "Someone has started reviewing.", "E7F6FF", C.text2],
    ["Reviewed", "Checked and approved.", "E3F4EA", C.text2],
  ];
  states.forEach(([t, d, fill], i) => {
    const x = 0.5 + i * 3.2;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.3, w: 2.6, h: 1.15, rectRadius: 0.1, fill: { color: fill }, line: { color: "D1DAE5", width: 0.75 }, objectName: `state-${i}` });
    s.addText(t, { x: x + 0.2, y: 1.4, w: 2.2, h: 0.45, fontSize: 18, bold: true, color: C.text2, margin: 0, isTextBox: true });
    s.addText(d, { x: x + 0.2, y: 1.85, w: 2.2, h: 0.5, fontSize: 11.5, color: "3F4A57", margin: 0, isTextBox: true });
    if (i < 2) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + 2.68, y: 1.72, w: 0.44, h: 0.32, fill: { color: C.accent1 }, line: { color: C.accent1 } });
  });
  s.addText("Mark the PR Ready for review", { x: 2.2, y: 2.6, w: 2.4, h: 0.5, fontSize: 11.5, bold: true, color: C.accent3, align: "center", margin: 0, isTextBox: true });
  s.addText("Approve and merge the PR", { x: 5.4, y: 2.6, w: 2.4, h: 0.5, fontSize: 11.5, bold: true, color: C.accent3, align: "center", margin: 0, isTextBox: true });
  card(s, 0.5, 3.35, 9.0, 1.4, "review-notes");
  await iconCircle(s, fa.FaChartBar, 0.7, 3.55);
  s.addText([
    { text: "The pipeline records each change of state — nobody edits status files by hand.", options: { bullet: true, breakLine: true } },
    { text: "Progress per language shows on the Documents & languages page.", options: { bullet: true, breakLine: true } },
    { text: "If the English source changes later, affected sections are flagged stale for another look.", options: { bullet: true } },
  ], { x: 1.45, y: 3.5, w: 7.9, h: 1.15, fontSize: 12, color: "3F4A57", valign: "middle", paraSpaceAfter: 4, margin: 0, isTextBox: true });
  s.addNotes(
    "Every section moves through three states. It starts as a draft. When a reviewer begins, they mark the pull request Ready for review, and its sections move to In review. " +
    "When the review is done, approving and merging the pull request moves those sections to Reviewed. " +
    "The pipeline records each change itself, so nobody edits status files by hand, and the Documents and languages page shows the progress for each language. " +
    "If the English source changes later, the affected sections are flagged as stale so they get another look."
  );

  // ---- 8. Layout handoff --------------------------------------------
  pres.addSection({ title: "Layout and publishing" });
  s = content("Layout handoff: the watermarked draft", "Layout and publishing");
  const hand = [
    ["Every section reviewed", "The Publish page marks the language ready."],
    ["Run layout handoff", "Copy the document id, open Run workflow, enter id and language."],
    ["Download the package", "From the run's Artifacts (kept 14 days)."],
    ["Send it to the designer", "To lay out in the document's template."],
  ];
  hand.forEach(([t, d], i) => {
    const y = 1.2 + i * 0.88;
    num(s, i + 1, 0.5, y + 0.04);
    s.addText(t, { x: 1.1, y, w: 4.0, h: 0.32, fontSize: 14, bold: true, color: C.text2, margin: 0, isTextBox: true });
    s.addText(d, { x: 1.1, y: y + 0.32, w: 4.0, h: 0.45, fontSize: 11.5, color: "3F4A57", valign: "top", margin: 0, isTextBox: true });
  });
  card(s, 5.5, 1.2, 4.0, 3.55, "package");
  await iconCircle(s, fa.FaBoxOpen, 5.7, 1.38);
  s.addText("What's in the package", { x: 6.38, y: 1.38, w: 3.0, h: 0.55, fontSize: 14, bold: true, color: C.text2, valign: "middle", margin: 0, isTextBox: true });
  s.addText([
    { text: "A Word file of the reviewed translation, watermarked “DRAFT – NOT FOR DISTRIBUTION”", options: { bullet: true, breakLine: true } },
    { text: "The figures, as separate files", options: { bullet: true, breakLine: true } },
    { text: "Handoff notes for the designer", options: { bullet: true, breakLine: true } },
    { text: "Only fully reviewed languages can be handed off.", options: { bullet: true } },
  ], { x: 5.7, y: 2.08, w: 3.65, h: 2.55, fontSize: 12, color: "3F4A57", valign: "top", paraSpaceAfter: 6, margin: 0, isTextBox: true });
  s.addNotes(
    "Once every section of a language is reviewed, the Publish page marks it as ready. A manager copies the document id, opens the layout handoff workflow, enters the id and the language, and runs it. " +
    "A few minutes later the package can be downloaded from the run. It holds a Word file of the reviewed translation, watermarked Draft, not for distribution, along with the figures as separate files and handoff notes. " +
    "That package goes to the designer to lay out in the document's template. It's a working draft, not a publication, and only fully reviewed languages can be handed off."
  );

  // ---- 9. Final review and sign-off ---------------------------------
  s = content("Final review and sign-off before publishing", "Layout and publishing");
  const flow = [
    [fa.FaPencilRuler, "Laid out", "The designer returns the laid-out draft."],
    [fa.FaSearch, "Final review", "Reviewers and owners check the laid-out version."],
    [fa.FaClipboardList, "Ready to publish", "A sign-off issue opens automatically."],
    [fa.FaCheckDouble, "Three sign-offs", "Each approver ticks their box."],
    [fa.FaRocket, "Publish", "A manager confirms; the final PDF is released."],
  ];
  const fw = 9.0 / flow.length;
  for (let i = 0; i < flow.length; i++) {
    const [Ic, t, d] = flow[i];
    const x = 0.5 + i * fw;
    await iconCircle(s, Ic, x + (fw - 0.7) / 2 - 0.05, 1.25, 0.7);
    if (i < flow.length - 1) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + fw - 0.33, y: 1.47, w: 0.26, h: 0.24, fill: { color: "9DC3CF" }, line: { color: "9DC3CF" } });
    s.addText(t, { x: x + 0.05, y: 2.05, w: fw - 0.2, h: 0.35, fontSize: 13, bold: true, color: C.text2, align: "center", margin: 0, isTextBox: true });
    s.addText(d, { x: x + 0.05, y: 2.4, w: fw - 0.2, h: 0.75, fontSize: 11, color: "3F4A57", align: "center", valign: "top", margin: 0, isTextBox: true });
  }
  card(s, 0.5, 3.35, 9.0, 1.45, "signoff");
  s.addText("Sign-off checklist", { x: 0.75, y: 3.45, w: 3.0, h: 0.35, fontSize: 13, bold: true, color: C.text2, margin: 0, isTextBox: true });
  ["Localization lead", "Technical/content reviewer", "Project/ops executive"].forEach((r, i) => {
    const x = 0.75 + i * 2.95;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 3.9, w: 0.28, h: 0.28, rectRadius: 0.05, fill: { color: "FFFFFF" }, line: { color: C.accent3, width: 1.25 } });
    s.addText(r, { x: x + 0.4, y: 3.85, w: 2.4, h: 0.38, fontSize: 12.5, color: C.text2, valign: "middle", margin: 0, isTextBox: true });
  });
  s.addText("All three are required, and the final step must be a translations manager's.", { x: 0.75, y: 4.33, w: 8.5, h: 0.35, fontSize: 11.5, italic: true, color: "3F4A57", margin: 0, isTextBox: true });
  s.addNotes(
    "The designer returns the laid-out draft, and it goes through a final review by the reviewers and document owners. " +
    "Once every section is reviewed, the pipeline opens a Ready to publish issue for that document and language. It carries a sign-off checklist with three boxes: the localization lead, the technical or content reviewer, and the project or ops executive. " +
    "All three must be ticked, and the step that completes the sign-off has to come from a translations manager. Only then is the final PDF produced and released. " +
    "If someone who isn't a manager completes the checklist, nothing is published; a manager is asked to confirm."
  );

  // ---- 10. The publishing rule (dark) -------------------------------
  s = pres.addSlide({ masterName: "Dark title", sectionTitle: "Layout and publishing" });
  s.addText("Nothing is published without sign-off", { placeholder: "title" });
  s.addText("Machine drafts, reviewed drafts and watermarked layout drafts are working copies. A translation is released only after the three sign-offs are complete and a translations manager confirms.", { placeholder: "body" });
  s.addNotes(
    "To repeat the most important rule: nothing is published without sign-off. Machine drafts, reviewed drafts and the watermarked layout drafts are all working copies. " +
    "A translation is released only after all three sign-offs are complete and a translations manager confirms."
  );

  // ---- 11. Access and where to find things --------------------------
  pres.addSection({ title: "Reference" });
  s = content("Access and where to find things", "Reference");
  const refs = [
    [fa.FaHome, "Translations site", "genai-security-project.github.io/translations — Onboard, Documents & languages, Publish, Docs."],
    [fa.FaBook, "Docs page", "Guides, reference, requests, translations awaiting review and workflow runs."],
    [fa.FaKey, "No tokens", "Everything uses your normal GitHub sign-in. Managers are added in GitHub settings by an admin."],
    [fa.FaUsers, "Reviewers", "Each language has its own reviewer team, requested automatically on drafts."],
  ];
  for (let i = 0; i < refs.length; i++) {
    const [Ic, t, d] = refs[i];
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.5 + col * 4.6, y = 1.25 + row * 1.8;
    card(s, x, y, 4.4, 1.6, `ref-${i}`);
    await iconCircle(s, Ic, x + 0.2, y + 0.22);
    s.addText(t, { x: x + 0.9, y: y + 0.2, w: 3.3, h: 0.45, fontSize: 14, bold: true, color: C.text2, valign: "middle", margin: 0, isTextBox: true });
    s.addText(d, { x: x + 0.9, y: y + 0.68, w: 3.35, h: 0.85, fontSize: 11.5, color: "3F4A57", valign: "top", margin: 0, isTextBox: true });
  }
  s.addNotes(
    "Everything starts from the translations site, which has pages for onboarding, documents and languages, publishing, and docs. " +
    "The Docs page links the guides and reference, plus requests, translations awaiting review, and workflow runs. " +
    "There are no access tokens: everything uses your normal GitHub sign-in, and an admin adds managers in GitHub. Each language has its own reviewer team, requested automatically."
  );

  // ---- 12. Close (dark) ---------------------------------------------
  s = pres.addSlide({ masterName: "Dark title", sectionTitle: "Reference" });
  s.addText("Questions?", { placeholder: "title" });
  s.addText("Start at the Docs page: genai-security-project.github.io/translations/docs.html", { placeholder: "body" });
  s.addNotes("That's the pipeline from request to release. For more detail, start at the Docs page on the translations site. Thanks for watching.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
