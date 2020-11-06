/*
	Chip Specifications:
	-------------------

	4KB/4096 bytes Memory
	16x 8-bit registers (V0-VF)
	16-bit register (I) to store memory addresses
	Program counter (PC) to store address currently being executed
	Stack represented by an array
	Delay timer
	Sound timer
*/

export default class CPU {
	constructor(renderer, keyboard, speaker) {
		this.renderer = renderer;
		this.keyboard = keyboard;
		this.speaker = speaker;

		// 4096 bytes of memory.
		this.memory = new Uint8Array(16);

		// 16 8-bit registers (V0-VF).
		this.v = new Uint8Array(16);

		// I register for storing memory addresses.
		this.i = 0;

		// Timers.
		this.delayTimer = 0;
		this.soundTimer = 0;

		// Program counter. 0x200 is where loaded program/rom instructions start, after the interpreter.
		this.pc = 0x200;

		// Stack (not initialised in order to avoid empty results).
		this.stack = new Array();

		// Emulator pause function.
		this.paused = false;

		// Emulator speed - higher value = more instructions executed every cycle.
		this.speed = 10;
	}

	loadSpritesIntoMemory() {
		// Array of hex values for the 16 5-byte sprites (0-F) - http://devernay.free.fr/hacks/chip8/C8TECH10.HTM#2.4
		const sprites = [
			0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
			0x20, 0x60, 0x20, 0x20, 0x70, // 1
			0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
			0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
			0x90, 0x90, 0xF0, 0x10, 0x10, // 4
			0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
			0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
			0xF0, 0x10, 0x20, 0x40, 0x40, // 7
			0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
			0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
			0xF0, 0x90, 0xF0, 0x90, 0x90, // A
			0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
			0xF0, 0x80, 0x80, 0x80, 0xF0, // C
			0xE0, 0x90, 0x90, 0x90, 0xE0, // D
			0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
			0xF0, 0x80, 0xF0, 0x80, 0x80  // F
		];

		// The sprites can be loaded into interpreter memory space (0x000 - 0x1FFF).
		for (let i = 0; i < sprites.length; i++) {
			this.memory[i] = sprites[i];
		}
	}

	loadProgramIntoMemory(program) {
		// Load the program/rom starting at 0x200.
		for (let loc = 0; loc < program.length; loc++) {
			this.memory[0x200 + loc] = program[loc];
		}
	}

	loadRom(romName) {
		const request = new XMLHttpRequest,
			self = this;

		// Handle response received from .send().
		request.onload = function onload() {
			// If the request response has content.
			if (request.response) {
				// Store the response contents in 8-bit array.
				const program = new Uint8Array(request.response);
				// Load the program/rom into memory.
				self.loadProgramIntoMemory(program);
			}
		}

		// Initialise GET request to fetch rom.
		request.open('GET', `roms/${romName}`);
		// Return response as arraybuffer.
		request.responseType = 'arraybuffer';

		// Send GET request.
		request.send();
	}

	cycle() {
		for (let i = 0; i < this.speed; i++) {
			// Execute instructions only when emulator is running.
			if (!this.paused) {
				// Instructions at http://devernay.free.fr/hacks/chip8/C8TECH10.HTM#3.1
				// Memory is made of 8-bit pieces, but instruction is 16-bits / 2 bytes longs.
				// Therefore opcode = two 8-bit halves of whole. Shift (this.pc) left by 8 bits
				// and OR the (this.pc + 1) segment into opcode.
				const opcode = (this.memory[this.pc] << 8 | this.memory[this.pc + 1]);
				this.executeInstruction(opcode);
			}
		}

		if (!this.paused) this.updateTimers();

		this.playSound();
		this.renderer.render();
	}

	updateTimers() {
		// Each timer is decremented by 1 at a rate of 60Hz (60x /sec).
		// delayTimer is used in two instructions, to set its value, to read said value and branch.
		if (this.delayTimer > 0) this.delayTimer -= 1;
		// soundTimer is used to control the length of the sound.
		if (this.soundTimer > 0) this.soundTimer -= 1;
	}

