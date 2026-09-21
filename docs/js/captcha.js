// A deliberately simple calculation CAPTCHA gating the submit action on
// upload.html. Not meant as robust bot-proofing (a real token requirement
// already restricts submission to people with write access to a private
// repo) — this is a lightweight, explicit "confirm you mean to do this"
// gate on an action with a real side effect (a commit + a workflow run).
// First pass; swap for something stronger later if abuse ever shows up.

let _captchaAnswer = null;

function renderCaptcha(container) {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  _captchaAnswer = a + b;
  container.innerHTML = "";

  const label = document.createElement("label");
  label.className = "captcha-label";
  label.textContent = `Before submitting: what is ${a} + ${b}?`;

  const input = document.createElement("input");
  input.type = "number";
  input.id = "captcha-input";
  input.className = "captcha-input";
  input.setAttribute("aria-label", "Captcha answer");

  container.appendChild(label);
  container.appendChild(input);
}

function checkCaptcha(container) {
  const input = document.getElementById("captcha-input");
  const ok = input && Number(input.value) === _captchaAnswer;
  if (!ok) renderCaptcha(container); // wrong answer — fresh problem, no guessing the same one twice
  return ok;
}
