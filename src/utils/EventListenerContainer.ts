export default class EventListenerContainer {
  private _removers: Set<() => void>;

  constructor() {
    this._removers = new Set();
  }

  get removers() {
    return Array.from(this._removers);
  }

  add<
    T extends HTMLElement | Window | Document,
    K extends T extends HTMLElement
      ? keyof HTMLElementEventMap
      : T extends Window
      ? keyof WindowEventMap
      : T extends Document
      ? keyof DocumentEventMap
      : unknown
  >(
    target: T,
    type: K,
    listener: (
      e: K extends keyof HTMLElementEventMap
        ? HTMLElementEventMap[K]
        : K extends keyof WindowEventMap
        ? WindowEventMap[K]
        : K extends keyof DocumentEventMap
        ? DocumentEventMap[K]
        : unknown
    ) => void,
    options?: boolean | AddEventListenerOptions
  ) {
    target.addEventListener(type, listener as EventListener, options);

    document.createElement("div").addEventListener;
    const _options: boolean | EventListenerOptions | undefined =
      typeof options === "object" ? { capture: options.capture } : options;

    const remover = () => {
      target.removeEventListener(type, listener as EventListener, _options);
      this._removers.delete(remover);
    };

    this._removers.add(remover);
  }

  removeAll() {
    this._removers.forEach((remover) => {
      remover();
    });
    this._removers.clear();
  }
}
