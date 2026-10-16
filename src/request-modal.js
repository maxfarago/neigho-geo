import registry from "./registry.json";
import boxIcon from "pixelarticons/svg/box.svg?raw";
import gamepadIcon from "pixelarticons/svg/gamepad.svg?raw";
import imageIcon from "pixelarticons/svg/image.svg?raw";
import musicIcon from "pixelarticons/svg/music.svg?raw";
import bugIcon from "pixelarticons/svg/bug.svg?raw";
import moreIcon from "pixelarticons/svg/more-horizontal.svg?raw";

const MIN = 20;
const MAX = 800;

const ICONS = {
  prop: boxIcon,
  gameplay: gamepadIcon,
  visuals: imageIcon,
  sound: musicIcon,
  bug: bugIcon,
  other: moreIcon,
};

function presetPlaceholder(preset) {
  const description = preset.description?.replace(/[.!?]+$/, "");
  return [description && `${description}.`, preset.placeholder && `Ex: ${preset.placeholder}`]
    .filter(Boolean).join(" ");
}

export function openRequest(gameId, presetId) {
  const el = document.querySelector("mh-request-modal");
  if (el) el.open(gameId, presetId);
}

window.openRequest = openRequest;

class MhRequestModal extends HTMLElement {
  #game = null;
  #preset = null;
  #busy = false;

  connectedCallback() {
    this.innerHTML = `
      <dialog class="mh-dialog" aria-labelledby="mh-request-title">
        <form method="dialog" class="mh-form">
          <header>
            <figure class="mh-game">
              <img class="mh-game-image" alt="" width="80" height="80">
            </figure>
            <div class="mh-heading">
              <h2 id="mh-request-title">ADD FEATURE</h2>
              <p class="mh-game-name"></p>
            </div>
            <button type="button" class="mh-x" aria-label="Close">×</button>
          </header>
          <div class="mh-chips" role="listbox" aria-label="Preset"></div>
          <label class="mh-label">
            <span>Describe it</span>
            <textarea name="body" rows="5" maxlength="${MAX}"></textarea>
          </label>
          <p class="mh-status" hidden></p>
          <button type="button" class="mh-send" disabled>SUBMIT</button>
        </form>
      </dialog>
    `;
    this.dialog = this.querySelector("dialog");
    this.gameImage = this.querySelector(".mh-game-image");
    this.gameName = this.querySelector(".mh-game-name");
    this.chips = this.querySelector(".mh-chips");
    this.textarea = this.querySelector("textarea");
    this.status = this.querySelector(".mh-status");
    this.send = this.querySelector(".mh-send");
    this.textarea.addEventListener("input", () => this.#updateSubmitState());
    this.send.addEventListener("click", () => this.#submit());
    this.querySelector(".mh-x").addEventListener("click", () => this.dialog.close());
    this.dialog.addEventListener("close", () => {
      document.body.classList.remove("modal-open");
    });
  }

  open(gameId, presetId) {
    const game = registry.games.find((g) => g.id === gameId);
    if (!game) return;
    this.#game = game;
    this.#busy = false;
    this.gameImage.src = game.still;
    this.gameName.textContent = game.title;
    this.#preset = game.presets.find((p) => p.id === presetId) || game.presets[0];
    this.#renderChips();
    this.textarea.value = "";
    this.textarea.placeholder = presetPlaceholder(this.#preset);
    this.textarea.disabled = false;
    this.send.hidden = false;
    this.#setStatus("");
    this.#updateSubmitState();
    document.body.classList.add("modal-open");
    this.dialog.showModal();
    this.textarea.focus();
  }

  #renderChips() {
    this.chips.replaceChildren(
      ...this.#game.presets.map((p) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "mh-chip" + (p.id === this.#preset.id ? " on" : "");
        b.setAttribute("role", "option");
        b.setAttribute("aria-selected", String(p.id === this.#preset.id));
        b.dataset.id = p.id;
        b.disabled = this.#busy;
        b.innerHTML = `<span class="mh-chip-icon" aria-hidden="true">${ICONS[p.id] || ICONS.other}</span><span>${p.label}</span>`;
        b.querySelector("svg").setAttribute("focusable", "false");
        b.addEventListener("click", () => {
          this.#preset = p;
          this.textarea.placeholder = presetPlaceholder(p);
          for (const chip of this.chips.children) {
            const selected = chip.dataset.id === p.id;
            chip.classList.toggle("on", selected);
            chip.setAttribute("aria-selected", String(selected));
          }
        });
        return b;
      })
    );
  }

  #updateSubmitState() {
    const n = this.textarea.value.trim().length;
    this.send.disabled = this.#busy || n < MIN;
  }

  #setStatus(text, kind = "") {
    this.status.hidden = !text;
    this.status.textContent = text;
    this.status.className = "mh-status" + (kind ? ` ${kind}` : "");
  }

  async #submit() {
    const body = this.textarea.value.trim();
    if (this.#busy || body.length < MIN || body.length > MAX) return;
    this.#busy = true;
    this.send.disabled = true;
    this.textarea.disabled = true;
    this.#renderChips();
    this.#setStatus("");
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: this.#game.id,
          presetId: this.#preset.id,
          body,
          credit: false,
        }),
      });
      if (res.status === 429) {
        this.#fail("slow down. three ideas a day.");
        return;
      }
      if (!res.ok) {
        this.#fail("couldn't send. try again.");
        return;
      }
      this.send.hidden = true;
      this.#setStatus("got it. the stable has it.", "ok");
      const { id } = await res.json();
      await this.#watch(id);
    } catch {
      this.#fail("couldn't send. try again.");
    }
  }

  async #watch(id) {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const s = await fetch(`/api/requests/${id}`).then((r) => r.json());
        if (s.status === "declined") {
          this.#setStatus(s.decline_reason || "the stable passed on this one.", "err");
          return;
        }
        if (s.status === "error") {
          this.#setStatus("the stable hit a snag. it's logged.", "err");
          return;
        }
        if (s.status === "needs_review") return;
      } catch {
        /* keep waiting */
      }
    }
  }

  #fail(msg) {
    this.#busy = false;
    this.textarea.disabled = false;
    this.#renderChips();
    this.#updateSubmitState();
    this.#setStatus(msg, "err");
  }
}

if (!customElements.get("mh-request-modal")) {
  customElements.define("mh-request-modal", MhRequestModal);
}
