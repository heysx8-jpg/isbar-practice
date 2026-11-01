(function () {
  document.querySelectorAll("[data-timer]").forEach(function (box) {
    var out = box.querySelector("output"), handle = null;
    function show(s) { out.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
    function stop() { if (handle) clearInterval(handle); handle = null; }
    box.querySelectorAll("button[data-mins]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        stop(); box.classList.remove("done");
        var end = Date.now() + Number(btn.dataset.mins) * 60000;
        function tick() {
          var left = Math.max(0, Math.round((end - Date.now()) / 1000));
          show(left);
          if (left === 0) { stop(); box.classList.add("done"); }
        }
        tick(); handle = setInterval(tick, 250);
      });
    });
    box.querySelector("[data-stop]").addEventListener("click", function () {
      stop(); box.classList.remove("done"); out.textContent = "--:--";
    });
  });
})();
