import registry from "./registry.json";
import { openRequest } from "./request-modal.js";
import "./style.css";

const games = registry.games.filter((g) => g.status !== "retired");
const ATTRACT_MS = 30000;
const SPLASH_KEY = "mh:splash";

const shelf = document.getElementById("shelf");
const title = document.getElementById("title");
const tagline = document.getElementById("tagline");
const play = document.getElementById("play");
const suggest = document.getElementById("suggest");
const press = document.getElementById("press");
const splash = document.getElementById("splash");
const arcade = document.getElementById("arcade");

let index = Math.max(
  0,
  games.findIndex((g) => g.status === "live")
);
let attract = false;
let attractTimer = 0;
let idleHandle = 0;
let lastPad = { x: 0, a: false };

function current() {
  return games[index];
}

function select(i, fromAttract) {
  if (i < 0 || i >= games.length) return;
  index = i;
  if (!fromAttract) stopAttract();
  render();
}

function render() {
  const g = current();
  for (const el of shelf.children) {
    const on = el.dataset.id === g.id;
    el.classList.toggle("on", on);
    el.setAttribute("aria-selected", String(on));
    if (on && !attract) el.focus({ preventScroll: true });
  }
  title.textContent = g.title;
  tagline.textContent = g.tagline;
  const live = g.status === "live";
  play.href = live ? g.playUrl : "#";
  play.classList.toggle("off", !live);
  play.setAttribute("aria-disabled", String(!live));
  suggest.disabled = !live;
  arcade.dataset.board = g.board;
  arcade.dataset.color = g.cart.color;
}

function cartEl(g, i) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `cart cart-${g.board}${g.status !== "live" ? " soon" : ""}`;
  b.dataset.id = g.id;
  b.role = "option";
  b.setAttribute("aria-label", g.title);
  b.style.setProperty("--cart", g.cart.color);
  b.innerHTML = `
    <span class="cart-ridge"></span>
    <span class="cart-body">
      <span class="cart-label">
        <span class="cart-sys">${g.board === "mvs" ? "MVS" : "64"}</span>
        <span class="cart-title">${g.title}</span>
      </span>
    </span>
    <span class="cart-edge"></span>
  `;
  b.addEventListener("click", () => select(i));
  b.addEventListener("dblclick", () => launch());
  return b;
}

function launch() {
  const g = current();
  if (g.status !== "live") return;
  stopAttract();
  window.location.href = g.playUrl;
}

function bumpIdle() {
  stopAttract();
  window.clearTimeout(idleHandle);
  idleHandle = window.setTimeout(startAttract, ATTRACT_MS);
}

function startAttract() {
  if (document.body.classList.contains("modal-open")) {
    bumpIdle();
    return;
  }
  attract = true;
  press.hidden = false;
  arcade.classList.add("attract");
  attractTimer = 0;
}

function stopAttract() {
  if (!attract) return;
  attract = false;
  press.hidden = true;
  arcade.classList.remove("attract");
}

function skipSplash() {
  if (splash.hidden) return;
  splash.hidden = true;
  splash.setAttribute("aria-hidden", "true");
  sessionStorage.setItem(SPLASH_KEY, "1");
  bumpIdle();
}

function showSplash() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || sessionStorage.getItem(SPLASH_KEY)) {
    splash.hidden = true;
    splash.setAttribute("aria-hidden", "true");
    bumpIdle();
    return;
  }
  splash.hidden = false;
  splash.addEventListener("pointerdown", skipSplash);
  splash.addEventListener("click", skipSplash);
}

function onKey(e) {
  if (splash && !splash.hidden) {
    e.preventDefault();
    skipSplash();
    return;
  }
  if (document.body.classList.contains("modal-open")) return;
  const k = e.key;
  if (k === "ArrowLeft" || k === "a" || k === "A") {
    e.preventDefault();
    select((index - 1 + games.length) % games.length);
  } else if (k === "ArrowRight" || k === "d" || k === "D") {
    e.preventDefault();
    select((index + 1) % games.length);
  } else if (k === "Enter" || k === " ") {
    e.preventDefault();
    launch();
  } else if (k === "s" || k === "S") {
    openRequest(current().id);
  }
  bumpIdle();
}

function pollPad() {
  const pad = navigator.getGamepads?.()[0];
  if (pad) {
    const x =
      pad.buttons[14]?.pressed ? -1 : pad.buttons[15]?.pressed ? 1 : Math.round(pad.axes[0] || 0);
    const a = pad.buttons[0]?.pressed;
    if (x !== lastPad.x && x) {
      select((index + x + games.length) % games.length);
      bumpIdle();
    }
    if (a && !lastPad.a) {
      if (splash && !splash.hidden) skipSplash();
      else launch();
      bumpIdle();
    }
    lastPad = { x, a };
  }
  if (attract) {
    attractTimer += 1;
    if (attractTimer % 90 === 0) select((index + 1) % games.length, true);
  }
  requestAnimationFrame(pollPad);
}

function boot() {
  shelf.replaceChildren(...games.map(cartEl));
  render();
  suggest.addEventListener("click", () => openRequest(current().id));
  play.addEventListener("click", (e) => {
    if (current().status !== "live") e.preventDefault();
    else bumpIdle();
  });
  window.addEventListener("keydown", onKey);
  window.addEventListener("pointerdown", bumpIdle);
  window.addEventListener("mousemove", bumpIdle, { passive: true });
  window.addEventListener("gamepadconnected", bumpIdle);
  const params = new URLSearchParams(location.search);
  const suggestId = params.get("suggest");
  showSplash();
  if (suggestId && games.some((g) => g.id === suggestId)) {
    skipSplash();
    const i = games.findIndex((g) => g.id === suggestId);
    if (i >= 0) select(i);
    openRequest(suggestId, params.get("preset") || undefined);
  }
  requestAnimationFrame(pollPad);
}

boot();
