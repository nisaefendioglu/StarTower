import * as THREE from 'three';
import { rng, hash } from './random.js';
import { t } from './i18n.js';

function toTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Bir katın cephesi: pencere şeridi + ortada isim tabelası. */
export function facadeTexture(floor, maxCount) {
  const W = 1024, H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  const r = rng(hash(floor.id));

  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1d264e');
  g.addColorStop(1, '#141a38');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);

  // Daha çok repo yıldızlayanın katında daha çok ışık yanar
  const cols = 28, cw = W / cols;
  const litP = floor.lobby ? 0.35 : 0.45 + Math.min(0.5, (floor.count / (maxCount || 1)) * 0.5);
  for (let i = 0; i < cols; i++) {
    const on = r() < litP;
    x.fillStyle = on ? (r() < 0.85 ? '#ffc45c' : '#a9c8ff') : '#232c56';
    x.globalAlpha = on ? 0.6 + r() * 0.4 : 1;
    x.fillRect(i * cw + cw * 0.18, 18, cw * 0.64, H - 36);
  }
  x.globalAlpha = 1;

  const pw = 520, px = (W - pw) / 2;
  x.fillStyle = 'rgba(6,9,24,.92)';
  x.fillRect(px, 22, pw, H - 44);
  x.strokeStyle = floor.isTop ? '#ff5f6d' : 'rgba(255,196,92,.6)';
  x.lineWidth = 3;
  x.strokeRect(px + 1.5, 23.5, pw - 3, H - 47);

  x.textBaseline = 'middle';
  x.fillStyle = '#ffc45c';
  x.font = '500 30px "IBM Plex Mono", monospace';
  x.fillText(floor.lobby ? 'L' : String(floor.rank).padStart(2, '0'), px + 18, H / 2 + 1);
  const count = floor.lobby ? t('signPeople', { n: floor.people }) : `★${floor.count}`;
  const cwid = x.measureText(count).width;
  x.fillText(count, px + pw - 18 - cwid, H / 2 + 1);

  const avail = pw - 18 - 60 - cwid - 36;
  let size = 40;
  x.fillStyle = '#eaedf9';
  do {
    x.font = `800 ${size}px "Bricolage Grotesque", sans-serif`;
    size -= 2;
  } while (x.measureText(floor.label).width > avail && size > 16);
  let label = floor.label;
  while (x.measureText(label).width > avail && label.length > 3) label = label.slice(0, -2) + '…';
  x.fillText(label, px + 80, H / 2 + 2);

  return toTexture(c);
}

/** Çevredeki binalar için basit pencere dokusu. */
export function windowTexture(seed, cols, rows, litP) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const x = c.getContext('2d');
  const r = rng(seed);
  x.fillStyle = '#121833';
  x.fillRect(0, 0, 128, 256);
  const cw = 128 / cols, rh = 256 / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const on = r() < litP;
      x.fillStyle = on ? (r() < 0.8 ? '#ffc45c' : '#9fc4ff') : '#1c2448';
      x.globalAlpha = on ? 0.55 + r() * 0.45 : 1;
      x.fillRect(i * cw + cw * 0.25, j * rh + rh * 0.22, cw * 0.5, rh * 0.5);
    }
  }
  x.globalAlpha = 1;
  return toTexture(c);
}

/** Repo binasının cephesi: her sıra bir kat. Taranmamış katlar sönük. */
export function repoFacadeTexture(seed, floors, litFloors) {
  const rows = Math.max(1, floors);
  const px = 18; // kat başına piksel
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = Math.min(1024, rows * px);
  const rh = c.height / rows;
  const x = c.getContext('2d');
  const r = rng(seed);
  x.fillStyle = '#151c3d';
  x.fillRect(0, 0, c.width, c.height);
  const cols = 5, cw = c.width / cols;
  for (let j = 0; j < rows; j++) {
    const lit = j >= rows - litFloors; // canvas yukarıdan aşağı: üst sıralar üst katlar
    // kat çizgisi
    x.fillStyle = '#29336a';
    x.fillRect(0, j * rh, c.width, Math.max(1, rh * 0.08));
    for (let i = 0; i < cols; i++) {
      const on = lit ? r() < 0.82 : r() < 0.08;
      x.fillStyle = on ? (r() < 0.85 ? '#ffc45c' : '#a9c8ff') : '#1f2850';
      x.globalAlpha = on ? 0.65 + r() * 0.35 : 1;
      x.fillRect(i * cw + cw * 0.2, j * rh + rh * 0.24, cw * 0.6, rh * 0.56);
    }
    x.globalAlpha = 1;
  }
  return toTexture(c);
}

/** Bina tepesindeki repo adı tabelası. */
export function signTexture(name, stars) {
  const W = 512, H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(6,9,24,.88)';
  x.beginPath();
  x.roundRect(4, 4, W - 8, H - 8, 18);
  x.fill();
  x.strokeStyle = 'rgba(255,196,92,.55)';
  x.lineWidth = 3;
  x.stroke();
  x.textBaseline = 'middle';
  const count = `★${stars}`;
  x.font = '500 36px "IBM Plex Mono", monospace';
  const cw = x.measureText(count).width;
  x.fillStyle = '#ffc45c';
  x.fillText(count, W - 28 - cw, H / 2 + 2);
  const avail = W - 28 - cw - 28 - 24;
  let size = 46;
  do {
    x.font = `800 ${size}px "Bricolage Grotesque", sans-serif`;
    size -= 2;
  } while (x.measureText(name).width > avail && size > 22);
  let label = name;
  while (x.measureText(label).width > avail && label.length > 3) label = label.slice(0, -2) + '…';
  x.fillStyle = '#eaedf9';
  x.fillText(label, 28, H / 2 + 3);
  return toTexture(c);
}
