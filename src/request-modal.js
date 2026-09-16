import registry from "./registry.json";

const MIN = 20;
const MAX = 800;

export function openRequest(gameId, presetId) {
  const el = document.querySelector("mh-request-modal");
  if (el) el.open(gameId, presetId);
}

window.openRequest = openRequest;

class MhRequestModal extends HTMLElement {
  #game = null;
  #preset = null;

  connectedCallback() {
    this.innerHTML = `
      <dialog class="mh-dialog">
        <form method="dialog" class="mh-form">
          <header>
            <p class="mh-kicker"></p>
            <h2>Suggest</h2>
            <button type="button" class="mh-x" aria-label="Close">×</button>
          </header>
          <div class="mh-chips" role="listbox" aria-label="Preset"></div>
          <label class="mh-label">
            <span>What should we add</span>
            <textarea name="body" rows="5" maxlength="${MAX}"></textarea>
            <span class="mh-count">0 / ${MAX}</span>
          </label>
          <label class="mh-credit">
            <input type="checkbox" name="credit" checked>
            Credit me publicly if this ships
          </label>
          <p class="mh-soon">the stable isn't taking requests yet.</p>
          <button type="button" class="mh-send" disabled>Submit</button>
        </form>
      </dialog>
    `;
    this.dialog = this.querySelector("dialog");
    this.kicker = this.querySelector(".mh-kicker");
    this.chips = this.querySelector(".mh-chips");
    this.textarea = this.querySelector("textarea");
    this.count = this.querySelector(".mh-count");
    this.textarea.addEventListener("input", () => this.#count());
    this.querySelector(".mh-x").addEventListener("click", () => this.dialog.close());
    this.dialog.addEventListener("close", () => {
      document.body.classList.remove("modal-open");
    });
  }

  open(gameId, presetId) {
    const game = registry.games.find((g) => g.id === gameId);
    if (!game) return;
    this.#game = game;
    this.kicker.textContent = game.title;
    this.#preset = game.presets.find((p) => p.id === presetId) || game.presets[0];
    this.#renderChips();
    this.textarea.value = "";
    this.textarea.placeholder = this.#preset.placeholder || "";
    this.#count();
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
        b.innerHTML = `<b>${p.label}</b><span>${p.description}</span>`;
        b.addEventListener("click", () => {
          this.#preset = p;
          this.textarea.placeholder = p.placeholder || "";
          this.#renderChips();
        });
        return b;
      })
    );
  }

  #count() {
    const n = this.textarea.value.trim().length;
    this.count.textContent = `${n} / ${MAX}`;
    this.count.classList.toggle("short", n > 0 && n < MIN);
  }
}

if (!customElements.get("mh-request-modal")) {
  customElements.define("mh-request-modal", MhRequestModal);
}
