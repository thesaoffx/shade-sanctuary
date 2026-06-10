// Shade Sanctuary: reveals, counters, mobile nav, quote form
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ----- scroll reveals -----
  var targets = document.querySelectorAll(".reveal, .reveal-stagger");
  if (!reduced && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -40px 0px" });
    targets.forEach(function (t) { io.observe(t); });
  } else {
    targets.forEach(function (t) { t.classList.add("in"); });
  }

  document.querySelectorAll(".reveal-stagger").forEach(function (group) {
    Array.prototype.forEach.call(group.children, function (child, i) {
      child.style.setProperty("--i", i);
    });
  });

  // ----- count-up stats -----
  var nums = document.querySelectorAll("[data-count]");
  function animateCount(el) {
    var end = parseInt(el.getAttribute("data-count"), 10);
    var suffix = el.getAttribute("data-suffix") || "";
    if (reduced) { el.textContent = end + suffix; return; }
    var start = null;
    var dur = 1300;
    function tick(ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(end * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if ("IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          animateCount(e.target);
          cio.unobserve(e.target);
        }
      });
    }, { threshold: 0.6 });
    nums.forEach(function (n) { cio.observe(n); });
  } else {
    nums.forEach(animateCount);
  }

  // ----- mobile nav -----
  var toggle = document.querySelector(".nav-toggle");
  var mobileNav = document.getElementById("mobile-nav");
  function closeNav() {
    if (!mobileNav.classList.contains("open")) return;
    mobileNav.classList.remove("open");
    mobileNav.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
  }
  if (toggle && mobileNav) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      if (open) { closeNav(); return; }
      mobileNav.hidden = false;
      mobileNav.classList.add("open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
    });
    mobileNav.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeNav();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav();
    });
  }

  // ----- quote form: direct send with email-app fallback -----
  var ENDPOINT = "https://formsubmit.co/ajax/shadesanctuary@gmail.com";

  function mailtoFallback(d) {
    var lines = [
      "Hi Shade Sanctuary,",
      "",
      "I'd like a free fencing quote.",
      "",
      "Name: " + (d.name || ""),
      "Phone: " + (d.phone || ""),
      "Suburb: " + (d.suburb || ""),
      "Service: " + (d.service || ""),
      "Approx. length: " + (d.metres || "not sure") + " m"
    ];
    if (d.message) lines.push("", "Details: " + d.message);
    return "mailto:shadesanctuary@gmail.com" +
      "?subject=" + encodeURIComponent("Free quote request from " + (d.suburb || "Adelaide")) +
      "&body=" + encodeURIComponent(lines.join("\n"));
  }

  document.querySelectorAll("form.quote-form").forEach(function (form) {
    var status = form.querySelector(".form-status");
    var hint = form.querySelector(".form-hint");
    var button = form.querySelector("button[type=submit]");

    function showStatus(kind, text) {
      status.hidden = false;
      status.className = "form-status " + kind;
      status.textContent = text;
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();

      // honeypot: bots fill it, humans never see it
      if (form.querySelector(".hp-field").value) return;

      // light validation with visible feedback
      var firstInvalid = null;
      ["name", "phone", "suburb"].forEach(function (n) {
        var input = form.querySelector("[name=" + n + "]");
        var ok = input.value.trim().length > 1;
        if (n === "phone") ok = /[\d+][\d\s+()-]{6,}/.test(input.value.trim());
        input.classList.toggle("invalid", !ok);
        if (!ok && !firstInvalid) firstInvalid = input;
      });
      if (firstInvalid) {
        firstInvalid.focus();
        showStatus("err", "Please fill in your name, phone and suburb so we can get back to you.");
        return;
      }

      var d = {
        name: form.querySelector("[name=name]").value.trim(),
        phone: form.querySelector("[name=phone]").value.trim(),
        suburb: form.querySelector("[name=suburb]").value.trim(),
        service: form.querySelector("[name=service]").value,
        metres: form.querySelector("[name=metres]").value.trim()
      };
      var msgField = form.querySelector("[name=message]");
      if (msgField) d.message = msgField.value.trim();

      button.disabled = true;
      var originalLabel = button.textContent;
      button.textContent = "Sending…";
      status.hidden = true;

      var controller = "AbortController" in window ? new AbortController() : null;
      var timer = controller && setTimeout(function () { controller.abort(); }, 10000);

      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        signal: controller ? controller.signal : undefined,
        body: JSON.stringify({
          name: d.name,
          phone: d.phone,
          suburb: d.suburb,
          service: d.service,
          "approx. metres": d.metres || "not sure",
          message: d.message || "",
          _subject: "Free quote request from " + (d.suburb || "Adelaide"),
          _template: "table",
          _captcha: "false"
        })
      }).then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res.ok) throw new Error("bad status");
        return res.json();
      }).then(function (json) {
        if (!json || String(json.success) !== "true") throw new Error("not accepted");
        form.querySelector(".form-fields").hidden = true;
        if (hint) hint.hidden = true;
        button.hidden = true;
        showStatus("ok", "Thanks " + d.name.split(" ")[0] + ", your request is in. We'll reply within 24 hours. Need it sooner? Call 0421 726 598.");
      }).catch(function () {
        if (timer) clearTimeout(timer);
        button.disabled = false;
        button.textContent = originalLabel;
        window.location.href = mailtoFallback(d);
      });
    });

    // clear error styling as the visitor types
    form.addEventListener("input", function (e) {
      if (e.target.classList && e.target.classList.contains("invalid")) {
        e.target.classList.remove("invalid");
      }
    });
  });
})();