	playSound() {
		if (this.soundTimer > 0) this.speaker.play(40);
		else this.speaker.stop();
	}

	executeInstruction(opcode) {
		// 36 instructions at http://devernay.free.fr/hacks/chip8/C8TECH10.HTM#3.0
		// Because each instruction is 2 bytes long, increment PC by 2 to reach next instruction.
		this.pc += 2;

		// x value is 4 bits / half byte / nibble in size and located in lower 4 bits of high byte.
		// y value is 4 bits / half byte / nibble in size and located in upper 4 bits of low byte.
		// e.g. with address 0x5460
		//      high byte = 0x54 and lower 4 bits is 0x4 therefore x = 0x4
		//      low byte  = 0x60 and upper 4 bits is 0x6 therefore y = 0x6
		// below as e.g. with address 0x5460 -> 0x5460 &(AND) 0x0F00 = 0x0400 -> shift 8 bits right = 0x04/0x4
		const x = (opcode & 0x0F00) >> 8;
		// below as e.g. with address 0x5460 -> 0x5460 &(AND) 0x00F0 = 0x0060 -> shift 4 bits right = 0x006/0x6
		const y = (opcode & 0x00F0) >> 4;

		// Get upper 4 bits of most significant byte of opcode.
		switch (opcode & 0xF000) {
			case 0x0000:
				switch (opcode) {
					// SYS addr - 0nnn
					case 0x0000:
						break;
					// CLS - 00E0
					case 0x00E0:
						this.renderer.clear();
						break;
					// RET - 00EE
					case 0x00EE:
						// Pop last element in stack and store in PC, returning from subroutine.
						// Reference states opcode subtracts 1 from stack pointer, but here using stack array.
						this.pc = this.stack.pop();
						break;
				}
				break;

			// JP addr - 1nnn
			case 0x1000:
				// Get value of nnn and store in PC.
				this.pc = (opcode & 0xFFF);
				break;
			// CALL addr - 2nnn
			case 0x2000:
				// Push PC onto stack, calling subroutine.
				// Reference states opcode increments stack pointer to point at PC, but here using stack array.
				this.stack.push(this.pc)
				this.pc = (opcode & 0xFFF);
				break;
			// SE Vx, byte - 3xkk
			case 0x3000:
				// Compares value in x register (Vx) to value in kk. If equal, increment PC thereby skipping
				// next instruction. 0xFF gets the last last byte of opcode (the kk portion).
				if (this.v[x] === (opcode & 0xFF)) this.pc += 2;
				break;
			// SNE Vx, byte - 4xkk
			case 0x4000:
				// Same as above except skips next instruction if NOT equal.
				if (this.v[x] !== (opcode & 0xFF)) this.pc += 2;
				break;
			case 0x5000:
				break;
			case 0x6000:
				break;
			case 0x7000:
				break;
			case 0x8000:
				switch (opcode & 0xF) {
					case 0x0:
						break;
					case 0x1:
						break;
					case 0x2:
						break;
					case 0x3:
						break;
					case 0x4:
						break;
					case 0x5:
						break;
					case 0x6:
						break;
					case 0x7:
						break;
					case 0xE:
						break;
				}
				break;

			case 0x9000:
				break;
			case 0xA000:
				break;
			case 0xB000:
				break;
			case 0xC000:
				break;
			case 0xD000:
				break;
			case 0xE000:
				switch (opcode & 0xFF) {
					case 0x9E:
						break;
					case 0xA1:
						break;
				}
				break;

			case 0xF000:
				switch (opcode & 0xFF) {
					case 0x07:
						break;
					case 0x0A:
						break;
					case 0x15:
						break;
					case 0x18:
						break;
					case 0x1E:
						break;
					case 0x29:
						break;
					case 0x33:
						break;
					case 0x55:
						break;
					case 0x65:
						break;
				}
				break;

			default:
				throw new Error('Unknown opcode ' + opcode);
		}
	}
}