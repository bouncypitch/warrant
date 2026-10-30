const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wide = () => matchMedia("(min-width: 861px)").matches;

const seen = new IntersectionObserver((items) => {
  for (const item of items) if (item.isIntersecting) { item.target.classList.add("in"); seen.unobserve(item.target); }
}, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach((node) => seen.observe(node));

addEventListener("scroll", () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  document.getElementById("progress").style.transform = `scaleX(${max ? scrollY / max : 0})`;
  const road = document.getElementById("road").getBoundingClientRect();
  const part = (innerHeight * 0.75 - road.top) / road.height;
  document.getElementById("road").style.setProperty("--road", Math.max(0, Math.min(1, part)));
}, { passive: true });

const count = new IntersectionObserver((items) => {
  for (const item of items) {
    if (!item.isIntersecting) continue;
    count.unobserve(item.target);
    const node = item.target, end = Number(node.dataset.count), pre = node.dataset.prefix ?? "", post = node.dataset.suffix ?? "";
    if (still) { node.textContent = pre + end + post; continue; }
    const start = performance.now();
    const tick = (now) => {
      const part = Math.min(1, (now - start) / 1200);
      node.textContent = pre + Math.round(end * (1 - (1 - part) ** 3)) + post;
      if (part < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}, { threshold: 0.6 });
document.querySelectorAll("[data-count]").forEach((node) => count.observe(node));

const play = (video) => { if (!still) video.play().catch(() => {}); };
const auto = new IntersectionObserver((items) => {
  for (const item of items) item.isIntersecting ? play(item.target) : item.target.pause();
}, { threshold: 0.4 });
document.querySelectorAll("video[data-auto], .step video").forEach((video) => auto.observe(video));

const stageVideos = [...document.querySelectorAll("#stage video")];
const pick = (clip) => {
  for (const video of stageVideos) {
    const on = video.dataset.clip === clip;
    if (on && !video.classList.contains("on")) { video.currentTime = 0; play(video); }
    if (!on) video.pause();
    video.classList.toggle("on", on);
  }
};
const steps = [...document.querySelectorAll(".step")];
const active = new IntersectionObserver((items) => {
  for (const item of items) {
    if (!item.isIntersecting) continue;
    steps.forEach((step) => step.classList.toggle("on", step === item.target));
    if (wide()) pick(item.target.dataset.clip);
  }
}, { rootMargin: "-45% 0px -45% 0px" });
steps.forEach((step) => active.observe(step));
steps[0].classList.add("on");
stageVideos[0].classList.add("on");

const chat = [
  ["PL", "#e879f9", "Planner", "Builder", "Draft outreach using the verified evidence."],
  ["BD", "#a3e635", "Builder", "Reviewer", "Draft ready with 3 claims."],
  ["RV", "#f9a8d4", "Reviewer", "Builder", "1 claim had no source and was removed."],
  ["SC", "#fbbf24", "Security", "Reviewer", "Links came from the saved research."],
  ["RV", "#f9a8d4", "Reviewer", "Human", "Ready for human approval. Nothing sends without it."],
];
const room = document.getElementById("room");
for (const [mark, color, from, to, text] of chat) {
  const row = document.createElement("div");
  row.className = "msg";
  row.innerHTML = `<div class="av" style="background:${color}">${mark}</div><div><b>${from}</b><br><i>@${to}</i> ${text}</div>`;
  room.append(row);
}
const replay = new IntersectionObserver((items) => {
  if (!items[0].isIntersecting) return;
  replay.disconnect();
  [...room.children].forEach((row, index) => setTimeout(() => row.classList.add("in"), still ? 0 : 500 + index * 900));
}, { threshold: 0.3 });
replay.observe(room);

(async () => {
  const canvas = document.getElementById("globe");
  const ctx = canvas.getContext("2d");
  const [land, data] = await Promise.all([fetch("data/land.json").then((r) => r.json()), fetch("data/targets.json").then((r) => r.json())]);
  const world = topojson.feature(land, land.objects.land);
  const lines = d3.geoGraticule10();
  const names = Object.keys(data);
  const buttons = document.getElementById("acts");
  const ticker = document.getElementById("ticker");
  let act = 0, started = 0, user = false;
  const view = { lon: -60, lat: 20 };

  const choose = (index, byUser) => {
    act = index; started = performance.now(); user = user || byUser;
    [...buttons.children].forEach((button, at) => button.classList.toggle("on", at === index));
    ticker.textContent = "";
  };
  names.forEach((name, index) => {
    const button = document.createElement("button");
    button.textContent = `${name}: ${data[name].seller}`;
    button.onclick = () => choose(index, true);
    buttons.append(button);
  });
  choose(0, false);

  const draw = (now) => {
    const box = canvas.getBoundingClientRect(), ratio = devicePixelRatio || 1;
    if (canvas.width !== Math.round(box.width * ratio)) { canvas.width = Math.round(box.width * ratio); canvas.height = Math.round(box.height * ratio); }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, box.width, box.height);

    const targets = data[names[act]].targets;
    const focus = [targets.reduce((sum, t) => sum + t.lon, 0) / targets.length, targets.reduce((sum, t) => sum + t.lat, 0) / targets.length];
    const pull = still ? 1 : 0.04;
    view.lon += (focus[0] - view.lon) * pull;
    view.lat += (focus[1] - view.lat) * pull;
    const age = still ? 99 : (now - started) / 1000;

    const projection = d3.geoOrthographic().translate([box.width / 2, box.height / 2 - 24]).scale(Math.min(box.width, box.height) * 0.46).rotate([-view.lon, -view.lat]).clipAngle(90);
    const path = d3.geoPath(projection, ctx);
    ctx.beginPath(); path({ type: "Sphere" });
    const glow = ctx.createRadialGradient(box.width * 0.42, box.height * 0.32, 10, box.width / 2, box.height / 2, box.width * 0.6);
    glow.addColorStop(0, "#1b1b30"); glow.addColorStop(1, "#0b0b14");
    ctx.fillStyle = glow; ctx.fill();
    ctx.strokeStyle = "rgba(139,92,246,.5)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); path(lines); ctx.strokeStyle = "rgba(255,255,255,.05)"; ctx.stroke();
    ctx.beginPath(); path(world); ctx.fillStyle = "#26263f"; ctx.fill(); ctx.strokeStyle = "#3f3f62"; ctx.stroke();

    let passed = 0, refused = 0, latest = null;
    targets.forEach((target, index) => {
      const part = Math.min(1, Math.max(0, (age - 0.8 - index * 0.5) / 1.1));
      if (part <= 0) return;
      const point = [target.lon, target.lat];
      if (part < 1) {
        const eased = part * part * (3 - 2 * part), head = d3.geoInterpolate(focus, point)(eased);
        ctx.beginPath(); path({ type: "LineString", coordinates: [focus, head] });
        ctx.strokeStyle = "rgba(139,92,246,.8)"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
        const dot = projection(head);
        if (dot) { ctx.fillStyle = "#fff"; ctx.shadowColor = "#8b5cf6"; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(dot[0], dot[1], 3.5, 0, 6.3); ctx.fill(); ctx.shadowBlur = 0; }
        return;
      }
      latest = target; target.ok ? passed++ : refused++;
      const spot = projection(point);
      if (!spot) return;
      const color = target.ok ? "#34d399" : "#fb7185";
      ctx.fillStyle = color; ctx.globalAlpha = target.ok ? 1 : 0.6; ctx.shadowColor = color; ctx.shadowBlur = target.ok ? 18 : 0;
      ctx.beginPath(); ctx.arc(spot[0], spot[1], target.ok ? 6 : 4, 0, 6.3); ctx.fill();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    });
    if (latest) ticker.innerHTML = "";
    if (latest) { const b = document.createElement("b"); b.textContent = latest.n; ticker.append(b, ` · ${passed} passed, ${refused} refused`); }
    if (!still && !user && age > 11) choose((act + 1) % names.length, false);
    if (!still) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  addEventListener("resize", () => still && requestAnimationFrame(draw));
})();
