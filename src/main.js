import registry from "./registry.json";
import { openRequest } from "./request-modal.js";
import "./style.css";

const games = registry.games.filter((g) => g.status !== "retired");
const grid = document.getElementById("grid");

let selected = null;

function select(id) {
  selected = id;
  for (const el of grid.children) {
    const on = el.dataset.id === id;
    el.classList.toggle("on", on);
    el.setAttribute("aria-selected", String(on));
  }
}

function bindPress(el) {
  const on = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    el.classList.add("is-down");
  };
  const off = () => el.classList.remove("is-down");
  el.addEventListener("pointerdown", on);
  el.addEventListener("pointerup", off);
  el.addEventListener("pointercancel", off);
  el.addEventListener("pointerleave", off);
}

function tileEl(g) {
  const el = document.createElement("article");
  el.className = "tile" + (g.status !== "live" ? " soon" : "");
  el.dataset.id = g.id;
  el.setAttribute("aria-selected", "false");
  el.innerHTML = `
    <button type="button" class="shot" aria-label="${g.title}">
      <img src="${g.still}" alt="${g.title}" width="1200" height="1200">
    </button>
    <div class="cover">
      <h2>${g.title}</h2>
      <p>${g.tagline}</p>
      <div class="actions">
        <a class="play" href="${g.status === "live" ? g.playUrl : "#"}">PLAY</a>
        <button type="button" class="suggest">SUGGEST</button>
      </div>
    </div>
  `;
  el.querySelector(".shot").addEventListener("click", () => select(g.id));
  el.querySelector(".suggest").addEventListener("click", (e) => {
    e.stopPropagation();
    if (g.status === "live") openRequest(g.id);
  });
  const play = el.querySelector(".play");
  bindPress(play);
  bindPress(el.querySelector(".suggest"));
  if (g.status !== "live") {
    play.setAttribute("aria-disabled", "true");
    play.addEventListener("click", (e) => e.preventDefault());
  }
  return el;
}

function onKey(e) {
  if (document.body.classList.contains("modal-open")) return;
  const ids = games.map((g) => g.id);
  const i = selected ? ids.indexOf(selected) : -1;
  if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "a" || e.key === "A") {
    e.preventDefault();
    select(ids[(i - 1 + ids.length) % ids.length]);
  } else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "d" || e.key === "D") {
    e.preventDefault();
    select(ids[(i + 1) % ids.length]);
  } else if ((e.key === "Enter" || e.key === " ") && selected) {
    const g = games.find((x) => x.id === selected);
    if (g?.status === "live") {
      e.preventDefault();
      window.location.href = g.playUrl;
    }
  } else if ((e.key === "s" || e.key === "S") && selected) {
    openRequest(selected);
  }
}

function boot() {
  grid.replaceChildren(...games.map(tileEl));
  window.addEventListener("keydown", onKey);
  const params = new URLSearchParams(location.search);
  const suggestId = params.get("suggest");
  if (suggestId && games.some((g) => g.id === suggestId)) {
    select(suggestId);
    openRequest(suggestId, params.get("preset") || undefined);
  }
}

boot();
