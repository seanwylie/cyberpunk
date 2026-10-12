// Indirection so ui.ts can host the City news modal without statically importing the lazy src/cityui.ts module.
export const CITYUI: { html: (ui: any) => string; click: (ui: any, el: HTMLElement, a: string) => boolean } = {
  html: () => '<div class="mut">Loading…</div>', click: () => false,
};
