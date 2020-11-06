export default class Renderer {
	constructor(scale) {
		this.cols = 64;
		this.rows = 32;
		this.scale = scale;
		this.canvas = document.querySelector('canvas');
		this.ctx = this.canvas.getContext('2d');
		this.canvas.width = this.cols * this.scale;
		this.canvas.height = this.rows * this.scale;
		this.display = new Array(this.cols * this.rows);
	}

	setPixel(x, y) {
		// Wrap pixel if off screen to the left or right.
		if (x > this.cols) x -= this.cols;
		else if (x < 0) x += this.cols;

		// Wrap pixel if off screen to the top or bottom.
		if (y > this.rows) y -= this.rows;
		else if (y < 0) y += this.rows;

		// Calculate pixel location.
		let pixelLoc = x + (y * this.cols);

		// XOR pixel onto display.
		this.display[pixelLoc] ^= 1;

		// Return whether pixel was erased or not i.e. collision.
		return !this.display[pixelLoc];
	}

	clear() {
		this.display = new Array(this.cols * this.rows);
	}

	render() {
		// Clear the display every render cycle.
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// Loop through the display array.
		for (let i = 0; i < this.cols * this.rows; i++) {
			// Get the x position of pixel from the "i".
			const x = (i % this.cols) * this.scale;
			// Get the y position of pixel from the "i".
			const y = Math.floor(i / this.cols) * this.scale;

			// If the pixel in the display array is 1 then draw it.
			if (this.display[i]) {
				// Set draw colour to black.
				this.ctx.fillStyle = '#000';
				// Place the pixel at position (x, y) scaling the width and height.
				this.ctx.fillRect(x, y, this.scale, this.scale);
			}
		}
	}
}
