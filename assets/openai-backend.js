/* OpenAI (ChatGPT API) backend for the live generator.
   The visitor's key is sent only to api.openai.com; it is kept in this
   browser's localStorage only if they tick "Remember on this device". */
(function () {
  "use strict";
  var DEFAULT_MODEL = "gpt-5";
  var keyBox = document.getElementById("gen-key"), remember = document.getElementById("gen-remember");
  var modelBox = document.getElementById("gen-model"), modelList = document.getElementById("gen-model-list");
  var modelNote = document.getElementById("gen-model-note");

  try {
    var k = localStorage.getItem("isbar-openai-key"); if (k) { keyBox.value = k; remember.checked = true; }
    var m = localStorage.getItem("isbar-openai-model"); if (m) modelBox.value = m;
  } catch (e) {}
  if (!modelBox.value) modelBox.value = DEFAULT_MODEL;

  function save() {
    try {
      if (remember.checked && keyBox.value.trim()) localStorage.setItem("isbar-openai-key", keyBox.value.trim());
      else localStorage.removeItem("isbar-openai-key");
      if (modelBox.value.trim()) localStorage.setItem("isbar-openai-model", modelBox.value.trim());
    } catch (e) {}
  }
  remember.addEventListener("change", save);
  modelBox.addEventListener("change", save);
  keyBox.addEventListener("change", function () { save(); loadModels(); });

  /* Suggest the chat models this key can use. */
  function loadModels() {
    var key = keyBox.value.trim();
    if (!key) return;
    fetch("https://api.openai.com/v1/models", { headers: { Authorization: "Bearer " + key } })
      .then(function (r) {
        if (r.status === 401) { modelNote.textContent = "OpenAI didn’t accept that key."; return null; }
        return r.ok ? r.json() : null;
      })
      .then(function (j) {
        if (!j || !j.data) return;
        var ids = j.data.map(function (x) { return x.id; })
          .filter(function (id) { return /^(gpt-|o\d|chatgpt-)/.test(id) && !/(audio|realtime|transcribe|tts|image|search|embedding|instruct|codex)/.test(id); })
          .sort().reverse();
        modelList.innerHTML = ids.map(function (id) { return '<option value="' + id + '"></option>'; }).join("");
        modelNote.textContent = "Key accepted. " + ids.length + " chat models available. Click the model box to choose.";
      })
      .catch(function () {});
  }
  loadModels();

  function friendly(status, body) {
    var msg = body && body.error && body.error.message ? body.error.message : "";
    if (status === 401) return "OpenAI didn’t accept that API key. Check it and try again.";
    if (status === 404) return "That model isn’t available to this key. Choose another from the model box.";
    if (status === 429) return /quota|billing|credit/i.test(msg)
      ? "This OpenAI account is out of credit. Add credit at platform.openai.com → Billing."
      : "Rate limit reached. Wait a minute and try again.";
    if (status === 400) return "OpenAI rejected the request: " + msg;
    return "OpenAI returned an error (" + status + "). Try again." + (msg ? " " + msg : "");
  }

  var backend = {
    run: async function (prompt, o) {
      var key = keyBox.value.trim(), model = modelBox.value.trim() || DEFAULT_MODEL;
      if (!key) throw { userMessage: "Paste your OpenAI API key in the box above first." };
      save();
      var text = "", res;
      try {
        res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          signal: o.signal,
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
          body: JSON.stringify({ model: model, stream: true, messages: [{ role: "user", content: prompt }] })
        });
      } catch (e) {
        if (e && e.name === "AbortError") throw { userMessage: "Stopped." };
        throw { userMessage: "Couldn’t reach OpenAI. Check your connection and try again." };
      }
      if (!res.ok) {
        var body = null;
        try { body = await res.json(); } catch (e) {}
        throw { userMessage: friendly(res.status, body) };
      }
      var reader = res.body.getReader(), dec = new TextDecoder(), buf = "", finish = null;
      try {
        for (;;) {
          var chunk = await reader.read();
          if (chunk.done) break;
          buf += dec.decode(chunk.value, { stream: true });
          var lines = buf.split("\n");
          buf = lines.pop();
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line.indexOf("data:") !== 0) continue;
            var data = line.slice(5).trim();
            if (data === "[DONE]") continue;
            var j;
            try { j = JSON.parse(data); } catch (e) { continue; }
            var c = j.choices && j.choices[0];
            if (!c) continue;
            if (c.delta && c.delta.content) { text += c.delta.content; o.onText(text); }
            if (c.finish_reason) finish = c.finish_reason;
          }
        }
      } catch (e) {
        if (e && e.name === "AbortError") throw { userMessage: "Stopped.", text: text };
        throw { userMessage: "The connection dropped part-way. Try again.", text: text };
      }
      if (!text) throw { userMessage: "The model returned no text. Try again or choose another model." };
      return { text: text, note: finish === "length" ? "The answer hit the length limit and may be cut short." : "Done (" + model + ")." };
    }
  };

  ISBARGen.mount(document.getElementById("gen-root"), backend);
})();
