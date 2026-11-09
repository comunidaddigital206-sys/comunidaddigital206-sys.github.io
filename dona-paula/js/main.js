(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = () => innerWidth < 768;

  /* --- botones de muestra: muestran cómo llega el mensaje --- */
  const d = $("#d"), burbuja = $("#burbuja");
  const mostrar = (msg) => { burbuja.textContent = msg; d.showModal(); };
  $$(".demo").forEach((b) => b.addEventListener("click", () => mostrar(b.dataset.msg)));

  /* --- armá tu pedido --- */
  $("#enviarLista").addEventListener("click", () => {
    const items = $$("#lista input:checked").map((i) => "• " + i.value);
    const det = $("#detalle").value.trim();
    let msg = "Hola! Quería pedir presupuesto de:";
    msg += items.length ? "\n" + items.join("\n") : "\n• (todavía no marqué nada)";
    if (det) msg += "\n\n" + det;
    mostrar(msg);
  });

  /* --- WhatsApp flotante después de la portada --- */
  const fw = $(".float-wa");
  let tick = false;
  addEventListener("scroll", () => {
    if (tick) return; tick = true;
    requestAnimationFrame(() => { fw.classList.toggle("on", scrollY > innerHeight * 0.7); tick = false; });
  }, { passive: true });

  /* --- animaciones de scroll --- */
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1));
  idle(initMotion, { timeout: 900 });

  function splitWords(el) {
    const out = [];
    (function w(n) {
      [...n.childNodes].forEach((c) => {
        if (c.nodeType === 3) {
          const f = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach((t) => {
            if (!t) return;
            if (/^\s+$/.test(t)) { f.appendChild(document.createTextNode(" ")); return; }
            const o = document.createElement("span"); o.className = "sw";
            const i = document.createElement("span"); i.textContent = t;
            o.appendChild(i); f.appendChild(o); out.push(i);
          });
          c.replaceWith(f);
        } else if (c.nodeType === 1) w(c);
      });
    })(el);
    return out;
  }

  function initMotion() {
    if (RM || !window.gsap) return;
    gsap.registerPlugin(ScrollTrigger);

    if (window.Lenis && !isMobile()) {
      const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
      $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => { const t = $(a.getAttribute("href")); if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: -70 }); } }));
    }

    // portada: el fondo baja más lento que el texto
    gsap.to(".hero-bg", { yPercent: 18, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    gsap.to(".hero-in", { yPercent: -14, opacity: 0.25, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

    // títulos palabra por palabra
    $$(".split").forEach((el) => {
      const words = splitWords(el);
      gsap.from(words, { yPercent: 115, rotate: 4, duration: 1.05, ease: "expo.out", stagger: 0.05, scrollTrigger: { trigger: el, start: "top 86%" } });
    });

    // aparición genérica
    ScrollTrigger.batch(".rv", { start: "top 90%", once: true, onEnter: (b) => gsap.from(b, { autoAlpha: 0, y: 40, duration: 1, ease: "expo.out", stagger: 0.08 }) });

    // cinta que acelera con el scroll
    const track = $("[data-marquee]");
    track.innerHTML += track.innerHTML;
    const tw = gsap.fromTo(track, { xPercent: 0 }, { xPercent: -50, duration: 24, ease: "none", repeat: -1 });
    ScrollTrigger.create({ onUpdate: (s) => { const v = Math.min(Math.abs(s.getVelocity()) / 400, 5); gsap.to(tw, { timeScale: 1 + v, duration: 0.2, overwrite: true }); gsap.to(tw, { timeScale: 1, duration: 1.2, delay: 0.2 }); } });

    // foto de entregas que se revela
    const fr = $(".foto-rev"), fimg = $(".foto-rev img");
    if (isMobile()) {
      gsap.from(fr, { autoAlpha: 0, y: 50, scale: 0.95, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: fr, start: "top 85%", once: true } });
    } else {
      const st = { trigger: fr, start: "top 85%", end: "top 30%", scrub: 0.8 };
      gsap.fromTo(fr, { clipPath: "inset(14% 10% 14% 10% round 22px)" }, { clipPath: "inset(0% 0% 0% 0% round 22px)", ease: "none", scrollTrigger: st });
      gsap.fromTo(fimg, { scale: 1.3 }, { scale: 1, ease: "none", scrollTrigger: st });
    }

    // línea de los pasos que crece
    const mm = gsap.matchMedia();
    mm.add({ d: "(min-width:900px)", m: "(max-width:899px)" }, (ctx) => {
      const prop = ctx.conditions.d ? "scaleX" : "scaleY";
      gsap.fromTo(".linea i", { [prop]: 0 }, { [prop]: 1, ease: "none", scrollTrigger: { trigger: "#pasos", start: "top 80%", end: "bottom 60%", scrub: true } });
    });
    gsap.from("#pasos li", { autoAlpha: 0, y: 30, duration: 1, ease: "expo.out", stagger: 0.15, scrollTrigger: { trigger: "#pasos", start: "top 85%" } });

    // las tarjetas de rubros entran escalonadas
    gsap.from(".card", { autoAlpha: 0, y: 40, duration: 1, ease: "expo.out", stagger: 0.07, scrollTrigger: { trigger: ".cards", start: "top 85%" } });
  }
})();
