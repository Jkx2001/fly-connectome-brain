import { random } from './random.js';
import { DT } from './brain.js';

export const HALF = 5;
export const FLY_RADIUS = 0.16;
export const DEFAULT_WALLS = [{ id: 1, x: -1.5, z: 0.2, width: 0.24, depth: 2 }, { id: 2, x: 1.4, z: -1.1, width: 1.6, depth: 0.24 }];
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class World {
  constructor(seed = 42) { this.reset(seed); }
  reset(seed = 42) {
    const rng = random(seed);
    this.seed = seed; this.time = 0; this.distance = 0; this.eaten = 0;
    this.fly = { x: -0.8, z: 1.8, heading: rng() * Math.PI * 2, speed: 0 };
    this.food = [{ id: 1, x: 2.4, z: 1.1, amount: 1 }, { id: 2, x: -2.5, z: -2.3, amount: 1 }];
    this.walls = DEFAULT_WALLS.map(w => ({ ...w })); this.nextId = 3;
    this.light = 0.25; this.touchTime = 0; this.path = []; this.sensors = {};
  }
  odorAt(x, z) {
    let concentration = 0;
    for (const f of this.food) concentration += f.amount * Math.exp(-Math.hypot(x - f.x, z - f.z) / 1.8);
    return clamp(concentration, 0, 1);
  }
  blocked(x, z, radius = FLY_RADIUS) {
    return Math.abs(x) > HALF - radius || Math.abs(z) > HALF - radius || this.walls.some(w => Math.abs(x - w.x) < w.width / 2 + radius && Math.abs(z - w.z) < w.depth / 2 + radius);
  }
  sense() {
    const { x, z, heading: h } = this.fly;
    const left = { x: x + Math.cos(h - 0.7) * 0.35, z: z + Math.sin(h - 0.7) * 0.35 };
    const right = { x: x + Math.cos(h + 0.7) * 0.35, z: z + Math.sin(h + 0.7) * 0.35 };
    this.sensors = {
      odorLeft: this.odorAt(left.x, left.z), odorRight: this.odorAt(right.x, right.z),
      visionLeft: this.light, visionRight: this.light,
      touchLeft: this.touchTime > 0 || this.blocked(left.x, left.z) ? 0.85 : 0,
      touchRight: this.touchTime > 0 || this.blocked(right.x, right.z) ? 0.85 : 0,
      taste: this.food.some(f => Math.hypot(x - f.x, z - f.z) < 0.36) ? 0.9 : 0,
    };
    return this.sensors;
  }
  step(motor) {
    // The decoder receives ONLY descending activity. No food position,
    // odor gradient, navigation target, or behavior state enters it.
    const { speed, turn } = decodeMotor(motor);
    const f = this.fly;
    f.heading = (f.heading + turn * DT) % (2 * Math.PI);
    const nx = f.x + Math.cos(f.heading) * speed * DT, nz = f.z + Math.sin(f.heading) * speed * DT;
    const oldX = f.x, oldZ = f.z;
    // Collision resolution is physical constraint, never an avoidance turn.
    if (!this.blocked(nx, f.z)) f.x = nx;
    if (!this.blocked(f.x, nz)) f.z = nz;
    f.speed = Math.hypot(f.x - oldX, f.z - oldZ) / DT;
    this.distance += f.speed * DT;
    for (const food of this.food) {
      if (Math.hypot(f.x - food.x, f.z - food.z) < 0.36) {
        const bite = Math.min(food.amount, DT * 0.12);
        food.amount -= bite; this.eaten += bite;
      }
    }
    this.food = this.food.filter(f => f.amount > 0.001);
    this.time += DT; this.touchTime = Math.max(0, this.touchTime - DT);
    if (Math.round(this.time / DT) % 10 === 0) { this.path.push([f.x, f.z]); if (this.path.length > 600) this.path.shift(); }
  }
  command(action) {
    if (action.type === 'food') {
      if (this.food.length >= 16 || this.blocked(action.x, action.z, 0.3)) return false;
      this.food.push({ id: this.nextId++, x: action.x, z: action.z, amount: 1 });
    } else if (action.type === 'wall') {
      if (this.walls.length >= 12) return false;
      const wall = { id: this.nextId++, x: clamp(action.x, -4, 4), z: clamp(action.z, -4, 4), width: 1.4, depth: 0.24 };
      if (Math.abs(this.fly.x - wall.x) < wall.width / 2 + FLY_RADIUS && Math.abs(this.fly.z - wall.z) < wall.depth / 2 + FLY_RADIUS) return false;
      this.walls.push(wall);
    } else if (action.type === 'moveWall') {
      const wall = this.walls.find(w => w.id === action.id); if (!wall) return false;
      const nx = clamp(action.x, -HALF + wall.width / 2, HALF - wall.width / 2), nz = clamp(action.z, -HALF + wall.depth / 2, HALF - wall.depth / 2);
      if (Math.abs(this.fly.x - nx) < wall.width / 2 + FLY_RADIUS && Math.abs(this.fly.z - nz) < wall.depth / 2 + FLY_RADIUS) return false;
      wall.x = nx; wall.z = nz;
    } else if (action.type === 'touch') this.touchTime = 0.4;
    else if (action.type === 'light') this.light = clamp(action.value, 0, 1);
    else if (action.type === 'clear') this.food = [];
    else return false;
    return true;
  }
  snapshot() {
    return { fly: { ...this.fly }, food: this.food.map(f => ({ ...f })), walls: this.walls.map(w => ({ ...w })), time: this.time, distance: this.distance, eaten: this.eaten, light: this.light, sensors: { ...this.sensors }, path: this.path.map(p => [...p]), seed: this.seed };
  }
}

export function decodeMotor({ left, right, forward }) {
  return { speed: clamp(forward === undefined ? (left + right) / 0.24 : forward, 0, 1) * 0.9, turn: clamp((right - left) / 0.08, -1, 1) * 2.5 };
}
