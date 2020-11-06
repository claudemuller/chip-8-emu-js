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
			// SE Vx, Vy - 5xy0
			case 0x5000:
				// Compares value in Vx and Vy and skips instruction if equal.
				if (this.v[x] === this.v[y]) this.pc += 2;
				break;
			// LD Vx, byte - 6xkk
			case 0x6000:
				// Load kk into Vx.
				this.v[x] = (opcode & 0xFF);
				break;
			// ADD Vx, byte - 7xkk
			case 0x7000:
				// Add kk to Vx.
				this.v[x] += (opcode & 0xFF);
				break;
				// Opcodes below, only the nibble changes hence nested switch to zoom in on nibble.
			case 0x8000:
				switch (opcode & 0xF) {
					// LD Vx, Vy - 8xy0
					case 0x0:
						// Load Vy into Vx.
						this.v[x] = this.v[y];
						break;
					// OR Vx, Vy - 8xy1
					case 0x1:
						// Set Vx to (Vx OR Vy).
						this.v[x] |= this.v[y];
						break;
					// AND Vx, Vy - 8xy2
					case 0x2:
						// Set Vx to (Vx AND Vy).
						this.v[x] &= this.v[y];
						break;
					// XOR Vx, Vy - 8xy3
					case 0x3:
						// Set Vx to (Vx XOR Vy).
						this.v[x] ^= this.v[y];
						break;
					// ADD Vx, Vy - 8xy4
					case 0x4:
						// Set Vx to (Vx + Vy).
						// Reference states - If the result is greater than 8 bits (i.e., > 255,) VF is set to 1,
						// otherwise 0. Only the lowest 8 bits of the result are kept, and stored in Vx.
						const sum = (this.v[x] += this.v[y]);
						// Set register VF = 0.
						this.v[0xF] = 0;
						// If sum greater than 255, set register VF = 1.
						if (sum > 0xFF) this.v[0xF] = 1;
						// Set Vx = the sum above. Because V register array is Uint8Array, any value over 8 bits
						// automatically has lower, rightmost 8 bits taken and stored.
						this.v[x] = sum;
						break;
					// SUB Vx, Vy - 8xy5
					case 0x5:
						// Subtracts Vy from Vx with overflow handling as above.
						this.v[0xF] = 0;
						if (this.v[x] > this.v[y]) this.v[0xF] = 1;
						this.v[x] -= this.v[y];
						break;
					// SHR Vx {, Vy} - 8xy6
					case 0x6:
						// Determines the least significant bit and set to VF.
						this.v[0xF] = (this.v[x] & 0x1);
						this.v[x] >>= 1;
						break;
					// SUBN Vx, Vy - 8xy7
					case 0x7:
						// Subtracts Vx from Vy, stores in Vx; if Vy > Vx, VF = 1, otherwise 0.
						this.v[0xF] = 0;
						if (this.v[y] > this.v[x]) this.v[0xF] = 1;
						this.v[x] = this.v[y] - this.v[x];
						break;
					// SHL Vx {, Vy} - 8xyE
					case 0xE:
						// Shifts Vx left 1 and sets VF to 0 or 1 depending on condition.
						// Get most significant bit of Vx and store in VF. AND Vx with binary 10000000/0x80 to get
						// most significant bit.
						this.v[0xF] = (this.v[x] & 0x80);
						// Multiply Vx by 2 by shifting left by 1.
						this.v[x] <<= 1;
						break;
				}
				break;

			// SNE Vx, Vy - 9xy0
			case 0x9000:
				// Increments PC by 2 if Vx and Vy are not equal.
				if (this.v[x] !== this.v[y]) this.pc += 2;
				break;
			// LD I, addr - Annn
			case 0xA000:
				// Set register I to nnn. e.g. 0xA740 & 0xFFF = 0x740.
				this.i = (opcode & 0xFFF);
				break;
			// JP V0, addr - Bnnn
			case 0xB000:
				// Set PC to nnn plus the value of register V0.
				this.pc = (opcode & 0xFFF) + this.v[0];
				break;
			// RND Vx, byte - Cxkk
			case 0xC000:
				// Generate a random number in range 0-255, then AND with lowest byte of opcode.
				const rand = Math.floor(Math.random() * 0xFF);
				this.v[x] = rand & (opcode & 0xFF);
				break;
			// DRW Vx, Vy, nibble - Dxyn
			case 0xD000:
				// Each pixel is 8 pixels wide.
				const width = 8;
				// Set to last nibble of opcode. e.g. opcode is 0xD235 -> height = 5.
				const height = (opcode & 0xF);
				// Set VF = 0.
				this.v[0xF] = 0;
				// Iterate over sprite rows.
				for (let row = 0; row < height; row++) {
					// Grab single row of sprite to iterate of its cols. Reference states, start at address in register I.
					let sprite = this.memory[this.i + row];
					// Iterate over sprite cols.
					for (let col = 0; col < width; col++) {
						// Check if bit is greater than 0 i.e. does not have a pixel at that location.
						if ((sprite & 0x80) > 0) {
							// Check return value of setPixel; if setPixel returns 1, erase pixel and set VF = 1;
							// if setPixel returns 0, don't do anything and keep VF = 0;
							// Then shift sprite left 1 bit to move through all bits.
							if (this.renderer.setPixel(this.v[x] + col, this.v[x] + row)) this.v[0xF] = 1;
						}
					}
					sprite <<= 1;
				}
				break;

			case 0xE000:
				switch (opcode & 0xFF) {
					// SKP Vx - Ex9E
					case 0x9E:
						// Skip next instruction if key stored in Vx is pressed by incrementing PC by 2.
						if (this.keyboard.isKeyPressed(this.v[x])) this.pc += 2;
						break;
						// SKNP Vx - ExA1
					case 0xA1:
						// Skip next instruction if key stored in Vx is NOT pressed by incrementing PC by 2.
						if (!this.keyboard.isKeyPressed(this.v[x])) this.pc += 2;
						break;
				}
				break;

			case 0xF000:
				switch (opcode & 0xFF) {
					// LD Vx, DT - Fx07
					case 0x07:
						// Sets value in Vx to value in delayTimer.
						this.v[x] = this.delayTimer;
						break;
					// LD Vx, K - Fx0A
					case 0x0A:
						// Pause the emulator until key pressed.
						this.paused = true;
						this.keyboard.onNextKeyPress = function onNextKeyPressed(key) {
							this.v[x] = key;
							this.paused = false;
						}.bind(this);
						break;
					// LD DT, Vx - Fx15
					case 0x15:
						// Sets value in delayTimer to value in Vx
						this.delayTimer = this.v[x];
						break;
					// LD ST, Vx - Fx18
					case 0x18:
						// Sets value in soundTimer to value in Vx
						this.soundTimer = this.v[x];
						break;
					// ADD I, Vx - Fx1E
					case 0x1E:
						// Add Vx to I.
						this.i += this.v[x];
						break;
					// LD F, Vx - ADD I, Vx - Fx29
					case 0x29:
						// Set register I to location of sprite at Vx; it's first multiplied by 5 as each sprite is
						// 5 bytes long.
						this.i = this.v[x] * 5;
						break;
					// LD B, Vx - Fx33
					case 0x33:
						// Get hundreds digit from Vx and store in I.
						this.memory[this.i] = parseInt(this.v[x] / 100);
						// Get tens digit from Vx and store in I+1. Get value between 0-99, divide by 10, gives
						// value between 0-9.
						this.memory[this.i + 1] = parseInt((this.v[x] % 100) / 10);
						// Get ones (last) digit from Vx and store in I+2.
						this.memory[this.i + 2] = parseInt(this.v[x] % 10);
						break;
					// LD [I], Vx - Fx55
					case 0x55:
						// Loop through registers V0-Vx and store values in memory starting at I.
						for (let registerIndex = 0; registerIndex <= x; registerIndex++) {
							this.memory[this.i + registerIndex] = this.v[registerIndex];
						}
						break;
					// LD Vx, [I] - Fx65
					case 0x65:
						// Reads values from memory starting at I and stores into registers V0-Vx.
						for (let registerIndex = 0; registerIndex <= x; registerIndex++) {
							this.v[registerIndex] = this.memory[this.i + registerIndex];
						}
						break;
				}
				break;

			default:
				throw new Error('Unknown opcode ' + opcode);
		}
	}
}