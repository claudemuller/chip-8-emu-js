export default class Speaker {
	constructor() {
		const AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext;

		this.audioCtx = new AudioContext();
		this.muted = 0;

		// Create a gain to control the volume.
		this.gain = this.audioCtx.createGain();
		this.finish = this.audioCtx.destination;
		// Connect the gain to the audio context.
		this.gain.connect(this.finish);
	}

	mute() {
		// Toggle mute.
		this.gain.setValueAtTime(this.muted = 1 - this.muted, this.audioCtx.currentTime);
	}

	play(frequency) {
		if (this.audioCtx && !this.oscillator) {
			// Create an oscillator.
			this.oscillator = this.audioCtx.createOscillator();

			// Set the oscillator's frequency.
			this.oscillator.frequency.setValueAtTime(frequency || 440, this.audioCtx.currentTime);

			// Square wave.
			this.oscillator.type = 'square';

			// Connect the gain and start again.
			this.oscillator.connect(this.gain);
			this.oscillator.start();
		}
	}

	stop() {
		if (this.oscillator) {
			this.oscillator.stop();
			this.oscillator.disconnect();
			this.oscillator = null;
		}
	}
}