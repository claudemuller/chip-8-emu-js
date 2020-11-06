import Renderer from './renderer.js';
import Keyboard from './keyboard.js';
import Speaker from './speaker.js';
import CPU from './cpu.js';

const renderer = new Renderer(10),
	keyboard = new Keyboard(),
	speaker = new Speaker(),
	cpu = new CPU(renderer, keyboard, speaker);

let loop,
	fps = 60, // 60Hz (60x /sec) as per Chip-8 spec.
	fpsInterval,
	startTime,
	now,
	then,
	elapsed;

function init() {
	fpsInterval = 1000 / fps;
	then = Date.now();
	startTime = then;

	cpu.loadSpritesIntoMemory();
	cpu.loadRom('BLITZ');

	loop = requestAnimationFrame(step);
}

// Timestep.
function step() {
	now = Date.now();
	elapsed = now - then;

	if (elapsed > fpsInterval) cpu.cycle();

	loop = requestAnimationFrame(step);
}

init();