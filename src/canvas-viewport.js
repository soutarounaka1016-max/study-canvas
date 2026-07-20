export const MIN_VIEW_SCALE = 1;
export const MAX_VIEW_SCALE = 4;

export class CanvasViewport {
  constructor(container, stage, options = {}) {
    if (!container || !stage) throw new TypeError("表示領域が見つかりません");
    this.container = container;
    this.stage = stage;
    this.minScale = options.minScale ?? MIN_VIEW_SCALE;
    this.maxScale = options.maxScale ?? MAX_VIEW_SCALE;
    this.onGestureStart = options.onGestureStart || (() => {});
    this.onGestureEnd = options.onGestureEnd || (() => {});
    this.pointers = new Map();
    this.scale = 1;
    this.x = 0;
    this.y = 0;
    this.gesture = null;
    this.apply();
  }

  pointerDown(event) {
    if (event.pointerType !== "touch") return false;
    this.pointers.set(event.pointerId, pointFromEvent(event));
    if (this.pointers.size < 2) return false;

    event.preventDefault();
    if (!this.gesture) {
      this.onGestureStart();
      this.container.classList.add("is-gesturing");
    }
    this.beginGesture();
    return true;
  }

  pointerMove(event) {
    if (event.pointerType !== "touch" || !this.pointers.has(event.pointerId)) return false;
    this.pointers.set(event.pointerId, pointFromEvent(event));
    if (!this.gesture || this.pointers.size < 2) return false;

    event.preventDefault();
    const [first, second] = firstTwo(this.pointers);
    const currentMidpoint = midpoint(first, second);
    const currentDistance = Math.max(1, distance(first, second));
    const nextScale = clamp(
      this.gesture.startScale * (currentDistance / this.gesture.startDistance),
      this.minScale,
      this.maxScale,
    );
    const rect = this.container.getBoundingClientRect();
    const midpointInContainer = {
      x: currentMidpoint.x - rect.left,
      y: currentMidpoint.y - rect.top,
    };
    this.scale = nextScale;
    this.x = midpointInContainer.x - this.gesture.anchor.x * nextScale;
    this.y = midpointInContainer.y - this.gesture.anchor.y * nextScale;
    this.clampPosition();
    this.apply();
    return true;
  }

  pointerEnd(event) {
    if (event.pointerType !== "touch" || !this.pointers.has(event.pointerId)) return false;
    const wasGesturing = Boolean(this.gesture);
    this.pointers.delete(event.pointerId);
    if (this.pointers.size >= 2) {
      this.beginGesture();
    } else if (wasGesturing) {
      this.gesture = null;
      this.container.classList.remove("is-gesturing");
      this.onGestureEnd();
    }
    if (wasGesturing) event.preventDefault();
    return wasGesturing;
  }

  reset() {
    this.scale = 1;
    this.x = 0;
    this.y = 0;
    this.pointers.clear();
    this.gesture = null;
    this.container.classList.remove("is-gesturing");
    this.apply();
  }

  beginGesture() {
    const [first, second] = firstTwo(this.pointers);
    const startMidpoint = midpoint(first, second);
    const rect = this.container.getBoundingClientRect();
    const localMidpoint = {
      x: startMidpoint.x - rect.left,
      y: startMidpoint.y - rect.top,
    };
    this.gesture = {
      startScale: this.scale,
      startDistance: Math.max(1, distance(first, second)),
      anchor: {
        x: (localMidpoint.x - this.x) / this.scale,
        y: (localMidpoint.y - this.y) / this.scale,
      },
    };
  }

  clampPosition() {
    const width = this.stage.offsetWidth || this.container.clientWidth;
    const height = this.stage.offsetHeight || this.container.clientHeight;
    const minimumX = Math.min(0, this.container.clientWidth - width * this.scale);
    const minimumY = Math.min(0, this.container.clientHeight - height * this.scale);
    this.x = clamp(this.x, minimumX, 0);
    this.y = clamp(this.y, minimumY, 0);
  }

  apply() {
    this.stage.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) scale(${this.scale})`;
    this.stage.dataset.viewScale = String(this.scale);
  }
}

export function calculateMonthGrid(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new TypeError("年月が正しくありません");
  }
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { firstWeekday, dayCount };
}

function firstTwo(pointers) {
  return [...pointers.values()].slice(0, 2);
}

function pointFromEvent(event) {
  return { x: event.clientX, y: event.clientY };
}

function midpoint(first, second) {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
