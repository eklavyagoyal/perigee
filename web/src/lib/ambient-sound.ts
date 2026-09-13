import { smooth } from './descent';

export class AmbientSound {
  private context: AudioContext;
  private gain: GainNode;
  private noise: GainNode;
  on = false;

  constructor() {
    this.context = new AudioContext();
    this.gain = this.context.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(this.context.destination);
    [55, 82.41, 110.1].forEach((frequency, i) => {
      const oscillator = this.context.createOscillator();
      oscillator.frequency.value = frequency;
      const volume = this.context.createGain(); volume.gain.value = i === 0 ? .17 : .06;
      oscillator.connect(volume).connect(this.gain); oscillator.start();
    });
    const buffer = this.context.createBuffer(1, this.context.sampleRate * 3, this.context.sampleRate);
    const values = buffer.getChannelData(0); let previous = 0;
    for (let i = 0; i < values.length; i++) { previous = (previous + (Math.random() * 2 - 1) * .02) / 1.02; values[i] = previous * 3.5; }
    const source = this.context.createBufferSource(); source.buffer = buffer; source.loop = true;
    this.noise = this.context.createGain(); this.noise.gain.value = .02;
    source.connect(this.noise).connect(this.gain); source.start();
  }
  async setEnabled(enabled: boolean) {
    if (enabled) await this.context.resume();
    this.on = enabled;
    this.gain.gain.setTargetAtTime(enabled ? .55 : 0, this.context.currentTime, .3);
  }
  update(progress: number) {
    if (this.on) this.noise.gain.setTargetAtTime(.025 + smooth(.3, .6, progress) * (1 - smooth(.7, .9, progress)) * .7, this.context.currentTime, .3);
  }
  visibility(hidden: boolean) { if (hidden) void this.context.suspend(); else if (this.on) void this.context.resume(); }
  dispose() { this.on = false; void this.context.close(); }
}
