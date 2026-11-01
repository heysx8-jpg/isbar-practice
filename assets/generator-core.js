/* Shared logic for the live ISBAR case generator.
   Needs window.ISBAR_DATA (exemplars, built by build.py) and a backend:
   backend.run(prompt, {onText, signal}) -> Promise<{text, note?}>          */
(function () {
  "use strict";
  var D = window.ISBAR_DATA || {};

  function caseOpts(f) {
    var cond = f.topic === "other" ? (f.other || "").trim() : f.topic;
    return {
      cond: cond || "a condition commonly seen by occupational therapists",
      age: f.age === "any" ? "your choice (vary it — child, adolescent, adult or older adult as suits the condition)" : f.age,
      gender: f.gender === "any" ? "your choice" : f.gender,
      setting: f.setting === "any" ? "your choice, realistic for this condition in Queensland" : f.setting,
      twist: (f.twist || "").trim()
    };
  }

  function buildCasePrompt(f) {
    var o = caseOpts(f);
    return [
      "You write practice cases for occupational therapy students preparing for an OSCE-style clinical skills test in Queensland, Australia. After 10 minutes' preparation the student gives a 7-minute ISBAR handover (Introduction, Situation, Background, Assessment, Recommendation) to an educator playing their clinical supervisor, then answers questions for 3 minutes.",
      "",
      "Write ONE new fictional case.",
      "- Condition: " + o.cond,
      "- Client age: " + o.age,
      "- Client gender: " + o.gender,
      "- Setting: " + o.setting,
      o.twist ? "- Requested focus or twist: " + o.twist : "",
      "",
      "Requirements:",
      "1. Match the voice, structure and length of the example case below: an opening paragraph (full name, age, **bold condition**, setting, living situation, relevant history); a reassuring medical-status paragraph; \"You have been asked to…\" with the client initially presenting well; two or three paragraphs in which warning signs gradually emerge through observation and short direct quotes; a paragraph naming gaps in the record (\"There is no clear documentation regarding…\"); and a closing time-pressure moment.",
      "2. Hide ONE clear immediate priority that needs escalation. It must be discoverable from clues only. Never name the hidden problem or diagnosis.",
      "3. Include 3–4 distractors: reassuring findings from other disciplines, a normal screening result, a client who seems well and keen, family or staff pressure, and an irrelevant but tempting request (paperwork, funding, equipment, a hobby).",
      "4. The narrative must be 540–600 words. Use British/Australian spelling and curly quotes. Be clinically accurate and use Queensland/Australian service names where relevant (NDIS, My Aged Care, NIISQ, WorkCover Queensland, Queensland Health). Do not invent statistics, guideline rules or real people.",
      "5. Do not reuse these existing practice scenarios: " + (D.existing || "none") + ".",
      "6. Reply with Markdown only, in exactly this shape, with nothing before or after it:",
      "",
      "# Case study: <first name>",
      "",
      "Condition: <condition>",
      "",
      "Client: <age>-year-old <woman/man/girl/boy/non-binary person> · <setting>",
      "",
      "<narrative paragraphs>",
      "",
      "**You are the occupational therapy student <doing what, with whom> and your clinical supervisor is not currently in the room.**",
      "",
      "**Present <first name>’s case to your clinical supervisor using the ISBAR framework. Identify the immediate concerns and explain what you would prioritise in responding to the situation.**",
      "",
      "Example case (for voice, structure and length only; do not copy its facts):",
      "<<<",
      D.exampleCase || "",
      ">>>"
    ].join("\n");
  }

  function buildAnswerPrompt(caseText) {
    return [
      "You are an experienced occupational therapy clinical educator in Queensland, Australia. Write a model 7-minute spoken ISBAR handover for the practice case below, as an OT student would say it to their clinical supervisor, followed by coaching notes.",
      "",
      "Rules:",
      "- Spoken words of the student, in curly quotation marks, section by section, in the voice of the example answer (\"Hi, I’m the occupational therapy student who…\"). No student name.",
      "- The spoken text (I, S, B, A, R) must be 950–1,050 words, roughly I 50, S 120, B 160, A 320, R 370.",
      "- Lead with the immediate concern in I and S. In B, state only relevant facts exactly as in the case and name missing information as things to clarify, not assumptions.",
      "- Assessment: case finding → what it may indicate → consequence for safety and occupations → priority. Use condition knowledge. Show you saw through each distractor. Separate known facts, interpretation, missing information and proposed assessment. Stay within student scope: no diagnosis, no capacity determination, no medical decisions — say what warrants urgent review and by whom.",
      "- Recommendation: action → reason → who → review. Order: immediate safety action, escalation, specific MDT asks, one principal short-term OT assessment and one longer-term measure (do not flood with tools; do not default to MoCA), then intervention, education, referral and follow-up. Respect autonomy and the client’s own goals, culture and roles. Use professional wording.",
      "- Cite 1–3 real guidelines or sources only where they explain reasoning, and only if you are confident they exist. British/Australian spelling.",
      "",
      "Reply with Markdown only, in exactly this shape:",
      "",
      "## I – Introduction",
      "## S – Situation",
      "## B – Background",
      "## A – Assessment",
      "## R – Recommendation",
      "## Coaching notes",
      "### The immediate priority",
      "### Distractors in this case   (bullets: **distractor** — why it should not drive the decision)",
      "### Missing information to clarify   (bullets)",
      "### Useful references   (1–3 bullets)",
      "",
      "Example answer for a different case (format and depth only):",
      "<<<",
      D.exampleAnswer || "",
      ">>>",
      "",
      "The case to answer:",
      "<<<",
      caseText,
      ">>>"
    ].join("\n");
  }

  /* ---- tiny Markdown renderer (headings, paragraphs, bold/italic, bullets) ---- */
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function inline(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<em>$2</em>");
  }
  function renderMarkdown(md) {
    var out = [], list = null, para = [];
    function flushPara() { if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; } }
    function flushList() { if (list) { out.push("<ul>" + list.map(function (li) { return "<li>" + inline(li) + "</li>"; }).join("") + "</ul>"); list = null; } }
    md.replace(/<!--[\s\S]*?-->/g, "").split(/\r?\n/).forEach(function (line) {
      var h = line.match(/^(#{1,3})\s+(.*)$/), li = line.match(/^\s*[-*]\s+(.*)$/);
      if (h) { flushPara(); flushList(); var n = h[1].length + 1; out.push("<h" + n + ">" + inline(h[2]) + "</h" + n + ">"); }
      else if (li) { flushPara(); (list = list || []).push(li[1]); }
      else if (!line.trim()) { flushPara(); flushList(); }
      else { flushList(); para.push(line.trim()); }
    });
    flushPara(); flushList();
    return out.join("\n");
  }

  function wordCount(md) {
    return md.replace(/^#.*$/gm, "").split(/\s+/).filter(Boolean).length;
  }

  /* ---- UI wiring ---- */
  function mount(root, backend) {
    var $ = function (s) { return root.querySelector(s); };
    var form = $("#gen-form"), topic = $("#gen-topic"), other = $("#gen-other-wrap");
    var caseOut = $("#gen-case"), ansOut = $("#gen-answer"), status = $("#gen-status");
    var btnCase = $("#gen-case-btn"), btnAns = $("#gen-answer-btn"), btnStop = $("#gen-stop"), btnCopy = $("#gen-copy");
    var caseMeta = $("#gen-case-meta"), ansMeta = $("#gen-answer-meta");
    var caseText = "", ctl = null;

    topic.addEventListener("change", function () { other.hidden = topic.value !== "other"; });
    other.hidden = topic.value !== "other";

    function busy(on, msg) {
      btnCase.disabled = on; btnAns.disabled = on || !caseText; btnStop.hidden = !on;
      status.textContent = msg || "";
    }
    function fields() {
      return { topic: topic.value, other: $("#gen-other").value, age: $("#gen-age").value,
               gender: $("#gen-gender").value, setting: $("#gen-setting").value, twist: $("#gen-twist").value };
    }
    function run(prompt, target, meta, label) {
      ctl = new AbortController();
      target.innerHTML = "<p class=\"gen-thinking\">Thinking… this usually takes 20–60 seconds.</p>";
      busy(true, label);
      return backend.run(prompt, {
        signal: ctl.signal,
        onText: function (t) { target.innerHTML = renderMarkdown(t); meta.textContent = wordCount(t) + " words so far"; }
      }).then(function (r) {
        target.innerHTML = renderMarkdown(r.text);
        busy(false, r.note || "");
        return r.text;
      }, function (e) {
        var keep = e && e.text;
        target.innerHTML = keep ? renderMarkdown(keep) : "";
        busy(false, (e && e.userMessage) || "Something went wrong. Try again.");
        throw e;
      });
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (topic.value === "other" && !$("#gen-other").value.trim()) { status.textContent = "Type a condition first."; return; }
      caseText = ""; ansOut.innerHTML = ""; ansMeta.textContent = ""; btnCopy.hidden = true;
      run(buildCasePrompt(fields()), caseOut, caseMeta, "Writing a new case…").then(function (t) {
        caseText = t;
        var body = t.split(/\*\*You are the occupational/)[0].replace(/^(#.*|Condition:.*|Client:.*)$/gm, "");
        caseMeta.textContent = "Narrative ≈ " + wordCount(body) + " words. Prepare for 10 minutes, present for 7, then generate the sample answer.";
        btnAns.disabled = false; btnCopy.hidden = false;
      }, function () {});
    });
    btnAns.addEventListener("click", function () {
      if (!caseText) return;
      run(buildAnswerPrompt(caseText), ansOut, ansMeta, "Writing the sample ISBAR answer…").then(function (t) {
        var spoken = t.split("## Coaching notes")[0];
        var n = wordCount(spoken);
        ansMeta.textContent = "Spoken text ≈ " + n + " words (≈ " + (n / 140).toFixed(1) + " min at 140 words per minute).";
      }, function () {});
    });
    btnStop.addEventListener("click", function () { if (ctl) ctl.abort(); });
    btnCopy.addEventListener("click", function () {
      var done = function () { status.textContent = "Case copied."; };
      try {
        navigator.clipboard.writeText(caseText).then(done, function () { selectCase(); });
      } catch (e) { selectCase(); }
      function selectCase() {
        var r = document.createRange(); r.selectNodeContents(caseOut);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        status.textContent = "Case selected. Press Ctrl+C (or ⌘C) to copy.";
      }
    });
    busy(false, "");
  }

  window.ISBARGen = { buildCasePrompt: buildCasePrompt, buildAnswerPrompt: buildAnswerPrompt,
                      renderMarkdown: renderMarkdown, mount: mount };
})();
