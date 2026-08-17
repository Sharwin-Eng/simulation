/**
 * ANTIGRAVITY — Seeded Pseudo-Random Number Generator
 * 
 * Uses the Mulberry32 algorithm for deterministic random number generation.
 * Given the same seed, the sequence of random numbers is identical,
 * ensuring simulation reproducibility.
 * 
 * Mathematical basis: Mulberry32 is a 32-bit state PRNG with a period of 2^32.
 * It passes the gjrand testing suite and is suitable for simulation use
 * where cryptographic security is not required.
 */

export class SeededRandom {
  /**
   * @param {number} seed - Initial seed value (integer)
   */
  constructor(seed = 42) {
    this._initialSeed = seed;
    this._state = seed | 0; // Ensure integer
  }

  /**
   * Returns the next pseudo-random number in [0, 1).
   * Advances internal state.
   * @returns {number}
   */
  next() {
    let t = (this._state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a random integer in [min, max] (inclusive).
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Returns a random float in [min, max).
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  nextFloat(min, max) {
    return this.next() * (max - min) + min;
  }

  /**
   * Returns true with the given probability.
   * @param {number} probability - Value in [0, 1]
   * @returns {boolean}
   */
  chance(probability) {
    return this.next() < probability;
  }

  /**
   * Resets the generator to its initial seed.
   */
  reset() {
    this._state = this._initialSeed | 0;
  }

  /**
   * Returns the initial seed.
   * @returns {number}
   */
  get seed() {
    return this._initialSeed;
  }
}
