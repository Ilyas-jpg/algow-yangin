import type { Map as MlMap } from "maplibre-gl";
import type { WindGrid } from "@/lib/types";
import { sampleUV } from "@/lib/wind";
import { metersPerPixel } from "@/lib/geo";

/**
 * Windy hissi veren hafif partikül katmanı.
 * Harita üstünde bağımsız canvas; ekran uzayında advection + iz soldurma.
 * Veri kodlaması değil atmosfer hissi — UI chrome'a glow sızdırmaz.
 */
export class WindParticleLayer {
  private map: MlMap;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private grid: WindGrid | null = null;
  private raf = 0;
  private xs = new Float32Array(0);
  private ys = new Float32Array(0);
  private life = new Int16Array(0);
  private running = false;
  private needClear = false;
  private dpr = 1;
  private w = 0;
  private h = 0;

  constructor(map: MlMap, container: HTMLElement) {
    this.map = map;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "wind-canvas";
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;
    this.onResize();
    map.on("move", this.onMove);
    map.on("resize", this.onResize);
  }

  setGrid(g: WindGrid | null) {
    this.grid = g;
  }

  setEnabled(on: boolean) {
    if (on && this.grid && !this.running) {
      this.running = true;
      this.reseed();
      this.raf = requestAnimationFrame(this.frame);
    } else if (!on && this.running) {
      this.running = false;
      cancelAnimationFrame(this.raf);
      this.ctx.clearRect(0, 0, this.w, this.h);
    }
  }

  destroy() {
    this.setEnabled(false);
    this.map.off("move", this.onMove);
    this.map.off("resize", this.onResize);
    this.canvas.remove();
  }

  private onMove = () => {
    this.needClear = true;
  };

  private onResize = () => {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = parent.clientWidth;
    this.h = parent.clientHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.running) this.reseed();
  };

  private reseed() {
    const isSmall = this.w < 700;
    const target = Math.max(
      180,
      Math.min(isSmall ? 400 : 850, Math.round((this.w * this.h) / 5200))
    );
    this.xs = new Float32Array(target);
    this.ys = new Float32Array(target);
    this.life = new Int16Array(target);
    for (let i = 0; i < target; i++) this.spawn(i);
  }

  private spawn(i: number) {
    this.xs[i] = Math.random() * this.w;
    this.ys[i] = Math.random() * this.h;
    this.life[i] = 40 + Math.floor(Math.random() * 110);
  }

  private frame = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const { ctx, grid, map } = this;
    if (!grid) return;

    if (this.needClear) {
      ctx.clearRect(0, 0, this.w, this.h);
      this.needClear = false;
    }

    // izleri soldur — kısa iz, harita okunurluğunu bastırmasın
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = "rgba(0,0,0,0.88)";
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = "source-over";

    const zoom = map.getZoom();
    ctx.strokeStyle = "rgba(150,170,205,0.26)";
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let i = 0; i < this.xs.length; i++) {
      if (--this.life[i] <= 0) {
        this.spawn(i);
        continue;
      }
      if (this.life[i] % 2 === 0) continue; // kareyi atla: daha yavaş, sakin akış
      const x = this.xs[i];
      const y = this.ys[i];
      const ll = map.unproject([x, y]);
      const uv = sampleUV(grid, ll.lng, ll.lat);
      if (!uv || (Math.abs(uv.u) < 0.05 && Math.abs(uv.v) < 0.05)) {
        this.spawn(i);
        continue;
      }
      const mpp = metersPerPixel(ll.lat, zoom);
      const scale = 170 / mpp; // zaman abartısı: 1 kare ≈ 170 sn rüzgar
      let dx = uv.u * scale;
      let dy = -uv.v * scale; // ekran y aşağı
      const len = Math.hypot(dx, dy);
      const MAX = 3.2;
      if (len > MAX) {
        dx = (dx / len) * MAX;
        dy = (dy / len) * MAX;
      }
      const nx = x + dx;
      const ny = y + dy;
      if (nx < -10 || ny < -10 || nx > this.w + 10 || ny > this.h + 10) {
        this.spawn(i);
        continue;
      }
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      this.xs[i] = nx;
      this.ys[i] = ny;
    }
    ctx.stroke();
  };
}
